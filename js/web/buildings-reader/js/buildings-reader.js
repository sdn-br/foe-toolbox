/*
 * **************************************************************************************
 *
 * Dateiname:                 buildings-reader.js (Original Name: read-buildings.js)
 * Projekt:                   foe-chrome
 *
 * erstellt von:              Daniel Siekiera <daniel.siekiera@gmail.com>
 * erstellt am:	              22.12.19, 14:31 Uhr
 * zuletzt bearbeitet:       22.12.19, 14:31 Uhr
 *
 * Copyright © 2019
 *
 * **************************************************************************************
 */

// https://foede.innogamescdn.com/start/metadata?id=city_entities-xxxxxxx

// nicht plünderbare Gebäude

let BlackListBuildingsArray = [
	'R_MultiAge_CulturalBuilding6b', // Königliches Badehaus lvl2
	'R_MultiAge_CulturalBuilding6c', // Königliches Badehaus lvl3
	'R_MultiAge_CulturalBuilding6d', // Königliches Badehaus lvl4
	'R_MultiAge_CulturalBuilding6e', // Königliches Badehaus lvl5
	'R_MultiAge_CulturalBuilding6f', // Königliches Badehaus lvl6
];

let BlackListBuildingsString = [
	'R_MultiAge_SummerBonus19', //Großer Leuchtturm
	'R_MultiAge_Battlegrounds1', //Ehrenstatue
	'R_MultiAge_PatrickBonus21', //Druidentempel
];

// grau darzustellende Produktionen
let UnimportantProds = [
	'supplies', // Vorräte
	'money'     // Münzen
];

/*FoEproxy.addHandler('ArmyUnitManagementService', 'getArmyInfo', (data, postData) => {
	console.log(data);
	$('#sabotageInfo').remove();
});*/

FoEproxy.addHandler('OtherPlayerService', 'updatePlayer', (data, postData) => {
	BuildingsReader.UpdatePlayer(data.responseData[0]);	
});
/**
 *
 * @type {{data: {}, CityEntities: [], ShowFunction: BuildingsReader.ShowFunction, OtherPlayersBuildings: BuildingsReader.OtherPlayersBuildings, player_name: string, showResult: BuildingsReader.showResult}}
 */
