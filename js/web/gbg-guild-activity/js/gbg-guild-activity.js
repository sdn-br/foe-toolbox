/*
 * **************************************************************************************
 *
 * FoE Toolbox: activity of other guilds on the GBG map, after the fork br-schwamm
 * (GuildFights.otherGuilds, commit ac4c3be). Opt-in, setting ShowOtherGuildActivity.
 * Passive: only reads what the game sends, never requests anything.
 *
 * A click on the HQ of another guild on the GBG map opens its profile (ClanService.getClanData),
 * which lists every member with the battles won (won_battles). The first visit stores them as
 * baseline, every further visit compares with the previous one and keeps a history per player:
 * battles won since the observation started, and the last interval in which the count rose.
 * Several guilds are tracked side by side, switching between them keeps their history.
 *
 * Limits of the data: won_battles counts battles only, negotiations are not visible. The value is
 * not limited to GBG, a player who fights elsewhere in between shows up as well. A single visit
 * shows nothing, the activity comes from comparing two visits.
 *
 * The history lives in memory and only while the GBG map is open: leaving the map (city, other
 * player, reload) drops it and closes the box. The older a baseline gets, the more battles outside
 * GBG it contains, so a short observation on the map is the meaningful one.
 *
 * You may use, distribute and modify this code under the terms of the AGPL license.
 * See file LICENSE.md for full license details.
 *
 * **************************************************************************************
 */

FoEproxy.addHandler('ClanService', 'getClanData', (data, postData) => {
	if (ActiveMap !== 'gg' || !Settings.GetSetting('ShowOtherGuildActivity')) return;

	GbgGuildActivity.track(data.responseData, Date.now());
});

FoEproxy.addFoeHelperHandler('ActiveMapUpdated', () => {
	if (ActiveMap !== 'gg') GbgGuildActivity.reset();
});


