/*
 * **************************************************************************************
 *
 * Dateiname:                 looting.js (Original Dateiname: plunderer.js)
 * Projekt:                   foe-chrome
 *
 * erstellt von:              Daniel Siekiera <daniel.siekiera@gmail.com>
 * erstellt am:	              07.04.20, 21:58 Uhr
 * zuletzt bearbeitet:        07.04.20, 15:46 Uhr
 *
 * Copyright © 2020
 *
 * **************************************************************************************
 */

// Detect shield
FoEproxy.addHandler('OtherPlayerService', 'getCityProtections', async(data, postData) => {
	// Deffer handling city protection in next tick, to ensure PlayerDict is fetched
	setTimeout(async () => {
		const r = data.responseData;
		if (!Array.isArray(r)) { return; }
		const shielded = r.filter(it => it.expireTime > 0); // -1 for users that cannot be attacked, ignore them

		await IndexDB.getDB();

		for (const shieldInfo of shielded) {
			const playerId = shieldInfo.playerId;
			const lastShieldAction = await IndexDB.db.neighborhoodAttacks.where({playerId: playerId}).and(it => it.type === Looting.ACTION_TYPE_SHIELDED).last();

			// If in db already exists actual shield info than skip
			if (lastShieldAction && new Date(lastShieldAction.expireTime * 1000) >= new Date()) {continue;}

			await IndexDB.db.neighborhoodAttacks.add({
				type: Looting.ACTION_TYPE_SHIELDED,
				playerId: playerId,
				date: new Date,
				expireTime: shieldInfo.expireTime,
			});
			await IndexDB.addUserFromPlayerDictIfNotExists(playerId);
		}
	}, 1);
});

FoEproxy.addHandler('BattlefieldService', 'all', async (data, postData, responseData) => {
	const isAutoBattle = data.responseData.isAutoBattle; // isAutoBattle is part of BattleRealm only
	//
	const state = data.responseData.__class__ === 'BattleRealm' ? data.responseData.state : data.responseData;
	if (state.__class__ !== 'BattleRealmState') {
		return;
	}

	const {winnerBit, surrenderBit, unitsOrder, ranking_data, round} = state;
	const era = (ranking_data &&
		ranking_data.ranking &&
		ranking_data.ranking[0] &&
		ranking_data.ranking[0].era) || 'unknown';
	const actionType =
		winnerBit === 1 ? Looting.ACTION_TYPE_BATTLE_WIN :
			winnerBit === 2 ? Looting.ACTION_TYPE_BATTLE_LOSS :
				surrenderBit === 1 ? Looting.ACTION_TYPE_BATTLE_SURRENDERED : null;

	if (!actionType) {
		return;
	}

	const myUnits = unitsOrder.filter(it => it.teamFlag === 1).map(adaptUnit(true));
	const otherUnits = unitsOrder.filter(it => it.teamFlag === 2).map(adaptUnit(false));
	let defenderPlayerId = data.responseData.defenderPlayerId || otherUnits[0].ownerId;
	let isPvpArena = responseData.find(e => e.requestClass === 'PVPArenaService') !== undefined;

	if(defenderPlayerId <= 0) {
		let logEntry = responseData.find(e => e.requestClass === 'PVPArenaService' && e.requestMethod === 'addLog');
		if (logEntry !== undefined) {
			defenderPlayerId = logEntry.responseData.otherPlayer.player.player_id;
		}
	}

	// defenderPlayerId = -1 if PVE
	if (defenderPlayerId <= 0) {
		return;
	}

	// Avoid adding defend battles (when view recorded defend battles)
	if (defenderPlayerId === ExtPlayerID) { return ; }

	await IndexDB.getDB();

	// Ensure user is exists in db already
	await IndexDB.addUserFromPlayerDictIfNotExists(defenderPlayerId);

	// Add action
	await IndexDB.db.neighborhoodAttacks.add({
		playerId: defenderPlayerId,
		date: new Date(),
		type: actionType,
		pvpArena: !!isPvpArena,
		battle: {
			myArmy: myUnits,
			otherArmy: otherUnits,
			round,
			auto: !!isAutoBattle,
			era,
		}
	});

	Looting.UpdateBoxIfVisible();

	function adaptUnit(isAttacking)
	{
		return function(unit) {
			const bonuses = Unit.GetBoostSums(Unit.GetBoostDict(unit.bonuses));
			const attBoost = isAttacking ? bonuses.AttackAttackBoost : bonuses.DefenseAttackBoost;
			const defBoost = isAttacking ? bonuses.AttackDefenseBoost : bonuses.DefenseDefenseBoost;

			return {
				startHP: unit.startHitpoints,
				endHp: unit.currentHitpoints || 0,
				attBoost: attBoost || 0,
				defBoost: defBoost || 0,
				unitTypeId: unit.unitTypeId,
				ownerId: unit.ownerId,
			}
		}
	}
});

