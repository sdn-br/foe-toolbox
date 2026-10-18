/*
 * **************************************************************************************
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * You may use, distribute and modify this code under the
 * terms of the AGPL license.
 *
 * See file LICENSE.md or go to
 * https://github.com/mainIine/foe-helfer-extension/blob/master/LICENSE.md
 * for full license details.
 *
 * **************************************************************************************
 */

// FoE Toolbox: a note per player inside other boxes (first the sabotage box).
// The note is a player page in the notes module (Notes.Store), so it is the same note in
// both places. Any player group counts, new pages go to a group of the type 'neighbor', which
// the toolbox shows as "players" for any player, independent of the neighborhood (players are
// neighbors for two weeks at most). Players are matched by id, not by name.

let PlayerNote = {

	/**
	 * Filter of the players group in the notes box, not stored
	 */
	filter: 'all',

	/**
	 * State of the player picker ("+ player" in the notes)
	 */
	picker: { own: [], players: [], text: '', el: null },

	// more rows make the list slow with a year of known players, the search narrows it down
	PickerLimit: 50,

	// what a player is right now: flag in PlayerDict, icon, i18n key
	Relations: [['neighbor', 'IsNeighbor', '⚔', 'Neighbor'], ['guild', 'IsGuildMember', '🛡', 'GuildMember'], ['friend', 'IsFriend', '🤝', 'Friend']],

	/**
	 * Player page of the first player group (any type) that belongs to the player
	 *
	 * @param playerId
	 * @returns {Promise<{id: number, content: string}|null>}
	 */
	get: async (playerId) => {
		if (Notes.Store.db === null || !playerId) {
			return null;
		}

		const item = (await PlayerNote.playerPages()).find(i => PlayerNote.playerIdOf(i) === Number(playerId));

		return item ? { id: item.id, content: item.content || '' } : null;
	},


	/**
	 * All pages of the player groups in the order get looks for a player's page
	 *
	 * @returns {Promise<Object[]>}
	 */
	playerPages: async () => {
		const db = Notes.Store.db,
			groupIds = (await db.groups.toArray())
				.filter(g => g.player_group)
				.sort((a, b) => (a.sort - b.sort) || (a.id - b.id))
				.map(g => g.id);

		if (groupIds.length === 0) {
			return [];
		}

		return (await db.items.where('groupId').anyOf(groupIds).toArray())
			.sort((a, b) => (groupIds.indexOf(a.groupId) - groupIds.indexOf(b.groupId)) || (a.sort - b.sort));
	},


	/**
	 * Note text per player id, for readers that cannot wait for the db (the PvP arena table)
	 * and for the note icons in the PvP attacks. Filled by loadTexts, which save calls again.
	 */
	texts: new Map(),


	/**
	 * @returns {Promise<Map<number, string>>} see texts
	 */
	loadTexts: async () => {
		const texts = new Map();

		if (Notes.Store.db !== null) {
			for (const item of await PlayerNote.playerPages()) {
				const id = PlayerNote.playerIdOf(item);
				if (id !== undefined && !texts.has(id) && !PlayerNote.isEmpty(item.content)) {
					texts.set(id, PlayerNote.toText(item.content));
				}
			}
		}

		return PlayerNote.texts = texts;
	},


	/**
	 * Plain text of a note, its lines kept
	 *
	 * @param content HTML of the editable field
	 * @returns {string}
	 */
	toText: (content) => {
		const html = (content || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p)>/gi, '\n');
		return new DOMParser().parseFromString(html, 'text/html').body.textContent.replace(/\u00a0/g, ' ').trim();
	},


	/**
	 * After every change of the notes: reloads texts, then the event 'toolbox#playerNotesChanged',
	 * on which each box with player notes updates itself (notes box, sabotage, PvP attacks, PvP arena)
	 *
	 * @param source 'notes' for a change in the notes box, which then does not draw itself again
	 */
	notesChanged: async (source = 'player-note') => {
		await PlayerNote.loadTexts();
		window.dispatchEvent(new CustomEvent('toolbox#playerNotesChanged', { detail: { source: source } }));
	},


	/**
	 * Opens the player's page in the notes box
	 *
	 * @param playerId
	 */
	openInNotes: async (playerId) => {
		Notes.notes = await Notes.Store.read();

		const grpIdx = Notes.notes.findIndex(g => g.player_group && g.items.some(i => PlayerNote.playerIdOf(i) === playerId));
		if (grpIdx < 0) {
			return;
		}

		Notes.ActiveTab = grpIdx + 1;
		Notes.ActiveSubTab = Notes.notes[grpIdx].items.findIndex(i => PlayerNote.playerIdOf(i) === playerId) + 1;
		PlayerNote.filter = 'all';
		Notes.buildBox();
	},


	/**
	 * One-time take-over of the notes of the Helfer's PvP arena (localStorage PvPArenaNotes-<world>)
	 * into player pages, a text not in the page yet is appended. The arena notes stay untouched.
	 */
	migrateArenaNotes: async () => {
		const key = `PvPArenaNotes-${ExtWorld}`,
			done = `ToolboxPvPArenaNotesTaken-${ExtWorld}`;

		if (localStorage.getItem(done) || !localStorage.getItem(key) || Notes.Store.db === null) {
			return;
		}

		try {
			for (const [id, text] of Object.entries(JSON.parse(localStorage.getItem(key)))) {
				const playerId = Number(id),
					line = String(text).trim(),
					note = await PlayerNote.get(playerId);

				if (!line || (note && PlayerNote.toText(note.content).includes(line))) {
					continue;
				}

				await MainParser.loadPlayerIntoDict(playerId); // name of a new page
				await PlayerNote.save(playerId, (note && !PlayerNote.isEmpty(note.content) ? note.content + '<br>' : '') + HTML.escapeHtml(line));
			}

			localStorage.setItem(done, '1');
		} catch (e) {
			console.error('PlayerNote: taking over the PvP arena notes failed', e);
		}
	},


	/**
	 * Saves the note. Without a page the player is added to the first 'neighbor' group,
	 * without such a group one is created. An empty note creates nothing and deletes an
	 * existing page, the group stays.
	 *
	 * @param playerId
	 * @param content HTML of the editable field
	 * @returns {Promise<{id: number, content: string}|null>} null when there is no page (anymore)
	 */
	save: async (playerId, content) => {
		const db = Notes.Store.db;

		if (db === null) {
			throw new Error('Notes DB not ready');
		}

		let note = await PlayerNote.get(playerId);

		if (!note) {
			if (PlayerNote.isEmpty(content)) {
				return null;
			}

			await db.transaction('rw', db.groups, db.items, async () => {
				let group = (await db.groups.toArray())
					.filter(g => g.player_group === 'neighbor')
					.sort((a, b) => (a.sort - b.sort) || (a.id - b.id))[0];

				if (!group) {
					const last = await db.groups.orderBy('sort').last(),
						groupId = await db.groups.add({
							group_name: i18n('Boxes.Notes.SelectPlayerGroupNeighbor'),
							player_group: 'neighbor',
							sort: last ? last.sort + 1 : 1
						});
					group = { id: groupId };
				}

				const player = PlayerDict[playerId] || { PlayerID: playerId },
					id = await db.items.add({
						groupId: group.id,
						tab: player.PlayerName || String(playerId),
						title: '',
						content: content,
						player_data: JSON.stringify(player),
						sort: (await db.items.where('groupId').equals(group.id).count()) + 1
					});

				note = { id: id, content: content };
			});
		}
		else if (PlayerNote.isEmpty(content)) {
			await db.items.delete(note.id);
			note = null;
		}
		else {
			await db.items.update(note.id, { content: content });
			note.content = content;
		}

		await PlayerNote.notesChanged();

		return note;
	},


	/**
	 * Card with an editable note, saved when the field loses the focus
	 *
	 * @param playerId
	 * @param note result of get
	 * @returns {TemplateResult}
	 */
	view: (playerId, note) => {
		const { html } = litHtml,
			content = note ? note.content : '';

		const save = async (e) => {
			// typing and deleting leaves a <br>, which would also hide the placeholder
			if (PlayerNote.isEmpty(e.target.innerHTML)) {
				e.target.innerHTML = '';
			}

			const value = e.target.innerHTML;

			// an emptied field deletes the page, also one that was saved empty before
			if (note ? (value === content && value !== '') : value === '') {
				return;
			}

			try {
				await PlayerNote.save(playerId, value);
			} catch (err) {
				console.error(err);
				HTML.ShowToastMsg({
					head: i18n('Boxes.Notes.Title'),
					text: err && err.message ? err.message : String(err),
					type: 'error',
					hideAfter: 10000,
				});
			}
		};

		// .innerHTML is only written when the stored content changes, so typing is never overwritten
		return html`
			<div class="toolbox-card player-note">
				<h4>${i18n('Boxes.PlayerNote.Title')}</h4>
				<div class="player-note-text" contenteditable="true" spellcheck="false"
					data-placeholder="${i18n('Boxes.PlayerNote.Placeholder')}"
					.innerHTML=${content}
					@blur=${save}></div>
			</div>`;
	},


	playerIdOf: (item) => {
		try {
			return item.player_data ? Number(JSON.parse(item.player_data).PlayerID) : undefined;
		} catch (e) {
			return undefined;
		}
	},


	/**
	 * Icons for what the player is right now (neighbor, guild member, friend), from the
	 * player lists of the current game session. Not stored, so always up to date.
	 *
	 * @param playerId
	 * @param withText adds the meaning next to each icon (page header), otherwise only a tooltip
	 * @returns {string} HTML, empty for unknown players and pages without a player
	 */
	relationIcons: (playerId, withText = false) => {
		const p = PlayerDict[playerId];

		if (!p) {
			return '';
		}

		return PlayerNote.Relations
			.filter(([, flag]) => p[flag] === true)
			.map(([, , icon, key]) => {
				const text = i18n('Boxes.PlayerNote.' + key);
				// with the text next to it the icon needs no tooltip
				return withText ? `<span class="player-relation">${icon} ${text}</span>` : `<span class="player-relation fh-tooltip" ${ToolboxTT.attrs(text)}>${icon}</span>`;
			})
			.join('');
	},


	/**
	 * Filter bar above the player pages: all, one relation, or none of them ("others")
	 *
	 * @returns {string} HTML
	 */
	filterBar: () => {
		const chip = (value, text) => `<span class="player-filter-chip${PlayerNote.filter === value ? ' active' : ''}" data-filter="${value}">${text}</span>`;

		// a nav, not a div: Tabslet treats every direct div of the sub tabs as a page
		return `<nav class="player-filter">`
			+ chip('all', i18n('Boxes.PlayerNote.FilterAll'))
			+ PlayerNote.Relations.map(([value, , icon, key]) => chip(value, `${icon} ${i18n('Boxes.PlayerNote.Filter' + key)}`)).join('')
			+ chip('other', i18n('Boxes.PlayerNote.FilterOther'))
			+ `<span class="player-filter-empty">${i18n('Boxes.PlayerNote.FilterEmpty')}</span>`
			+ `</nav>`;
	},


	/**
	 * Delegated on the box body, so it also works in the pop-out
	 */
	bindFilter: () => {
		$('#toolboxNotesBody').on('click', '.player-filter-chip', function () {
			PlayerNote.filter = $(this).data('filter');
			PlayerNote.applyFilter();
			PlayerNote.renderPicker();
		});
	},


	/**
	 * Hides the player pages outside the filter. The relations are read at the moment of the
	 * click, so the filter always matches the current game session.
	 */
	applyFilter: () => {
		const matches = (playerId) => PlayerNote.matchesFilter(playerId, PlayerNote.filter);

		$('#toolboxNotesBody .player-filter').each(function () {
			const bar = $(this),
				tabs = bar.closest('.tabs-sub'),
				items = tabs.find('ul.vertical > li');

			bar.find('.player-filter-chip').each(function () {
				$(this).toggleClass('active', $(this).data('filter') === PlayerNote.filter);
			});

			items.each(function () {
				$(this).toggleClass('player-hidden', !matches(Number($(this).data('player'))));
			});

			const visible = items.not('.player-hidden');

			tabs.toggleClass('player-filter-none', visible.length === 0);
			bar.find('.player-filter-empty').toggle(items.length > 0 && visible.length === 0);

			// the open page must be one of the visible ones
			if (visible.length > 0 && visible.filter('.active').length === 0) {
				visible.first().find('a').trigger('click');
			}
		});
	},


	/**
	 * Player search of the players group, opened by "+ player". Not modal: a list over the open
	 * page, wider than the page list, closed by a click outside or Escape. On top the players of
	 * this group (a click opens the page), below every other player the toolbox knows (a click
	 * adds a page): the current session (PlayerDict) and the local players table (former
	 * neighbors, arena opponents, visited cities). Only local data, nothing is requested from the game.
	 *
	 * @param row the "+ player" row of the group
	 */
	showPicker: async (row) => {
		const tabs = row.closest('.tabs-sub');

		if (tabs.children('.player-picker').length > 0) {
			return;
		}

		// below the filter bar, which stays usable and also filters the search
		const bar = tabs.children('.player-filter'),
			top = bar.length > 0 ? bar.position().top + bar.outerHeight(true) : row.position().top;

		// an aside, not a div: Tabslet treats every direct div of the sub tabs as a page
		const el = $('<aside class="player-picker" />').css('top', top).insertAfter(row)[0],
			groupId = Number(row.data('group')),
			byId = new Map(),
			group = (Notes.notes || []).find(n => n.id === groupId);

		Notes.ActualGrp = groupId;
		PlayerNote.picker = { own: [], players: [], text: '', el: el };
		PlayerNote.renderPicker();
		$(el).find('.player-picker-search').trigger('focus');

		$(el.ownerDocument).off('mousedown.playerpicker').on('mousedown.playerpicker', (e) => {
			// the filter of the group also filters the search
			if ($(e.target).closest('.player-picker, .player-filter').length === 0) {
				PlayerNote.closePicker();
			}
		});

		try {
			await IndexDB.getDB();
			for (const p of await IndexDB.db.players.toArray()) {
				byId.set(Number(p.id), { id: Number(p.id), name: p.name, avatar: p.avatar, clanName: p.clanName });
			}
		} catch (e) {
			console.error(e);
		}

		// the session knows the newest names, avatars and guilds
		for (const p of Object.values(PlayerDict)) {
			byId.set(Number(p.PlayerID), { id: Number(p.PlayerID), name: p.PlayerName, avatar: p.Avatar, clanName: p.ClanName });
		}

		const own = (group ? group.items : []).map(item => {
			const id = PlayerNote.playerIdOf(item);
			return { ...(byId.get(id) || {}), id: id, name: item.tab };
		}).filter(p => p.id !== undefined);

		byId.delete(Number(ExtPlayerID));
		own.forEach(p => byId.delete(p.id));

		const byName = (a, b) => a.name.localeCompare(b.name);

		Object.assign(PlayerNote.picker, {
			own: own.sort(byName),
			players: [...byId.values()].filter(p => p.name).sort(byName),
		});
		PlayerNote.renderPicker();
	},


	closePicker: () => {
		const el = PlayerNote.picker.el;

		if (el) {
			$(el.ownerDocument).off('mousedown.playerpicker');
			$(el).remove();
			PlayerNote.picker.el = null;
		}
	},


	renderPicker: () => {
		const el = PlayerNote.picker.el;

		if (el && el.isConnected) {
			litHtml.render(PlayerNote.pickerView(PlayerNote.picker), el);
		}
	},


	/**
	 * @param picker state, see PlayerNote.picker
	 * @returns {TemplateResult}
	 */
	pickerView: (picker) => {
		const { html, unsafeHTML } = litHtml,
			query = picker.text.trim().toLowerCase(),
			fits = (p) => PlayerNote.matchesFilter(p.id, PlayerNote.filter) && (query === '' || p.name.toLowerCase().includes(query)),
			own = picker.own.filter(fits),
			others = picker.players.filter(fits),
			shown = others.slice(0, PlayerNote.PickerLimit),
			// Enter takes the first row
			first = own[0] || shown[0];

		const open = (id) => {
			const tabs = $(picker.el).closest('.tabs-sub');
			PlayerNote.closePicker();
			tabs.find(`ul.vertical > li[data-player="${id}"] a`).trigger('click');
		};

		const add = async (id) => {
			PlayerNote.closePicker();
			// players from the db only are not in the session yet, SavePlayerToGroup reads PlayerDict
			await MainParser.loadPlayerIntoDict(id);
			if (PlayerDict[id]) {
				Notes.SavePlayerToGroup(id);
			}
		};

		const pick = (p) => (own.includes(p) ? open(p.id) : add(p.id));

		const row = (p) => html`
			<li class=${p === first ? 'first' : ''} @click=${() => pick(p)}>
				<span class="avatar" style="background-image:url('${srcLinks.GetPortrait(p.avatar)}')"></span>
				<span class="player-picker-name">${p.name}${p.clanName ? html`<small>${p.clanName}</small>` : ''}</span>
				<span class="player-picker-icons">${unsafeHTML(PlayerNote.relationIcons(p.id))}</span>
				${own.includes(p) ? '' : html`<span class="player-picker-add">+</span>`}
			</li>`;

		return html`
			<input type="text" class="player-picker-search" placeholder="${i18n('Boxes.PlayerNote.Search')}" .value=${picker.text}
				@input=${(e) => { picker.text = e.target.value; PlayerNote.renderPicker(); }}
				@keydown=${(e) => {
					if (e.key === 'Escape') {
						e.stopPropagation();
						PlayerNote.closePicker();
					} else if (e.key === 'Enter' && first) {
						pick(first);
					}
				}}>
			<ul class="player-picker-list">
				${own.map(row)}
				${own.length > 0 && shown.length > 0 ? html`<li class="player-picker-sep"></li>` : ''}
				${shown.map(row)}
			</ul>
			${own.length + others.length === 0 ? html`<p class="player-picker-hint">${i18n('Boxes.PlayerNote.FilterEmpty')}</p>` : ''}
			${others.length > shown.length ? html`<p class="player-picker-hint">${HTML.i18nReplacer(i18n('Boxes.PlayerNote.MorePlayers'), { count: others.length - shown.length })}</p>` : ''}`;
	},


	/**
	 * Whether the player is what the filter asks for, read from the current session
	 *
	 * @param playerId
	 * @param filter 'all', 'neighbor', 'guild', 'friend' or 'other' (none of them)
	 * @returns {boolean}
	 */
	matchesFilter: (playerId, filter) => {
		if (filter === 'all') {
			return true;
		}

		const p = PlayerDict[playerId] || {},
			relations = PlayerNote.Relations.filter(([, flag]) => p[flag] === true).map(([value]) => value);

		return filter === 'other' ? relations.length === 0 : relations.includes(filter);
	},


	isEmpty: (content) => !content || content.replace(/<br\s*\/?>|&nbsp;|\s/g, '') === '',

};