let BuildingsReader = {

	data: {},
	OtherPlayer: undefined,
	PlayerName: undefined,
	ClanName: undefined,
	IsFriend: false,
	IsGuildMember: false,
	IsNeighbor: false,
	CityEntities: [],
	ArmyBoosts: [],
	IsLootable: false,
	IsSabotageable: false,
	
	/**
	 * Die Gebäude ermitteln
	 *
	 * @param dp
	 */
	OtherPlayersBuildings: (dp) => {

		BuildingsReader.data = {
			ready: [],
			work: []
		};

		BuildingsReader.OtherPlayer = dp.other_player;

		BuildingsReader.IsFriend = BuildingsReader.OtherPlayer.is_friend;
		BuildingsReader.IsGuildMember = BuildingsReader.OtherPlayer.is_guild_member;
		BuildingsReader.IsNeighbor = BuildingsReader.OtherPlayer.is_neighbor;
		BuildingsReader.IsSabotageable = BuildingsReader.OtherPlayer.canSabotage;
		BuildingsReader.IsLootable = (BuildingsReader.IsNeighbor && !BuildingsReader.IsFriend && !BuildingsReader.IsGuildMember && (BuildingsReader.OtherPlayer.next_interaction_in === undefined || BuildingsReader.OtherPlayer.canSabotage));

		// Werte des letzten Nachbarn löschen
		CityMap.CityData = null;

		let PlayerID = BuildingsReader.OtherPlayer.player_id;

		BuildingsReader.PlayerName = PlayerDict[PlayerID]['PlayerName'];
		BuildingsReader.ClanName = PlayerDict[PlayerID]['ClanName'];

		$('#sabotageInfo').remove();

		let d = dp['city_map']['entities'];

        BuildingsReader.CityEntities = d;      

		let BoostDict = [];
        for (let i in d) {
			if (d.hasOwnProperty(i)) {
			let id = d[i]['cityentity_id'];

			if (d[i]['bonus'] !== undefined) {
				let BoostType = d[i]['bonus']['type'];
				let BoostValue = d[i]['bonus']['value'];
				if (BoostType !== undefined && BoostValue !== undefined) {
					BoostDict[BoostType] |= 0;
					BoostDict[BoostType] += BoostValue;
				}
			}

			let BuildingData = MainParser.CityEntities[id];
			if (d[i]['state'] !== undefined && d[i]['state']['__class__'] !== 'ConstructionState' && d[i]['state']['__class__'] !== 'UnconnectedState') {
				if (BuildingData['abilities'] !== undefined) {
					for (let ability in BuildingData['abilities']) {
						if (!BuildingData['abilities'].hasOwnProperty(ability))  continue;
						let CurrentAbility = BuildingData['abilities'][ability];
						if (CurrentAbility['boostHints'] !== undefined) {
							for (let boostHint in CurrentAbility['boostHints']) {
								if (!CurrentAbility['boostHints'].hasOwnProperty(boostHint)) continue;

								let CurrentBoostHint = CurrentAbility['boostHints'][boostHint];
								BuildingsReader.HandleBoostEraMap(BoostDict, CurrentBoostHint['boostHintEraMap'], d[i]);
							}
						}

						if (CurrentAbility['bonuses'] !== undefined) {
							for (let bonus in CurrentAbility['bonuses']) {
								if (!CurrentAbility['bonuses'].hasOwnProperty(bonus)) continue;

								let CurrentBonus = CurrentAbility['bonuses'][bonus];
								BuildingsReader.HandleBoostEraMap(BoostDict, CurrentBonus['boost'], d[i]);
							}
						}

						if (CurrentAbility['bonusGiven'] !== undefined) {
							let CurrentBonus = CurrentAbility['bonusGiven'];
							BuildingsReader.HandleBoostEraMap(BoostDict, CurrentBonus['boost'], d[i]);
                           }
						}
					}
				}
				                
                if (BlackListBuildingsArray.includes(id) === false && BlackListBuildingsString.indexOf(id.substring(0, id.length-1)) === -1) {
                    if (d[i]['state'] !== undefined && d[i]['state']['current_product'] !== undefined) {
                        if (d[i]['type'] === 'goods') {
                            GoodsParser.readType(d[i]);
                        }
                        else if ((d[i]['type'] === 'residential' || d[i]['type'] === 'production' || d[i]['type'] === 'clan_power_production') && d[i]['state']['is_motivated'] === false) {
                            GoodsParser.readType(d[i]);
                        }
                    }
                }
            }
		}

		BuildingsReader.ArmyBoosts = Unit.GetBoostSums(BoostDict);

		BuildingsReader.showResult();
	},


	/**
	 * Boosts aus einer Era Map suchen und das BoostDict aktualisieren
	 * */
	HandleBoostEraMap: (BoostDict, BoostEraMap, Building) => {
		if (BoostEraMap === undefined) return;

		for (let EraName in BoostEraMap) {
			if (!BoostEraMap.hasOwnProperty(EraName)) continue;

			let EraBoosts = BoostEraMap[EraName];
			let BuildingEraName = Building['level'] !== undefined ? Technologies.EraNames[Building['level'] + 1] : undefined;

			if (EraName === 'AllAge' || EraName === BuildingEraName) {
				let BoostType = EraBoosts['type'];
				let BoostValue = EraBoosts['value'];

				if (BoostType !== undefined && BoostValue !== undefined) {
					BoostDict[BoostType] |= 0;
					BoostDict[BoostType] += BoostValue;
					//if (BoostType === 'att_boost_attacker' || BoostType === 'military_boost' || BoostType === 'advanced_tactics') {
					//		(MainParser.CityEntities[Building['cityentity_id']].name + ' ' + BoostType + '_ ' + BoostValue + '%');
					//}
				}
			}
		}
    },


	/**
	 *  HTML Box anzeigen
	 */
	showResult: async() => {
		// let d = helper.arr.multisort(BuildingsReader.data, ['name'], ['ASC']);
		let rd = helper.arr.multisort(BuildingsReader.data.ready, ['isImportant', 'weightedAmount', 'name'], ['DESC', 'DESC', 'ASC']);
		
		let wk = helper.arr.multisort(BuildingsReader.data.work, ['isImportant', 'weightedAmount', 'name'], ['DESC', 'DESC', 'ASC']);

		// Wenn die Box noch nicht da ist, neu erzeugen und in den DOM packen
		if ($('#sabotageInfo').length === 0) {
			
			HTML.Box({
				'id': 'sabotageInfo',
				'title': i18n('Boxes.Sobotage.Title'),
				'auto_close': true,
				'dragdrop': true,
				'minimize': true,
				//'speaker': 'SabotageTone'
			});

			// CSS in den DOM prügeln
			HTML.AddCssFile('buildings-reader');
		}

		let div = $('#sabotageInfo'),
			h = [];
        const boosts = BuildingsReader.ArmyBoosts;
		h.push('<div class="text-center dark-bg" style="padding:5px 0 3px;">');
		h.push('<p class="header"><strong>');
        h.push('<span class="player-name">' + BuildingsReader.PlayerName);

		if (BuildingsReader.ClanName) {
			h.push(` [${BuildingsReader.ClanName}]`);
		}

		h.push('</span>');
		h.push('</strong></p>');
		if ((!BuildingsReader.IsLootable || BuildingsReader.IsSabotageable) && Settings.GetSetting('ShowNeighborsLootables'))
		{
			let nextAttackTime = moment.unix(MainParser.LastResponseTimestamp).add(BuildingsReader.OtherPlayer.next_interaction_in, 'seconds');
			if (BuildingsReader.IsGuildMember || BuildingsReader.IsFriend || !BuildingsReader.IsNeighbor) {
				let MsgType = (BuildingsReader.IsGuildMember ? 'NoAttackGuildMember' : (BuildingsReader.IsFriend ? 'NoAttackFriend' : 'NoAttackNoNeighbor'))
				h.push(`<p class="error"><strong>${i18n('Boxes.Sabotage.'+MsgType)}</strong></p>`);
			} else if (BuildingsReader.IsSabotageable) {
				h.push(`<p class="success"><strong>${HTML.i18nReplacer(i18n('Boxes.Sabotage.CanSabotage'), {
					nextattacktime: nextAttackTime.format('DD.MM.YYYY HH:mm:ss')
				})}</strong></p>`);
			} else {
				h.push(`<p class="error"><strong>${HTML.i18nReplacer(i18n('Boxes.Sabotage.NextAttackTimeInfo'), {
					nextattacktime: nextAttackTime.format('DD.MM.YYYY HH:mm:ss')
				})}</strong>`);
				
				if (await BuildingsReader.GetAlert(BuildingsReader.OtherPlayer.player_id) === undefined) {
					h.push(`  <button class="btn btn-default btn-sabotage-alarm" id="alert-sabotage-${BuildingsReader.OtherPlayer.player_id}"  onclick="BuildingsReader.SetAlert(${BuildingsReader.OtherPlayer.player_id}, ${nextAttackTime.unix()})">${i18n('Boxes.Sabotage.SetAlarm')}</button>`);
				} else {
					h.push(`  <button disabled class="btn btn-default btn-sabotage-alarm" id="alert-sabotage-${BuildingsReader.OtherPlayer.player_id}">${i18n('Boxes.Sabotage.AlreadySetAlarm')}</button>`);
				}
				h.push('</p>');
			}
		}
		
		h.push('<p><span class="btn-default button-showcity">' + i18n('Boxes.Sabotage.ShowCity') + '</span></p>');
        
		h.push('</p>');
		
        if (Settings.GetSetting('ShowPlayersAttDeffValues'))
		{
			h.push('<table style="width: 100%; margin-bottom: 5px;" id="attdeftab"><tbody><tr><td>');		
			h.push('<table style="width:100%">');
			h.push('<thead>');
			h.push('<tr>');
			h.push(`<th class="text-center army"><strong>${i18n('Boxes.Sabotage.AttackingArmy')}</strong></th>`);
			h.push('</tr>');
			h.push('</thead>');
			h.push('</table>');
			
			h.push('</td><td>');

			h.push('<table style="width:100%">');
			h.push('<thead>');
			h.push('<tr>');
			h.push(`<th class="text-center army"><strong>${i18n('Boxes.Sabotage.DefendingArmy')}</strong></th>`);
			h.push('</tr>');
			h.push('</thead>');
			h.push('</table>');

			h.push('</td></tr><tr><td>');

			h.push('<table style="width:100%">');
			h.push('<thead>');
			h.push('<tr>');
			h.push(`<th class="text-center army"><strong>${i18n('Boxes.Sabotage.Attack')}</strong></th>`);
			h.push(`<th class="text-center army"><strong>${i18n('Boxes.Sabotage.Defense')}</strong></th>`);
			h.push('</tr>');
			h.push('</thead>');
			h.push('<tbody>');
			h.push('<tr>');
			h.push(`<td class="text-center army-boost"><strong>${boosts.AttackAttackBoost}% (max ${boosts.AttackAttackBoost + 50}%)</strong></td>`);
			h.push(`<td class="text-center army-boost"><strong>${boosts.AttackDefenseBoost}%</strong></td>`);
			h.push('</tr>');
			h.push('</tbody>');
			h.push('</table>');
			
			h.push('</td><td>');

			h.push('<table style="width:100%">');
			h.push('<thead>');
			h.push('<tr>');
			h.push(`<th class="text-center army"><strong>${i18n('Boxes.Sabotage.Attack')}</strong></th>`);
			h.push(`<th class="text-center army"><strong>${i18n('Boxes.Sabotage.Defense')}</strong></th>`);
			h.push('</tr>');
			h.push('</thead>');
			h.push('<tbody>');
			h.push('<tr>');
			h.push(`<td class="text-center army-boost"><strong>${boosts.DefenseAttackBoost}%</strong></td>`);
			h.push(`<td class="text-center army-boost"><strong>${boosts.DefenseDefenseBoost}% (max ${boosts.DefenseDefenseBoost + 60}%)</strong></td>`);
			h.push('</tr>');
			h.push('</tbody>');
			h.push('</table>');
			
			h.push('</td></tr></tbody></table>');
		}
		h.push('</div>');		

		if (Settings.GetSetting('ShowNeighborsLootables'))
		{
			h.push('<table class="foe-table" style="margin-bottom: 5px; margin-top:2px;">');

			h.push('<thead>');

			h.push('<tr>');
			h.push(`<th${rd.length > 0 ? ' colspan="3"' : ''} class="production-headline"><strong>${i18n('Boxes.Neighbors.ReadyProductions')}</strong></th>`);
			h.push('</tr>');

			h.push('</thead>');
			h.push('<tbody>');

			for (let i in rd) {
				if (rd.hasOwnProperty(i)) {
					h.push(`<tr class="${!BuildingsReader.IsLootable ? 'bg-red' : 'success'}">`);
					h.push(`<td${!BuildingsReader.IsLootable ? ' class="error"' : ''}>${rd[i]['name']}</td>`);
					h.push(`<td${!BuildingsReader.IsLootable ? ' class="error"' : ''}>${rd[i]['amount']}</td>`);
					h.push('<td><span class="show-entity" data-id="' + rd[i]['id'] + '"><img class="game-cursor" src="' + extUrl + 'css/images/hud/open-eye.png"></span></td>');
					h.push('</tr>');
				}
			}

			if (rd.length == 0) {
				h.push(`<tr class="${!BuildingsReader.IsLootable ? 'bg-red' : ''}">`);
				h.push(`<td class="text-center">${i18n('Boxes.Sabotage.NoProductionsAvailable')}</td>`);
				h.push('</tr>');					
			}

			h.push('</tbody>');
			h.push('</table>');
		}

		/*if (wk.length > 0) {

			h.push('<table class="foe-table">');

			h.push('<thead>');

			h.push('<tr>');
			h.push('<th colspan="3" class="production-headline"><strong>' + i18n('Boxes.Neighbors.OngoingProductions') + '</strong></th>');
			h.push('</tr>');

			h.push('</thead>');
			h.push('<tbody>');

			for (let i in wk) {
				if (wk.hasOwnProperty(i)) {
					h.push('<tr>');
					h.push('<td>' + wk[i]['name'] + '</td>');
					h.push('<td>' + wk[i]['amount'] + '</td>');
					h.push('<td><span class="show-entity" data-id="' + wk[i]['id'] + '"><img class="game-cursor" src="' + extUrl + 'css/images/hud/open-eye.png"></span></td>');
					h.push('</tr>');
				}
			}

			h.push('</tbody>');
			h.push('</table>');
		}*/
		
		div.find('#sabotageInfoBody').html(h.join(''));
		div.show();

		// Ein Gebäude soll auf der Karte dargestellt werden
		$('body').on('click', '.foe-table .show-entity', function () {
			BuildingsReader.ShowFunction($(this).data('id'));
		});
		
		$('body').on('click', '.button-showcity', function () {
			BuildingsReader.ShowFunction();
		});
	},


	/**
	 * Zeigt pulsierend ein Gebäude auf der Map
	 *
	 * @param id
	 */
	ShowFunction: (id) => {

		let h = CityMap.hashCode(BuildingsReader.PlayerName);

		// CSS in den DOM prügeln
		HTML.AddCssFile('citymap');

		if ($('#map' + h).length < 1) {
			CityMap.init(BuildingsReader.CityEntities, BuildingsReader.PlayerName);
		}

		$('[data-entityid]').removeClass('pulsate');
		
		if (id !== undefined) {

			setTimeout(() => {
				let target = $('[data-entityid="' + id + '"]');

				$('#map-container').scrollTo(target, 800, {offset: {left: -280, top: -280}, easing: 'swing'});

				target.addClass('pulsate');
			}, 200);
		}
	},
	
	UpdatePlayer: (ud) => {
		if (ud.player_id = BuildingsReader.OtherPlayer.player_id) {
		
			BuildingsReader.OtherPlayer = ud;

			BuildingsReader.IsFriend = BuildingsReader.OtherPlayer.is_friend;
			BuildingsReader.IsGuildMember = BuildingsReader.OtherPlayer.is_guild_member;
			BuildingsReader.IsNeighbor = BuildingsReader.OtherPlayer.is_neighbor;

			BuildingsReader.IsLootable = (BuildingsReader.IsNeighbor && !BuildingsReader.IsFriend && !BuildingsReader.IsGuildMember && (BuildingsReader.OtherPlayer.next_interaction_in === undefined || BuildingsReader.OtherPlayer.canSabotage));
			
			if ($('#sabotageInfo').is(':visible')) {
					BuildingsReader.showResult();
			}
		}
	},
	
	
	GetAlert: async(PlayerID)=> {

		// is alert.js included?
		if(!Alerts){
			return ;
		}

		// fetch all alerts and search the id
		return Alerts.getAll().then((resp)=> {
			if(resp.length === 0){
				return ;
			}

			return resp.find(alert => alert['data']['category'] === 'sabotage' && alert['data']['title'] === PlayerDict[PlayerID]['PlayerName'] && alert['data']['expires'] > MainParser.getCurrentDateTime());
		});
	},


	SetAlert: (PlayerID, nextAttackTime)=> {
		let title = PlayerDict[PlayerID]['PlayerName'];
		const data = {
			title: title,
			body: HTML.i18nReplacer(i18n('Boxes.Sabotage.SaveAlert'), {playerName: title}),
			expires: (nextAttackTime - 30) * 1000, // -30s * Microtime
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
			text: HTML.i18nReplacer(i18n('Boxes.Sabotage.SaveMessage.Desc'), {playerName: title}),
			type: 'success',
			hideAfter: 5000
		});

		$(`#alert-sabotage-${PlayerID}`).html(i18n('Boxes.Sabotage.AlreadySetAlarm'));
		$(`#alert-sabotage-${PlayerID}`).prop('onclick', null);
		$(`#alert-sabotage-${PlayerID}`).attr('disabled', '');
	}
};