FoEproxy.addHandler('OtherPlayerService', 'plunderById', async (data, postData) => {
	if (!Array.isArray(postData)) { return; }

	if (postData.length === 0) { return; }

	if (!data.responseData) { return; }

	const playerId = postData[0].requestData[0];
	const entityId = postData[0].requestData[1];
	const lastVisitedPlayer = Looting.lastVisitedPlayer;

	if (!lastVisitedPlayer) { return; }
	if (playerId !== lastVisitedPlayer.other_player.player_id) { return; }
	
	const entity = lastVisitedPlayer.city_map.entities.find(e => entityId === e.id);

	if (data.responseData.result === 'repelled') {	

		await IndexDB.getDB();
		
		await IndexDB.db.neighborhoodAttacks.add({
			type: Looting.ACTION_TYPE_REPELLED,
			playerId: playerId,
			entityId: entity.id,
			buildId: entity.cityentity_id,
			date: new Date
		});
	}

});


FoEproxy.addHandler('CityMapService', 'reset', async (data, postData) => {
	const r = data.responseData;

	if (!Array.isArray(r)) {
		return;
	}

	await IndexDB.getDB();

	r.forEach(async (it) => {
		const entityId = it.id;
		const playerId = it.player_id;
		if (it.state.__class__ !== 'LootedState' && it.state.__class__ !== 'PlunderedState') {
			return;
		}

		// Find city entity in last visited player
		const lastVisitedPlayer = Looting.lastVisitedPlayer;
		if (!lastVisitedPlayer) {
			return;
		}
		if (playerId !== lastVisitedPlayer.other_player.player_id) {
			return;
		}

		const entity = lastVisitedPlayer.city_map.entities.find(e => entityId === e.id);
		if (entity &&
			entity.state &&
			entity.state.current_product &&
			entity.state.current_product.product &&
			entity.state.current_product.product.resources) {
			const resources = entity.state.current_product.product.resources;
			const unimportantProds = [
				'supplies',
				'money'
			];
			const isImportant = Object.keys(resources).some(it => !unimportantProds.includes(it));
			let action = {
				playerId,
				date: new Date(),
				type: Looting.ACTION_TYPE_LOOTED,
				resources,
				sp: resources.strategy_points || 0,
				important: isImportant,
				entityId: entity.id,
				buildId: entity.cityentity_id,
			};

			await Looting.upsertLootAction(action);
		}
	});
});

// Handle double loot bonus (Atlantis Museum). Usually this event come before CityMapService/reset
FoEproxy.addHandler('CityMapService', 'showEntityIcons', async (data, postData) => {
	// Typical structure of data:
	// "responseData": [
	//	{
	//		"id": 2440,
	//		"type": "citymap_icon_loot_and_pillage",
	//		"__class__": "CityEntityIcon"
	//	}
	// ],

	const r = data.responseData;

	if (!Array.isArray(r)) {
		return;
	}

	// In fact this is an array, but only one loot id will be for sure in this event, so ignore rest array
	const doubleLootCityId = r.filter(it => it.type === 'citymap_icon_plunder_and_pillage').map(it => it.id)[0];
	if (!doubleLootCityId) { return }

	const playerId = Looting.lastVisitedPlayer.other_player.player_id;

	const action = {
		entityId: doubleLootCityId,
		playerId,
		doubleLoot: true,
	};
	await Looting.upsertLootAction(action);
});

FoEproxy.addHandler('OtherPlayerService', 'visitPlayer', async (data, postData) => {
	const playerData = data.responseData;
	Looting.lastVisitedPlayer = playerData;
	Looting.page = 1;
	Looting.filterByPlayerId = playerData.other_player.player_id;
	Looting.filterByPvPArena = false;
 	MainParser.UpdatePlayerDict(playerData, 'VisitPlayer').then(() => {
		//await Looting.collectPlayer(playerData);
		Looting.UpdateBoxIfVisible();
	});
});

