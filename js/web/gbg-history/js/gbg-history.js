/*
 * **************************************************************************************
 *
 * FoE Toolbox: victory point history of the guilds of a GBG round, after Forge Hammer
 * (js/web/guildfights, HandleGuildLeaderboard, CheckOverflow).
 * Passive: stores what the game sends when the player opens the GBG ranking
 * (GuildBattlegroundService.getLeaderboard), never requests it.
 *
 * - table "guildHistory" of the GBG DB (declared in Guild_fights.checkForDB, version 22):
 *   one row per hour in which the sum of all points changed
 *   { gbground, time, guilds: [{ id, name, flag, points }] }, guilds in ranking order
 * - placements of past rounds above the player table (wrapper around Guild_fights.BuildPlayerContent)
 * - season reward overflow warning on the last day of a round, setting in the player box
 *   settings (key showOverflowWarning of GuildFightsPlayerBoxSettings, like Forge Hammer)
 *
 * Read API for other modules: GbgHistory.getRoundRows, GbgHistory.getPlacements,
 * FoE helper event "GbgHistoryUpdated" after a new or changed row.
 *
 * You may use, distribute and modify this code under the terms of the AGPL license.
 * See file LICENSE.md for full license details.
 *
 * **************************************************************************************
 */

let GbgHistory = {

	// the player can switch rounds faster than the DB answers, only the last render may write
	renderToken: 0,
	placementsOpen: false,


	/**
	 * Handler of GuildBattlegroundService.getLeaderboard
	 *
	 * @param {Object[]} ranking responseData, one entry per guild in ranking order
	 *        ({ clan: { id, name, flag }, victoryPointsTotal, reward: { playerRewards } })
	 * @param {number} [now] unix time, only set by the console fixture
	 * @returns {Promise<void>}
	 */
	handleLeaderboard: async (ranking, now = moment().unix()) => {
		let gbground = Guild_fights.CurrentGBGRound;
		if (!gbground || !Array.isArray(ranking) || !Guild_fights.db) return;

		let timeLeft = gbground - now;
		if (timeLeft > 0 && timeLeft <= 86400 && Guild_fights.PlayerBoxSettings.showOverflowWarning) {
			GbgHistory.checkOverflow(ranking);
		}

		await GbgHistory.storeRow(gbground, GbgHistory.guildsOf(ranking), now);
	},


	/**
	 * Final guild ranking of an ended round, sent with getState after the round ("subscribed",
	 * leaderboardEntries in the same form as getLeaderboard). Stored as the last row at the end of
	 * the round, so the placements and the end of the chart exist even if nobody opened the ranking
	 * during the round. No overflow warning, the reward is already paid out.
	 *
	 * @param {number} gbground end of the ended round
	 * @param {Object[]} ranking leaderboardEntries
	 * @returns {Promise<void>}
	 */
	handleFinalRanking: async (gbground, ranking) => {
		if (!gbground || !Array.isArray(ranking) || ranking.length === 0 || !Guild_fights.db) return;

		await GbgHistory.storeRow(gbground, GbgHistory.guildsOf(ranking), gbground);
	},


	/**
	 * Final player standing of an ended round (getState outside a round). Upstream
	 * Stats.HandlePlayerLeaderboard stored it with the current time on every opening of the
	 * battlegrounds, the player chart then ran on flat after the round. Stored here in the same
	 * form, with the round end as date: the date is the key, so a later opening replaces the row.
	 *
	 * @param {number} gbground end of the ended round
	 * @param {Object[]} entries playerLeaderboardEntries
	 * @returns {Promise<void>}
	 */
	handleFinalPlayers: async (gbground, entries) => {
		if (!gbground || !Array.isArray(entries) || entries.length === 0) return;

		let date = new Date(gbground * 1000),
			players = {};

		for (let it of entries) {
			players[it.player.player_id] = {
				id: it.player.player_id,
				n: it.negotiationsWon || 0,
				b: it.battlesWon || 0,
				r: it.rank || 1
			};
		}

		await IndexDB.getDB();
		await IndexDB.db.statsGBGPlayers.put({ date, players });
		await IndexDB.db.statsGBGPlayerCache.bulkPut(entries.map(({ player }) => ({
			id: player.player_id,
			name: player.name,
			avatar: player.avatar,
			date: MainParser.getCurrentDate()
		})));
	},


	/**
	 * @param {Object[]} ranking entries of the guild ranking
	 * @returns {{id: number, name: string, flag: string|null, points: number}[]}
	 */
	guildsOf: (ranking) => {
		// the leaderboard may lack the flag, the map data has it
		let participants = Guild_fights.MapData?.battlegroundParticipants || [];

		return ranking.filter(rank => rank?.clan).map(rank => ({
			id: rank.clan.id,
			name: rank.clan.name,
			flag: rank.clan.flag ?? participants.find(p => p.clan?.id === rank.clan.id)?.clan.flag ?? null,
			points: rank.victoryPointsTotal || 0,
		}));
	},


	/**
	 * Stores the guild list if the sum of the points changed since the last row of the round.
	 * One row per hour: a later change in the same hour replaces it (Forge Hammer used add,
	 * which failed on the second change within an hour and kept the older value).
	 *
	 * @param {number} gbground
	 * @param {Object[]} guilds
	 * @param {number} now unix time
	 * @returns {Promise<void>}
	 */
	storeRow: async (gbground, guilds, now) => {
		let sum = list => list.reduce((total, g) => total + (g.points || 0), 0);

		let last = await Guild_fights.db.guildHistory.where('gbground').equals(gbground).last();
		if (last && sum(last.guilds) === sum(guilds)) return;

		let row = { gbground, time: moment.unix(now).startOf('hour').unix(), guilds };
		await Guild_fights.db.guildHistory.put(row);

		FoEproxy.triggerFoeHelperHandler('GbgHistoryUpdated', row);
	},


	/**
	 * All stored rows of a round, oldest first
	 *
	 * @param {number} [gbground] end of the round (Guild_fights.CurrentGBGRound by default)
	 * @returns {Promise<{gbground: number, time: number, guilds: {id: number, name: string, flag: ?string, points: number}[]}[]>}
	 */
	getRoundRows: async (gbground = Guild_fights.CurrentGBGRound) => {
		if (!gbground || !Guild_fights.db) return [];
		return Guild_fights.db.guildHistory.where('gbground').equals(gbground).sortBy('time');
	},


	/**
	 * Last known guild list of a round in ranking order, null if the ranking was never opened
	 *
	 * @param {number} gbground
	 * @returns {Promise<?Object[]>}
	 */
	getPlacements: async (gbground) => {
		if (!gbground || !Guild_fights.db) return null;
		let last = await Guild_fights.db.guildHistory.where('gbground').equals(gbground).last();
		return last?.guilds?.length ? last.guilds : null;
	},


	/**
	 * Toast with the goods to spend so the season reward of the own guild does not
	 * run into the storage cap (resourceCap of the goods definitions)
	 *
	 * @param {Object[]} ranking
	 */
	checkOverflow: (ranking) => {
		let rewards = ranking.find(rank => rank?.clan?.id === ExtGuildID)?.reward?.playerRewards || [],
			lines = [];

		for (let reward of rewards) {
			let id = reward.subType,
				cap = GoodsData[id]?.abilities?.resourceCap?.amount;

			if (!cap) continue;

			let excess = (reward.amount || 0) + (ResourceStock[id] || 0) - cap;
			if (excess > 0) {
				lines.push(`<div>${srcLinks.icons(id)} ${HTML.FormatNumberShort(excess)}</div>`);
			}
		}

		if (lines.length === 0) return;

		// own setting, so independent of the global notification switch
		HTML.ShowToastMsg({
			show: true,
			head: i18n('Boxes.GBGSeasonOverflow.Title'),
			text: `<div class="toolbox-gbg-overflow">${i18n('Boxes.GBGSeasonOverflow.Text')}${lines.join('')}</div>`,
			type: 'warning',
			hideAfter: 10000,
		});
	},


	/**
	 * Placements of a past round above the player table, as Forge Hammer in the round selection
	 *
	 * @param {number} gbground
	 * @param {number} token
	 * @returns {Promise<void>}
	 */
	renderPlacements: async (gbground, token) => {
		// only for ended rounds, after the end the ended round is still the current one
		if (!gbground || gbground > moment().unix()) return;

		let guilds = await GbgHistory.getPlacements(gbground);
		if (!guilds || token !== GbgHistory.renderToken) return;

		let rows = guilds.map((g, i) => `<tr${g.id === ExtGuildID ? ' class="mark-player"' : ''}>
			<td class="tdmin">${i + 1}.</td>
			<td class="tdmin">${g.flag ? `<img src="${srcLinks.get('/shared/clanflags/' + g.flag.toLowerCase() + '.jpg', true)}" alt="" />` : ''}</td>
			<td>${$('<div />').text(g.name || '').html()}</td>
			<td class="text-right">${HTML.Format(g.points)}</td>
		</tr>`).join('');

		let accordion = $(`<div class="foehelper-accordion toolbox-gbg-placements${GbgHistory.placementsOpen ? ' open' : ''}">
			<div class="foehelper-accordion-head game-cursor">${i18n('Boxes.GuildFights.GuildResults')}</div>
			<div class="foehelper-accordion-body"><table class="foe-table"><tbody>${rows}</tbody></table></div>
		</div>`);

		accordion.find('.foehelper-accordion-head').on('click', () => {
			accordion.toggleClass('open');
			GbgHistory.placementsOpen = accordion.hasClass('open');
		});

		$('#gbgContentWrapper').prepend(accordion);
	},


	/**
	 * Checkbox in the player box settings, before the save button
	 */
	settingsHtml: () => {
		let checked = Guild_fights.PlayerBoxSettings.showOverflowWarning ? ' checked="checked"' : '';
		return `<p class="text-left"><input id="gf_showOverflowWarning" name="showoverflowwarning" value="1" type="checkbox"${checked} /> <label for="gf_showOverflowWarning">${i18n('Boxes.GuildFights.ShowOverflowWarning')}</label></p>`;
	},
};