// PvP arena of the Helfer: its note column shows and edits the player page of the notes instead of
// its own notes in localStorage (taken over once by PlayerNote.migrateArenaNotes). The field has one
// line, a note with several lines is read only there and a click opens it in the notes.
{
	const calcBody = PvPArena.CalcBody,
		refreshTable = PvPArena.RefreshTable,
		calcTable = PvPArena.CalcTable;

	PvPArena.GetNotes = () => Object.fromEntries(PlayerNote.texts);

	// the table reads the notes synchronously, so they are loaded before
	PvPArena.CalcBody = async () => {
		await PlayerNote.loadTexts();
		calcBody();
	};

	PvPArena.RefreshTable = async () => {
		await PlayerNote.loadTexts();
		refreshTable();
	};

	PvPArena.CalcTable = () => {
		const table = $('<div />').html(calcTable());

		table.find('input.player-note').each(function () {
			const text = PlayerNote.texts.get(Number($(this).data('id'))) || '';

			if (text.includes('\n')) {
				$(this).attr({ readonly: 'readonly', value: text.split('\n')[0] + ' …', title: text }).addClass('player-note-multi');
			}
		});

		return table.html();
	};

	PvPArena.SaveNote = async (playerId, text) => {
		text = text.trim();

		try {
			await MainParser.loadPlayerIntoDict(playerId); // name of a new page
			await PlayerNote.save(playerId, HTML.escapeHtml(text));
		} catch (e) {
			console.error(e);
			HTML.ShowToastMsg({
				head: i18n('Boxes.Notes.Title'),
				text: e && e.message ? e.message : String(e),
				type: 'error',
				hideAfter: 10000,
			});
		}

		$(`#PvPArenaBody .player-note[data-id="${playerId}"]`).val(text).attr('title', text);
	};

	window.addEventListener('toolbox#playerNotesChanged', () => {
		if ($('#PvPArena').length > 0) {
			refreshTable();
		}
	});

	$(document).on('click', '#PvPArenaBody .player-note-multi', function () {
		PlayerNote.openInNotes(Number($(this).data('id')));
	});
}
