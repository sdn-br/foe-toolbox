/*
 * **************************************************************************************
 *
 * FoE Toolbox: charts of the toolbox statistics (Stats, js/web/stats) inside other boxes.
 *
 * StatsEmbed.render(container, config) draws what the statistics box draws with the same
 * settings, through the Stats code itself (series, delta, chart options, tooltip, toolbox).
 * StatsEmbed.dispose(container) frees the chart. API in docs/helfer-migration.md.
 *
 * Stats keeps its settings and its chart in globals (Stats.state, Stats.DatePickerFrom/To,
 * Stats.getChart on #statsChart, Stats.ChartData, Stats._tooltipMeta). A render swaps them
 * for the embed and restores them in a finally, without changing stats.js:
 *
 * - The database is read first, outside the swap: Stats.fetchRange with the dates of the
 *   embed (it reads them synchronously, they are restored right after the call), plus the
 *   player cache or reward types the series functions read directly. Inside the swap these
 *   reads answer with the rows already read, so the swapped part only waits on resolved
 *   promises and ends within one microtask run: no click, date picker, timer or game
 *   response can see the swapped globals. A timer logs a warning if that ever breaks.
 * - Renders run one after another in a queue. Stats.updateCharts is wrapped into the same
 *   queue (scripts/toolbox-wraps.txt), so the statistics box never draws while an embed
 *   holds the globals, and an embed waits for a pending render of the box.
 * - Tooltip, data view and CSV of an embedded chart read the globals when they are used,
 *   long after the render. They get the data of the embed swapped in for that one
 *   synchronous call.
 *
 * You may use, distribute and modify this code under the terms of the AGPL license.
 * See file LICENSE.md for full license details.
 *
 * **************************************************************************************
 */