// Every save of the player box settings writes the whole object, so the key has to live in it.
// SetBoxNavigation only reloads its own keys, this one is read once here (default on).
Guild_fights.PlayerBoxSettings.showOverflowWarning =
	(JSON.parse(localStorage.getItem('GuildFightsPlayerBoxSettings') || 'null') || {}).showOverflowWarning ?? 1;


{
	const buildPlayerContent = Guild_fights.BuildPlayerContent;

	Guild_fights.BuildPlayerContent = async (...args) => {
		const token = ++GbgHistory.renderToken;
		const result = await buildPlayerContent(...args);
		await GbgHistory.renderPlacements(args[0], token);
		return result;
	};
}


{
	const showSettings = Guild_fights.ShowPlayerBoxSettings;

	Guild_fights.ShowPlayerBoxSettings = (...args) => {
		const result = showSettings(...args);
		$('#save-GuildFightsPlayerBox-settings').parent().before(GbgHistory.settingsHtml());
		return result;
	};
}


{
	const saveSettings = Guild_fights.PlayerBoxSettingsSaveValues;

	// set before the original, it stores the whole PlayerBoxSettings object
	Guild_fights.PlayerBoxSettingsSaveValues = (...args) => {
		Guild_fights.PlayerBoxSettings.showOverflowWarning = $('#gf_showOverflowWarning').is(':checked') ? 1 : 0;
		return saveSettings(...args);
	};
}


FoEproxy.addHandler('GuildBattlegroundService', 'getLeaderboard', (data) => {
	GbgHistory.handleLeaderboard(data.responseData);
});

// the round of a getState outside of a round is computed like Guild_fights does (start of the next round minus 3 days)
FoEproxy.addHandler('GuildBattlegroundStateService', 'getState', (data) => {
	let state = data.responseData;
	if (!state || state.stateId === 'participating' || !state.startsAt) return;

	GbgHistory.handleFinalRanking(parseInt(state.startsAt) - 259200, state.leaderboardEntries);
});
