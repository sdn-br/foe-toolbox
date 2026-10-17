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
				popout: () => MainParser.PopOut('LGInvestmentOverviewBox'),
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

		const legend = `<span class="text-warning">${i18n('Boxes.LGInvestmentOverviewBox.Tooltip.FoundNew')}</span><br>` +
			`<span class="text-success">${i18n('Boxes.LGInvestmentOverviewBox.Tooltip.FoundAgain')}</span><br>` +
			`<span class="text-orange">${i18n('Boxes.LGInvestmentOverviewBox.Tooltip.NoPayment')}</span>`;

		let h = [];

		h.push('<div class="text-center dark-bg toolbox-head">');
		h.push('<p class="head-bar">');

		if (PlayerName) {
			h.push('<span class="player-name"><strong>' + MainParser.GetPlayerLink(PlayerID, PlayerName));
			if (Player['ClanName']) {
				h.push(` [${MainParser.GetGuildLink(Player['ClanId'], Player['ClanName'])}]`);
			}
			h.push('</strong></span>');
		}

		h.push(`<span class="color-description" data-original-title="${HTML.i18nTooltip(legend)}">?</span>`);
		h.push('</p>');

		if (!Player['IsActive']) {
			h.push(`<p><strong class="error">${i18n(Player['IsActive'] === undefined ? 'Boxes.Calculator.PlayerActivityUnknown' : 'Boxes.Calculator.PlayerInactive')}</strong></p>`);
		}

		h.push('</div>');
		h.push('<table id="OverviewTable" class="foe-table sortable-table">');
		h.push('<thead>' +
			'<tr class="sorter-header">' +
				'<th class="is-number" data-type="lg-overview-group">' + i18n('Boxes.LGInvestmentOverviewBox.Building') + '</th>' +
				'<th class="text-center is-number" data-type="lg-overview-group">' + i18n('Boxes.LGInvestmentOverviewBox.Level') + '</th>' +
				'<th class="text-center is-number" data-type="lg-overview-group">' + i18n('Boxes.LGInvestmentOverviewBox.PaidTotal') + '</th>' +
				'<th class="text-center is-number" data-type="lg-overview-group">' + i18n('Boxes.LGInvestmentOverviewBox.Profit') + '</th>' +
				'<th class="text-center is-number" data-type="lg-overview-group">' + i18n('Boxes.LGInvestmentOverviewBox.Rate') + '</th>' +
			'</tr>' +
		'</thead>');
		h.push('<tbody class="lg-overview-group">');

		let PlayAudio = false,
			LGFound = false;

		await IndexDB.getDB();

		// GBs of this player stored by the cost calculator, one row per GB
		const KnownGBs = new Map(
			(await IndexDB.db.greatbuildings.where('playerId').equals(PlayerID).toArray()).map(GB => [GB['name'], GB])
		);

		// data-text and data-number are the sort keys of tableSorter; without data-number ("???") the plugin sorts by a fixed value
		const cell = (Content, StrongClass, Sort, Align = ' class="text-center"') =>
			`<td${Align}${Sort}><strong${StrongClass}>${Content}</strong></td>`;
		const numberSort = (Value) => (Value === undefined || isNaN(Value) ? '' : ` data-number="${Value}"`);
		// tableSorter's string sort maps any text that is not purely letters (e.g. a space) to one fixed value,
		// so names sort as numbers: the negative alphabetical rank, because numbers sort descending first
		const NameRank = new Map([...new Set(Calculator.Overview.map(Row => Row['name']))]
			.sort((a, b) => String(a).localeCompare(String(b)))
			.map((Name, Rank) => [Name, Rank]));

		for (let i = 0; i < Calculator.Overview.length; i++) {
			const Row = Calculator.Overview[i],
				EntityID = Row['city_entity_id'],
				GBName = Row['name'],
				GBLevel = Row['level'],
				MaxProgress = Row['max_progress'],
				Rank = Row['rank'];

			let CurrentProgress = Row['current_progress'] || 0;

			if (!EntityID || MaxProgress === undefined) continue;

			let Profit = undefined,
				BestRate = undefined,
				StrongClass;

			// GB known with the same level and invested FP (stored by the cost calculator) => values known
			const KnownGB = KnownGBs.get(EntityID);

			if (KnownGB !== undefined && KnownGB['level'] === GBLevel && KnownGB['currentFp'] == CurrentProgress && KnownGB['bestRateNettoFp'] > 0) {
				const BestRateNetFP = KnownGB['bestRateNettoFp'],
					BestRateCosts = KnownGB['bestRateCosts'];
				BestRate = MainParser.round(BestRateCosts / BestRateNetFP * 1000) / 10;
				Profit = MainParser.round(BestRateNetFP * arc) - BestRateCosts;
			}

			const Era = Technologies.Eras[GreatBuildings.GetEraName(EntityID)],
				P1 = (Era !== undefined ? (GreatBuildings.GetP1(Era, GBLevel) || 0) : 0);

			// no own contribution yet and a profit is theoretically possible
			if (Rank !== undefined || P1 * arc < (MaxProgress - CurrentProgress) / 2) continue;
			if (Profit !== undefined && Profit < 0) continue;

			LGFound = true;

			let ProfitValue,
				RateValue,
				ProfitString,
				RateString;

			if (CurrentProgress === 0) {
				StrongClass = ' class="warning"'; // possibly not unlocked
				ProfitValue = MainParser.round(P1 * arc) - Math.ceil((MaxProgress - CurrentProgress) / 2);
				RateValue = MainParser.round(MaxProgress / P1 / 2 * 1000) / 10;
				ProfitString = HTML.Format(ProfitValue);
				RateString = Calculator.FormatKurs(RateValue);
			}
			else if (Profit === undefined) {
				StrongClass = '';
				PlayAudio = true;
				ProfitString = '???';
				RateString = '???%';
			}
			else {
				StrongClass = ' class="success"';
				PlayAudio = true;
				ProfitValue = Profit;
				RateValue = BestRate;
				ProfitString = HTML.Format(Profit);
				RateString = Calculator.FormatKurs(BestRate);
			}

			h.push('<tr>' +
				cell((i + 1) + ': ' + GBName, StrongClass, numberSort(-NameRank.get(GBName)), '') +
				cell(GBLevel, StrongClass, numberSort(GBLevel)) +
				cell(HTML.Format(CurrentProgress) + ' / ' + HTML.Format(MaxProgress), StrongClass, numberSort(CurrentProgress)) +
				cell(ProfitString, StrongClass, numberSort(ProfitValue)) +
				cell(RateString, StrongClass, numberSort(RateValue)) +
			'</tr>');
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
		$('#OverviewTable').tableSorter();
		$('#LGInvestmentOverviewBoxBody [data-original-title]').tooltip({
			html: true,
			container: 'body'
		});
	},
});
