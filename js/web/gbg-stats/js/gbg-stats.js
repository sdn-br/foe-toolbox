/*
 * **************************************************************************************
 *
 * FoE Toolbox: window "GG Statistiken", after Forge Hammer (js/web/stats, ShowGBGCharts,
 * buildGBGGuildsChart, getGBGForecast, getGBGRateSeries), drawn with ECharts instead of Chart.js.
 *
 * - tab "Siegpunkte": victory points of all guilds of a round from GbgHistory (gbg-history),
 *   tooltip with distance to the guilds above and below and points per hour, CSV export,
 *   optional dashed forecast until the end of a running round
 * - tab "Spieler": the player chart of the toolbox statistics (source statsGBGPlayers, same score
 *   as Forge Hammer) on the time range of the round, embedded with StatsEmbed (stats-embed),
 *   plus a button that opens it in the statistics box
 * - button "Statistiken" in the round bar of the GBG player window (wrapper around
 *   Guild_fights.SetBoxNavigation)
 *
 * Settings in localStorage "GbgStatsSettings" ({ forecast, tooltipColumns }), like GexStatSettings.
 *
 * You may use, distribute and modify this code under the terms of the AGPL license.
 * See file LICENSE.md for full license details.
 *
 * **************************************************************************************
 */

let GbgStats = {

	boxId: 'GbgStats',
	round: null,
	rows: [],
	rates: null,
	forecast: null,
	forecastAvailable: false,
	chart: null,
	// 1 = Siegpunkte, 2 = Spieler; tracked, :visible is also false while the box is minimized
	activeTab: 1,
	resizeObserver: null,
	// the round can change faster than the DB answers, only the last render may draw
	renderToken: 0,

	settings: Object.assign(
		{ forecast: false, tooltipColumns: ['ahead', 'rate'] },
		JSON.parse(localStorage.getItem('GbgStatsSettings') || 'null') || {}
	),

	// as Forge Hammer: at least 3 rows over at least 24 h, rate measured over about 24 h
	minRows: 3,
	minSpan: 86400,
	rateWindow: 86400,


	/**
	 * Opens the window on a round, a second click on the same round closes it
	 *
	 * @param {number} [gbground] end of the round, the running round by default
	 * @returns {Promise<void>}
	 */
	show: async (gbground) => {
		if (!Guild_fights.db) return;

		gbground = gbground || Guild_fights.CurrentGBGRound;

		if ($(`#${GbgStats.boxId}`).length > 0) {
			if (gbground === GbgStats.round) {
				GbgStats.disposeCharts();
				HTML.CloseOpenBox(GbgStats.boxId);
				return;
			}
		}
		else {
			HTML.Box({
				id: GbgStats.boxId,
				title: i18n('Boxes.GuildFights.Stats.Title'),
				auto_close: true,
				dragdrop: true,
				minimize: true,
				resize: true,
				popout: () => MainParser.PopOut(GbgStats.boxId, 920, 580),
				settings: GbgStats.showSettings,
			});
			HTML.AddCssFile('gbg-stats');

			// bound on the box, not on document, so it also works in the pop-out window
			$(`#${GbgStats.boxId}`)
				.on('click', `#${GbgStats.boxId}close`, GbgStats.disposeCharts)
				.on('click', '.settingsbox-wrapper .saveSettings', GbgStats.saveSettings)
				.on('change', '.gbgstats-round', function () { GbgStats.setRound(parseInt($(this).val())); })
				.on('click', '.gbgstats-week', function () { GbgStats.setRound($(this).data('week')); })
				.on('click', '.gbgstats-players-open', GbgStats.openPlayerStats);
		}

		await GbgStats.setRound(gbground);

		// opened from the player box, whose click handler (HTML.Box) raises the player box afterwards
		setTimeout(() => HTML.BringToFront($(`#${GbgStats.boxId}`)), 0);
	},


	/**
	 * @param {number} gbground
	 * @returns {Promise<void>}
	 */
	setRound: async (gbground) => {
		let rounds = await GbgStats.getRounds();
		GbgStats.round = rounds.includes(gbground) ? gbground : (rounds[0] || null);
		GbgStats.render(rounds);
	},


	/**
	 * Rounds of the player window plus every round with victory points, newest first
	 *
	 * @returns {Promise<number[]>}
	 */
	getRounds: async () => {
		let withPoints = await Guild_fights.db.guildHistory.orderBy('gbground').uniqueKeys();
		return [...new Set([Guild_fights.CurrentGBGRound, ...(Guild_fights.GBGAllRounds || []), ...withPoints])]
			.filter(round => round)
			.sort((a, b) => b - a);
	},


	/**
	 * Round bar and tabs, then the content of the active tab
	 *
	 * @param {number[]} rounds
	 */
	render: (rounds) => {
		let round = GbgStats.round,
			index = rounds.indexOf(round),
			previous = rounds[index + 1] || null,
			next = index > 0 ? rounds[index - 1] : null,
			options = rounds.map(week => `<option value="${week}"${week === round ? ' selected="selected"' : ''}>${moment.unix(week).subtract(11, 'd').format(i18n('Date'))} - ${moment.unix(week).format(i18n('Date'))}</option>`).join('');

		GbgStats.disposeCharts();

		$(`#${GbgStats.boxId}Body`).html(`<div class="gbgstats-roundswitch dark-bg">
				${i18n('Boxes.GuildMemberStat.GBFRound')}
				<button class="btn gbgstats-week" data-week="${previous}"${previous === null ? ' disabled' : ''}>&lt;</button>
				<select class="gbgstats-round"${rounds.length ? '' : ' disabled'}>${options}</select>
				<button class="btn gbgstats-week" data-week="${next}"${next === null ? ' disabled' : ''}>&gt;</button>
			</div>
			<div class="gbgstats-tabs tabs">
				<ul class="horizontal dark-bg">
					<li class="game-cursor"><a href="#GbgStatsGuilds" class="game-cursor">${i18n('Boxes.GuildFights.Stats.TabGuilds')}</a></li>
					<li class="game-cursor"><a href="#GbgStatsPlayers" class="game-cursor">${i18n('Boxes.GuildFights.Stats.TabPlayers')}</a></li>
				</ul>
				<div id="GbgStatsGuilds">
					<div class="gbgstats-hint" style="display:none"></div>
					<div id="GbgStatsChart"></div>
				</div>
				<div id="GbgStatsPlayers">
					<div class="gbgstats-players-bar"><button class="btn btn-slim gbgstats-players-open"${round ? '' : ' disabled'}>${i18n('Boxes.GuildFights.Stats.PlayersOpen')}</button></div>
					<div class="gbgstats-hint" style="display:none"></div>
					<div id="GbgStatsPlayersChart"></div>
				</div>
			</div>`);

		let tabs = $(`#${GbgStats.boxId}Body .gbgstats-tabs`);
		tabs.tabslet({ active: GbgStats.activeTab });

		// a chart sized in a hidden tab ends up 0 px wide, so draw it when the tab is shown
		tabs.on('_after', () => {
			GbgStats.activeTab = $('#GbgStatsGuilds').css('display') === 'none' ? 2 : 1;
			GbgStats.renderTab();
		});

		GbgStats.renderTab();
	},


	/**
	 * Draws the chart of the active tab and frees the other one
	 */
	renderTab: () => {
		if (GbgStats.activeTab === 1) {
			GbgStats.disposePlayers();
			GbgStats.renderGuilds();
		}
		else {
			GbgStats.disposeChart();
			GbgStats.renderPlayers();
		}
	},


	/**
	 * @returns {boolean} window open on the tab "Siegpunkte"
	 */
	guildsShown: () => GbgStats.activeTab === 1 && $('#GbgStatsChart').length > 0,


	/**
	 * Player chart of the toolbox statistics for the selected round, as the statistics box
	 * draws it with source statsGBGPlayers, line view and the time range of the round
	 *
	 * @returns {Promise<void>}
	 */
	renderPlayers: async () => {
		let container = document.getElementById('GbgStatsPlayersChart');
		if (!container) return;

		let hint = $('#GbgStatsPlayers .gbgstats-hint'),
			range = GbgStats.playerRange();

		if (!range) {
			StatsEmbed.dispose(container);
			hint.text(i18n('Boxes.GuildFights.Stats.PlayersNoData')).show();
			return;
		}

		let result = await StatsEmbed.render(container, { source: 'statsGBGPlayers', chartType: 'line', from: range.from, to: range.to });

		// null: the round or the tab changed meanwhile, the newer render sets the hint
		if (result) hint.text(i18n('Boxes.GuildFights.Stats.PlayersNoData')).toggle(result.rows === 0);
	},


	/**
	 * Time range of the selected round for the player chart: end minus 11 days to the end, or now
	 *
	 * @returns {?{from: Date, to: Date}}
	 */
	playerRange: () => {
		if (!GbgStats.round) return null;

		// the final standing is stored with the round end as date (GbgHistory.handleFinalPlayers),
		// one second more because the range query excludes its end
		let end = moment.unix(GbgStats.round);
		return { from: end.clone().subtract(11, 'days').toDate(), to: moment.min(end.clone().add(1, 'second'), moment()).toDate() };
	},


	/**
	 * Victory points chart of the selected round
	 *
	 * @returns {Promise<void>}
	 */
	renderGuilds: async () => {
		let token = ++GbgStats.renderToken,
			gbground = GbgStats.round,
			rows = gbground ? await GbgHistory.getRoundRows(gbground) : [];

		// the player can switch the round or the tab while the DB answers
		if (token !== GbgStats.renderToken || !GbgStats.guildsShown()) return;

		let forecast = GbgStats.getForecast(rows, gbground);

		GbgStats.rows = rows;
		GbgStats.rates = GbgStats.getRateSeries(rows);
		GbgStats.forecast = forecast;
		GbgStats.forecastAvailable = forecast !== null;

		let hint = '';
		if (rows.length === 0) hint = i18n('Boxes.GuildFights.Stats.NoData');
		else if (GbgStats.settings.forecast && !forecast && GbgStats.isRunning(gbground)) hint = i18n('Boxes.GuildFights.Stats.ForecastNoData');

		$('#GbgStatsGuilds .gbgstats-hint').text(hint).toggle(hint !== '');

		if (rows.length === 0) {
			GbgStats.disposeChart();
			$('#GbgStatsChart').hide();
			return;
		}

		$('#GbgStatsChart').show();

		await Stats.loadChartLib();
		if (token !== GbgStats.renderToken || !GbgStats.guildsShown()) return;

		let chart = GbgStats.getChart();
		if (chart) chart.setOption(GbgStats.chartOption(rows, GbgStats.settings.forecast ? forecast : null), { notMerge: true });
	},


	/**
	 * @param {Object[]} rows guildHistory rows, oldest first
	 * @param {?Object} forecast see getForecast, null to leave it out
	 * @returns {Object} ECharts option
	 */
	chartOption: (rows, forecast) => {
		let guilds = GbgStats.getGuilds(rows),
			colors = GbgStats.getGuildColors(GbgStats.round),
			latest = rows[rows.length - 1],
			lastTime = forecast ? forecast.marks[forecast.marks.length - 1] : latest.time,
			// hourly labels get unreadable beyond a few days, and a round spans eleven
			labelFormat = lastTime - rows[0].time > 3 * 86400 ? 'dd, DD.MM' : 'dd, HH:mm',
			series = [];

		guilds.forEach((guild, i) => {
			// explicit, so the forecast line of a guild gets the same color as its points
			let color = colors[guild.id] || Stats.ChartColors[i % Stats.ChartColors.length],
				style = {
					name: guild.name,
					type: 'line',
					symbolSize: 3,
					showSymbol: rows.length < 60,
					connectNulls: true,
					itemStyle: { color: color },
				};

			series.push(Object.assign({}, style, {
				id: 'g' + guild.id,
				lineStyle: { color: color, width: 1.5 },
				data: rows.flatMap(row => {
					let entry = row.guilds.find(g => g.id === guild.id);
					return entry ? [[row.time * 1000, entry.points]] : [];
				}),
			}));

			let projected = forecast?.points[guild.id],
				start = latest.guilds.find(g => g.id === guild.id);

			if (projected && start) {
				// starts on the last measured point, so the dashed line continues the solid one
				series.push(Object.assign({}, style, {
					id: 'f' + guild.id,
					lineStyle: { color: color, width: 1.5, type: 'dashed' },
					data: [[latest.time * 1000, start.points], ...forecast.marks.map((time, j) => [time * 1000, projected.values[j]])],
				}));
			}
		});

		return {
			animation: false,
			grid: { left: 10, right: 20, top: 62, bottom: 10, containLabel: true },
			legend: {
				type: 'scroll',
				// below the toolbox icons, like in the statistics box
				top: 28,
				left: 10,
				right: 20,
				data: guilds.map(g => g.name),
				// at the end the buttons ran into the toolbox icons
				selectorPosition: 'start',
				selector: [
					{ type: 'all', title: i18n('Boxes.GuildFights.Stats.LegendAll') },
					{ type: 'inverse', title: i18n('Boxes.GuildFights.Stats.LegendInverse') },
				],
			},
			toolbox: {
				right: 8,
				top: 0,
				itemSize: 13,
				itemGap: 10,
				feature: {
					saveAsImage: { title: 'PNG', name: 'gbg-siegpunkte', backgroundColor: '#2a2a2b' },
					myCsv: {
						show: true,
						title: 'CSV',
						icon: 'path://M11,3 L13,3 L13,11 L16,11 L12,16 L8,11 L11,11 Z M4,18 L20,18 L20,20 L4,20 Z',
						onclick: GbgStats.exportCsv,
					},
				},
			},
			tooltip: {
				trigger: 'axis',
				confine: true,
				formatter: GbgStats.tooltip,
			},
			dataZoom: [{ type: 'inside', filterMode: 'none' }],
			xAxis: {
				type: 'time',
				axisLabel: { hideOverlap: true, formatter: value => moment(value).format(labelFormat) },
			},
			yAxis: {
				type: 'value',
				scale: true,
				axisLabel: { formatter: Stats.formatNumber },
			},
			series: series,
		};
	},


	/**
	 * Tooltip: one row per guild, ranked by points. Guild and points always, the optional
	 * columns from the settings. The rate belongs to the hovered time, on the forecast to the
	 * rate the forecast was built from.
	 *
	 * @param {Object|Object[]} params ECharts axis tooltip params
	 * @returns {string}
	 */
	tooltip: (params) => {
		if (!Array.isArray(params)) params = [params];

		// at the last measured time the forecast line starts with the same point, measured wins
		let byGuild = new Map();
		for (let p of params) {
			let projected = p.seriesId.charAt(0) === 'f',
				id = Number(p.seriesId.slice(1));

			if (!byGuild.has(id) || !projected) {
				byGuild.set(id, { id: id, name: p.seriesName, marker: p.marker, points: p.value[1], projected: projected });
			}
		}

		let rows = [...byGuild.values()].filter(r => r.points != null).sort((a, b) => b.points - a.points);
		if (rows.length === 0) return '';

		let columns = GbgStats.settings.tooltipColumns,
			isProjected = rows.every(r => r.projected),
			time = Math.round(params[0].value[0] / 1000),
			measured = isProjected ? null : GbgStats.rates?.[time],
			basisHours = isProjected ? GbgStats.forecast?.hours : measured?.hours,
			rateOf = id => isProjected ? GbgStats.forecast?.points[id]?.rate : measured?.rates[id],
			showBehind = columns.includes('behind'),
			showAhead = columns.includes('ahead'),
			// a rate needs a row behind it, a single row gives the column nothing to show
			showRate = columns.includes('rate') && !!GbgStats.rates,
			esc = text => $('<div />').text(text ?? '').html(),
			num = value => value == null ? '–' : Math.round(value).toLocaleString(i18n('Local'));

		let head = `<th>${i18n('General.Guild')}</th><th class="text-right">${i18n('Boxes.GuildFights.Stats.TTPoints')}</th>`;
		if (showBehind) head += `<th class="text-right">${i18n('Boxes.GuildFights.Stats.TTBehind')}</th>`;
		if (showAhead) head += `<th class="text-right">${i18n('Boxes.GuildFights.Stats.TTAhead')}</th>`;
		if (showRate) head += `<th class="text-right">${i18n('Boxes.GuildFights.Stats.TTRate')}${basisHours ? ` <small>${i18n('Boxes.GuildFights.Stats.TTRateBasis').replace('__hours__', Math.round(basisHours))}</small>` : ''}</th>`;

		let body = rows.map((row, i) => {
			let cells = `<td>${row.marker}${esc(row.name)}</td><td class="text-right">${num(row.points)}</td>`;
			if (showBehind) cells += `<td class="text-right">${num(i > 0 ? rows[i - 1].points - row.points : null)}</td>`;
			if (showAhead) cells += `<td class="text-right">${num(i < rows.length - 1 ? row.points - rows[i + 1].points : null)}</td>`;
			if (showRate) cells += `<td class="text-right">${num(rateOf(row.id))}</td>`;
			return `<tr>${cells}</tr>`;
		}).join('');

		let projected = isProjected ? ` <em>${i18n('Boxes.GuildFights.Stats.ForecastProjected')}</em>` : '';

		return `<div class="gbgstats-tt"><small>${moment.unix(time).format(i18n('Date') + ' HH:mm')}${projected}</small>
			<table><tr>${head}</tr>${body}</table></div>`;
	},


	/**
	 * Every guild of the round once, in the order of the newest ranking
	 *
	 * @param {Object[]} rows
	 * @returns {{id: number, name: string}[]}
	 */
	getGuilds: (rows) => {
		let guilds = new Map();
		for (let i = rows.length - 1; i >= 0; i--) {
			for (let g of rows[i].guilds) {
				if (!guilds.has(g.id)) guilds.set(g.id, { id: g.id, name: g.name });
			}
		}
		return [...guilds.values()];
	},


	/**
	 * Map colors of the guilds, only known for the running round
	 *
	 * @param {number} gbground
	 * @returns {Object.<number, string>} clan id -> color
	 */
	getGuildColors: (gbground) => {
		let colors = {};
		if (gbground !== Guild_fights.CurrentGBGRound || !Guild_fights.SortedColors) return colors;

		for (let participant of Guild_fights.MapData?.battlegroundParticipants || []) {
			let color = Guild_fights.SortedColors.find(c => c.id === participant.participantId);
			if (color?.main && participant.clan) colors[participant.clan.id] = color.main;
		}
		return colors;
	},


	/**
	 * @param {number} gbground
	 * @returns {boolean}
	 */
	isRunning: (gbground) => !!gbground && moment().unix() < gbground,


	/**
	 * Points per hour of every guild at every row, each measured back to the row closest to
	 * rateWindow earlier (Forge Hammer getGBGRateSeries)
	 *
	 * @param {Object[]} rows guildHistory rows, oldest first
	 * @returns {?Object.<number, {hours: number, rates: Object.<number, number>}>} by row time
	 */
	getRateSeries: (rows) => {
		if (rows.length < 2) return null;

		let series = {};

		// the oldest row has nothing behind it
		for (let i = 1; i < rows.length; i++) {
			let current = rows[i],
				target = current.time - GbgStats.rateWindow,
				// closest to a day back, which can be a lot older when data is sparse
				reference = rows.slice(0, i).reduce((closest, r) => Math.abs(r.time - target) < Math.abs(closest.time - target) ? r : closest),
				hours = (current.time - reference.time) / 3600;

			if (hours <= 0) continue;

			let rates = {};
			for (let guild of current.guilds) {
				let before = reference.guilds.find(g => g.id === guild.id);
				// totals only grow, a drop would be bad data
				if (before) rates[guild.id] = Math.max(0, (guild.points - before.points) / hours);
			}

			series[current.time] = { hours: hours, rates: rates };
		}

		return Object.keys(series).length ? series : null;
	},


	/**
	 * Projects the points of every guild to the end of a running round with the newest rate
	 * (Forge Hammer getGBGForecast). One mark per remaining day, counted back from the end of
	 * the round so they all land on the same hour of the day.
	 *
	 * @param {Object[]} rows guildHistory rows, oldest first
	 * @param {number} gbground end of the round
	 * @returns {?{marks: number[], hours: number, points: Object.<number, {rate: number, values: number[]}>}}
	 */
	getForecast: (rows, gbground) => {
		// a past round ended, there is nothing to project
		if (!GbgStats.isRunning(gbground) || rows.length < GbgStats.minRows) return null;

		let latest = rows[rows.length - 1];
		if (gbground <= latest.time || latest.time - rows[0].time < GbgStats.minSpan) return null;

		let measured = GbgStats.getRateSeries(rows)?.[latest.time];
		if (!measured) return null;

		let marks = [];
		for (let time = gbground; time > latest.time && marks.length < 14; time -= 86400) {
			marks.unshift(time);
		}

		let points = {};
		for (let guild of latest.guilds) {
			let rate = measured.rates[guild.id];
			if (rate === undefined) continue;

			points[guild.id] = {
				rate: rate,
				values: marks.map(time => Math.round(guild.points + rate * (time - latest.time) / 3600)),
			};
		}

		return { marks: marks, hours: measured.hours, points: points };
	},


	/**
	 * CSV of the measured points only, the forecast stays out
	 */
	exportCsv: () => {
		let rows = GbgStats.rows;
		if (!rows.length) return;

		let guilds = GbgStats.getGuilds(rows),
			q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"',
			lines = [['date', ...guilds.map(g => g.name)].map(q).join(';')];

		for (let row of rows) {
			lines.push([
				q(moment.unix(row.time).format('YYYY-MM-DD HH:mm')),
				...guilds.map(g => row.guilds.find(x => x.id === g.id)?.points ?? ''),
			].join(';'));
		}

		let blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }),
			a = document.createElement('a');

		a.href = URL.createObjectURL(blob);
		a.download = `gbg-siegpunkte-${moment.unix(GbgStats.round).format('YYYY-MM-DD')}.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
	},


	/**
	 * ECharts instance on #GbgStatsChart, kept at the size of its container (as Stats.getChart)
	 *
	 * @returns {?Object}
	 */
	getChart: () => {
		let container = document.getElementById('GbgStatsChart');
		if (!container) return null;

		let chart = echarts.getInstanceByDom(container);
		if (!chart) {
			GbgStats.disposeChart();
			container.textContent = '';
			chart = echarts.init(container, 'foe');
			GbgStats.chart = chart;

			GbgStats.resizeObserver = new ResizeObserver(() => chart.resize());
			GbgStats.resizeObserver.observe(container);
		}

		return chart;
	},


	disposeChart: () => {
		GbgStats.resizeObserver?.disconnect();
		GbgStats.resizeObserver = null;
		GbgStats.chart?.dispose();
		GbgStats.chart = null;
	},


	disposePlayers: () => {
		let container = document.getElementById('GbgStatsPlayersChart');
		if (container) StatsEmbed.dispose(container);
	},


	disposeCharts: () => {
		GbgStats.disposeChart();
		GbgStats.disposePlayers();
	},


	/**
	 * Opens the toolbox statistics with the GBG player chart on the time range of the round
	 */
	openPlayerStats: () => {
		let range = GbgStats.playerRange();
		if (!range) return;

		Stats.state.source = 'statsGBGPlayers';
		Stats.state.chartType = 'line';
		Stats.DatePickerFrom = range.from;
		Stats.DatePickerTo = range.to;

		// with an event the box is rebuilt instead of closed when it is already open
		Stats.Show(true);
	},


	/**
	 * Settings box (gear): forecast and the optional tooltip columns
	 */
	showSettings: () => {
		let s = GbgStats.settings,
			available = GbgStats.forecastAvailable,
			column = (key, label, fixed) => `<p><label><input type="checkbox" class="gbgstats-column" data-column="${key}"${fixed || s.tooltipColumns.includes(key) ? ' checked="checked"' : ''}${fixed ? ' disabled' : ''} /> ${i18n(label)}</label></p>`;

		$(`#${GbgStats.boxId}SettingsBox`).html(`
			<p><label><input type="checkbox" id="GbgStatsForecast"${s.forecast ? ' checked="checked"' : ''} /> ${i18n('Boxes.GuildFights.Stats.Forecast')}</label></p>
			<p class="text-smaller">${i18n(available ? 'Boxes.GuildFights.Stats.ForecastDesc' : 'Boxes.GuildFights.Stats.ForecastNoData')}</p>
			<hr>
			<p>${i18n('Boxes.GuildFights.Stats.TTColumns')}</p>
			${column('guild', 'General.Guild', true)}
			${column('points', 'Boxes.GuildFights.Stats.TTPoints', true)}
			${column('behind', 'Boxes.GuildFights.Stats.TTBehind', false)}
			${column('ahead', 'Boxes.GuildFights.Stats.TTAhead', false)}
			${column('rate', 'Boxes.GuildFights.Stats.TTRate', false)}
			<p><button class="btn saveSettings">${i18n('Boxes.GuildFights.SaveSettings')}</button></p>`);
	},


	saveSettings: () => {
		let box = $(`#${GbgStats.boxId}SettingsBox`);

		GbgStats.settings.forecast = box.find('#GbgStatsForecast').is(':checked');
		GbgStats.settings.tooltipColumns = box.find('.gbgstats-column:checked:not(:disabled)').map((i, el) => $(el).data('column')).get();
		localStorage.setItem('GbgStatsSettings', JSON.stringify(GbgStats.settings));

		box.remove();

		// the tooltip reads the columns on every hover, the forecast needs new chart data
		if (GbgStats.guildsShown()) GbgStats.renderGuilds();
	},
};


{
	const setBoxNavigation = Guild_fights.SetBoxNavigation;

	// button "Statistiken" in the round bar of the player window, for every round (Forge Hammer: running round only)
	Guild_fights.SetBoxNavigation = async (...args) => {
		const result = await setBoxNavigation(...args);

		let bar = $('#gbg_roundswitch'),
			round = args[0] || Guild_fights.GBGAllRounds?.[0];

		if (bar.length === 0 || !round) return result;

		let buttons = $('#gbgLogFilter');
		if (buttons.length === 0) buttons = $('<div id="gbgLogFilter"></div>').appendTo(bar);

		$(`<button class="btn">${i18n('Boxes.GuildFights.Stats.Open')}</button>`)
			.on('click', () => GbgStats.show(round))
			.prependTo(buttons);

		return result;
	};
}


FoEproxy.addFoeHelperHandler('GbgHistoryUpdated', (row) => {
	if (row?.gbground !== GbgStats.round || !GbgStats.guildsShown()) return;

	GbgStats.renderGuilds();
});