let GbgGuildActivity = {

	// { <clan id>: { id, name, firstVisit, lastVisit, prevVisit, visits,
	//                players: { <player key>: { name, battles, gained, lastDelta, lastFrom, lastTo } } } }
	Guilds: {},
	selected: null,


	/**
	 * Compares the member list with the previous visit of the same guild
	 *
	 * @param {Object} clan responseData of ClanService.getClanData
	 * @param {number} now ms
	 */
	track: (clan, now) => {
		if (!clan?.id || !Array.isArray(clan.members) || clan.id === ExtGuildID) return;

		let guild = GbgGuildActivity.Guilds[clan.id];
		const isNew = !guild;

		if (isNew) {
			guild = GbgGuildActivity.Guilds[clan.id] = { id: clan.id, firstVisit: now, visits: 0, players: {} };
		}

		const players = {};

		for (const m of clan.members) {
			// the name changes on a rename, the id does not
			const key = m.player_id ?? m.name,
				battles = m.won_battles || 0,
				prev = guild.players[key];

			if (!prev) {
				players[key] = { name: m.name, battles, gained: 0, lastDelta: 0, lastFrom: null, lastTo: null };
				continue;
			}

			const delta = battles - prev.battles;
			players[key] = (delta > 0)
				? { ...prev, name: m.name, battles, gained: prev.gained + delta, lastDelta: delta, lastFrom: guild.lastVisit, lastTo: now }
				: { ...prev, name: m.name, battles };
		}

		// members who left are dropped with their history
		guild.players = players;
		guild.name = clan.name;
		guild.prevVisit = isNew ? null : guild.lastVisit;
		guild.lastVisit = now;
		guild.visits++;

		GbgGuildActivity.selected = clan.id;
		GbgGuildActivity.show();
	},


	reset: () => {
		GbgGuildActivity.Guilds = {};
		GbgGuildActivity.selected = null;
		HTML.CloseOpenBox('GbgGuildActivity');
	},


	show: () => {
		if ($('#GbgGuildActivity').length === 0) {
			HTML.Box({
				id: 'GbgGuildActivity',
				title: i18n('Boxes.GbgGuildActivity.Title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				popout: () => MainParser.PopOut('GbgGuildActivity'),
			});
		}

		GbgGuildActivity.render();
	},


	select: (id) => {
		GbgGuildActivity.selected = id;
		GbgGuildActivity.render();
	},


	/**
	 * Renders the box if it is open. getViewModel collects, view renders.
	 */
	render: () => {
		const body = $('#GbgGuildActivityBody')[0];
		if (!body) return;

		litHtml.render(GbgGuildActivity.view(GbgGuildActivity.getViewModel()), body);
	},


	/**
	 * Everything the box shows, as plain data
	 *
	 * @returns {Object}
	 */
	getViewModel: () => {
		const guild = GbgGuildActivity.Guilds[GbgGuildActivity.selected];

		const guilds = Object.values(GbgGuildActivity.Guilds)
			.map(g => ({ id: g.id, name: g.name, active: g.id === GbgGuildActivity.selected }));

		if (!guild) return { guilds, guild: null, rows: [] };

		const rows = Object.values(guild.players)
			.filter(p => p.gained > 0)
			.map(p => ({ ...p, isNew: p.lastTo === guild.lastVisit }));

		// active in the last interval first, then by the last activity, then by battles
		rows.sort((a, b) => (b.isNew - a.isNew) || (b.lastTo - a.lastTo) || (b.gained - a.gained) || a.name.localeCompare(b.name));

		return {
			guilds,
			guild: {
				name: guild.name,
				firstVisit: guild.firstVisit,
				prevVisit: guild.prevVisit,
				lastVisit: guild.lastVisit,
				visits: guild.visits,
				activeNow: rows.filter(r => r.isNew).length,
			},
			rows,
		};
	},


	/**
	 * Markup of the box, a pure function of the view model
	 *
	 * @param vm result of getViewModel
	 * @returns {TemplateResult}
	 */
	view: (vm) => {
		const { html } = litHtml,
			t = (key) => i18n('Boxes.GbgGuildActivity.' + key),
			time = (ms) => moment(ms).format('HH:mm'),
			g = vm.guild;

		if (!g) return html`<div class="dark-bg toolbox-head">${t('Empty')}</div>`;

		const head = !g.prevVisit
			? t('FirstVisit')
			: HTML.i18nReplacer(t(g.activeNow > 0 ? 'Interval' : 'IntervalNone'), { from: time(g.prevVisit), to: time(g.lastVisit), count: g.activeNow });

		return html`
			${vm.guilds.length < 2 ? '' : html`
				<div class="gga-guilds">
					${vm.guilds.map(x => html`
						<button class="btn ${x.active ? 'btn-active' : ''}" @click=${() => GbgGuildActivity.select(x.id)}>${x.name}</button>`)}
				</div>`}
			<div class="dark-bg toolbox-head">
				<strong>${g.name}</strong><br>
				${head}<br>
				<small>${HTML.i18nReplacer(t('Since'), { time: time(g.firstVisit), visits: g.visits })}</small>
			</div>
			${vm.rows.length === 0 ? '' : html`
				<table class="foe-table gga-table">
					<thead class="sticky">
						<tr>
							<th>${t('Player')}</th>
							<th>${t('LastActive')}</th>
							<th>${t('Gained')}</th>
						</tr>
					</thead>
					<tbody>
						${vm.rows.map(r => html`
							<tr class="${r.isNew ? 'gga-new' : ''}">
								<td>${r.name}</td>
								<td>${time(r.lastFrom)}–${time(r.lastTo)} <strong class="success">+${HTML.Format(r.lastDelta)}</strong></td>
								<td>${HTML.Format(r.gained)}</td>
							</tr>`)}
					</tbody>
				</table>`}
			<div class="gga-hint">${t('Hint')}</div>`;
	},
};