/**
 *
 * @type {
 * 		{
 * 		emptyGoods: GoodsParser.emptyGoods,
 * 		bazaarBuilding: GoodsParser.bazaarBuilding,
 * 		sumGoods: (function(*): number),
 * 		readType: GoodsParser.readType,
 * 		getProducts: (function(*): {amount: (string), state: boolean, isImportant: boolean})
 * 		}
 * 	}
 */
let GoodsParser = {

	/**
	 * Ist es ein Produkt das man "mitzählen" kann?
	 *
	 * @param d
	 */
	readType: (d)=> {

		// Ruhmeshallen ausgrenzen
		/*
		if(d['state']['current_product']['asset_name'] !== undefined && d['state']['current_product']['asset_name'].indexOf('bazaar_') > -1){
			GoodsParser.bazaarBuilding(d);
		}
		*/

		// produziert nix
		//else
			if(d['state']['current_product'] === undefined) {
			GoodsParser.emptyGoods(d);
		}

		// alle anderen
		else {

			let p = GoodsParser.getProducts(d);

			if(p['amount'] !== undefined){
				let entry = {
					name: MainParser.CityEntities[d['cityentity_id']]['name'],
					amount: p['amount'],
					weightedAmount: p['weightedAmount'],
					state: p['state'],
					id: d['id'],
					isImportant: p['isImportant']
				};
				
				if (p['isImportant'] === false ) {
					entry.name = '<spark style="color:grey;">' + MainParser.CityEntities[d['cityentity_id']]['name'] + '</spark>';
					entry.amount = '<spark style="color:grey;">' + p['amount'] + '</spark>';
				}

				if( entry['state'] === true ){
					BuildingsReader.data.ready.push(entry);
				} else {
					BuildingsReader.data.work.push(entry);
				}
			}
		}
	},


	/**
	 * ermittelt die Produktart
	 *
	 * @param d
	 * @returns {{amount: number, name: (*|string), state: boolean, isImportant: boolean}}
	 */
	getProducts: (d) => {
		const base_weight_factor = 1000000000;
		let amount,
			state = d['state']['__class__'] === 'ProductionFinishedState',
			isFP = false,
			isImportant = false,
			weightedAmount = 0
			
		let g = [];

		let a;
		if (d['state']['current_product']['product'] !== undefined && d['state']['current_product']['product']['resources'] !== undefined) {
			a = d['state']['current_product']['product']['resources'];

			for (let k in a) {
				if (a.hasOwnProperty(k)) {
					let weightFactor = 1;
					
					if (!UnimportantProds.includes(k)) {
						isImportant = true;
					} else {
						weightFactor /= base_weight_factor;
					}
					
					if (GoodsData[k]['nameSingular'] == "Forge Point")
						weightFactor *= base_weight_factor;
					
					weightedAmount += a[k] * weightFactor;
					
					if (!isFP)
						isFP = GoodsData[k]['nameSingular'] == "Forge Point";

					if (k === 'strategy_points') {
						g.push('<strong>' + a[k] + ' ' + GoodsData[k]['name'] + '</strong>');

					} else {
						if (isImportant)
							g.push(a[k] + ' ' + GoodsData[k]['name'] + ' (' + (ResourceStock[k] !== undefined && ResourceStock[k] !== 0 ? HTML.Format(ResourceStock[k]) : 0) + ')');
						else
							g.push(a[k] + ' ' + GoodsData[k]['name']);
					}
				}
			}
		}

		if (d['state']['current_product']['clan_power'] !== undefined) {
			isImportant = true;
			g.push(d['state']['current_product']['clan_power'] + ' ' + i18n('Boxes.Neighbors.GuildPower'));
		}

		amount = g.join('<br>');
		
		return {
			amount: amount,
			weightedAmount: weightedAmount,
			state: state,
			isImportant: isImportant
		};
	},


	/**
	 * Gebäude mit "GuildPower"
	 *
	 * @param d
	 */
	bazaarBuilding: (d)=> {

		let entry = {
			name: d['state']['current_product']['name'],
			weightedAmount: d['state']['current_product']['clan_power'],
			amount: d['state']['current_product']['clan_power'] + ' ' + d['state']['current_product']['name'],
			state: d['state']['__class__'] === 'ProductionFinishedState'
		};

		if( entry['state'] === true ){
			BuildingsReader.data.ready.push(entry);
		} else {
			BuildingsReader.data.work.push(entry);
		}
	},

	/**
	 * Güter oder ggf. FPs zusammenrechnen
	 *
	 * @param d
	 * @returns {number}
	 */
	sumGoods: (d)=> {

		let sum = 0;

		for( let el in d ) {
			if( d.hasOwnProperty(el) ) {
				sum += parseFloat( d[el] );
			}
		}

		return sum;
	},

	/**
	 * Fertiges Array wenn nix drin ist
	 *
	 * @param d
	 */
	emptyGoods: (d)=> {
		let data = {
			name: MainParser.CityEntities[d['cityentity_id']]['name'],
			weightedAmount: 0,
			fp: '-',
			product: 'unbenutzt',
			// cords: {x: d[i]['x'], y: d[i]['y']}
		};

		BuildingsReader.data.work.push(data);
	}

};