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

		const PlayerID = Calculator.OverviewPlayerID(),
			vm = await Calculator.getOverviewViewModel(PlayerID);

		if (PlayerID !== Calculator.OverviewPlayerID()) return; // a newer overview arrived meanwhile

		if (vm.playAudio && !DisableAudio) Calculator.PlayOverviewSound();

		Calculator.OverviewVM = vm;
		Calculator.renderOverview();
	},


	/** last view model and the chosen column order of the possible investments */
	OverviewVM: undefined,
	OverviewSort: { key: undefined, dir: 1 },


	/**
	 * Sorts and renders the last view model (also after a click on a column head)
	 */
	renderOverview: () => {
		const body = $('#LGInvestmentOverviewBoxBody')[0];
		if (!body || !Calculator.OverviewVM) return;

		// lit-html updates only what changed, the body element keeps its state across renders and pop-out moves
		litHtml.render(Calculator.viewOverview(Calculator.OverviewVM, Calculator.OverviewSort), body);
		$(body).find('[data-original-title]').tooltip({
			html: true,
			container: 'body'
		});
	},


	/**
	 * Everything the box shows, as plain data
	 *
	 * @param PlayerID player of the scanned overview
	 * @returns {Promise<Object>}
	 */
	getOverviewViewModel: async (PlayerID) => {
		const arc = ((parseFloat(MainParser.ArkBonus) + 100) / 100);

		// player name and activity (players already known are also loaded from the db)
		await MainParser.loadPlayerIntoDict(PlayerID);
		await IndexDB.getDB();

		const Player = PlayerDict[PlayerID] || {},
			PlayerName = Player['PlayerName'] || Calculator.Overview[0]['player']['name'];

		// GBs of this player stored by the cost calculator, one row per GB
		const KnownGBs = new Map(
			(await IndexDB.db.greatbuildings.where('playerId').equals(PlayerID).toArray()).map(GB => [GB['name'], GB])
		);

		let rows = [],
			playAudio = false;

		Calculator.Overview.forEach((Row, i) => {
			const EntityID = Row['city_entity_id'],
				GBLevel = Row['level'],
				MaxProgress = Row['max_progress'],
				CurrentProgress = Row['current_progress'] || 0;

			if (!EntityID || MaxProgress === undefined) return;

			let Profit,
				BestRate;

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
			if (Row['rank'] !== undefined || P1 * arc < (MaxProgress - CurrentProgress) / 2) return;
			if (Profit !== undefined && Profit < 0) return;

			let row = { index: i + 1, name: Row['name'], level: GBLevel, current: CurrentProgress, max: MaxProgress };

			if (CurrentProgress === 0) {
				// possibly not unlocked
				row.cls = 'warning';
				row.profit = MainParser.round(P1 * arc) - Math.ceil((MaxProgress - CurrentProgress) / 2);
				row.rate = MainParser.round(MaxProgress / P1 / 2 * 1000) / 10;
			}
			else if (Profit === undefined) {
				row.cls = '';
				playAudio = true;
			}
			else {
				row.cls = 'success';
				playAudio = true;
				row.profit = Profit;
				row.rate = BestRate;
			}

			rows.push(row);
		});

		return {
			playerLink: (PlayerName ? MainParser.GetPlayerLink(PlayerID, PlayerName) : undefined),
			guildLink: (PlayerName && Player['ClanName'] ? MainParser.GetGuildLink(Player['ClanId'], Player['ClanName']) : undefined),
			activity: (Player['IsActive'] ? undefined : (Player['IsActive'] === undefined ? 'Boxes.Calculator.PlayerActivityUnknown' : 'Boxes.Calculator.PlayerInactive')),
			rows,
			playAudio,
		};
	},


	/**
	 * Markup of the box body, a pure function of the view model and the column order
	 *
	 * @param vm result of getOverviewViewModel
	 * @param sort {key, dir} key of a column, dir 1 ascending, -1 descending
	 * @returns {TemplateResult}
	 */
	viewOverview: (vm, sort) => {
		const { html, unsafeHTML } = litHtml,
			t = (key) => i18n('Boxes.LGInvestmentOverviewBox.' + key);

		const legend = `<span class="text-warning">${t('Tooltip.FoundNew')}</span><br>` +
			`<span class="text-success">${t('Tooltip.FoundAgain')}</span><br>` +
			`<span class="text-orange">${t('Tooltip.NoPayment')}</span>`;

		// unknown values (???) sort last in both directions
		const rows = sort.key === undefined ? vm.rows : [...vm.rows].sort((a, b) => {
			const A = a[sort.key], B = b[sort.key];
			if (A === undefined || B === undefined) return (A === undefined) - (B === undefined);
			return sort.dir * (sort.key === 'name' ? String(A).localeCompare(String(B)) : A - B);
		});

		// text sorts A to Z first, numbers the highest first (as tableSorter does)
		const toggle = (key) => {
			const first = (key === 'name' ? 1 : -1);
			Calculator.OverviewSort = { key, dir: (sort.key === key ? -sort.dir : first) };
			Calculator.renderOverview();
		};
		const head = (key, label, cls = 'text-center') => html`
			<th class="${cls} ${sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : ''}" @click=${() => toggle(key)}>${label}</th>`;
		const cell = (row, content, cls = 'text-center') => html`<td class="${cls}"><strong class="${row.cls}">${content}</strong></td>`;

		return html`
			<div class="text-center dark-bg toolbox-head">
				<p class="head-bar">
					${vm.playerLink ? html`<span class="player-name"><strong>${unsafeHTML(vm.playerLink)}${vm.guildLink ? html` [${unsafeHTML(vm.guildLink)}]` : ''}</strong></span>` : ''}
					<span class="color-description" data-original-title="${legend}">?</span>
				</p>
				${vm.activity ? html`<p><strong class="error">${i18n(vm.activity)}</strong></p>` : ''}
			</div>
			<table id="OverviewTable" class="foe-table sortable-table">
				<thead>
					<tr class="sorter-header">
						${head('name', t('Building'), '')}
						${head('level', t('Level'))}
						${head('current', t('PaidTotal'))}
						${head('profit', t('Profit'))}
						${head('rate', t('Rate'))}
					</tr>
				</thead>
				<tbody>
					${rows.length === 0 ? html`
						<tr><td colspan="5" class="text-center no-investments-possible"><strong>${t('NoInvestmentsPossible')}</strong></td></tr>`
					: rows.map(row => html`
						<tr>
							${cell(row, `${row.index}: ${row.name}`, '')}
							${cell(row, row.level)}
							${cell(row, `${HTML.Format(row.current)} / ${HTML.Format(row.max)}`)}
							${cell(row, row.profit === undefined ? '???' : HTML.Format(row.profit))}
							${cell(row, row.rate === undefined ? '???%' : Calculator.FormatKurs(row.rate))}
						</tr>`)}
				</tbody>
			</table>`;
	},
});
