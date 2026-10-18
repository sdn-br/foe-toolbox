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
// The note is a player page in the notes module (Notice.Store), so it is the same note in
// both places. Any player group counts, new pages go to a group of the toolbox type 'player'
// that does not depend on the neighborhood. Players are matched by id, not by name.

let PlayerNote = {

	/**
	 * Player page of the first player group (any type) that belongs to the player
	 *
	 * @param playerId
	 * @returns {Promise<{id: number, content: string}|null>}
	 */
	get: async (playerId) => {
		const db = Notice.Store.db;

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
	 * Saves the note. Without a page the player is added to the first 'player' group,
	 * without such a group one is created. An empty note creates nothing and deletes an
	 * existing page, the group stays.
	 *
	 * @param playerId
	 * @param content HTML of the editable field
	 * @returns {Promise<{id: number, content: string}|null>} null when there is no page (anymore)
	 */
	save: async (playerId, content) => {
		const db = Notice.Store.db;

		if (db === null) {
			throw new Error('Notice DB not ready');
		}

		let note = await PlayerNote.get(playerId);

		if (!note) {
			if (PlayerNote.isEmpty(content)) {
				return null;
			}

			await db.transaction('rw', db.groups, db.items, async () => {
				let group = (await db.groups.toArray())
					.filter(g => g.player_group === 'player')
					.sort((a, b) => (a.sort - b.sort) || (a.id - b.id))[0];

				if (!group) {
					const last = await db.groups.orderBy('sort').last(),
						groupId = await db.groups.add({
							group_name: i18n('Boxes.Notice.SelectPlayerGroupPlayer'),
							player_group: 'player',
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
					head: i18n('Boxes.Notice.Title'),
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

		return [['IsNeighbor', '⚔', 'Neighbor'], ['IsGuildMember', '🛡', 'GuildMember'], ['IsFriend', '🤝', 'Friend']]
			.filter(([flag]) => p[flag] === true)
			.map(([, icon, key]) => {
				const text = i18n('Boxes.PlayerNote.' + key);
				return `<span class="player-relation" title="${text}">${icon}${withText ? ' ' + text : ''}</span>`;
			})
			.join('');
	},


	isEmpty: (content) => !content || content.replace(/<br\s*\/?>|&nbsp;|\s/g, '') === '',


	/**
	 * Shows the new state in an open notes box
	 */
	refreshNoticeBox: async () => {
		Notice.notes = await Notice.Store.read();

		if ($('#notices').length > 0) {
			Notice.prepareContent();
		}
	},
};
