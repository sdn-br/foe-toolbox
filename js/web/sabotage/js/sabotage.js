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
		let g = [],
			IsImportant = false,
			WeightedAmount = 0;

		for (let Production of ProductionList) {
			let Resources = Production.resources || {};

			if (Production.type === 'resources' || Production.type === 'special_goods') {
				for (let k of Object.keys(Resources)) {
					let Amount = Resources[k],
						WeightFactor = 1,
						Name = GoodsData[k]?.name || k;

					if (typeof Amount !== 'number') continue;

					if (!Sabotage.UnimportantProds.includes(k)) {
						IsImportant = true;
					}
					else {
						WeightFactor /= BaseWeightFactor;
					}
					if (k === 'strategy_points') WeightFactor *= BaseWeightFactor;

					WeightedAmount += Amount * WeightFactor;

					if (k === 'strategy_points') {
						g.push('<strong>' + Amount + ' ' + Name + '</strong>');
					}
					else if (!Sabotage.UnimportantProds.includes(k)) {
						g.push(Amount + ' ' + Name + ' (' + (ResourceStock[k] ? HTML.Format(ResourceStock[k]) : 0) + ')');
					}
					else {
						g.push(Amount + ' ' + Name);
					}
				}
			}
			// Hall of Fame and similar
			else if (Production.type === 'guildResources' && Resources['clan_power'] !== undefined) {
				IsImportant = true;
				g.push(Resources['clan_power'] + ' ' + i18n('Boxes.Neighbors.GuildPower'));
			}
		}

		if (g.length === 0) return;

		let Name = MainParser.CityEntities[Entity['cityentity_id']]['name'],
			Amount = g.join('<br>');

		let entry = {
			name: (IsImportant ? Name : '<span style="color:grey;">' + Name + '</span>'),
			amount: (IsImportant ? Amount : '<span style="color:grey;">' + Amount + '</span>'),
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
	 * Shows the box
	 */
	showResult: async () => {
		let rd = helper.arr.multisort(Sabotage.data.ready, ['isImportant', 'weightedAmount', 'name'], ['DESC', 'DESC', 'ASC']);

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

			// delegated once on the box, only the body content is replaced on render
			const box = $('#sabotageInfo');
			box.on('click', '#sabotageInfoBody .show-entity', function () {
				Sabotage.ShowFunction($(this).data('id'));
			});
			box.on('click', '#sabotageInfoBody .button-showcity', function () {
				Sabotage.ShowFunction();
			});
			box.on('click', '#sabotageInfoBody .button-showloot', function () {
				Looting.filterByPlayerId = Sabotage.PlayerId;
				Looting.page = 1;
				Looting.Show();
			});
		}

		let div = $('#sabotageInfo'),
			h = [];
		const boosts = Sabotage.ArmyBoosts;

		h.push('<div class="text-center dark-bg" style="padding:5px 0 3px;">');
		h.push('<p class="header"><strong>');
		h.push('<span class="player-name">' + MainParser.GetPlayerLink(Sabotage.PlayerId, Sabotage.PlayerName));

		if (Sabotage.ClanName) {
			h.push(`<br>[${MainParser.GetGuildLink(Sabotage.ClanId, Sabotage.ClanName)}]`);
		}

		h.push('</span>');
		h.push('</strong></p>');
		if (Sabotage.PlayerEra && Technologies.Eras[Sabotage.PlayerEra] !== undefined) {
			h.push(`<p><strong>${i18n('Boxes.Sabotage.PlayerEra')}: ${i18n('Eras.' + Technologies.Eras[Sabotage.PlayerEra])}</strong></p>`);
		}

		let shieldTime = await Sabotage.GetActiveShield(Sabotage.PlayerId);
		let isShielded = (shieldTime !== undefined);

		if ((!Sabotage.IsLootable || isShielded || Sabotage.IsSabotageable) && Settings.GetSetting('ShowNeighborsLootables')) {
			if (Sabotage.IsGuildMember || Sabotage.IsFriend || !Sabotage.IsNeighbor) {
				let MsgType = (Sabotage.IsGuildMember ? 'NoAttackGuildMember' : (Sabotage.IsFriend ? 'NoAttackFriend' : 'NoAttackNoNeighbor'));
				h.push(`<p class="error"><strong>${i18n('Boxes.Sabotage.' + MsgType)}</strong></p>`);
			}
			else {
				let nextInteractionTime,
					textClass,
					i18nId;

				// getCurrentDateTime is in milliseconds
				let nextAttackTime = moment(MainParser.getCurrentDateTime()).add(Sabotage.OtherPlayer.next_interaction_in || 0, 'seconds');
				let alertAvailable = (await Sabotage.GetAlert(Sabotage.PlayerId) !== undefined);
				let buttonI18nId = (!alertAvailable ? 'Boxes.Sabotage.SetAlarm' : 'Boxes.Sabotage.AlreadySetAlarm');

				if (Sabotage.IsSabotageable) {
					textClass = 'success';
					i18nId = 'Boxes.Sabotage.CanSabotage';
					nextInteractionTime = nextAttackTime;
				}
				else if (isShielded) {
					textClass = 'error';
					i18nId = 'Boxes.Sabotage.NextAttackTimeInfoShielded';
					nextInteractionTime = shieldTime;
				}
				else {
					textClass = 'error';
					i18nId = 'Boxes.Sabotage.NextAttackTimeInfo';
					nextInteractionTime = nextAttackTime;
				}

				let buttonAction = (!alertAvailable ? ` onclick="Sabotage.SetAlert(${Sabotage.PlayerId}, ${nextInteractionTime.unix()})"` : '');

				h.push(`<p class="${textClass}"><strong>${HTML.i18nReplacer(i18n(i18nId), {
					nextattacktime: nextInteractionTime.format('DD.MM.YYYY HH:mm:ss')
				})}</strong> <button${alertAvailable ? ' disabled' : ''} class="btn btn-sabotage-alarm" id="alert-sabotage-${Sabotage.PlayerId}"${buttonAction}>${i18n(buttonI18nId)}</button></p>`);
			}
		}

		let ShowCity = (ActiveMap === 'OtherPlayer' && LastMapPlayerID === Sabotage.PlayerId),
			ShowLoot = (!Sabotage.IsGuildMember && typeof Looting !== 'undefined');

		if (ShowCity || ShowLoot) {
			h.push('<p>');
			if (ShowCity) h.push(`<span class="btn button-showcity">${i18n('Boxes.Sabotage.ShowCity')}</span>`);
			if (ShowLoot) h.push(`<span class="btn button-showloot">${i18n('Boxes.Sabotage.ShowLoot')}</span>`);
			h.push('</p>');
		}

		if (Settings.GetSetting('ShowPlayersAttDeffValues')) {
			let fmt = (v) => Math.round(v * 100) / 100;

			h.push('<table id="attdeftab"><tbody><tr>');
			h.push(`<td colspan="2" class="text-center army"><strong>${i18n('Boxes.Sabotage.AttackingArmy')}</strong></td>`);
			h.push(`<td colspan="3" class="text-center army"><strong>${i18n('Boxes.Sabotage.DefendingArmy')}</strong></td>`);
			h.push('</tr><tr>');
			h.push(`<td class="text-center army"><strong>${i18n('Boxes.Sabotage.Attack')}</strong></td>`);
			h.push(`<td class="text-center army"><strong>${i18n('Boxes.Sabotage.Defense')}</strong></td>`);
			h.push(`<td class="text-center army"><strong>${i18n('Boxes.Sabotage.Attack')}</strong></td>`);
			h.push(`<td class="text-center army"><strong>${i18n('Boxes.Sabotage.Defense')}</strong></td>`);
			h.push(`<td class="text-center army"><strong>${i18n('Boxes.Sabotage.PlunderRepel')}</strong></td>`);
			h.push('</tr><tr>');
			h.push(`<td class="text-center army-boost"><strong>${fmt(boosts.AttackAttackBoost)}% (max ${fmt(boosts.AttackAttackBoost + 50)}%)</strong></td>`);
			h.push(`<td class="text-center army-boost"><strong>${fmt(boosts.AttackDefenseBoost)}%</strong></td>`);
			h.push(`<td class="text-center army-boost"><strong>${fmt(boosts.DefenseAttackBoost)}%</strong></td>`);
			h.push(`<td class="text-center army-boost"><strong>${fmt(boosts.DefenseDefenseBoost)}% (max ${fmt(boosts.DefenseDefenseBoost + 60)}%)</strong></td>`);
			h.push(`<td class="text-center army-boost"><strong>${fmt(Sabotage.PlunderRepel)}%</strong></td>`);
			h.push('</tr></tbody></table>');
		}
		h.push('</div>');

		if (Settings.GetSetting('ShowNeighborsLootables')) {
			let NotLootable = (!Sabotage.IsLootable || (!Sabotage.IsSabotageable && isShielded));

			h.push('<table class="foe-table">');
			h.push('<thead>');
			h.push('<tr>');
			h.push(`<th${rd.length > 0 ? ' colspan="3"' : ''} class="production-headline"><strong>${i18n('Boxes.Neighbors.ReadyProductions')}</strong></th>`);
			h.push('</tr>');
			h.push('</thead>');
			h.push('<tbody>');

			for (let entry of rd) {
				h.push(`<tr class="${NotLootable ? 'bg-red' : 'success'}">`);
				h.push(`<td${NotLootable ? ' class="error"' : ''}>${entry['name']}</td>`);
				h.push(`<td${NotLootable ? ' class="error"' : ''}>${entry['amount']}</td>`);
				h.push(ShowCity ? `<td><span class="show-entity game-cursor" data-id="${entry['id']}"><img src="${extUrl}css/images/hud/open-eye.png"></span></td>` : '<td></td>');
				h.push('</tr>');
			}

			if (rd.length === 0) {
				h.push(`<tr class="${NotLootable ? 'bg-red' : ''}">`);
				h.push(`<td class="text-center">${i18n('Boxes.Sabotage.NoProductionsAvailable')}</td>`);
				h.push('</tr>');
			}

			h.push('</tbody>');
			h.push('</table>');
		}

		div.find('#sabotageInfoBody').html(h.join(''));
		div.show();
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

		let btn = $(`#alert-sabotage-${PlayerId}`);
		btn.html(i18n('Boxes.Sabotage.AlreadySetAlarm'));
		btn.prop('onclick', null).off('click');
		btn.attr('disabled', '');
	},
};
