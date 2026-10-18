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

// FoE Toolbox: the notes live in a local IndexedDB instead of the foe-rechner.de API.
// Notes.Store.send answers the former API endpoints ("Notice/*" there, "Notes/*" here) with
// the response shape the callbacks in toolbox-notes.js (a copy of the Helfer notice.js) expect.
// The only remaining network use is the manual import from the FoE Helfer server.

Notes.Store = {

	db: null,

	/**
	 * @param playerID
	 * @returns {Promise<void>}
	 */
	checkForDB: async (playerID) => {
		const DBName = `FoEToolbox2DB_Notice_${playerID}`;

		Notes.Store.db = new Dexie(DBName);

		Notes.Store.db.version(1).stores({
			groups: '++id,sort',
			items: '++id,groupId,sort'
		});

		try {
			await Notes.Store.db.open();
		} catch (e) {
			console.error(e);
		}
	},


	/**
	 * Local replacement for MainParser.send2Server(data, 'Notes/...', callback)
	 *
	 * @param data
	 * @param ep 'Notes/get' | 'Notes/set' | 'Notes/sort' | 'Notes/del'
	 * @param callback
	 */
	send: (data, ep, callback) => {
		Notes.Store.handle(data, ep)
			.then(resp => callback(resp))
			.catch(e => {
				console.error(e);
				callback({status: 'ERROR', msg: e && e.message ? e.message : String(e)});
			});
	},


	handle: async (data, ep) => {
		const db = Notes.Store.db;

		if (db === null) {
			throw new Error('Notes DB not ready');
		}

		switch (ep) {
			case 'Notes/get':
				await Notes.Store.mergePlayerGroups();
				await Notes.Store.migrateTitles();
				break;

			case 'Notes/set':
				// content changes: the callback only checks the status and updates its own cache
				if (data.type === 'cnt') {
					await Notes.Store.setContent(data);
					return {status: 'OK'};
				}
				await db.transaction('rw', db.groups, db.items, () => Notes.Store.set(data));
				break;

			case 'Notes/sort':
				await db.transaction('rw', db.groups, db.items, () => {
					const table = data.type === 'grp' ? db.groups : db.items,
						list = (data.type === 'grp' ? data.grps : data.itms) || [];

					return Promise.all(list.map(e => table.update(Number(e.id), {sort: Number(e.sort)})));
				});
				break;

			case 'Notes/del':
				await db.transaction('rw', db.groups, db.items, async () => {
					const id = Number(data.id);

					if (data.type === 'grp') {
						await db.items.where('groupId').equals(id).delete();
						await db.groups.delete(id);
					} else {
						await db.items.delete(id);
					}
				});
				break;

			default:
				throw new Error('Unknown endpoint ' + ep);
		}

		return {status: 'OK', notice: await Notes.Store.read()};
	},


	/**
	 * New or renamed group or item. Ids come from the DOM, partly as strings.
	 */
	set: async (data) => {
		const db = Notes.Store.db,
			isNew = (data.id === 'new'),
			sort = Number(data.sort);

		if (data.type === 'grp') {
			if (isNew) {
				// without a sort value a new group is appended (Number('') would be 0 and put it first)
				const last = await db.groups.orderBy('sort').last();
				await db.groups.add({
					group_name: data.name || '',
					player_group: data.player_group || null,
					sort: (data.sort !== '' && Number.isFinite(sort)) ? sort : (last ? last.sort + 1 : 1)
				});
			}
			else if (data.name) {
				await db.groups.update(Number(data.id), {group_name: data.name});
			}
			return;
		}

		if (isNew) {
			const groupId = Number(data.grp);

			if (!await db.groups.get(groupId)) {
				throw new Error('Unknown group ' + data.grp);
			}

			// player pages are sent without a sort value, they are appended
			await db.items.add({
				groupId: groupId,
				tab: data.name || '',
				title: '',
				content: '',
				player_data: data.player || null,
				sort: Number.isFinite(sort) ? sort : (await db.items.where('groupId').equals(groupId).count()) + 1
			});
		}
		else if (data.name) {
			await db.items.update(Number(data.id), {tab: data.name});
		}
	},


	setContent: async (data) => {
		await Notes.Store.db.items.update(Number(data.id), {content: data.cont});
	},


	/**
	 * The "notice" array of the former API: groups with their items, both sorted
	 *
	 * @returns {Promise<Array|null>} null without groups, then notice.js shows the "create a group first" hint
	 */
	read: async () => {
		const db = Notes.Store.db,
			bySort = (a, b) => (a.sort - b.sort) || (a.id - b.id),
			// the players group always comes first, only the own groups are sorted
			groups = (await db.groups.toArray()).sort((a, b) => (!!b.player_group - !!a.player_group) || bySort(a, b)),
			items = (await db.items.toArray()).sort(bySort);

		if (groups.length === 0) {
			return null;
		}

		return groups.map(g => ({
			id: g.id,
			group_name: g.group_name,
			player_group: g.player_group,
			sort: g.sort,
			items: items.filter(i => i.groupId === g.id).map(i => ({
				id: i.id,
				tab: i.tab,
				title: i.title,
				content: i.content,
				player_data: i.player_data,
				sort: i.sort
			}))
		}));
	},


	/**
	 * Confirmation in the same modal as group and item editing
	 */
	ShowImportModal: async () => {
		const db = Notes.Store.db,
			groups = db ? await db.groups.count() : 0,
			items = db ? await db.items.count() : 0;

		HTML.Box({
			id: 'toolboxNotes-modal',
			title: i18n('Boxes.Notes.Import'),
			auto_close: true,
		});

		$('body').prepend( $('<div class="foe-helper-overlay" />') );

		$('#toolboxNotes-modalBody').append(
			$('<p />').addClass('notice-import-text').text(HTML.i18nReplacer(i18n('Boxes.Notes.ImportConfirm'), {groups, items})),
			$('<span />').attr({role: 'button', class: 'btn'}).text(i18n('Boxes.Notes.ImportStart')).on('click', Notes.Store.Import),
			$('<span />').attr({role: 'button', class: 'btn'}).text(i18n('General.Cancel')).on('click', Notes.Store.CloseModal)
		);
	},


	CloseModal: () => {
		$('#toolboxNotes-modal').fadeToggle('fast', function(){
			$(this).remove();

			$('.foe-helper-overlay').remove();
		});
	},


	/**
	 * Replaces the local notes by the notes stored on the FoE Helfer server
	 */
	Import: () => {
		const apiToken = localStorage.getItem('ApiToken');

		$('#toolboxNotes-modalBody .btn').remove();

		if (!apiToken) {
			Notes.Store.ImportFailed(i18n('Boxes.Notes.ImportNotPossible'));
			return;
		}

		// endpoint name of the FoE Helfer API
		MainParser.send2Server({apiToken: apiToken}, 'Notice/get', async (resp) => {
			if (resp['status'] === 'ERROR') {
				Notes.Store.ImportFailed(resp['msg']);
			}
			// status OK without notes = blocked on the API, the local notes stay untouched
			else if (resp['notice'] === undefined) {
				$('#toolboxNotes-modalBody').html( $('<div />').addClass('notice-import-text').html(i18n('Boxes.Notes.BannedFromApi')) );
			}
			// nothing stored on the server: an empty answer must not wipe the local notes
			else if (!resp['notice'] || Object.keys(resp['notice']).length === 0) {
				$('#toolboxNotes-modalBody').html( $('<p />').addClass('notice-import-text').text(i18n('Boxes.Notes.ImportEmpty')) );
			}
			else {
				try {
					await Notes.Store.replaceAll(resp['notice']);
					Notes.notes = await Notes.Store.read();
				} catch (e) {
					console.error(e);
					Notes.Store.ImportFailed(e && e.message ? e.message : String(e));
					return;
				}

				Notes.ActiveTab = 1;
				Notes.ActiveSubTab = 1;
				Notes.EditMode = false;

				Notes.Store.CloseModal();
				Notes.buildBox();

				HTML.ShowToastMsg({
					head: i18n('Boxes.Notes.Title'),
					text: i18n('Boxes.Notes.ImportSuccess'),
					type: 'success',
					hideAfter: 5000,
					show: true,
				});
			}
		}, (msg) => Notes.Store.ImportFailed(msg), true);
	},


	ImportFailed: (msg) => {
		Notes.Store.CloseModal();

		HTML.ShowToastMsg({
			head: i18n('Boxes.Notes.ImportError'),
			text: msg || '',
			type: 'error',
			hideAfter: 10000,
			show: true,
		});
	},


	/**
	 * Server notes into the local schema, all or nothing. Server ids are uuids, the
	 * local DB assigns its own ids and keeps the server order as sort value.
	 *
	 * @param notice groups as sent by the API (array or object)
	 */
	replaceAll: async (notice) => {
		const db = Notes.Store.db,
			groups = notice ? Object.values(notice) : [];

		if (db === null) {
			throw new Error('Notes DB not ready');
		}

		await db.transaction('rw', db.groups, db.items, async () => {
			await db.items.clear();
			await db.groups.clear();

			for (let g = 0; g < groups.length; g++) {
				const grp = groups[g],
					items = grp['items'] ? Object.values(grp['items']) : [];

				const groupId = await db.groups.add({
					group_name: grp['group_name'] || '',
					player_group: grp['player_group'] || null,
					sort: g
				});

				for (let i = 0; i < items.length; i++) {
					const itm = items[i];

					await db.items.add({
						groupId: groupId,
						tab: itm['tab'] || '',
						title: itm['title'] || '',
						content: itm['content'] || '',
						player_data: itm['player_data'] || null,
						sort: i
					});
				}
			}

			await Notes.Store.mergePlayerGroups();
			await Notes.Store.migrateTitles();
		});
	},


	/**
	 * One name per page: the heading shows the page name. A former own heading (FoE Helfer
	 * import, older versions) that differs from the name and is not the placeholder moves once
	 * into the text as a bold first line, so nothing is lost. Player pages never had one.
	 */
	migrateTitles: async () => {
		const db = Notes.Store.db,
			items = (await db.items.toArray()).filter(i => i.title);

		if (items.length === 0) {
			return;
		}

		await db.transaction('rw', db.items, async () => {
			for (const item of items) {
				const text = $('<div />').html(item.title).text().trim(),
					keep = !item.player_data && text !== '' && text !== item.tab && text !== i18n('Boxes.Notes.DummyHeading');

				await db.items.update(item.id, {
					title: '',
					content: keep ? `<b>${item.title}</b><br>${item.content || ''}` : item.content
				});
			}
		});
	},


	/**
	 * The toolbox has exactly one player group, shown as "players" (type 'neighbor', see
	 * player-note.js). Whether a player is a neighbor, guild member or friend changes, so the
	 * notes filter by the current state instead of sorting players into groups.
	 *
	 * Creates the group if it is missing. Further player groups (FoE Helfer import, older
	 * versions) are merged into the first one: pages move over, several pages of one player
	 * become one page with the texts one below the other. Nothing is lost but the grouping.
	 */
	mergePlayerGroups: async () => {
		const db = Notes.Store.db,
			bySort = (a, b) => (a.sort - b.sort) || (a.id - b.id);

		await db.transaction('rw', db.groups, db.items, async () => {
			const groups = (await db.groups.toArray()).filter(g => g.player_group).sort(bySort);

			if (groups.length === 0) {
				const last = await db.groups.orderBy('sort').last();
				await db.groups.add({
					group_name: i18n('Boxes.Notes.SelectPlayerGroupNeighbor'),
					player_group: 'neighbor',
					sort: last ? last.sort + 1 : 1
				});
				return;
			}

			const target = groups[0],
				groupIds = groups.map(g => g.id),
				items = (await db.items.where('groupId').anyOf(groupIds).toArray())
					.sort((a, b) => (groupIds.indexOf(a.groupId) - groupIds.indexOf(b.groupId)) || bySort(a, b)),
				byPlayer = new Map();

			if (groups.length === 1 && target.player_group === 'neighbor' && new Set(items.map(PlayerNote.playerIdOf)).size === items.length) {
				return;
			}

			let sort = 1;

			for (const item of items) {
				const playerId = PlayerNote.playerIdOf(item),
					keep = (playerId !== undefined ? byPlayer.get(playerId) : undefined);

				if (keep) {
					if (!PlayerNote.isEmpty(item.content)) {
						keep.content = PlayerNote.isEmpty(keep.content) ? item.content : keep.content + '<br><br>' + item.content;
						await db.items.update(keep.id, {content: keep.content});
					}
					await db.items.delete(item.id);
					continue;
				}

				if (playerId !== undefined) {
					byPlayer.set(playerId, item);
				}
				await db.items.update(item.id, {groupId: target.id, sort: sort++});
			}

			if (target.player_group !== 'neighbor') {
				await db.groups.update(target.id, {player_group: 'neighbor'});
			}
			await db.groups.bulkDelete(groupIds.slice(1));
		});
	},
};


// Import button in the settings below the API token (tab "Info + Website"): the import is a
// one-time step that needs this token, and in the notes box it collided with the edit buttons.
{
	const apiTokenInput = Settings.ApiTokenInput;

	Settings.ApiTokenInput = () => $('<div />').append(
		apiTokenInput(),
		$('<p />').append(
			$('<span />')
				.attr({role: 'button', class: 'btn notice-import-btn'})
				.text(i18n('Boxes.Notes.Import'))
				.on('click', Notes.Store.ShowImportModal)
		)
	);
}