let StatsEmbed = {

	queue: Promise.resolve(),
	// container -> { token, chart, observer, chartData, meta }
	embeds: new WeakMap(),
	// the unwrapped Stats.updateCharts, set below; an embed calling the wrapper would wait on itself
	updateCharts: null,

	// tables Stats.updateCharts passes to Stats.fetchRange, by source
	rangeTables: {
		statsGBGPlayers: ['statsGBGPlayers', null],
		statsUnitsD: ['statsUnitsD', 'statsUnitsH'],
		statsUnitsH: ['statsUnitsD', 'statsUnitsH'],
		statsTreasureClanD: ['statsTreasureClanD', 'statsTreasureClanH'],
		statsTreasureClanH: ['statsTreasureClanD', 'statsTreasureClanH'],
		statsTreasurePlayerD: ['statsTreasurePlayerD', 'statsTreasurePlayerH'],
		statsTreasurePlayerH: ['statsTreasurePlayerD', 'statsTreasurePlayerH'],
		statsRewards: ['statsRewards', null],
	},

	// tables the series functions read in full (IndexDB.db.<table>.toArray), by source
	fullTables: {
		statsGBGPlayers: 'statsGBGPlayerCache',
		statsRewards: 'statsRewardTypes',
	},

	stateKeys: ['source', 'chartType', 'eras', 'isGroupByEra', 'isRenormalize', 'rewardSource', 'filter'],


	/**
	 * Draws a statistics chart into the container, like the statistics box with these settings
	 *
	 * @param {HTMLElement} container element of the chart, sized by the caller, the embed owns its content
	 * @param {Object} [config] keys of Stats.state (source, chartType, eras, isGroupByEra, isRenormalize,
	 *     rewardSource, filter), missing ones from Stats.state; from and to (Date, both null = all rows, the default)
	 * @returns {Promise<?{rows: number}>} rows in the range (0: nothing drawn, the container is empty),
	 *     null when a newer render or dispose of the container came first
	 */
	render: (container, config = {}) => {
		let embed = StatsEmbed.embeds.get(container);
		if (!embed) {
			embed = { token: 0 };
			StatsEmbed.embeds.set(container, embed);
		}

		let token = ++embed.token;
		return StatsEmbed.enqueue(() => StatsEmbed.draw(container, embed, token, config));
	},


	/**
	 * @param {HTMLElement} container
	 */
	dispose: (container) => {
		let embed = StatsEmbed.embeds.get(container);
		if (!embed) return;

		StatsEmbed.embeds.delete(container);
		StatsEmbed.disposeChart(embed);
	},


	/**
	 * @param {function(): *} job
	 * @returns {Promise<*>} result of the job, a failed job does not stop the queue
	 */
	enqueue: (job) => {
		let result = StatsEmbed.queue.then(job);
		StatsEmbed.queue = result.catch(() => {});
		return result;
	},


	draw: async (container, embed, token, config) => {
		let stale = () => embed.token !== token || StatsEmbed.embeds.get(container) !== embed || !container.isConnected;
		if (stale()) return null;

		await Stats.loadChartLib();

		let state = StatsEmbed.getState(config),
			from = config.from ?? null,
			to = config.to ?? null,
			[daily, hourly] = StatsEmbed.rangeTables[state.source] || [state.source, null],
			fullTable = StatsEmbed.fullTables[state.source],
			fetchRange = Stats.fetchRange,
			rows = await StatsEmbed.withGlobals({ DatePickerFrom: from, DatePickerTo: to }, () => fetchRange(daily, hourly)),
			fullRows = fullTable ? await IndexDB.db[fullTable].toArray() : null;

		if (stale()) return null;

		if (rows.length === 0) {
			StatsEmbed.disposeChart(embed);
			container.textContent = '';
			return { rows: 0 };
		}

		let chart = StatsEmbed.getChart(container, embed),
			realDb = IndexDB.db,
			db = new Proxy(realDb, {
				get: (target, key) => key === fullTable ? { toArray: () => Promise.resolve(fullRows) } : Reflect.get(target, key),
			}),
			chartToolbox = Stats.chartToolbox,
			timeTooltipFormatter = Stats.timeTooltipFormatter;

		let drawn = await StatsEmbed.swapped({
			state: state,
			DatePickerFrom: from,
			DatePickerTo: to,
			ChartData: null,
			_tooltipMeta: null,
			// another table would read the DB inside the swap, the timer warns then
			fetchRange: (d, h = null) => d === daily && h === hourly ? Promise.resolve(rows) : fetchRange(d, h),
			getChart: () => chart,
			chartToolbox: () => StatsEmbed.toolbox(chartToolbox(), embed),
			timeTooltipFormatter: (params) => StatsEmbed.withGlobals({ _tooltipMeta: embed.meta }, () => timeTooltipFormatter(params)),
		}, db, async () => {
			await StatsEmbed.updateCharts();
			return { chartData: Stats.ChartData, meta: Stats._tooltipMeta };
		});

		embed.chartData = drawn.chartData;
		embed.meta = drawn.meta;

		return { rows: rows.length };
	},


	/**
	 * Settings of the embed: a copy of Stats.state with the keys of the config
	 *
	 * @param {Object} config
	 * @returns {Object}
	 */
	getState: (config) => {
		let state = Object.assign({}, Stats.state, { eras: Object.assign({}, Stats.state.eras), eraSelectOpen: false });

		for (let key of StatsEmbed.stateKeys) {
			if (config[key] !== undefined) state[key] = config[key];
		}

		// as Stats.Show: without a selection the current and the previous era
		if (!Object.keys(state.eras).length) {
			state.eras = { [Technologies.EraNames[CurrentEraID]]: true };
			if (CurrentEraID > 2) state.eras[Technologies.EraNames[CurrentEraID - 1]] = true;
		}

		return state;
	},


	/**
	 * Data view and CSV of Stats.chartToolbox read Stats.ChartData when clicked
	 *
	 * @param {Object} option result of Stats.chartToolbox
	 * @param {Object} embed
	 * @returns {Object}
	 */
	toolbox: (option, embed) => {
		let feature = option.feature,
			toContent = feature.dataView?.optionToContent,
			csv = feature.myCsv?.onclick;

		if (toContent) feature.dataView.optionToContent = () => StatsEmbed.withGlobals({ ChartData: embed.chartData }, toContent);
		if (csv) feature.myCsv.onclick = () => StatsEmbed.withGlobals({ ChartData: embed.chartData }, csv);

		return option;
	},


	/**
	 * Runs fn with the given Stats properties, synchronously
	 *
	 * @param {Object} values
	 * @param {function(): *} fn
	 * @returns {*}
	 */
	withGlobals: (values, fn) => {
		let saved = {};
		for (let key in values) {
			saved[key] = Stats[key];
			Stats[key] = values[key];
		}

		try {
			return fn();
		}
		finally {
			Object.assign(Stats, saved);
		}
	},


	/**
	 * Runs the async fn with the given Stats properties and IndexDB.db. fn must only wait on
	 * resolved promises, then nothing outside sees the swap (see header).
	 *
	 * @param {Object} values
	 * @param {Object} db
	 * @param {function(): Promise<*>} fn
	 * @returns {Promise<*>}
	 */
	swapped: async (values, db, fn) => {
		let saved = {},
			savedDb = IndexDB.db,
			leaked = false,
			timer = setTimeout(() => leaked = true, 0);

		for (let key in values) {
			saved[key] = Stats[key];
			Stats[key] = values[key];
		}
		IndexDB.db = db;

		try {
			return await fn();
		}
		finally {
			Object.assign(Stats, saved);
			IndexDB.db = savedDb;
			clearTimeout(timer);

			if (leaked) console.warn('StatsEmbed: a task ran while the Stats globals were swapped, Stats reads something StatsEmbed does not read ahead');
		}
	},


	/**
	 * Own ECharts instance on the container, kept at its size (as Stats.getChart)
	 *
	 * @param {HTMLElement} container
	 * @param {Object} embed
	 * @returns {Object}
	 */
	getChart: (container, embed) => {
		if (embed.chart && !embed.chart.isDisposed()) return embed.chart;

		container.textContent = '';
		container.classList.add('stats-embed');

		let chart = embed.chart = echarts.init(container, 'foe');
		embed.observer = new ResizeObserver(() => chart.resize());
		embed.observer.observe(container);

		return chart;
	},


	disposeChart: (embed) => {
		embed.observer?.disconnect();
		embed.observer = null;
		embed.chart?.dispose();
		embed.chart = null;
		embed.chartData = null;
		embed.meta = null;
	},
};


{
	const updateCharts = Stats.updateCharts;
	StatsEmbed.updateCharts = updateCharts;

	// renders of the statistics box join the queue of the embeds, see header
	Stats.updateCharts = (...args) => StatsEmbed.enqueue(() => updateCharts(...args));

	// now, a pop-out copies the style sheets of the game page only when it opens
	HTML.AddCssFile('stats-embed');
}
