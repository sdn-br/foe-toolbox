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
	picker: { players: [], text: '', filter: 'all' },

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
		const db = Notes.Store.db;

		if (db === null || !playerId) {
			return null;
		}

		const groupIds = (await db.groups.toArray())
			.filter(g => g.player_group)
			.sort((a, b) => (a.sort - b.sort) || (a.id - b.id))
			.map(g => g.id);

		if (groupIds.length === 0) {
			return null;
		}

		const items = await db.items.where('groupId').anyOf(groupIds).toArray(),
			item = items
				.filter(i => PlayerNote.playerIdOf(i) === Number(playerId))
				.sort((a, b) => (groupIds.indexOf(a.groupId) - groupIds.indexOf(b.groupId)) || (a.sort - b.sort))[0];

		return item ? { id: item.id, content: item.content || '' } : null;
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

		await PlayerNote.refreshNoticeBox();

		return note;
	},


	/**
	 * Card with an editable note, saved when the field loses the focus
	 *
	 * @param playerId
	 * @param note result of get
	 * @param onSaved called with the saved note, e.g. to render the box again
	 * @returns {TemplateResult}
	 */
	view: (playerId, note, onSaved) => {
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
				const saved = await PlayerNote.save(playerId, value);
				if (onSaved) onSaved(saved);
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
				return `<span class="player-relation" title="${text}">${icon}${withText ? ' ' + text : ''}</span>`;
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
	 * Player picker of the players group: every player the toolbox knows, the current
	 * session (PlayerDict) and the local players table (former neighbors, arena opponents,
	 * visited cities). Only local data, nothing is requested from the game.
	 *
	 * @param groupId players group the chosen player is added to
	 */
	showPicker: async (groupId) => {
		Notes.ActualGrp = groupId;

		HTML.Box({
			id: 'toolboxNotes-modal-players',
			title: i18n('Boxes.Notes.ModalChoosePlayer'),
			auto_close: true,
			dragdrop: true
		});

		$('body').prepend( $('<div class="foe-helper-overlay" />') );

		const byId = new Map(),
			group = (Notes.notes || []).find(n => n.id === groupId),
			taken = new Set((group ? group.items : []).map(PlayerNote.playerIdOf));

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

		byId.delete(Number(ExtPlayerID));
		taken.forEach(id => byId.delete(id));

		PlayerNote.picker = {
			players: [...byId.values()].filter(p => p.name).sort((a, b) => a.name.localeCompare(b.name)),
			text: '',
			filter: PlayerNote.filter,
		};

		PlayerNote.renderPicker();
		$('#toolboxNotes-modal-playersBody .player-picker-search').trigger('focus');
	},


	renderPicker: () => {
		const body = $('#toolboxNotes-modal-playersBody')[0];

		if (body) {
			litHtml.render(PlayerNote.pickerView(PlayerNote.picker), body);
		}
	},


	/**
	 * @param picker state, see PlayerNote.picker
	 * @returns {TemplateResult}
	 */
	pickerView: (picker) => {
		const { html, unsafeHTML } = litHtml,
			query = picker.text.trim().toLowerCase(),
			matches = picker.players.filter(p => PlayerNote.matchesFilter(p.id, picker.filter) && (query === '' || p.name.toLowerCase().includes(query))),
			shown = matches.slice(0, PlayerNote.PickerLimit),
			update = (change) => {
				Object.assign(PlayerNote.picker, change);
				PlayerNote.renderPicker();
			};

		const choose = async (id) => {
			// players from the db only are not in the session yet, SavePlayerToGroup reads PlayerDict
			await MainParser.loadPlayerIntoDict(id);
			if (PlayerDict[id]) {
				Notes.SavePlayerToGroup(id);
			}
		};

		const chips = [['all', i18n('Boxes.PlayerNote.FilterAll')]]
			.concat(PlayerNote.Relations.map(([value, , icon, key]) => [value, `${icon} ${i18n('Boxes.PlayerNote.Filter' + key)}`]))
			.concat([['other', i18n('Boxes.PlayerNote.FilterOther')]]);

		return html`
			<div class="player-picker">
				<input type="text" class="player-picker-search" placeholder="${i18n('Boxes.PlayerNote.Search')}" .value=${picker.text}
					@input=${(e) => update({ text: e.target.value })}
					@keydown=${(e) => { if (e.key === 'Enter' && matches.length === 1) choose(matches[0].id); }}>
				<nav class="player-filter">
					${chips.map(([value, text]) => html`<span class="player-filter-chip ${picker.filter === value ? 'active' : ''}" @click=${() => update({ filter: value })}>${text}</span>`)}
				</nav>
				<ul class="player-picker-list">
					${shown.map(p => html`
						<li @click=${() => choose(p.id)}>
							<span class="avatar" style="background-image:url('${srcLinks.GetPortrait(p.avatar)}')"></span>
							<span class="player-picker-name">${p.name}${p.clanName ? html`<small>${p.clanName}</small>` : ''}</span>
							<span class="player-picker-icons">${unsafeHTML(PlayerNote.relationIcons(p.id))}</span>
						</li>`)}
				</ul>
				${matches.length === 0 ? html`<p class="player-picker-hint">${i18n('Boxes.PlayerNote.FilterEmpty')}</p>` : ''}
				${matches.length > shown.length ? html`<p class="player-picker-hint">${HTML.i18nReplacer(i18n('Boxes.PlayerNote.MorePlayers'), { count: matches.length - shown.length })}</p>` : ''}
			</div>`;
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


	/**
	 * Shows the new state in an open notes box
	 */
	refreshNoticeBox: async () => {
		Notes.notes = await Notes.Store.read();

		if ($('#toolboxNotes').length > 0) {
			Notes.prepareContent();
		}
	},
};
