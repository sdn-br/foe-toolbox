/*
 * **************************************************************************************
 *
 * Dateiname:                 looting.js (Original Dateiname: plunderer.js)
 * Projekt:                   foe-chrome
 *
 * erstellt von:              Daniel Siekiera <daniel.siekiera@gmail.com>
 * erstellt am:	              07.04.20, 21:58 Uhr
 *
 * Copyright © 2020
 *
 * FoE Toolbox: PvP history (neighbourhood and PvP arena battles, plunder, city shields),
 * ported onto FoE Helfer 4.8.3.0. Stored in the IndexDB table "neighborhoodAttacks".
 * Not related to the upstream module "pvparena" (arena log with ranking points).
 *
 * **************************************************************************************
 */

// Detect shield
FoEproxy.addHandler('OtherPlayerService', 'getCityProtections', (data, postData) => {
	// Defer handling city protection to the next tick, to ensure PlayerDict is filled
	setTimeout(async () => {
		const r = data.responseData;
		if (!Array.isArray(r)) return;

		const shielded = r.filter(it => it.expireTime > 0); // -1 for users that cannot be attacked, ignore them

		await IndexDB.getDB();

		for (const shieldInfo of shielded) {
			const playerId = shieldInfo.playerId;
			const lastShieldAction = await IndexDB.db.neighborhoodAttacks.where({ playerId: playerId }).and(it => it.type === Looting.ACTION_TYPE_SHIELDED).last();

			// actual shield info already stored
			if (lastShieldAction && new Date(lastShieldAction.expireTime * 1000) >= new Date()) continue;

			await IndexDB.db.neighborhoodAttacks.add({
				type: Looting.ACTION_TYPE_SHIELDED,
				playerId: playerId,
				date: new Date(),
				expireTime: shieldInfo.expireTime,
			});
			await IndexDB.addUserFromPlayerDictIfNotExists(playerId);
		}
	}, 1);
});


FoEproxy.addHandler('BattlefieldService', 'all', async (data, postData, responseData) => {
	const isAutoBattle = data.responseData?.isAutoBattle; // isAutoBattle is part of BattleRealm only
	const state = data.responseData?.__class__ === 'BattleRealm' ? data.responseData.state : data.responseData;

	if (state?.__class__ !== 'BattleRealmState') return;

	const { winnerBit, surrenderBit, unitsOrder, ranking_data, round } = state;
	const era = ranking_data?.ranking?.[0]?.era || 'unknown';
	const actionType =
		winnerBit === 1 ? Looting.ACTION_TYPE_BATTLE_WIN :
			winnerBit === 2 ? Looting.ACTION_TYPE_BATTLE_LOSS :
				surrenderBit === 1 ? Looting.ACTION_TYPE_BATTLE_SURRENDERED : null;

	if (!actionType || !Array.isArray(unitsOrder)) return;

	const myUnits = unitsOrder.filter(it => it.teamFlag === 1).map(Looting.adaptUnit(true));
	const otherUnits = unitsOrder.filter(it => it.teamFlag === 2).map(Looting.adaptUnit(false));
	const requests = (Array.isArray(responseData) ? responseData : []);
	const isPvpArena = requests.some(e => e.requestClass === 'PVPArenaService');
	let defenderPlayerId = data.responseData.defenderPlayerId || otherUnits[0]?.ownerId || 0;

	if (defenderPlayerId <= 0) {
		const logEntry = requests.find(e => e.requestClass === 'PVPArenaService' && e.requestMethod === 'addLog');
		if (logEntry?.responseData?.otherPlayer?.player?.player_id) {
			defenderPlayerId = logEntry.responseData.otherPlayer.player.player_id;
		}
	}

	// defenderPlayerId = -1 if PVE
	if (defenderPlayerId <= 0) return;

	// Avoid adding defend battles (when viewing recorded defend battles)
	if (defenderPlayerId === ExtPlayerID) return;

	await IndexDB.getDB();

	// Ensure the player exists in the db
	await IndexDB.addUserFromPlayerDictIfNotExists(defenderPlayerId);

	await IndexDB.db.neighborhoodAttacks.add({
		playerId: defenderPlayerId,
		date: new Date(),
		type: actionType,
		pvpArena: isPvpArena,
		battle: {
			myArmy: myUnits,
			otherArmy: otherUnits,
			round,
			auto: !!isAutoBattle,
			era,
		}
	});

	Looting.UpdateBoxIfVisible();
});


