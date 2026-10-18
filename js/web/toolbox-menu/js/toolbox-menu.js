/*
 * **************************************************************************************
 *
 * FoE Toolbox: menu buttons of the toolbox modules, registered through the menu API of
 * _menu.js (Items, ItemsData, <id>_Btn) instead of patching it. The menus are built after
 * StartUpDone, all modules from js/toolbox.json are loaded by then.
 * The ids are stored in MenuSort and MenuHiddenItems, so they must not change.
 *
 * You may use, distribute and modify this code under the terms of the AGPL license.
 * See file LICENSE.md for full license details.
 *
 * **************************************************************************************
 */

{
	// default position behind playerProfile, users with a saved MenuSort keep their order
	const i = _menu.Items.indexOf('playerProfile');
	_menu.Items.splice(i < 0 ? _menu.Items.length : i + 1, 0, 'sabotage', 'possibleInvestments', 'looting');
}

_menu.ItemsData.push(
	{ id: 'looting', title: i18n('Menu.Looting.Title'), description: i18n('Menu.Looting.Desc') },
	{ id: 'sabotage', title: i18n('Menu.Sabotage.Title'), description: i18n('Menu.Sabotage.Desc'), warning: '<em id="sabotage-Btn-closed" class="tooltip-error">' + i18n('Menu.Sabotage.Warning') + '<br></em>' },
	{ id: 'possibleInvestments', title: i18n('Menu.PossibleInvestments.Title'), description: i18n('Menu.PossibleInvestments.Desc'), warning: '<em id="possibleInvestments-Btn-closed" class="tooltip-error">' + i18n('Menu.PossibleInvestments.Warning') + '<br></em>' },
);


/**
 * City information / plunder helper of the visited player
 */
_menu.sabotage_Btn = () => {
	let btn = _menu.MakeButton('sabotage', true);

	let btnEl = $('<span />').on('click', function () {
		// without one of these settings visitPlayer never unlocks the button
		if (!Settings.GetSetting('ShowPlayersAttDeffValues') && !Settings.GetSetting('ShowNeighborsLootables')) {
			HTML.ShowToastMsg({
				head: i18n('Menu.Sabotage.Title'),
				text: i18n('Menu.Sabotage.SettingOff'),
				type: 'warning',
				hideAfter: 4000
			});
			return;
		}

		if (Sabotage.OtherPlayer !== undefined) {
			Sabotage.showResult();
		}
	});

	return btn.append(btnEl);
};


/**
 * PvP history (neighbourhood and PvP arena battles, plunder)
 */
_menu.looting_Btn = () => {
	let btn = _menu.MakeButton('looting');

	let btnEl = $('<span />').on('click', function () {
		Looting.page = 1;
		Looting.Show();
	});

	return btn.append(btnEl);
};


/**
 * Reopens the snipe helper box ("Mögliche Investitionen") with the last scanned GB overview
 */
_menu.possibleInvestments_Btn = () => {
	let btn = _menu.MakeButton('possibleInvestments', true);

	let btnEl = $('<span />').on('click', function () {
		if (!Settings.GetSetting('ShowPossibleInvestments')) {
			HTML.ShowToastMsg({
				head: i18n('Menu.PossibleInvestments.Title'),
				text: i18n('Menu.PossibleInvestments.SettingOff'),
				type: 'warning',
				hideAfter: 4000
			});
			return;
		}

		if (Calculator.Overview === undefined) return;

		Calculator.ShowPossibleInvestments(true);
	});

	return btn.append(btnEl);
};


{
	// second counter for the future events of the hidden rewards, filled by hidden-rewards.js
	const hiddenRewardsBtn = _menu.hiddenRewards_Btn;
	_menu.hiddenRewards_Btn = () => hiddenRewardsBtn().append(
		$('<span id="hidden-future-reward-count" class="hud-counter hud-future-counter">0</span>')
	);
}
