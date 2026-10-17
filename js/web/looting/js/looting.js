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


// Raw handlers run synchronously right before the service handlers of the same XHR, so the
// BattlefieldService handler below sees its own response here (it needs the other entries)
FoEproxy.addRawHandler((xhr, requestData) => {
	if (requestData.url?.indexOf('game/json?h=') > -1) Looting.lastJsonXhr = xhr;
});


FoEproxy.addHandler('BattlefieldService', 'all', async (data, postData) => {
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
	const requests = Looting.getResponseEntries();
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
	// XHR of the game json request currently being handled, set by the raw handler
	lastJsonXhr: null,

	// Enum for action type
	ACTION_TYPE_LOOTED: 1,
	ACTION_TYPE_BATTLE_WIN: 2,
	ACTION_TYPE_BATTLE_LOSS: 3,
	ACTION_TYPE_BATTLE_SURRENDERED: 4,
	ACTION_TYPE_SHIELDED: 5,
	ACTION_TYPE_REPELLED: 6,

	UnimportantProds: ['supplies', 'money'],


	/**
	 * All entries of the response currently being handled (empty if unavailable)
	 *
	 * @returns {FoE_NETWORK_TYPE[]}
	 */
	getResponseEntries: () => {
		try {
			const entries = JSON.parse(Looting.lastJsonXhr?.responseText);
			return Array.isArray(entries) ? entries : [];
		} catch (e) {
			return [];
		}
	},


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
	 * Create the box if needed and render it
	 */
	Show: () => {
		if ($('#looting').length === 0) {
			HTML.Box({
				id: 'looting',
				title: i18n('Boxes.Looting.Title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				resize: true,
				popout: () => MainParser.PopOut('looting')
			});

			HTML.AddCssFile('looting');
		}

		Looting.Render();
	},


	/**
	 * Changes page or filter, then renders from the top
	 *
	 * @param change sets page and filter fields of Looting
	 */
	Reload: (change) => {
		if (Looting.loading) return;
		change();
		Looting.Show();
		$('#lootingBody .action-list').animate({ scrollTop: 0 }, 'fast');
	},


	SelectPlayer: (playerId) => Looting.Reload(() => {
		Looting.page = 1;
		Looting.filterByPlayerId = playerId || null;
		Looting.filterByPvPArena = false;
	}),


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
	 * Data and markup are separate steps, getViewModel collects, view renders
	 *
	 * @returns {Promise<void>}
	 */
	Render: async () => {
		Looting.loading = true;

		try {
			const vm = await Looting.getViewModel();
			// lit-html updates only what changed, the body element keeps its state across renders and pop-out moves
			litHtml.render(Looting.view(vm), $('#lootingBody')[0]);
		}
		catch (e) {
			console.error('Looting: render failed', e);
		}
		finally {
			Looting.loading = false;
		}
	},


	/**
	 * Everything the box shows, as plain data
	 *
	 * @returns {Promise<Object>}
	 */
	getViewModel: async () => {
		const { page, perPage, filterByPlayerId, filterByPvPArena } = Looting;

		await IndexDB.getDB();

		let actions = await Looting.select(filterByPlayerId, filterByPvPArena)
			.reverse()
			.offset((page - 1) * perPage)
			.limit(perPage)
			.sortBy('date');

		const pages = Math.max(1, Math.ceil((await Looting.select(filterByPlayerId, filterByPvPArena).count()) / perPage));

		for (const action of actions) {
			await MainParser.loadPlayerIntoDict(action.playerId);
		}
		if (filterByPlayerId) await MainParser.loadPlayerIntoDict(filterByPlayerId);

		// enrich actions with player info, consecutive actions of one player show it only once
		let lastPlayerId = null;
		actions = actions.map(it => {
			const player = PlayerDict[it.playerId],
				isSamePlayer = (it.playerId === lastPlayerId);
			lastPlayerId = it.playerId;

			return {
				...it,
				isSamePlayer,
				playerId: player?.PlayerID || 0,
				playerName: player?.PlayerName || i18n('Boxes.Looting.Unknown'),
				clanId: player?.ClanId || 0,
				clanName: player?.ClanName || i18n('Boxes.Looting.Unknown'),
				avatar: player?.Avatar && srcLinks.GetPortrait(player.Avatar),
				eraName: (player?.Era && Technologies.Eras[player.Era] !== undefined ? i18n('Eras.' + Technologies.Eras[player.Era]) : undefined),
			};
		});

		let filterLabel;
		if (filterByPlayerId) {
			const p = PlayerDict[filterByPlayerId];
			filterLabel = {
				playerLink: MainParser.GetPlayerLink(filterByPlayerId, p?.PlayerName || i18n('Boxes.Looting.Unknown')),
				guildLink: (p?.ClanName ? MainParser.GetGuildLink(p.ClanId || 0, p.ClanName) : undefined),
			};
		}
		else {
			filterLabel = { text: i18n(filterByPvPArena ? 'Boxes.Looting.CurrentPvPArenaOpponents' : 'Boxes.Looting.AllPlayers') };
		}

		return {
			page,
			pages,
			filterByPlayerId,
			filterByPvPArena,
			filterLabel,
			noArena: (Looting.lastPvPArenaOpponents.length === 0),
			sp: await Looting.calculateSP(filterByPlayerId, filterByPvPArena),
			actions,
		};
	},


	/**
	 * Sum up the plundered forge points (today, last 7 days, total)
	 *
	 * @param filterByPlayerId
	 * @param filterByPvPArena
	 * @returns {Promise<Object>} per period the forge points and the part from double loot
	 */
	calculateSP: async (filterByPlayerId, filterByPvPArena) => {
		const dateThisWeek = moment().subtract(1, 'weeks').toDate();
		const dateToday = moment().startOf('day').toDate();
		const sp = {
			today: { all: 0, double: 0 },
			week: { all: 0, double: 0 },
			total: { all: 0, double: 0 },
		};
		const add = (period, all, double) => {
			sp[period].all += all;
			sp[period].double += double;
		};

		const totalSPSelect = (filterByPlayerId ?
			IndexDB.db.neighborhoodAttacks.where('playerId').equals(filterByPlayerId) :
			(filterByPvPArena ?
				IndexDB.db.neighborhoodAttacks.where('playerId').anyOf(Looting.lastPvPArenaOpponents) :
				IndexDB.db.neighborhoodAttacks.where('type').equals(Looting.ACTION_TYPE_LOOTED)));

		await totalSPSelect.each((it) => {
			const all = (it.sp || 0),
				double = (it.doubleLoot ? all / 2 : 0);
			add('total', all, double);
			if (dateThisWeek < it.date) {
				add('week', all, double);
				if (dateToday < it.date) add('today', all, double);
			}
		});

		return sp;
	},


	/**
	 * Markup of the box body, a pure function of the view model
	 *
	 * @param vm result of getViewModel
	 * @returns {TemplateResult}
	 */
	view: (vm) => {
		const { html, unsafeHTML } = litHtml,
			t = (key) => i18n('Boxes.Looting.' + key),
			f = vm.filterLabel,
			periods = [['collectedToday', vm.sp.today], ['thisWeek', vm.sp.week], ['total', vm.sp.total]];

		return html`
			<div class="dark-bg toolbox-head">
				<div class="header">
					<div class="toolbox-cards">
						${periods.map(([key, sp]) => html`
							<div class="toolbox-card">
								<h4>${t(key)}</h4>
								<div class="toolbox-card-line">
									<span class="toolbox-card-label"><span class="toolbox-card-icon forgepoints"></span>${t('ForgePoints')}</span>
									<span class="toolbox-card-value">${sp.all}</span>
								</div>
								<div class="toolbox-card-line">
									<span class="toolbox-card-label"><span class="toolbox-card-icon doubleloot"></span>${t('DoubleLootPartFP')}</span>
									<span class="toolbox-card-value">${sp.double}</span>
								</div>
							</div>`)}
					</div>
					<div class="filter">
						<div class="filterd-by"><b>${t('filteredByUser')}:</b><br>
							<span class="player-name">${f.text !== undefined ? f.text
								: html`${unsafeHTML(f.playerLink)}${f.guildLink ? html` [${unsafeHTML(f.guildLink)}]` : ''}`}</span>
						</div>
						<div class="filter-buttons">
							<div><button class="btn select-pvp-arena-opponents ${vm.filterByPvPArena ? 'btn-active' : ''}" ?disabled=${vm.noArena}
								title="${vm.noArena ? t('PvPArenaOpponentsInactive') : ''}"
								@click=${() => Looting.Reload(() => {
									Looting.page = 1;
									Looting.filterByPlayerId = null;
									Looting.filterByPvPArena = true;
								})}>${t('showPvPArenaOpponents')}</button></div>
							<div><button class="btn select-player ${!vm.filterByPvPArena && vm.filterByPlayerId === null ? 'btn-active' : ''}"
								@click=${() => Looting.SelectPlayer(null)}>${t('showAllPlayers')}</button></div>
						</div>
					</div>
				</div>
			</div>
			<div class="action-list">
				${vm.actions.length === 0 ? html`<div class="no-data"> - ${t('noData')} - </div>` : vm.actions.map(Looting.viewAction)}
			</div>
			<div class="pagination">
				${vm.page > 1 ? html`<button class="btn load-1st-page" @click=${() => Looting.Reload(() => Looting.page = 1)}>${t('goto1stPage')}</button>` : ''}
				${t('Page')} ${vm.page}/${vm.pages}
				${vm.pages > vm.page ? html`<button class="btn load-next-page" @click=${() => Looting.Reload(() => Looting.page++)}>${t('nextPage')}</button>` : ''}
			</div>`;
	},


	/**
	 * One row of the history
	 *
	 * @param action enriched action of getViewModel
	 * @returns {TemplateResult}
	 */
	viewAction: (action) => {
		const { html, unsafeHTML } = litHtml,
			t = (key) => i18n('Boxes.Looting.' + key),
			select = () => Looting.SelectPlayer(action.playerId);

		const type = {
			[Looting.ACTION_TYPE_LOOTED]: 'actionLooted',
			[Looting.ACTION_TYPE_BATTLE_WIN]: 'actionBattleWon',
			[Looting.ACTION_TYPE_BATTLE_LOSS]: 'actionBattleLost',
			[Looting.ACTION_TYPE_BATTLE_SURRENDERED]: 'actionSurrendered',
			[Looting.ACTION_TYPE_SHIELDED]: 'actionShielded',
			[Looting.ACTION_TYPE_REPELLED]: 'actionRepelled',
		}[action.type];

		return html`
			<div class="action-row action-row-type-${action.type}">
				<div class="avatar select-player game-cursor" @click=${select}>
					${action.isSamePlayer || !action.avatar ? '' : html`<img class="player-avatar" src="${action.avatar}" alt=""><br>`}
					<span class="type text-${action.type === Looting.ACTION_TYPE_BATTLE_LOSS ? 'danger' : 'success'}">${type ? t(type) : 'unknown'}</span>
					${action.pvpArena ? html`<br><span class="pvparena">${t('PvPArenaAction')}</span>` : ''}
				</div>
				<div class="info-column">
					<div>
						${moment(action.date).format(i18n('DateTime'))}<br>
						<em>${moment(action.date).fromNow()}</em>
					</div>
					<div>
						${action.isSamePlayer || !action.eraName ? '' : html`<div class="era" title="${t('PlayersEra')}: ${action.eraName}"><strong>${action.eraName}</strong></div>`}
					</div>
				</div>
				<div class="action-content">
					${action.isSamePlayer ? '' : html`
						<div class="player-name select-player game-cursor" @click=${select}>
							${action.playerId ? unsafeHTML(MainParser.GetPlayerLink(action.playerId, action.playerName)) : action.playerName}<br>
							<span class="clan">[${action.clanId ? unsafeHTML(MainParser.GetGuildLink(action.clanId, action.clanName)) : action.clanName}]</span>
						</div>`}
					<div class="content">${Looting.viewActionContent(action)}</div>
				</div>
			</div>`;
	},


	/**
	 * Type specific part of a row
	 *
	 * @param action
	 * @returns {TemplateResult|string}
	 */
	viewActionContent: (action) => {
		const { html } = litHtml,
			t = (key) => i18n('Boxes.Looting.' + key),
			buildingName = (MainParser.CityEntities?.[action.buildId] || { name: '-' }).name;

		switch (action.type) {
			case Looting.ACTION_TYPE_REPELLED:
				return html`
					<div class="loot-wrap">
						<div class="name">
							<img class="sabotage" src="${extUrl}css/images/plunderrepel.png" alt="" title="${t('actionRepelled')}">
							${buildingName}
						</div>
					</div>`;

			case Looting.ACTION_TYPE_LOOTED: {
				const resources = action.resources || {};

				return html`
					<div class="loot-wrap">
						<div class="name">
							<img class="sabotage" src="${extUrl}css/images/sabotage.png" alt="" title="${t('actionLooted')}">
							${action.doubleLoot ? html`<img class="doubleLoot" src="${extUrl}css/images/doubleloot.png" alt="" title="${t('doubleLoot')}">` : ''}
							${buildingName}
						</div>
						<div class="loot-items ${action.important ? 'text-warning' : ''}">
							${Object.keys(resources).map(id => {
								const str = `${resources[id]} ${(GoodsData[id] || { name: id }).name}`;
								return html`<div>${id === 'strategy_points' ? html`<strong>${str}</strong>` : str}</div>`;
							})}
						</div>
					</div>`;
			}

			case Looting.ACTION_TYPE_BATTLE_LOSS:
			case Looting.ACTION_TYPE_BATTLE_WIN:
			case Looting.ACTION_TYPE_BATTLE_SURRENDERED:
				if (!action.battle) return '-';

				return html`
					<div class="battle">
						<div><strong>${action.battle.auto ? t('autoBattle') : `${t('rounds')}: ${action.battle.round || 'N/A'}`}</strong></div>
						<div class="army-overview">
							<div class="army">${Looting.viewArmy(action.battle.myArmy)}</div>
							<div class="versus">VS</div>
							<div class="army">${Looting.viewArmy(action.battle.otherArmy)}</div>
						</div>
					</div>`;

			case Looting.ACTION_TYPE_SHIELDED:
				return html`
					<div class="shield-wrap">
						<div class="shield-explain">
							<img src="${extUrl}css/images/shield.png" alt="">
							${t('shieldProtectetUntil')} ${moment(action.expireTime * 1000).format(i18n('DateTime'))}<br>
							<em>${t('shieldUntil')} ${moment().to(action.expireTime * 1000)}</em>
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
	 * @returns {TemplateResult|string}
	 */
	viewArmy: (army) => {
		if (!Array.isArray(army) || army.length === 0) return '';

		const { html } = litHtml,
			t = (key) => i18n('Boxes.Looting.' + key),
			firstUnit = army[0],
			isSameStats = !army.some(it => ((it.attBoost || 0) !== (firstUnit.attBoost || 0) || (it.defBoost || 0) !== (firstUnit.defBoost || 0))),
			attBoost = firstUnit.attBoost || 0,
			defBoost = firstUnit.defBoost || 0;

		return html`
			${!isSameStats ? '' : html`
				<div class="stats-same-for-all">
					<span class="${attBoost ? 'text-success' : 'text-danger'}">${t('Attack')}: ${attBoost}%</span> - <span class="${defBoost ? 'text-success' : 'text-danger'}">${t('Defense')}: ${defBoost}%</span>
				</div>`}
			<div class="unit-wrap">${army.map(unit => Looting.viewUnit(unit, !isSameStats))}</div>`;
	},


	/**
	 * Health state of a unit
	 *
	 * @param unit
	 * @param showDetails
	 * @returns {TemplateResult}
	 */
	viewUnit: (unit, showDetails) => {
		const { html } = litHtml,
			t = (key) => i18n('Boxes.Looting.' + key),
			endHP = unit.endHp || 0,
			startHP = unit.startHP || 0,
			healthPerc = (startHP > 0 ? MainParser.round((1 - ((startHP - endHP) / startHP)) * 100) : 0),
			attBoost = unit.attBoost || 0,
			defBoost = unit.defBoost || 0,
			type = (Unit.Types || []).find(obj => obj['unitTypeId'] === unit.unitTypeId) || { name: unit.unitTypeId, unitClass: '' },
			era = Technologies.Eras[type.minEra],
			eraText = (era !== undefined ? ` (${i18n('Eras.' + era)})` : ''),
			// short era below the unit, coloured against the own era: older, same or newer
			hasEra = (era !== undefined && era > 0),
			eraShortKey = 'Boxes.Looting.EraShort.' + type.minEra,
			eraShort = !hasEra ? '–' : (i18n(eraShortKey) !== eraShortKey ? i18n(eraShortKey) : i18n('Eras.' + era)),
			ownEra = Technologies.Eras[CurrentEra],
			eraClass = (!hasEra || ownEra === undefined ? 'none' : era < ownEra ? 'older' : era === ownEra ? 'same' : 'newer');

		return html`
			<div class="unit" title="${t('Unit')}: ${type.name}${eraText}, HP: ${endHP}/${startHP}, ${t('Attack')}: ${attBoost}, ${t('Defense')}: ${defBoost}">
				<div class="unit-portrait">
					<img src="${srcLinks.get(`/shared/unit_portraits/armyuniticons_50x50/armyuniticons_50x50_${unit.unitTypeId}.jpg`, true, true)}" alt="">
					<span class="unit_skill ${type.unitClass}"></span>
				</div>
				<div class="health">
					<span style="width: ${healthPerc}%"></span>
				</div>
				<div class="unit-era ${eraClass}">${eraShort}</div>
				${showDetails ? html`
					<div class="stats">
						<div class="${!endHP ? 'text-danger' : ''}">${endHP}/${startHP}</div>
						<div class="${attBoost ? 'text-success' : ''}">${attBoost}%</div>
						<div class="${defBoost ? 'text-success' : ''}">${defBoost}%</div>
					</div>` : ''}
			</div>`;
	}
};
