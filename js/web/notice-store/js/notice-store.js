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
// Notice.Store.send answers the former "Notice/*" endpoints with the response shape the
// callbacks in notice.js expect, so notice.js stays close to upstream for later merges.
// The only remaining network use is the manual import from the FoE Helfer server.

Notice.Store = {

	db: null,

	/**
	 * @param playerID
	 * @returns {Promise<void>}
	 */
	checkForDB: async (playerID) => {
		const DBName = `FoEToolbox2DB_Notice_${playerID}`;

		Notice.Store.db = new Dexie(DBName);

		Notice.Store.db.version(1).stores({
			groups: '++id,sort',
			items: '++id,groupId,sort'
		});

		try {
			await Notice.Store.db.open();
		} catch (e) {
			console.error(e);
		}
	},


	/**
	 * Local replacement for MainParser.send2Server(data, 'Notice/...', callback)
	 *
	 * @param data
	 * @param ep 'Notice/get' | 'Notice/set' | 'Notice/sort' | 'Notice/del'
	 * @param callback
	 */
	send: (data, ep, callback) => {
		Notice.Store.handle(data, ep)
			.then(resp => callback(resp))
			.catch(e => {
				console.error(e);
				callback({status: 'ERROR', msg: e && e.message ? e.message : String(e)});
			});
	},


	handle: async (data, ep) => {
		const db = Notice.Store.db;

		if (db === null) {
			throw new Error('Notice DB not ready');
		}

		switch (ep) {
			case 'Notice/get':
				await Notice.Store.mergePlayerGroups();
				break;

			case 'Notice/set':
				// content changes: the callback only checks the status and updates its own cache
				if (data.type === 'cnt') {
					await Notice.Store.setContent(data);
					return {status: 'OK'};
				}
				await db.transaction('rw', db.groups, db.items, () => Notice.Store.set(data));
				break;

			case 'Notice/sort':
				await db.transaction('rw', db.groups, db.items, () => {
					const table = data.type === 'grp' ? db.groups : db.items,
						list = (data.type === 'grp' ? data.grps : data.itms) || [];

					return Promise.all(list.map(e => table.update(Number(e.id), {sort: Number(e.sort)})));
				});
				break;

			case 'Notice/del':
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

		return {status: 'OK', notice: await Notice.Store.read()};
	},


	/**
	 * New or renamed group or item. Ids come from the DOM, partly as strings.
	 */
	set: async (data) => {
		const db = Notice.Store.db,
			isNew = (data.id === 'new'),
			sort = Number(data.sort);

		if (data.type === 'grp') {
			if (isNew) {
				// an empty sort field means "append", which is also what SaveModal assumes when it
				// selects the last tab; Number('') would be 0 and put the group first
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
		const changes = {content: data.cont};

		// player pages have no editable heading
		if (data.head !== undefined) {
			changes.title = data.head;
		}

		await Notice.Store.db.items.update(Number(data.id), changes);
	},


	/**
	 * The "notice" array of the former API: groups with their items, both sorted
	 *
	 * @returns {Promise<Array|null>} null without groups, then notice.js shows the "create a group first" hint
	 */
	read: async () => {
		const db = Notice.Store.db,
			bySort = (a, b) => (a.sort - b.sort) || (a.id - b.id),
			groups = (await db.groups.toArray()).sort(bySort),
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
		const db = Notice.Store.db,
			groups = db ? await db.groups.count() : 0,
			items = db ? await db.items.count() : 0;

		HTML.Box({
			id: 'notices-modal',
			title: i18n('Boxes.Notice.Import'),
			auto_close: true,
		});

		$('body').prepend( $('<div class="foe-helper-overlay" />') );

		$('#notices-modalBody').append(
			$('<p />').addClass('notice-import-text').text(HTML.i18nReplacer(i18n('Boxes.Notice.ImportConfirm'), {groups, items})),
			$('<span />').attr({role: 'button', class: 'btn'}).text(i18n('Boxes.Notice.ImportStart')).on('click', Notice.Store.Import),
			$('<span />').attr({role: 'button', class: 'btn'}).text(i18n('General.Cancel')).on('click', Notice.Store.CloseModal)
		);
	},


	CloseModal: () => {
		$('#notices-modal').fadeToggle('fast', function(){
			$(this).remove();

			$('.foe-helper-overlay').remove();
		});
	},


	/**
	 * Replaces the local notes by the notes stored on the FoE Helfer server
	 */
	Import: () => {
		const apiToken = localStorage.getItem('ApiToken');

		$('#notices-modalBody .btn').remove();

		if (!apiToken) {
			Notice.Store.ImportFailed(i18n('Boxes.Notice.ImportNotPossible'));
			return;
		}

		MainParser.send2Server({apiToken: apiToken}, 'Notice/get', async (resp) => {
			if (resp['status'] === 'ERROR') {
				Notice.Store.ImportFailed(resp['msg']);
			}
			// status OK without notes = blocked on the API, the local notes stay untouched
			else if (resp['notice'] === undefined) {
				$('#notices-modalBody').html( $('<div />').addClass('notice-import-text').html(i18n('Boxes.Notice.BannedFromApi')) );
			}
			// nothing stored on the server: an empty answer must not wipe the local notes
			else if (!resp['notice'] || Object.keys(resp['notice']).length === 0) {
				$('#notices-modalBody').html( $('<p />').addClass('notice-import-text').text(i18n('Boxes.Notice.ImportEmpty')) );
			}
			else {
				try {
					await Notice.Store.replaceAll(resp['notice']);
					Notice.notes = await Notice.Store.read();
				} catch (e) {
					console.error(e);
					Notice.Store.ImportFailed(e && e.message ? e.message : String(e));
					return;
				}

				Notice.ActiveTab = 1;
				Notice.ActiveSubTab = 1;
				Notice.EditMode = false;

				Notice.Store.CloseModal();
				Notice.buildBox();

				HTML.ShowToastMsg({
					head: i18n('Boxes.Notice.Title'),
					text: i18n('Boxes.Notice.ImportSuccess'),
					type: 'success',
					hideAfter: 5000,
					show: true,
				});
			}
		}, (msg) => Notice.Store.ImportFailed(msg), true);
	},


	ImportFailed: (msg) => {
		Notice.Store.CloseModal();

		HTML.ShowToastMsg({
			head: i18n('Boxes.Notice.ImportError'),
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
		const db = Notice.Store.db,
			groups = notice ? Object.values(notice) : [];

		if (db === null) {
			throw new Error('Notice DB not ready');
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

			await Notice.Store.mergePlayerGroups();
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
		const db = Notice.Store.db,
			bySort = (a, b) => (a.sort - b.sort) || (a.id - b.id);

		await db.transaction('rw', db.groups, db.items, async () => {
			const groups = (await db.groups.toArray()).filter(g => g.player_group).sort(bySort);

			if (groups.length === 0) {
				const last = await db.groups.orderBy('sort').last();
				await db.groups.add({
					group_name: i18n('Boxes.Notice.SelectPlayerGroupNeighbor'),
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
				.text(i18n('Boxes.Notice.Import'))
				.on('click', Notice.Store.ShowImportModal)
		)
	);
}
