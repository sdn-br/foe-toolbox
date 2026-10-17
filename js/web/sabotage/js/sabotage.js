/*
 * **************************************************************************************
 *
 * Dateiname:                 sabotage.js (Original Name: read-buildings.js)
 * Projekt:                   foe-chrome
 *
 * erstellt von:              Daniel Siekiera <daniel.siekiera@gmail.com>
 * erstellt am:	              22.12.19, 14:31 Uhr
 *
 * Copyright © 2019
 *
 * FoE Toolbox: city information / plunder helper, ported onto FoE Helfer 4.8.3.0.
 * Boosts and productions are read via CityBuildings.createBuilding (4.8.3 building model).
 *
 * **************************************************************************************
 */

FoEproxy.addHandler('OtherPlayerService', 'updatePlayer', (data, postData) => {
	Sabotage.UpdatePlayer(data.responseData?.[0]);
});

FoEproxy.addHandler('CityMapService', 'reset', (data, postData) => {
	Sabotage.RemovePlunderedEntity(data.responseData?.[0]);
});

FoEproxy.addHandler('OtherPlayerService', 'visitPlayer', (data, postData) => {
	MainParser.UpdatePlayerDict(data.responseData, 'VisitPlayer').then(() => {
		if (Settings.GetSetting('ShowPlayersAttDeffValues') || Settings.GetSetting('ShowNeighborsLootables')) {
			Sabotage.OtherPlayersBuildings(data.responseData);
			$('#sabotage-Btn').removeClass('hud-btn-red');
			$('#sabotage-Btn-closed').remove();
		}
		else {
			$('#sabotage-Btn').addClass('hud-btn-red');
			$('#sabotageInfo').remove();
		}
	});
});