FoEproxy.addHandler('OtherPlayerService', 'plunderById', async (data, postData) => {
	if (!Array.isArray(postData) || !data.responseData) return;

	const request = postData.find(r => r.requestClass === 'OtherPlayerService' && r.requestMethod === 'plunderById') || postData[0];
	if (!request?.requestData) return;

	const playerId = request.requestData[0];
	const entityId = request.requestData[1];
	const lastVisitedPlayer = Looting.lastVisitedPlayer;

	if (!lastVisitedPlayer || playerId !== lastVisitedPlayer.other_player.player_id) return;

	const entity = lastVisitedPlayer.city_map.entities.find(e => entityId === e.id);
	if (!entity) return;

	if (data.responseData.result === 'repelled') {
		await IndexDB.getDB();

		await IndexDB.db.neighborhoodAttacks.add({
			type: Looting.ACTION_TYPE_REPELLED,
			playerId: playerId,
			entityId: entity.id,
			buildId: entity.cityentity_id,
			date: new Date()
		});

		Looting.UpdateBoxIfVisible();
	}
});


FoEproxy.addHandler('CityMapService', 'reset', async (data, postData) => {
	const r = data.responseData;
	if (!Array.isArray(r)) return;

	for (const it of r) {
		if (it?.state?.__class__ !== 'LootedState' && it?.state?.__class__ !== 'PlunderedState') continue;

		// Find the city entity in the last visited player, the reset itself carries no production
		const lastVisitedPlayer = Looting.lastVisitedPlayer;
		if (!lastVisitedPlayer || it.player_id !== lastVisitedPlayer.other_player.player_id) continue;

		const entity = lastVisitedPlayer.city_map.entities.find(e => it.id === e.id);
		const resources = Looting.getProductionResources(entity);
		if (!resources) continue;

		const isImportant = Object.keys(resources).some(k => !Looting.UnimportantProds.includes(k));

		await Looting.upsertLootAction({
			playerId: it.player_id,
			date: new Date(),
			type: Looting.ACTION_TYPE_LOOTED,
			resources,
			sp: resources.strategy_points || 0,
			important: isImportant,
			entityId: entity.id,
			buildId: entity.cityentity_id,
		});
	}
});


// Handle double loot bonus (Atlantis Museum). Usually this event comes before CityMapService/reset
FoEproxy.addHandler('CityMapService', 'showEntityIcons', async (data, postData) => {
	// "responseData": [ { "id": 2440, "type": "citymap_icon_plunder_and_pillage", "__class__": "CityEntityIcon" } ]
	const r = data.responseData;
	if (!Array.isArray(r) || !Looting.lastVisitedPlayer) return;

	// only one loot id is in this event
	const doubleLootCityId = r.filter(it => it.type === 'citymap_icon_plunder_and_pillage').map(it => it.id)[0];
	if (!doubleLootCityId) return;

	await Looting.upsertLootAction({
		entityId: doubleLootCityId,
		playerId: Looting.lastVisitedPlayer.other_player.player_id,
		doubleLoot: true,
	});
});


FoEproxy.addHandler('OtherPlayerService', 'visitPlayer', (data, postData) => {
	const playerData = data.responseData;
	if (!playerData?.other_player) return;

	Looting.lastVisitedPlayer = playerData;
	Looting.page = 1;
	Looting.filterByPlayerId = playerData.other_player.player_id;
	Looting.filterByPvPArena = false;

	MainParser.UpdatePlayerDict(playerData, 'VisitPlayer').then(() => {
		Looting.UpdateBoxIfVisible();
	});
});