// PvPArena geöffnet
FoEproxy.addHandler('PVPArenaService', 'getOverview', (data, postData) => {
	Looting.lastPvPArenaOpponents = [];
	let opponents = data['responseData']['opponents'];
	for (let i in opponents) {
		if(!opponents.hasOwnProperty(i)) continue;
		Looting.lastPvPArenaOpponents.push(opponents[i].opposingPlayer.player.player_id);
	}
	Looting.filterByPvPArena = true;
	Looting.filterByPlayerId = null;
	Looting.UpdateBoxIfVisible();
});

FoEproxy.addHandler('PVPArenaService', 'updateOpponents', (data, postData) => {
	Looting.lastPvPArenaOpponents = [];
	let opponents = data['responseData'];
	for (let i in opponents) {
		if(!opponents.hasOwnProperty(i)) continue;
		Looting.lastPvPArenaOpponents.push(opponents[i].opposingPlayer.player.player_id);
	}
	Looting.filterByPvPArena = true;
	Looting.filterByPlayerId = null;
	Looting.UpdateBoxIfVisible();
});

let Looting = {

	// Filter and pagination.
	page: 1,
	filterByPlayerId: null,
	filterByPvPArena: false,

	// Cached last visited player for getting info about city before looting
	// Sadly loot event have no info about city entity, just collected resources
	lastVisitedPlayer: null,
	// Cached last known opponents of pvpArena
	lastPvPArenaOpponents: [],

	// Enum for action type
	ACTION_TYPE_LOOTED: 1,
	ACTION_TYPE_BATTLE_WIN: 2,
	ACTION_TYPE_BATTLE_LOSS: 3,
	ACTION_TYPE_BATTLE_SURRENDERED: 4,
	ACTION_TYPE_SHIELDED: 5,
	ACTION_TYPE_REPELLED: 6,

	inited: false,

	/**
	 * Upsert player in db
	 *
	 * @param player
	 * @returns {Promise<void>}
	 */
	collectPlayer: async (player) => {
		let otherPlayer = player.other_player;

		await IndexDB.getDB();

		await IndexDB.db.players.put({
			id: otherPlayer.player_id,
			name: otherPlayer.name,
			clanId: otherPlayer.clan_id || 0,
			clanName: otherPlayer.clan && otherPlayer.clan.name,
			avatar: otherPlayer.avatar,
			era: player.other_player_era,
			date: new Date(),
		});
	},

	// Create or update action, also apply doubleLoot
	upsertLootAction: async (payload) => {
		const {entityId, playerId} = payload;
		if (!entityId || !playerId) { return; }

		await IndexDB.getDB();

		await IndexDB.db.transaction('rw', IndexDB.db.neighborhoodAttacks, async () => {
			// Fetch last loot action that happen just few seconds ago (1 minute ago)
			const lastLootAction = await IndexDB.db.neighborhoodAttacks.where({playerId})
						.filter(it => (it.type == Looting.ACTION_TYPE_LOOTED &&
													 it.entityId == entityId &&
													 it.date > (+new Date() - 60 * 10 * 1000)))
						.last();

			// Add missing fields if not exists jet to payload:
			payload = {
				resources: {},
				sp: 0,
				type: Looting.ACTION_TYPE_LOOTED,
				...lastLootAction,
				...payload,
				date: new Date(),
			}

			if (lastLootAction && payload.doubleLoot && !payload.doubleLootApplied) {
				payload.sp = payload.sp * 2;
				payload.doubleLoot = true,
				payload.doubleLootApplied = true;
				Object.keys(payload.resources).forEach(key => payload.resources[key] = payload.resources[key] * 2);
			}

			if (lastLootAction) {
				await IndexDB.db.neighborhoodAttacks.put(payload);
			} else {
				await IndexDB.db.neighborhoodAttacks.add(payload);
			}
		});

		Looting.UpdateBoxIfVisible();
	},

	/**
	 * Refresh the Box
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
			let args = {
				'id': 'looting',
				'title': i18n('Boxes.Looting.Title'),
				'auto_close': true,
				'dragdrop': true,
				'minimize': true
			};

			HTML.Box(args);
			moment.locale(i18n('Local'));
			HTML.AddCssFile('looting');
			HTML.AddCssFile('unit');
		}

		Looting.Render();

		let unitScale = parseInt(Unit.Settings.pictogramScaling) + 1 + '/5';
		document.querySelector('#looting').style.setProperty('--unit_scale', unitScale);

		$('#looting').on('click', '#lootingBody .load-1st-page', function () {
			if (Looting.loading) {
				return;
			}
			Looting.page = 1;
			Looting.Show();
			$('#lootingBody').animate({scrollTop: 0}, 'fast');
		});

		$('#looting').on('click', '#lootingBody .load-next-page', function () {
			if (Looting.loading) {
				return;
			}
			Looting.page++;
			Looting.Show();
			$('#lootingBody').animate({scrollTop: 0}, 'fast');
		});

		$('#looting').on('click', '#lootingBody .select-player', function () {
			if (Looting.loading) {
				return;
			}

			const id = $(this).data('value');

			Looting.page = 1;
			Looting.filterByPlayerId = id ? +id : null;
			Looting.filterByPvPArena = false;
			Looting.Show();

			$('#lootingBody').animate({scrollTop: 0}, 'fast');
		});

		$('#looting').on('click', '#lootingBody .select-pvp-arena-opponents', function () {
			if (Looting.loading) {
				return;
			}
			
			console.log($(this));

			Looting.page = 1;
			Looting.filterByPlayerId = null;
			Looting.filterByPvPArena = true;
			Looting.Show();

			$('#lootingBody').animate({scrollTop: 0}, 'fast');
		});
	},


	/**
	 * Get all the Content
	 *
	 * @returns {Promise<void>}
	 */
	Render: async () => {
		const {page, filterByPlayerId, filterByPvPArena} = Looting;
		const perPage = 20;
		Looting.loading = true;
		
		const offset = (page - 1) * perPage,
			actionsSelect = (filterByPlayerId ?
				(IndexDB.db.neighborhoodAttacks.where('playerId').equals(filterByPlayerId)) :
				(filterByPvPArena ? 
					(IndexDB.db.neighborhoodAttacks.where('playerId').anyOf(Looting.lastPvPArenaOpponents)) :
					(IndexDB.db.neighborhoodAttacks.orderBy('date'))));

		let actions = 
			await actionsSelect
				.filter((action) => {
					return !filterByPvPArena || action.pvpArena !== undefined && action.pvpArena
				}) 
				.reverse()
				.offset(offset)
				.limit(perPage)
				.sortBy('date')
			;
				
		
		const countSelect = 
			(filterByPlayerId ? 
				(IndexDB.db.neighborhoodAttacks.where('playerId').equals(filterByPlayerId)) :
				(filterByPvPArena ? 
					(IndexDB.db.neighborhoodAttacks.where('playerId').anyOf(Looting.lastPvPArenaOpponents)) :
					(IndexDB.db.neighborhoodAttacks)));

		let pages = Math.ceil((await countSelect.count()) / perPage);

		// enrich actions with player info
		for (let action of actions) {
			await MainParser.loadPlayerIntoDict(action.playerId);
		}
		
		actions = actions.map(it => {
			const player = PlayerDict[it.playerId];

			// Try get info about player from indexdb, if not possible than from PlayerDict
			const playerInfo = player ? ({
				playerId: player.PlayerID || 0,
				playerName: player.PlayerName,
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

		let playerName = '';
		let clanName = ''

		if (filterByPlayerId) {
			playerName = PlayerDict[filterByPlayerId] !== undefined ? PlayerDict[filterByPlayerId].PlayerName : i18n('Boxes.Looting.Unknown');
			clanName =  PlayerDict[filterByPlayerId] !== undefined ? PlayerDict[filterByPlayerId].ClanName : i18n('Boxes.Looting.Unknown');
		}

		$('#lootingBody').html(`
			<div class="dark-bg" style="padding:5px 0 3px; ">
				<div class="header">
					<div class="strategy-points">
						Calculating strategy points...
					</div>
					<div class="filter">
						<div class="filterd-by"><b>${i18n('Boxes.Looting.filteredByUser')}:</b><br>
							<span class="player-name">
								${filterByPlayerId ? 
									`${MainParser.GetPlayerLink(filterByPlayerId, playerName)} ${clanName ? ` [${clanName}]` : ''}` : 
									filterByPvPArena ? 
										`${i18n('Boxes.Looting.CurrentPvPArenaOpponents')}` :
										`${i18n('Boxes.Looting.AllPlayers')}`
								}
							</span>
						</div>
						<div class="filter-buttons">
							<div><button${Looting.lastPvPArenaOpponents.length == 0  ? " disabled" : " "} class="btn btn-default select-pvp-arena-opponents${filterByPvPArena ? ' btn-active' : ' '}" data-value="" title="${Looting.lastPvPArenaOpponents.length == 0 ? HTML.i18nTooltip(i18n('Boxes.Looting.PvPArenaOpponentsInactive')) : ''}">${i18n('Boxes.Looting.showPvPArenaOpponents')}</button></div>
							<div><button class="btn btn-default select-player${!filterByPvPArena && filterByPlayerId === null ? ' btn-active' : ''}" data-value="">${i18n('Boxes.Looting.showAllPlayers')}</button></div>
						</div>
					</div>
				</div>
			</div>
			${Looting.RenderActions(actions)}
			<div class="pagination">
				${page > 1 && pages > 1 ? `<button class="btn btn-default load-1st-page">${i18n('Boxes.Looting.goto1stPage')}</button>` : ''}
				${i18n('Boxes.Looting.Page')} ${page}/${pages}
				${pages > page ? `<button class="btn btn-default load-next-page">${i18n('Boxes.Looting.nextPage')}</button>` : ''}
			</div>`);

		await Looting.calculateSP(filterByPlayerId, filterByPvPArena);
		Looting.loading = false;
	},


	/**
	 * Calculate the ForgePoints for 1 Week
	 *
	 * @param filterByPlayerId
	 * @returns {Promise<void>}
	 */
	calculateSP: async (filterByPlayerId, filterByPvPArena) => {
		const dateThisWeek = moment().subtract(1, 'weeks').toDate();
		const dateToday = moment().startOf('day').toDate();

		let todaySP = 0;
		let todaySPNoDouble = 0;
		let thisWeekSP = 0;
		let thisWeekSPNoDouble = 0;
		let totalSP = 0;
		let totalSPNoDouble = 0;
		let totalSPSelect = (filterByPlayerId ?
			(IndexDB.db.neighborhoodAttacks.where('playerId').equals(filterByPlayerId)) :
			(filterByPvPArena ? 
				(IndexDB.db.neighborhoodAttacks.where('playerId').anyOf(Looting.lastPvPArenaOpponents)) :
				(IndexDB.db.neighborhoodAttacks.where('type').equals(Looting.ACTION_TYPE_LOOTED))));

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

		$('#lootingBody .strategy-points').html(`
			<table style="width: 80%; text-align: center;">
				<thead>
					<tr>
						<th colspan="2" style="text-align: center;"><strong>${i18n('Boxes.Looting.collectedToday')}</strong></th>
						<th colspan="2" style="text-align: center;"><strong>${i18n('Boxes.Looting.thisWeek')}</strong></th>
						<th colspan="2" style="text-align: center;"><strong>${i18n('Boxes.Looting.total')}</strong></th>
					</tr>
					<tr>
						<th style="width: 16%; text-align: center;"><span class="doubleloot" title="${HTML.i18nTooltip(i18n('Boxes.Looting.DoubleLootPartFP'))}"></span></th>
						<th style="width: 16%; text-align: center;"><span class="forgepoints" title="${HTML.i18nTooltip(i18n('Boxes.Looting.TotalFP'))}"></span></th>
						<th style="width: 16%; text-align: center;"><span class="doubleloot" title="${HTML.i18nTooltip(i18n('Boxes.Looting.DoubleLootPartFP'))}"></span></th>
						<th style="width: 16%; text-align: center;"><span class="forgepoints" title="${HTML.i18nTooltip(i18n('Boxes.Looting.TotalFP'))}"></span></th>
						<th style="text-align: center;"><span class="doubleloot" title="${HTML.i18nTooltip(i18n('Boxes.Looting.DoubleLootPartFP'))}"></span></th>					
						<th style="width: 16%; text-align: center;"><span class="forgepoints" title="${HTML.i18nTooltip(i18n('Boxes.Looting.TotalFP'))}"></span></th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td style="text-align: center;"><strong>${todaySP - todaySPNoDouble}</strong></td>
						<td style="text-align: center;"><strong>${todaySP}</strong></td>
						<td style="text-align: center;"><strong>${thisWeekSP - thisWeekSPNoDouble}</strong></td>
						<td style="text-align: center;"><strong>${thisWeekSP}</strong></td>
						<td style="text-align: center;"><strong>${totalSP - totalSPNoDouble}</strong></td>
						<td style="text-align: center;"><strong>${totalSP}</strong></td>
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
		let lastPlayerId = null;
		let html = '';
		if (actions.length === 0) {
			html = `<div class="no-data"> - ${i18n('Boxes.Looting.noData')} - </div>`;
		} else {
			html = actions.map(action => {
				const isSamePlayer = action.playerId === lastPlayerId;
				lastPlayerId = action.playerId;
				return Looting.RenderAction({action, isSamePlayer});
			}).join('');
		}
		return html;
	},


	/**
	 * Render action
	 *
	 * @param action
	 * @param isSamePlayer
	 * @returns {string}
	 */
	RenderAction: ({action, isSamePlayer}) => {
		const type = {
			[Looting.ACTION_TYPE_LOOTED]: i18n('Boxes.Looting.actionLooted'),
			[Looting.ACTION_TYPE_BATTLE_WIN]: i18n('Boxes.Looting.actionBattleWon'),
			[Looting.ACTION_TYPE_BATTLE_LOSS]: i18n('Boxes.Looting.actionBattleLost'),
			[Looting.ACTION_TYPE_BATTLE_SURRENDERED]: i18n('Boxes.Looting.actionSurrendered'),
			[Looting.ACTION_TYPE_SHIELDED]: i18n('Boxes.Looting.actionShielded'),
			[Looting.ACTION_TYPE_REPELLED]: i18n('Boxes.Looting.actionRepelled'),
		}[action.type] || 'unknown';

		const avatar = action.avatar && `${MainParser.InnoCDN}assets/shared/avatars/${MainParser.PlayerPortraits[action.avatar]}.jpg`;
		const date = moment(action.date).format(i18n('DateTime'));
		const dateFromNow = moment(action.date).fromNow();

		let era = '';
		const playerName = action.playerName !== 'unknown' ? action.playerName : i18n('Boxes.Looting.Unknown');
		const clanName = action.clanName !== 'unknown' ? action.clanName : i18n('Boxes.Looting.Unknown');
		const pvpArena = action.pvpArena ? `</br><span class="pvparena">${i18n('Boxes.Looting.PvPArenaAction')}</span>` : '';

		if(action.playerEra && action.playerEra !== 'unknown'){
			let eraName = i18n('Eras.' + Technologies.Eras[action.playerEra]);

			era = `<div class="era" title="${i18n('Boxes.Looting.PlayersEra')}: ${eraName}"><strong>${eraName}</strong></div>`;
		}

		return `<div class="action-row action-row-type-${action.type}">
					<div class="avatar select-player" data-value="${action.playerId}">
						${isSamePlayer || !avatar? '' : `<img class="player-avatar" src="${avatar}" alt="${playerName}" /><br>`}
						<span class="type text-${action.type === 1 ? 'success' : (action.type === 3 ? 'danger' : 'success')}">${type}</span>
						${pvpArena}
					</div>
					<div class="info-column">
						<div>
							${date} <br />
							<em>${dateFromNow}</em>
						</div>
						<div>
							${isSamePlayer ? '' : `
								${era}
								${action.playerDate ? `
									<div class="discovered" title="${i18n('Boxes.Looting.visitTitle')}">
										${i18n('Boxes.Looting.visited')}: <br />
										<em>${moment(action.playerDate).fromNow()}</em>
									</div>`
								: ''}
							`}
						</div>
					</div>
					<div class="action-content">
						${isSamePlayer ? '' : `
						<div class="player-name select-player" data-value="${action.playerId}">
							${action.playerId ? MainParser.GetPlayerLink(action.playerId, playerName) : playerName}<br><span class="clan">[${clanName}]</span>
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
		switch (action.type) {
			case Looting.ACTION_TYPE_REPELLED:
				return `<div class="loot-wrap">
							<div class="name">
								<img class="sabotage" src="${extUrl}css/images/plunderrepel.png" alt="Plunder Repel" title="${i18n('Boxes.Looting.actionRepelled')}" />
								
								${(MainParser.CityEntities[action.buildId] || {name: '-'}).name}
							</div>
						</div>`;
			case Looting.ACTION_TYPE_LOOTED:
				const goodsIds = Object.keys(action.resources);

				return `<div class="loot-wrap">
							<div class="name">
								<img class="sabotage" src="${extUrl}css/images/sabotage.png" alt="Sabotage" title="${i18n('Boxes.Looting.actionLooted')}" />
								${action.doubleLoot ? `<img class="doubleLoot" src="${extUrl}css/images/doubleloot.png" alt="Double Loot Bonus" title="${i18n('Boxes.Looting.doubleLoot')}"/>` : ''}

								${(MainParser.CityEntities[action.buildId] || {name: '-'}).name}
							</div>
							<div class="loot-items ${action.important ? 'text-warning' : ''}">
								${goodsIds.map(id => {
									const goods = (GoodsData[id] || {name: ''}).name;
									const str = `${action.resources[id]} ${goods}`;
									return id === 'strategy_points' ? `<strong>${str}</strong>` : `${str}`;
								}).map(it => `<div>${it}</div>`).join('')}
							</div>
						</div>`;

			case Looting.ACTION_TYPE_BATTLE_LOSS:
			case Looting.ACTION_TYPE_BATTLE_WIN:
			case Looting.ACTION_TYPE_BATTLE_SURRENDERED:
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
							 	<img src="${extUrl}css/images/shield.png" alt="Shield">
								${i18n('Boxes.Looting.shieldProtectetUntil')} ${moment(action.expireTime * 1000).format(i18n('DateTime'))}<br>
								<em>${i18n('Boxes.Looting.shieldUntil')} ${moment().to(action.expireTime * 1000)}</em>
							</div>
						</div>`;
			default:
				return '-';
		}
	},


	/**
	 * Calculate Attack & Defense Bonus of the Units
	 *
	 * @param army
	 * @returns {string}
	 */
	RenderArmy: (army) => {
		const firstUnit = army[0];
		const isSameStats = !army.some(it => {
			return ((it.attBoost || 0) !== (firstUnit.attBoost || 0) ||
				(it.defBoost || 0) !== (firstUnit.defBoost || 0));
		});
		const attBoost = firstUnit.attBoost || 0;
		const defBoost = firstUnit.defBoost || 0;
		return `${!isSameStats ? '' : `
					<div class="stats-same-for-all">
						<span class="${attBoost ? 'text-success' : 'text-danger'}">${i18n('Boxes.Looting.Attack')}: ${attBoost}%</span> - <span class="${defBoost ? 'text-success' : 'text-danger'}">${i18n('Boxes.Looting.Defense')}: ${defBoost}%</span>
					</div>
				`}
				<div class="unit-wrap">${army.map(unit => Looting.RenderUnit({unit, showDetails: !isSameStats})).join('')}</div>`;
	},


	/**
	 * Show healts state from units
	 *
	 * @param unit
	 * @param showDetails
	 * @returns {string}
	 */
	RenderUnit: ({unit, showDetails}) => {
		const endHP = unit.endHp || 0;
		const startHP = unit.startHP || 0;
		const healtPerc = MainParser.round((1 - ((startHP - endHP) / startHP)) * 100);
		const attBoost = unit.attBoost || 0;
		const defBoost = unit.defBoost || 0;
		const type = Unit.Types.find(obj => (obj['unitTypeId'] === unit.unitTypeId))
		const era = Technologies.Eras[type.minEra];

		return `<div class="unit" title="${i18n('Boxes.Looting.Unit')}: ${type.name} (${i18n('Eras.' + era)}), HP: ${endHP}/${startHP}, ${i18n('Boxes.Looting.Attack')}: ${attBoost}, ${i18n('Boxes.Looting.Defense')}: ${defBoost}">
					<div class="unit_icon ${unit.unitTypeId} unit_skill ${type.unitClass}" style="background-image:url('${MainParser.InnoCDN}assets/shared/unit_portraits/armyuniticons_50x50/armyuniticons_50x50_0.png')"></div>
						<div class="health">
						<span style="width: ${healtPerc}%"></span>
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
