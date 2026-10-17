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

// FoE Toolbox: snipe helper, pre-scan of the GB overview of another player
// ("Mögliche Investitionen"). Opt-in via the setting ShowPossibleInvestments.

FoEproxy.addHandler('GreatBuildingsService', 'getOtherPlayerOverview', (data, postData) => {
	const Overview = data.responseData;

	if (!Array.isArray(Overview) || Overview.length === 0) return;
	if (Overview[0]?.player?.player_id === ExtPlayerID || !Settings.GetSetting('ShowPossibleInvestments')) return;

	Calculator.Overview = Overview;
	$('#possibleInvestments-Btn').removeClass('hud-btn-red');
	$('#possibleInvestments-Btn-closed').remove();
	Calculator.ShowPossibleInvestments(false);
});

// a GB of another player was opened: the scan of a different player is outdated
FoEproxy.addHandler('CityMapService', 'updateEntity', (data, postData) => {
	const Entity = data.responseData?.[0];

	if (!Calculator.Overview || Entity?.type !== 'greatbuilding' || Entity.player_id === ExtPlayerID) return;

	if (Entity.player_id !== Calculator.OverviewPlayerID()) {
		HTML.CloseOpenBox('LGInvestmentOverviewBox');
	}
});


Object.assign(Calculator, {

	/** rows of GreatBuildingsService.getOtherPlayerOverview of the last scanned player */
	Overview: undefined,
	PlayOverviewInfoSound: false,


	/**
	 * @returns {number|undefined} player of the last scanned overview
	 */
	OverviewPlayerID: () => Calculator.Overview?.[0]?.player?.player_id,


	/**
	 * Formats a rate in percent, '-' for 0
	 *
	 * @param {number} Kurs
	 * @returns {string}
	 */
	FormatOverviewKurs: (Kurs) => (Kurs === 0 ? '-' : HTML.Format(Kurs) + '%'),


	/**
	 * Plays a sound when a possible investment was found
	 */
	PlayOverviewSound: () => {
		if (Calculator.PlayOverviewInfoSound) helper.sounds.play('message');
	},


	/**
	 * Scans the GB overview and lists the possible investments
	 *
	 * @param {boolean} DisableAudio
	 * @returns {Promise<void>}
	 */
	ShowPossibleInvestments: async (DisableAudio) => {
		if (Calculator.Overview === undefined) return;

		const arc = ((parseFloat(MainParser.ArkBonus) + 100) / 100),
			PlayerID = Calculator.OverviewPlayerID();

		let cot = localStorage.getItem('CalculatorOverviewTone');
		if (cot === null) {
			localStorage.setItem('CalculatorOverviewTone', 'deactivated');
			cot = 'deactivated';
		}
		Calculator.PlayOverviewInfoSound = (cot !== 'deactivated');

		if ($('#LGInvestmentOverviewBox').length === 0) {
			HTML.Box({
				id: 'LGInvestmentOverviewBox',
				title: i18n('Boxes.LGInvestmentOverviewBox.Title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				speaker: 'CalculatorOverviewTone'
			});

			HTML.AddCssFile('calculator');

			$('#LGInvestmentOverviewBox').on('click', '#CalculatorOverviewTone', function () {
				let disabled = $(this).hasClass('deactivated');

				localStorage.setItem('CalculatorOverviewTone', (disabled ? '' : 'deactivated'));
				Calculator.PlayOverviewInfoSound = !!disabled;
				$(this).toggleClass('deactivated', !disabled);
			});
		}

		// player name and activity (players already known are also loaded from the db)
		await MainParser.loadPlayerIntoDict(PlayerID);
		if (PlayerID !== Calculator.OverviewPlayerID()) return; // a newer overview arrived meanwhile

		const Player = PlayerDict[PlayerID] || {},
			PlayerName = Player['PlayerName'] || Calculator.Overview[0]['player']['name'];

		let h = [];

		h.push('<div class="text-center dark-bg" style="padding:5px 0 3px;">');
		h.push('<p class="head-bar">');

		if (PlayerName) {
			h.push('<span class="player-name"><strong>' + MainParser.GetPlayerLink(PlayerID, PlayerName));
			if (Player['ClanName']) {
				h.push(` [${MainParser.GetGuildLink(Player['ClanId'], Player['ClanName'])}]`);
			}
			h.push('</strong></span>');
		}

		h.push('<span class="color-description">?' +
			'<span>' +
				'<span class="found-new">' + HTML.i18nTooltip(i18n('Boxes.LGInvestmentOverviewBox.Tooltip.FoundNew')) + '</span>' +
				'<span class="found-again">' + HTML.i18nTooltip(i18n('Boxes.LGInvestmentOverviewBox.Tooltip.FoundAgain')) + '</span>' +
				'<span class="no-payment">' + HTML.i18nTooltip(i18n('Boxes.LGInvestmentOverviewBox.Tooltip.NoPayment')) + '</span>' +
			'</span>' +
		'</span>');
		h.push('</p>');

		if (!Player['IsActive']) {
			h.push(`<p><strong class="error">${i18n(Player['IsActive'] === undefined ? 'Boxes.Calculator.PlayerActivityUnknown' : 'Boxes.Calculator.PlayerInactive')}</strong></p>`);
		}

		h.push('</div>');
		h.push('<table id="OverviewTable" class="foe-table">');
		h.push('<thead>' +
			'<tr>' +
				'<th>' + i18n('Boxes.LGInvestmentOverviewBox.Building') + '</th>' +
				'<th class="text-center">' + i18n('Boxes.LGInvestmentOverviewBox.Level') + '</th>' +
				'<th class="text-center">' + i18n('Boxes.LGInvestmentOverviewBox.PaidTotal') + '</th>' +
				'<th class="text-center">' + i18n('Boxes.LGInvestmentOverviewBox.Profit') + '</th>' +
				'<th class="text-center">' + i18n('Boxes.LGInvestmentOverviewBox.Rate') + '</th>' +
			'</tr>' +
		'</thead>');
		h.push('<tbody>');

		let PlayAudio = false,
			LGFound = false;

		await IndexDB.getDB();

		for (let i = 0; i < Calculator.Overview.length; i++) {
			const Row = Calculator.Overview[i],
				EntityID = Row['city_entity_id'],
				GBName = Row['name'],
				GBLevel = Row['level'],
				MaxProgress = Row['max_progress'],
				Rank = Row['rank'];

			let CurrentProgress = Row['current_progress'] || 0;

			if (!EntityID || MaxProgress === undefined) continue;

			let Gewinn = undefined,
				BestKurs = undefined,
				StrongClass;

			// GB known with the same level and invested FP (stored by the cost calculator) => values known
			const KnownGB = await IndexDB.db.greatbuildings
				.where({ playerId: PlayerID, name: EntityID })
				.first();

			if (KnownGB !== undefined && KnownGB['level'] === GBLevel && KnownGB['currentFp'] == CurrentProgress && KnownGB['bestRateNettoFp'] > 0) {
				const BestKursNettoFP = KnownGB['bestRateNettoFp'],
					BestKursEinsatz = KnownGB['bestRateCosts'];
				BestKurs = MainParser.round(BestKursEinsatz / BestKursNettoFP * 1000) / 10;
				Gewinn = MainParser.round(BestKursNettoFP * arc) - BestKursEinsatz;
			}

			const Era = Technologies.Eras[GreatBuildings.GetEraName(EntityID)],
				P1 = (Era !== undefined ? (GreatBuildings.GetP1(Era, GBLevel) || 0) : 0);

			// no own contribution yet and a profit is theoretically possible
			if (Rank !== undefined || P1 * arc < (MaxProgress - CurrentProgress) / 2) continue;
			if (Gewinn !== undefined && Gewinn < 0) continue;

			LGFound = true;

			let GewinnString,
				KursString;

			if (CurrentProgress === 0) {
				StrongClass = ' class="warning"'; // possibly not unlocked
				GewinnString = HTML.Format(MainParser.round(P1 * arc) - Math.ceil((MaxProgress - CurrentProgress) / 2));
				KursString = Calculator.FormatOverviewKurs(MainParser.round(MaxProgress / P1 / 2 * 1000) / 10);
			}
			else if (Gewinn === undefined) {
				StrongClass = '';
				PlayAudio = true;
				GewinnString = '???';
				KursString = '???%';
			}
			else {
				StrongClass = ' class="success"';
				PlayAudio = true;
				GewinnString = HTML.Format(Gewinn);
				KursString = Calculator.FormatOverviewKurs(BestKurs);
			}

			h.push('<tr>');
			h.push('<td><strong' + StrongClass + '>' + (i + 1) + ': ' + GBName + '</strong></td>');
			h.push('<td class="text-center"><strong' + StrongClass + '>' + GBLevel + '</strong></td>');
			h.push('<td class="text-center"><strong' + StrongClass + '>' + HTML.Format(CurrentProgress) + ' / ' + HTML.Format(MaxProgress) + '</strong></td>');
			h.push('<td class="text-center"><strong' + StrongClass + '>' + GewinnString + '</strong></td>');
			h.push('<td class="text-center"><strong' + StrongClass + '>' + KursString + '</strong></td>');
			h.push('</tr>');
		}

		if (LGFound) {
			if (PlayAudio && !DisableAudio) Calculator.PlayOverviewSound();
		}
		else {
			h.push('<tr>');
			h.push('<td colspan="5" class="text-center no-investments-possible"><strong>' + i18n('Boxes.LGInvestmentOverviewBox.NoInvestmentsPossible') + '</strong></td>');
			h.push('</tr>');
		}

		h.push('</tbody>');
		h.push('</table>');

		$('#LGInvestmentOverviewBoxBody').html(h.join(''));
	},
});