let Sabotage = {

	/** productions shown in grey (unimportant) */
	UnimportantProds: ['supplies', 'money'],

	/** Looting.ACTION_TYPE_SHIELDED, table neighborhoodAttacks */
	ACTION_TYPE_SHIELDED: 5,

	data: {
		ready: [],
		work: []
	},
	OtherPlayer: undefined,
	PlayerId: undefined,
	PlayerName: undefined,
	ClanName: undefined,
	ClanId: undefined,
	PlayerEra: undefined,
	IsFriend: false,
	IsGuildMember: false,
	IsNeighbor: false,
	CityEntities: [],
	ArmyBoosts: {},
	PlunderRepel: 0,
	IsLootable: false,
	IsSabotageable: false,

	/** players with an alarm set in this session */
	AlertsSet: new Set(),


	/**
	 * Reads the interaction state of the visited player
	 *
	 * @param OtherPlayer other_player of visitPlayer / updatePlayer
	 */
	SetPlayerState: (OtherPlayer) => {
		Sabotage.OtherPlayer = OtherPlayer;
		Sabotage.IsFriend = OtherPlayer.is_friend;
		Sabotage.IsGuildMember = OtherPlayer.is_guild_member;
		Sabotage.IsNeighbor = OtherPlayer.is_neighbor;
		Sabotage.IsSabotageable = OtherPlayer.canSabotage;
		Sabotage.IsLootable = (Sabotage.IsNeighbor && !Sabotage.IsFriend && !Sabotage.IsGuildMember && (OtherPlayer.next_interaction_in === undefined || OtherPlayer.canSabotage));
	},


	/**
	 * Evaluates the buildings of the visited city
	 *
	 * @param dp responseData of OtherPlayerService.visitPlayer
	 */
	OtherPlayersBuildings: (dp) => {
		if (!dp?.other_player || !dp?.city_map?.entities) return;

		Sabotage.data.ready = [];
		Sabotage.data.work = [];

		Sabotage.SetPlayerState(dp.other_player);

		let PlayerId = Sabotage.PlayerId = dp.other_player.player_id,
			Player = PlayerDict[PlayerId] || {};

		Sabotage.PlayerName = Player['PlayerName'] || dp.other_player.name;
		Sabotage.ClanName = Player['ClanName'];
		Sabotage.ClanId = Player['ClanId'];
		Sabotage.PlayerEra = Player['Era'] || dp.other_player.era || dp.other_player_era;

		// a popped-out box is re-rendered in place, removing it would close its pop-up window
		if (!Popup.IsOpen('sabotageInfo')) {
			$('#sabotageInfo').remove();
		}

		// the building rating (part of createBuilding) reads the era of the visited city
		if (ActiveMap === 'OtherPlayer' && !CityMap.OtherPlayer.eraName && Sabotage.PlayerEra) {
			CityMap.OtherPlayer.eraName = Sabotage.PlayerEra;
		}

		let Entities = Sabotage.CityEntities = dp.city_map.entities,
			Boosts = {
				'att_boost_attacker-all': 0,
				'def_boost_attacker-all': 0,
				'att_boost_defender-all': 0,
				'def_boost_defender-all': 0,
			},
			PlunderRepel = 0;

		for (let Entity of Entities) {
			let MetaData = MainParser.CityEntities[Entity['cityentity_id']];
			if (!MetaData) continue;

			let StateClass = Entity['state']?.['__class__'];
			// buildings under construction and unconnected buildings (except culture) give no boosts and produce nothing
			if (StateClass === undefined || StateClass === 'ConstructionState') continue;
			if (StateClass === 'UnconnectedState' && MetaData.type !== 'culture') continue;

			let Building;
			try {
				let Era = Technologies.getEraName(Entity['cityentity_id'], Entity['level']);
				// allies of other players are not known, so no ally boosts
				Building = CityBuildings.createBuilding(MetaData, Era, Entity, false);
			}
			catch (e) {
				console.error('Sabotage: building could not be read', Entity['cityentity_id'], e);
				continue;
			}

			for (let Type of Object.keys(Boosts)) {
				Boosts[Type] += (Productions.getRatingValueForType(Building, Type) || 0);
			}
			PlunderRepel += Sabotage.GetPlunderRepel(Building);

			if (MetaData.is_plunderable && !(MetaData.is_motivatable && Building.state.isPolivated === true)) {
				Sabotage.ReadProduction(Entity, Building);
			}
		}

		Sabotage.ArmyBoosts = {
			AttackAttackBoost: Boosts['att_boost_attacker-all'],
			AttackDefenseBoost: Boosts['def_boost_attacker-all'],
			DefenseAttackBoost: Boosts['att_boost_defender-all'],
			DefenseDefenseBoost: Boosts['def_boost_defender-all'],
		};
		Sabotage.PlunderRepel = PlunderRepel;

		Sabotage.showResult();
	},


	/**
	 * Plunder repel boost of a building (feature "all")
	 *
	 * @param Building building of CityBuildings.createBuilding
	 * @returns {number}
	 */
	GetPlunderRepel: (Building) => {
		let Sum = 0;
		for (let Boost of (Building.boosts || [])) {
			if (Boost.feature !== 'all' || !Boost.type.includes('plunder_repel')) continue;
			if (Boost.needsLink && Building.setBuilding !== undefined && Boost.requiredLinks > (Building.setBuilding.uniqueAdjacentCount || 0)) continue;
			Sum += (parseFloat(Boost.value) || 0);
		}
		return Sum;
	},


	/**
	 * Collects the plunderable resources of a building
	 *
	 * @param Entity raw city map entity
	 * @param Building building of CityBuildings.createBuilding
	 */
	ReadProduction: (Entity, Building) => {
		let ProductionList = Building.state.production;
		if (!ProductionList || Building.state.name === 'idle') return;

		const BaseWeightFactor = 1000000000;
		let lines = [],
			IsImportant = false,
			WeightedAmount = 0;

		for (let Production of ProductionList) {
			let Resources = Production.resources || {};

			if (Production.type === 'resources' || Production.type === 'special_goods') {
				for (let k of Object.keys(Resources)) {
					let Amount = Resources[k],
						WeightFactor = 1,
						Unimportant = Sabotage.UnimportantProds.includes(k);

					if (typeof Amount !== 'number') continue;

					if (!Unimportant) {
						IsImportant = true;
					}
					else {
						WeightFactor /= BaseWeightFactor;
					}
					if (k === 'strategy_points') WeightFactor *= BaseWeightFactor;

					WeightedAmount += Amount * WeightFactor;

					lines.push({
						amount: Amount,
						name: GoodsData[k]?.name || k,
						strong: (k === 'strategy_points'),
						// own stock, shown for goods worth plundering
						stock: (k !== 'strategy_points' && !Unimportant ? (ResourceStock[k] || 0) : undefined),
					});
				}
			}
			// Hall of Fame and similar
			else if (Production.type === 'guildResources' && Resources['clan_power'] !== undefined) {
				IsImportant = true;
				lines.push({ amount: Resources['clan_power'], name: i18n('Boxes.Neighbors.GuildPower') });
			}
		}

		if (lines.length === 0) return;

		let entry = {
			name: MainParser.CityEntities[Entity['cityentity_id']]['name'],
			lines: lines,
			weightedAmount: WeightedAmount,
			state: (Building.state.name === 'collectable'),
			id: Entity['id'],
			isImportant: IsImportant
		};

		if (entry.state) {
			Sabotage.data.ready.push(entry);
		}
		else {
			Sabotage.data.work.push(entry);
		}
	},


	/**
	 * Shows the box: data and markup are separate steps, getViewModel collects, view renders
	 */
	showResult: async () => {
		if ($('#sabotageInfo').length === 0) {
			HTML.Box({
				id: 'sabotageInfo',
				title: i18n('Boxes.Sabotage.Title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				popout: () => MainParser.PopOut('sabotageInfo'),
			});

			HTML.AddCssFile('sabotage');
		}

		let vm = await Sabotage.getViewModel(),
			div = $('#sabotageInfo');

		// lit-html updates only what changed, the body element keeps its state across renders and pop-out moves
		litHtml.render(Sabotage.view(vm), div.find('#sabotageInfoBody')[0]);
		div.show();
	},


	/**
	 * Everything the box shows, as plain data
	 *
	 * @returns {Promise<Object>}
	 */
	getViewModel: async () => {
		let shieldTime = await Sabotage.GetActiveShield(Sabotage.PlayerId),
			isShielded = (shieldTime !== undefined),
			showCity = (ActiveMap === 'OtherPlayer' && LastMapPlayerID === Sabotage.PlayerId),
			attack;

		if ((!Sabotage.IsLootable || isShielded || Sabotage.IsSabotageable) && Settings.GetSetting('ShowNeighborsLootables')) {
			if (Sabotage.IsGuildMember || Sabotage.IsFriend || !Sabotage.IsNeighbor) {
				attack = { blocked: (Sabotage.IsGuildMember ? 'NoAttackGuildMember' : (Sabotage.IsFriend ? 'NoAttackFriend' : 'NoAttackNoNeighbor')) };
			}
			else {
				// getCurrentDateTime is in milliseconds
				let nextAttackTime = moment(MainParser.getCurrentDateTime()).add(Sabotage.OtherPlayer.next_interaction_in || 0, 'seconds');

				attack = Sabotage.IsSabotageable ? { textClass: 'success', i18nId: 'CanSabotage', time: nextAttackTime }
					: isShielded ? { textClass: 'error', i18nId: 'NextAttackTimeInfoShielded', time: shieldTime }
					: { textClass: 'error', i18nId: 'NextAttackTimeInfo', time: nextAttackTime };

				attack.alertSet = Sabotage.AlertsSet.has(Sabotage.PlayerId) || (await Sabotage.GetAlert(Sabotage.PlayerId) !== undefined);
			}
		}

		return {
			playerId: Sabotage.PlayerId,
			playerLink: MainParser.GetPlayerLink(Sabotage.PlayerId, Sabotage.PlayerName),
			guildLink: (Sabotage.ClanName ? MainParser.GetGuildLink(Sabotage.ClanId, Sabotage.ClanName) : undefined),
			era: (Sabotage.PlayerEra && Technologies.Eras[Sabotage.PlayerEra] !== undefined ? i18n('Eras.' + Technologies.Eras[Sabotage.PlayerEra]) : undefined),
			attack: attack,
			showCity: showCity,
			showLoot: (!Sabotage.IsGuildMember && typeof Looting !== 'undefined'),
			boosts: (Settings.GetSetting('ShowPlayersAttDeffValues') ? Object.assign({ PlunderRepel: Sabotage.PlunderRepel }, Sabotage.ArmyBoosts) : undefined),
			productions: (Settings.GetSetting('ShowNeighborsLootables') ? {
				notLootable: (!Sabotage.IsLootable || (!Sabotage.IsSabotageable && isShielded)),
				ready: helper.arr.multisort(Sabotage.data.ready, ['isImportant', 'weightedAmount', 'name'], ['DESC', 'DESC', 'ASC']),
			} : undefined),
		};
	},


	/**
	 * Markup of the box body, a pure function of the view model
	 *
	 * @param vm result of getViewModel
	 * @returns {TemplateResult}
	 */
	view: (vm) => {
		const { html, unsafeHTML } = litHtml,
			t = (key) => i18n('Boxes.Sabotage.' + key),
			fmt = (v) => Math.round(v * 100) / 100,
			a = vm.attack,
			b = vm.boosts,
			p = vm.productions;

		const productionLine = (l) => l.strong ? html`<strong>${l.amount} ${l.name}</strong>`
			: html`${l.amount} ${l.name}${l.stock !== undefined ? ` (${l.stock ? HTML.Format(l.stock) : 0})` : ''}`;

		const productionRow = (entry) => html`
			<tr class="${p.notLootable ? 'bg-red' : 'success'}">
				<td class="${p.notLootable ? 'error' : ''} ${entry.isImportant ? '' : 'unimportant'}">${entry.name}</td>
				<td class="${p.notLootable ? 'error' : ''} ${entry.isImportant ? '' : 'unimportant'}">${entry.lines.map((l, i) => html`${i > 0 ? html`<br>` : ''}${productionLine(l)}`)}</td>
				<td>${vm.showCity ? html`<span class="show-entity game-cursor" @click=${() => Sabotage.ShowFunction(entry.id)}><img src="${extUrl}css/images/hud/open-eye.png"></span>` : ''}</td>
			</tr>`;

		return html`
			<div class="text-center dark-bg toolbox-head">
				<p class="header"><strong><span class="player-name">${unsafeHTML(vm.playerLink)}${vm.guildLink ? html`<br>[${unsafeHTML(vm.guildLink)}]` : ''}</span></strong></p>
				${vm.era ? html`<p><strong>${t('PlayerEra')}: ${vm.era}</strong></p>` : ''}
				${!a ? '' : a.blocked ? html`<p class="error"><strong>${t(a.blocked)}</strong></p>` : html`
					<p class="${a.textClass}"><strong>${HTML.i18nReplacer(t(a.i18nId), { nextattacktime: a.time.format('DD.MM.YYYY HH:mm:ss') })}</strong>
						<button class="btn btn-sabotage-alarm" ?disabled=${a.alertSet} @click=${() => Sabotage.SetAlert(vm.playerId, a.time.unix())}>${t(a.alertSet ? 'AlreadySetAlarm' : 'SetAlarm')}</button></p>`}
				${vm.showCity || vm.showLoot ? html`<p>
					${vm.showCity ? html`<span class="btn button-showcity" @click=${() => Sabotage.ShowFunction()}>${t('ShowCity')}</span>` : ''}
					${vm.showLoot ? html`<span class="btn button-showloot" @click=${() => Sabotage.ShowLoot(vm.playerId)}>${t('ShowLoot')}</span>` : ''}
				</p>` : ''}
				${!b ? '' : html`
					<table id="attdeftab"><tbody>
						<tr>
							<td colspan="2" class="text-center army"><strong>${t('AttackingArmy')}</strong></td>
							<td colspan="3" class="text-center army"><strong>${t('DefendingArmy')}</strong></td>
						</tr>
						<tr>
							${['Attack', 'Defense', 'Attack', 'Defense', 'PlunderRepel'].map(k => html`<td class="text-center army"><strong>${t(k)}</strong></td>`)}
						</tr>
						<tr>
							<td class="text-center army-boost"><strong>${fmt(b.AttackAttackBoost)}% (max ${fmt(b.AttackAttackBoost + 50)}%)</strong></td>
							<td class="text-center army-boost"><strong>${fmt(b.AttackDefenseBoost)}%</strong></td>
							<td class="text-center army-boost"><strong>${fmt(b.DefenseAttackBoost)}%</strong></td>
							<td class="text-center army-boost"><strong>${fmt(b.DefenseDefenseBoost)}% (max ${fmt(b.DefenseDefenseBoost + 60)}%)</strong></td>
							<td class="text-center army-boost"><strong>${fmt(b.PlunderRepel)}%</strong></td>
						</tr>
					</tbody></table>`}
			</div>
			${!p ? '' : html`
				<table class="foe-table">
					<thead><tr><th colspan="${p.ready.length > 0 ? 3 : 1}" class="production-headline"><strong>${i18n('Boxes.Neighbors.ReadyProductions')}</strong></th></tr></thead>
					<tbody>
						${p.ready.length > 0 ? p.ready.map(productionRow) : html`
							<tr class="${p.notLootable ? 'bg-red' : ''}"><td class="text-center">${t('NoProductionsAvailable')}</td></tr>`}
					</tbody>
				</table>`}`;
	},


	ShowLoot: (PlayerId) => {
		Looting.filterByPlayerId = PlayerId;
		Looting.page = 1;
		Looting.Show();
	},


	/**
	 * Opens the city map of the visited player, optionally highlighting a building
	 *
	 * @param id city map entity id
	 */
	ShowFunction: (id) => {
		if (ActiveMap !== 'OtherPlayer' || LastMapPlayerID !== Sabotage.PlayerId) return;

		CityMap.init(true);

		if (id === undefined) return;

		// the map renders asynchronously (see CityMap.init)
		let tries = 0;
		let highlight = () => {
			let entity = $(`#map-buildings .entity[data-id="${id}"]`);
			if (entity.length === 0) {
				if (++tries < 20) setTimeout(highlight, 150);
				return;
			}
			$('#map-buildings .entity').removeClass('highlighted');
			entity.addClass('highlighted');
			CityMap.FocusEntities(entity.toArray());
		};
		setTimeout(highlight, 300);
	},


	UpdatePlayer: (ud) => {
		if (!ud || !Sabotage.OtherPlayer || ud.player_id !== Sabotage.OtherPlayer.player_id) return;

		Sabotage.SetPlayerState(ud);

		if ($('#sabotageInfo').is(':visible')) {
			Sabotage.showResult();
		}
	},


	RemovePlunderedEntity: (pd) => {
		if (!pd || pd.player_id !== Sabotage.PlayerId) return;

		Sabotage.data.ready = Sabotage.data.ready.filter(e => e.id !== pd.id);
		if ($('#sabotageInfo').is(':visible')) {
			Sabotage.showResult();
		}
	},


	/**
	 * End of the city shield, from the PvP history (table neighborhoodAttacks)
	 *
	 * @param PlayerId
	 * @returns {Promise<moment|undefined>}
	 */
	GetActiveShield: async (PlayerId) => {
		await IndexDB.getDB();
		let lastShieldAction = await IndexDB.db.neighborhoodAttacks.where({ playerId: PlayerId }).and(it => it.type === Sabotage.ACTION_TYPE_SHIELDED).last();
		if (!lastShieldAction) return;

		let shieldTime = moment.unix(lastShieldAction.expireTime);
		if (shieldTime.isBefore(moment())) return;

		return shieldTime;
	},


	GetAlert: async (PlayerId) => {
		if (typeof Alerts === 'undefined') return;

		let title = Sabotage.GetPlayerName(PlayerId);

		return Alerts.getAll().then((resp) => {
			if (!resp || resp.length === 0) return;

			return resp.find(alert => alert['data']['category'] === 'sabotage' && alert['data']['title'] === title && alert['data']['expires'] > MainParser.getCurrentDateTime());
		}).catch(() => undefined);
	},


	GetPlayerName: (PlayerId) => {
		return PlayerDict[PlayerId]?.['PlayerName'] || (PlayerId === Sabotage.PlayerId ? Sabotage.PlayerName : '') || '';
	},


	SetAlert: (PlayerId, nextAttackTime) => {
		let title = Sabotage.GetPlayerName(PlayerId);
		const data = {
			title: title,
			body: HTML.i18nReplacer(i18n('Boxes.Sabotage.SaveAlert'), { playerName: title, nextattacktime: moment.unix(nextAttackTime).format('DD.MM.YYYY HH:mm:ss') }),
			expires: (nextAttackTime - 30) * 1000, // -30s, in milliseconds
			repeat: -1,
			persistent: true,
			tag: '',
			category: 'sabotage',
			vibrate: false,
			actions: null
		};

		MainParser.sendExtMessage({
			type: 'alerts',
			playerId: ExtPlayerID,
			action: 'create',
			data: data,
		});

		HTML.ShowToastMsg({
			head: i18n('Boxes.Sabotage.SaveMessage.Title'),
			text: HTML.i18nReplacer(i18n('Boxes.Sabotage.SaveMessage.Desc'), { playerName: title }),
			type: 'success',
			hideAfter: 5000
		});

		Sabotage.AlertsSet.add(PlayerId);
		if ($('#sabotageInfo').is(':visible')) {
			Sabotage.showResult();
		}
	},
};