// PvP arena opened
FoEproxy.addHandler('PVPArenaService', 'getOverview', (data, postData) => {
	Looting.setPvPArenaOpponents(data.responseData?.opponents);
});

FoEproxy.addHandler('PVPArenaService', 'updateOpponents', (data, postData) => {
	Looting.setPvPArenaOpponents(data.responseData);
});


let Looting = {

	// Filter and pagination
	page: 1,
	perPage: 20,
	filterByPlayerId: null,
	filterByPvPArena: false,
	loading: false,

	// Cached last visited player for getting info about the city before looting.
	// The loot event has no info about the city entity, just the collected resources
	lastVisitedPlayer: null,
	// Cached last known opponents of the PvP arena
	lastPvPArenaOpponents: [],

	// Enum for action type
	ACTION_TYPE_LOOTED: 1,
	ACTION_TYPE_BATTLE_WIN: 2,
	ACTION_TYPE_BATTLE_LOSS: 3,
	ACTION_TYPE_BATTLE_SURRENDERED: 4,
	ACTION_TYPE_SHIELDED: 5,
	ACTION_TYPE_REPELLED: 6,

	UnimportantProds: ['supplies', 'money'],


	/**
	 * Maps a battle unit to the stored format
	 *
	 * @param isAttacking
	 * @returns {function(*): {startHP, endHp, attBoost, defBoost, unitTypeId, ownerId}}
	 */
	adaptUnit: (isAttacking) => {
		return (unit) => {
			const bonuses = Unit.GetBoostSums(Unit.GetBoostDict(unit.bonuses || []));
			const attBoost = isAttacking ? bonuses.AttackAttackBoost : bonuses.DefenseAttackBoost;
			const defBoost = isAttacking ? bonuses.AttackDefenseBoost : bonuses.DefenseDefenseBoost;

			return {
				startHP: unit.startHitpoints,
				endHp: unit.currentHitpoints || 0,
				attBoost: attBoost || 0,
				defBoost: defBoost || 0,
				unitTypeId: unit.unitTypeId,
				ownerId: unit.ownerId,
			};
		};
	},


	/**
	 * Player resources a city entity is producing: classic buildings (`current_product`)
	 * and generic buildings (`productionOption`)
	 *
	 * @param entity raw city map entity of the visited player
	 * @returns {Object|undefined} resource id => amount
	 */
	getProductionResources: (entity) => {
		const state = entity?.state;
		if (!state) return;

		if (state.current_product?.product?.resources) {
			return Object.assign({}, state.current_product.product.resources);
		}

		const products = state.productionOption?.products;
		if (Array.isArray(products)) {
			let resources = {};
			for (const product of products) {
				if (product.type !== 'resources' || !product.playerResources?.resources) continue;

				for (const [k, v] of Object.entries(product.playerResources.resources)) {
					resources[k] = (resources[k] || 0) + v;
				}
			}
			if (Object.keys(resources).length > 0) return resources;
		}
	},


	setPvPArenaOpponents: (opponents) => {
		Looting.lastPvPArenaOpponents = [];
		if (!Array.isArray(opponents)) return;

		for (const opponent of opponents) {
			const id = opponent?.opposingPlayer?.player?.player_id;
			if (id !== undefined) Looting.lastPvPArenaOpponents.push(id);
		}
		Looting.filterByPvPArena = true;
		Looting.filterByPlayerId = null;
		Looting.UpdateBoxIfVisible();
	},


	/**
	 * Create or update a loot action, also apply double loot
	 *
	 * @param payload
	 * @returns {Promise<void>}
	 */
	upsertLootAction: async (payload) => {
		const { entityId, playerId } = payload;
		if (!entityId || !playerId) return;

		await IndexDB.getDB();

		await IndexDB.db.transaction('rw', IndexDB.db.neighborhoodAttacks, async () => {
			// last loot action of this building in the last 10 minutes
			const lastLootAction = await IndexDB.db.neighborhoodAttacks.where({ playerId })
				.filter(it => (it.type === Looting.ACTION_TYPE_LOOTED &&
					it.entityId === entityId &&
					it.date > (+new Date() - 60 * 10 * 1000)))
				.last();

			// Add missing fields to the payload
			payload = {
				resources: {},
				sp: 0,
				type: Looting.ACTION_TYPE_LOOTED,
				...lastLootAction,
				...payload,
				date: new Date(),
			};

			if (lastLootAction && payload.doubleLoot && !payload.doubleLootApplied) {
				payload.sp = payload.sp * 2;
				payload.doubleLoot = true;
				payload.doubleLootApplied = true;
				Object.keys(payload.resources).forEach(key => payload.resources[key] = payload.resources[key] * 2);
			}

			if (lastLootAction) {
				await IndexDB.db.neighborhoodAttacks.put(payload);
			}
			else {
				await IndexDB.db.neighborhoodAttacks.add(payload);
			}
		});

		Looting.UpdateBoxIfVisible();
	},


	/**
	 * Refresh the box
	 */
	UpdateBoxIfVisible: () => {
		if ($('#looting').length !== 0) {
			Looting.Show();
		}
	},


	/**
	 * Create html for DOM and inject
	 */
	Show: () => {
		if ($('#looting').length === 0) {
			HTML.Box({
				id: 'looting',
				title: i18n('Boxes.Looting.Title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				popout: () => MainParser.PopOut('looting')
			});

			HTML.AddCssFile('looting');
			HTML.AddCssFile('unit');
			Unit.PrepareCoords();

			const box = $('#looting');
			box[0].style.setProperty('--unit_scale', '5/5');

			let reload = (fn) => function () {
				if (Looting.loading) return;
				fn.call(this);
				Looting.Show();
				$('#lootingBody').animate({ scrollTop: 0 }, 'fast');
			};

			box.on('click', '#lootingBody .load-1st-page', reload(function () {
				Looting.page = 1;
			}));
			box.on('click', '#lootingBody .load-next-page', reload(function () {
				Looting.page++;
			}));
			box.on('click', '#lootingBody .select-player', reload(function () {
				const id = $(this).data('value');
				Looting.page = 1;
				Looting.filterByPlayerId = id ? +id : null;
				Looting.filterByPvPArena = false;
			}));
			box.on('click', '#lootingBody .select-pvp-arena-opponents', reload(function () {
				Looting.page = 1;
				Looting.filterByPlayerId = null;
				Looting.filterByPvPArena = true;
			}));
		}

		Looting.Render();
	},


	/**
	 * Base selection of the current filter
	 *
	 * @returns {Dexie.Collection}
	 */
	select: (filterByPlayerId, filterByPvPArena) => {
		const table = IndexDB.db.neighborhoodAttacks;
		if (filterByPlayerId) return table.where('playerId').equals(filterByPlayerId);
		if (filterByPvPArena) return table.where('playerId').anyOf(Looting.lastPvPArenaOpponents).filter(action => !!action.pvpArena);
		return table.orderBy('date');
	},


	/**
	 * Get all the content
	 *
	 * @returns {Promise<void>}
	 */
	Render: async () => {
		const { page, perPage, filterByPlayerId, filterByPvPArena } = Looting;
		Looting.loading = true;

		try {
			await IndexDB.getDB();

			const offset = (page - 1) * perPage;

			let actions = await Looting.select(filterByPlayerId, filterByPvPArena)
				.reverse()
				.offset(offset)
				.limit(perPage)
				.sortBy('date');

			const pages = Math.max(1, Math.ceil((await Looting.select(filterByPlayerId, filterByPvPArena).count()) / perPage));

			// enrich actions with player info
			for (const action of actions) {
				await MainParser.loadPlayerIntoDict(action.playerId);
			}
			if (filterByPlayerId) await MainParser.loadPlayerIntoDict(filterByPlayerId);

			actions = actions.map(it => {
				const player = PlayerDict[it.playerId];
				const playerInfo = player ? ({
					playerId: player.PlayerID || 0,
					playerName: player.PlayerName || 'unknown',
					clanId: player.ClanId || 0,
					clanName: player.ClanName || 'unknown',
					avatar: player.Avatar,
					playerEra: player.Era || 'unknown',
					playerDate: null,
				}) : ({
					playerId: 0,
					playerName: 'unknown',
					clanId: 0,
					clanName: 'unknown',
					avatar: null,
					playerEra: 'unknown',
					playerDate: null,
				});
				return {
					...it,
					...playerInfo,
				};
			});

			let playerName = '',
				clanName = '',
				clanId = 0;

			if (filterByPlayerId) {
				const p = PlayerDict[filterByPlayerId];
				playerName = p?.PlayerName || i18n('Boxes.Looting.Unknown');
				clanName = p?.ClanName || '';
				clanId = p?.ClanId || 0;
			}

			const noArena = (Looting.lastPvPArenaOpponents.length === 0);

			$('#lootingBody').html(`
				<div class="dark-bg" style="padding:5px 0 3px;">
					<div class="header">
						<div class="strategy-points"></div>
						<div class="filter">
							<div class="filterd-by"><b>${i18n('Boxes.Looting.filteredByUser')}:</b><br>
								<span class="player-name">
									${filterByPlayerId ?
										`${MainParser.GetPlayerLink(filterByPlayerId, playerName)} ${clanName ? ` [${MainParser.GetGuildLink(clanId, clanName)}]` : ''}` :
										filterByPvPArena ?
											`${i18n('Boxes.Looting.CurrentPvPArenaOpponents')}` :
											`${i18n('Boxes.Looting.AllPlayers')}`
									}
								</span>
							</div>
							<div class="filter-buttons">
								<div><button${noArena ? ' disabled' : ''} class="btn select-pvp-arena-opponents${filterByPvPArena ? ' btn-active' : ''}" data-value="" title="${noArena ? HTML.i18nTooltip(i18n('Boxes.Looting.PvPArenaOpponentsInactive')) : ''}">${i18n('Boxes.Looting.showPvPArenaOpponents')}</button></div>
								<div><button class="btn select-player${!filterByPvPArena && filterByPlayerId === null ? ' btn-active' : ''}" data-value="">${i18n('Boxes.Looting.showAllPlayers')}</button></div>
							</div>
						</div>
					</div>
				</div>
				${Looting.RenderActions(actions)}
				<div class="pagination">
					${page > 1 && pages > 1 ? `<button class="btn load-1st-page">${i18n('Boxes.Looting.goto1stPage')}</button>` : ''}
					${i18n('Boxes.Looting.Page')} ${page}/${pages}
					${pages > page ? `<button class="btn load-next-page">${i18n('Boxes.Looting.nextPage')}</button>` : ''}
				</div>`);

			await Looting.calculateSP(filterByPlayerId, filterByPvPArena);
		}
		catch (e) {
			console.error('Looting: render failed', e);
		}
		finally {
			Looting.loading = false;
		}
	},


	/**
	 * Sum up the plundered forge points (today, last 7 days, total)
	 *
	 * @param filterByPlayerId
	 * @param filterByPvPArena
	 * @returns {Promise<void>}
	 */
	calculateSP: async (filterByPlayerId, filterByPvPArena) => {
		const dateThisWeek = moment().subtract(1, 'weeks').toDate();
		const dateToday = moment().startOf('day').toDate();

		let todaySP = 0,
			todaySPNoDouble = 0,
			thisWeekSP = 0,
			thisWeekSPNoDouble = 0,
			totalSP = 0,
			totalSPNoDouble = 0;

		const totalSPSelect = (filterByPlayerId ?
			IndexDB.db.neighborhoodAttacks.where('playerId').equals(filterByPlayerId) :
			(filterByPvPArena ?
				IndexDB.db.neighborhoodAttacks.where('playerId').anyOf(Looting.lastPvPArenaOpponents) :
				IndexDB.db.neighborhoodAttacks.where('type').equals(Looting.ACTION_TYPE_LOOTED)));

		await totalSPSelect.each((it) => {
			const sp = (it.sp || 0);
			const spNoDouble = (it.doubleLoot ? sp / 2 : sp);
			totalSP += sp;
			totalSPNoDouble += spNoDouble;
			if (dateThisWeek < it.date) {
				thisWeekSP += sp;
				thisWeekSPNoDouble += spNoDouble;

				if (dateToday < it.date) {
					todaySP += sp;
					todaySPNoDouble += spNoDouble;
				}
			}
		});

		const doubleTitle = HTML.i18nTooltip(i18n('Boxes.Looting.DoubleLootPartFP')),
			fpTitle = HTML.i18nTooltip(i18n('Boxes.Looting.TotalFP'));

		$('#lootingBody .strategy-points').html(`
			<table>
				<thead>
					<tr>
						<th colspan="2"><strong>${i18n('Boxes.Looting.collectedToday')}</strong></th>
						<th colspan="2"><strong>${i18n('Boxes.Looting.thisWeek')}</strong></th>
						<th colspan="2"><strong>${i18n('Boxes.Looting.total')}</strong></th>
					</tr>
					<tr>
						<th><span class="doubleloot" title="${doubleTitle}"></span></th>
						<th><span class="forgepoints" title="${fpTitle}"></span></th>
						<th><span class="doubleloot" title="${doubleTitle}"></span></th>
						<th><span class="forgepoints" title="${fpTitle}"></span></th>
						<th><span class="doubleloot" title="${doubleTitle}"></span></th>
						<th><span class="forgepoints" title="${fpTitle}"></span></th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><strong>${todaySP - todaySPNoDouble}</strong></td>
						<td><strong>${todaySP}</strong></td>
						<td><strong>${thisWeekSP - thisWeekSPNoDouble}</strong></td>
						<td><strong>${thisWeekSP}</strong></td>
						<td><strong>${totalSP - totalSPNoDouble}</strong></td>
						<td><strong>${totalSP}</strong></td>
					</tr>
				</tbody>
			</table>
		`);
	},


	/**
	 * Render actions
	 *
	 * @param actions
	 * @returns {string}
	 */
	RenderActions: (actions) => {
		if (actions.length === 0) {
			return `<div class="no-data"> - ${i18n('Boxes.Looting.noData')} - </div>`;
		}

		let lastPlayerId = null;
		return actions.map(action => {
			const isSamePlayer = action.playerId === lastPlayerId;
			lastPlayerId = action.playerId;
			return Looting.RenderAction({ action, isSamePlayer });
		}).join('');
	},


	/**
	 * Render action
	 *
	 * @param action
	 * @param isSamePlayer
	 * @returns {string}
	 */
	RenderAction: ({ action, isSamePlayer }) => {
		const type = {
			[Looting.ACTION_TYPE_LOOTED]: i18n('Boxes.Looting.actionLooted'),
			[Looting.ACTION_TYPE_BATTLE_WIN]: i18n('Boxes.Looting.actionBattleWon'),
			[Looting.ACTION_TYPE_BATTLE_LOSS]: i18n('Boxes.Looting.actionBattleLost'),
			[Looting.ACTION_TYPE_BATTLE_SURRENDERED]: i18n('Boxes.Looting.actionSurrendered'),
			[Looting.ACTION_TYPE_SHIELDED]: i18n('Boxes.Looting.actionShielded'),
			[Looting.ACTION_TYPE_REPELLED]: i18n('Boxes.Looting.actionRepelled'),
		}[action.type] || 'unknown';

		const avatar = action.avatar && srcLinks.GetPortrait(action.avatar);
		const date = moment(action.date).format(i18n('DateTime'));
		const dateFromNow = moment(action.date).fromNow();

		let era = '';
		const playerName = action.playerName !== 'unknown' ? action.playerName : i18n('Boxes.Looting.Unknown');
		const clanName = action.clanName !== 'unknown' ? action.clanName : i18n('Boxes.Looting.Unknown');
		const pvpArena = action.pvpArena ? `<br><span class="pvparena">${i18n('Boxes.Looting.PvPArenaAction')}</span>` : '';

		if (action.playerEra && action.playerEra !== 'unknown' && Technologies.Eras[action.playerEra] !== undefined) {
			const eraName = i18n('Eras.' + Technologies.Eras[action.playerEra]);
			era = `<div class="era" title="${i18n('Boxes.Looting.PlayersEra')}: ${eraName}"><strong>${eraName}</strong></div>`;
		}

		return `<div class="action-row action-row-type-${action.type}">
					<div class="avatar select-player game-cursor" data-value="${action.playerId}">
						${isSamePlayer || !avatar ? '' : `<img class="player-avatar" src="${avatar}" alt="" /><br>`}
						<span class="type text-${action.type === Looting.ACTION_TYPE_BATTLE_LOSS ? 'danger' : 'success'}">${type}</span>
						${pvpArena}
					</div>
					<div class="info-column">
						<div>
							${date} <br />
							<em>${dateFromNow}</em>
						</div>
						<div>
							${isSamePlayer ? '' : era}
						</div>
					</div>
					<div class="action-content">
						${isSamePlayer ? '' : `
						<div class="player-name select-player game-cursor" data-value="${action.playerId}">
							${action.playerId ? MainParser.GetPlayerLink(action.playerId, playerName) : HTML.escapeHtml(playerName)}<br><span class="clan">[${action.clanId ? MainParser.GetGuildLink(action.clanId, action.clanName) : HTML.escapeHtml(clanName)}]</span>
						</div>
						`}
						<div class="content">${Looting.RenderActionContent(action)}</div>
					</div>
				</div>`;
	},


	/**
	 * Render action content
	 *
	 * @param action
	 * @returns {string}
	 */
	RenderActionContent: (action) => {
		const buildingName = (MainParser.CityEntities?.[action.buildId] || { name: '-' }).name;

		switch (action.type) {
			case Looting.ACTION_TYPE_REPELLED:
				return `<div class="loot-wrap">
							<div class="name">
								<img class="sabotage" src="${extUrl}css/images/plunderrepel.png" alt="" title="${i18n('Boxes.Looting.actionRepelled')}" />
								${buildingName}
							</div>
						</div>`;

			case Looting.ACTION_TYPE_LOOTED: {
				const resources = action.resources || {};

				return `<div class="loot-wrap">
							<div class="name">
								<img class="sabotage" src="${extUrl}css/images/sabotage.png" alt="" title="${i18n('Boxes.Looting.actionLooted')}" />
								${action.doubleLoot ? `<img class="doubleLoot" src="${extUrl}css/images/doubleloot.png" alt="" title="${i18n('Boxes.Looting.doubleLoot')}"/>` : ''}
								${buildingName}
							</div>
							<div class="loot-items ${action.important ? 'text-warning' : ''}">
								${Object.keys(resources).map(id => {
									const str = `${resources[id]} ${(GoodsData[id] || { name: id }).name}`;
									return `<div>${id === 'strategy_points' ? `<strong>${str}</strong>` : str}</div>`;
								}).join('')}
							</div>
						</div>`;
			}

			case Looting.ACTION_TYPE_BATTLE_LOSS:
			case Looting.ACTION_TYPE_BATTLE_WIN:
			case Looting.ACTION_TYPE_BATTLE_SURRENDERED:
				if (!action.battle) return '-';

				return `<div class="battle">
							<div><strong>${action.battle.auto ? i18n('Boxes.Looting.autoBattle') : `${i18n('Boxes.Looting.rounds')}: ${action.battle.round || 'N/A'}`}</strong></div>
							<div class="army-overview">
								<div class="army">${Looting.RenderArmy(action.battle.myArmy)}</div>
								<div class="versus">VS</div>
								<div class="army">${Looting.RenderArmy(action.battle.otherArmy)}</div>
							</div>
						</div>`;

			case Looting.ACTION_TYPE_SHIELDED:
				return `<div class="shield-wrap">
							<div class="shield-explain">
								<img src="${extUrl}css/images/shield.png" alt="">
								${i18n('Boxes.Looting.shieldProtectetUntil')} ${moment(action.expireTime * 1000).format(i18n('DateTime'))}<br>
								<em>${i18n('Boxes.Looting.shieldUntil')} ${moment().to(action.expireTime * 1000)}</em>
							</div>
						</div>`;

			default:
				return '-';
		}
	},


	/**
	 * Attack and defense boost of an army
	 *
	 * @param army
	 * @returns {string}
	 */
	RenderArmy: (army) => {
		if (!Array.isArray(army) || army.length === 0) return '';

		const firstUnit = army[0];
		const isSameStats = !army.some(it => ((it.attBoost || 0) !== (firstUnit.attBoost || 0) || (it.defBoost || 0) !== (firstUnit.defBoost || 0)));
		const attBoost = firstUnit.attBoost || 0;
		const defBoost = firstUnit.defBoost || 0;

		return `${!isSameStats ? '' : `
					<div class="stats-same-for-all">
						<span class="${attBoost ? 'text-success' : 'text-danger'}">${i18n('Boxes.Looting.Attack')}: ${attBoost}%</span> - <span class="${defBoost ? 'text-success' : 'text-danger'}">${i18n('Boxes.Looting.Defense')}: ${defBoost}%</span>
					</div>
				`}
				<div class="unit-wrap">${army.map(unit => Looting.RenderUnit({ unit, showDetails: !isSameStats })).join('')}</div>`;
	},


	/**
	 * Health state of a unit
	 *
	 * @param unit
	 * @param showDetails
	 * @returns {string}
	 */
	RenderUnit: ({ unit, showDetails }) => {
		const endHP = unit.endHp || 0;
		const startHP = unit.startHP || 0;
		const healthPerc = (startHP > 0 ? MainParser.round((1 - ((startHP - endHP) / startHP)) * 100) : 0);
		const attBoost = unit.attBoost || 0;
		const defBoost = unit.defBoost || 0;
		const type = (Unit.Types || []).find(obj => obj['unitTypeId'] === unit.unitTypeId) || { name: unit.unitTypeId, unitClass: '' };
		const era = Technologies.Eras[type.minEra];
		const eraText = (era !== undefined ? ` (${i18n('Eras.' + era)})` : '');

		return `<div class="unit" title="${i18n('Boxes.Looting.Unit')}: ${type.name}${eraText}, HP: ${endHP}/${startHP}, ${i18n('Boxes.Looting.Attack')}: ${attBoost}, ${i18n('Boxes.Looting.Defense')}: ${defBoost}">
					<div class="unit_icon ${unit.unitTypeId} unit_skill ${type.unitClass}"></div>
					<div class="health">
						<span style="width: ${healthPerc}%"></span>
					</div>
					${showDetails ? `
					<div class="stats">
						<div class="${!endHP ? 'text-danger' : ''}">${endHP}/${startHP}</div>
						<div class="${attBoost ? 'text-success' : ''}">${attBoost}%</div>
						<div class="${defBoost ? 'text-success' : ''}">${defBoost}%</div>
					</div>
					` : ''}
				</div>`;
	}
};
