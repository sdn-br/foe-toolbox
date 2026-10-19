/*
 * **************************************************************************************
 *
 * FoE Toolbox: progress of the own Great Buildings since the last visit, after Forge Hammer
 * (js/web/investment, tab "My GBs", commit c9eba24e2 and its follow-ups).
 * Passive: only reads what the game sends, never requests anything.
 *
 * - Snapshot: on every game start (StartupService.getData) the level and invested FP of every
 *   own GB are compared with the snapshot of the previous start, then the snapshot is replaced.
 *   A result not seen yet (tab not opened) is kept and added to the next comparison, so a
 *   reload does not lose it.
 *   Own contributions in between are counted in the snapshot (field "own") and subtracted,
 *   so the difference is what other players added.
 * - Contributors: the rankings of an own GB (getConstruction when opened, contributeForgePoints
 *   after an own contribution) are kept per GB, with the state of the previous visit as baseline.
 * - Tab "Meine LGs" in the Investment box (wrapper around Investment.BuildBox), counter with the
 *   FP total on the Investment menu button (wrapper around _menu.investment_Btn, setting
 *   ShowMyGBsCounter).
 *
 * Storage (localStorage, per player id):
 *   MyGBsSnapshot_<id>      { time, gbs: { <cityentity_id>: { level, invested, needed, own } } }
 *   MyGBsContributors_<id>  { <cityentity_id>: { level, visit, capturedAt, prevCapturedAt,
 *                             curr: { <player_id>: { name, fp } }, prev: { ... } } }
 *   MyGBsPending_<id>       { since, rows: [...] }  result with news, until the tab is opened
 *
 * Live updates: the game pushes contributions of other players to own GBs as WebSocket
 * CityMapService.updateEntity (new invested FP, no rankings, see _main.js). MyGBs.progressSince
 * with the snapshot entry and such an entity gives the live difference without touching the
 * snapshot.
 *
 * You may use, distribute and modify this code under the terms of the AGPL license.
 * See file LICENSE.md for full license details.
 *
 * **************************************************************************************
 */

// after the handler of _main.js, which sets ExtPlayerID and MainParser.CityMapData
FoEproxy.addHandler('StartupService', 'getData', (data, postData) => {
	MyGBs.checkProgress(data.responseData?.city_map?.entities);
});

// rankings of an own GB: opened (getConstruction) or own contribution (contributeForgePoints)
FoEproxy.addHandler('GreatBuildingsService', 'all', (data, postData) => {
	if (data.requestMethod === 'getConstruction') {
		MyGBs.handleRankings(data.responseData?.rankings, postData?.[0]?.requestData, false);
	}
	else if (data.requestMethod === 'contributeForgePoints') {
		MyGBs.handleRankings(data.responseData, postData?.[0]?.requestData, true);
	}
});

// the counter setting takes effect right away
$(document).on('change', 'input[data-id="ShowMyGBsCounter"]', () => MyGBs.refreshCounter());


let MyGBs = {

	/** start of this visit (ms), the contributor baseline is frozen per visit */
	VisitTime: 0,

	/** result of the comparison at the start: { since, rows: [...] }, undefined before the start */
	Progress: undefined,

	/** the "Meine LGs" tab was opened since the result with news, the counter is hidden then */
	Seen: false,

	/** expanded rows (cityentity_id) */
	expanded: new Set(),

	/** the last Investment.BuildBox call created the box (menu button: open on this tab) */
	boxCreated: false,


	storageKey: (kind) => `MyGBs${kind}_${ExtPlayerID}`,

	read: (kind) => {
		try {
			return JSON.parse(localStorage.getItem(MyGBs.storageKey(kind)));
		}
		catch (e) {
			return null;
		}
	},

	write: (kind, value) => localStorage.setItem(MyGBs.storageKey(kind), JSON.stringify(value)),

	remove: (kind) => localStorage.removeItem(MyGBs.storageKey(kind)),


	/**
	 * State of one GB as stored in the snapshot
	 *
	 * @param entity city map entity of type greatbuilding
	 * @returns {{level: number, invested: number, needed: number}}
	 */
	gbState: (entity) => ({
		level: entity.level || 0,
		invested: entity.state?.invested_forge_points || 0,
		needed: entity.state?.forge_points_for_level_up || 0,
	}),


	/**
	 * FP other players added to a GB between two states. Same level: the difference of the
	 * invested FP. Higher level: the rest of the old level plus the FP in the new level (the
	 * costs of levels in between are unknown, they are missing then). Own contributions since
	 * the earlier state (prev.own) are subtracted.
	 *
	 * @param prev snapshot entry { level, invested, needed, own }
	 * @param curr { level, invested } (gbState, or a live entity state)
	 * @returns {number} >= 0
	 */
	progressSince: (prev, curr) => {
		let raw = 0;

		if (curr.level === prev.level) {
			raw = curr.invested - prev.invested;
		}
		else if (curr.level > prev.level) {
			raw = (prev.needed - prev.invested) + curr.invested;
		}

		return Math.max(0, raw - (prev.own || 0));
	},


	/**
	 * Compares the GBs with the previous snapshot
	 *
	 * @param prev previous snapshot { time, gbs } or null on the first start
	 * @param current { <cityentity_id>: gbState }
	 * @returns {Object[]} one row per current GB { ceId, prevLevel, level, invested, needed, delta, changed, newlyBuilt }
	 */
	compare: (prev, current) => Object.entries(current).map(([ceId, c]) => {
		const p = prev?.gbs?.[ceId];

		// first start: nothing to compare
		if (!prev) {
			return { ceId, prevLevel: c.level, level: c.level, invested: c.invested, needed: c.needed, delta: 0, changed: false, newlyBuilt: false };
		}

		// built since the last visit
		if (!p) {
			return { ceId, prevLevel: null, level: c.level, invested: c.invested, needed: c.needed, delta: c.invested, changed: true, newlyBuilt: true };
		}

		const delta = MyGBs.progressSince(p, c);

		return { ceId, prevLevel: p.level, level: c.level, invested: c.invested, needed: c.needed, delta, changed: (delta > 0 || c.level !== p.level), newlyBuilt: false };
	}),


	/**
	 * Adds a result not seen yet to the new comparison: per GB the deltas add up, level and
	 * "newly built" of the older result stay. GBs no longer in the city drop out.
	 *
	 * @param pending { since, rows } or null
	 * @param rows rows of compare()
	 * @returns {Object[]}
	 */
	mergePending: (pending, rows) => {
		const old = Object.fromEntries((pending?.rows || []).map(r => [r.ceId, r]));

		return rows.map(r => {
			const p = old[r.ceId];
			if (!p?.changed) return r;

			return { ...r, prevLevel: p.prevLevel, delta: p.delta + r.delta, changed: true, newlyBuilt: p.newlyBuilt };
		});
	},


	/**
	 * Game start: compare with the previous snapshot, store the new one
	 *
	 * @param entities city_map.entities of StartupService.getData
	 */
	checkProgress: (entities) => {
		if (!Array.isArray(entities)) return;

		const now = +MainParser.getCurrentDate(),
			current = {};

		for (const entity of entities) {
			if (entity?.type !== 'greatbuilding') continue;
			current[entity.cityentity_id] = MyGBs.gbState(entity);
		}

		const prev = MyGBs.read('Snapshot');

		MyGBs.write('Snapshot', {
			time: now,
			gbs: Object.fromEntries(Object.entries(current).map(([ceId, c]) => [ceId, { ...c, own: 0 }])),
		});

		const pending = MyGBs.read('Pending');

		MyGBs.VisitTime = now;
		MyGBs.Progress = {
			since: pending?.since || prev?.time || null,
			rows: MyGBs.mergePending(pending, MyGBs.compare(prev?.gbs ? prev : null, current)),
		};
		MyGBs.Seen = false;

		if (MyGBs.Progress.rows.some(r => r.changed)) {
			MyGBs.write('Pending', MyGBs.Progress);
		}
		else {
			MyGBs.remove('Pending');
		}

		MyGBs.refreshCounter();
		MyGBs.render();
	},


	/**
	 * FP total of the GBs changed since the last visit
	 *
	 * @returns {number}
	 */
	total: () => (MyGBs.Progress?.rows || []).reduce((sum, row) => sum + (row.changed ? row.delta : 0), 0),


	/**
	 * Rankings of a GB. Only own GBs count: the request carries [entity id, player id, ...],
	 * the entity id is looked up in the own city only if the player id is the own one
	 * (entity ids of other cities overlap with the own ones).
	 *
	 * @param rankings GreatBuildingRankingRow[]
	 * @param requestData requestData of the request
	 * @param isContribution answer to an own contribution
	 */
	handleRankings: (rankings, requestData, isContribution) => {
		if (!Array.isArray(rankings) || !Array.isArray(requestData)) return;
		if (requestData[1] !== ExtPlayerID) return;

		const entity = MainParser.CityMapData?.[requestData[0]];
		if (entity?.type !== 'greatbuilding') return;

		const ceId = entity.cityentity_id,
			level = entity.level,
			store = MyGBs.read('Contributors') || {},
			before = store[ceId]?.level === level ? (store[ceId].curr?.[ExtPlayerID]?.fp || 0) : null;

		const players = MyGBs.captureContributors(store, ceId, level, rankings);

		if (isContribution) {
			// from the rankings; without rankings of this level from before, the amount of the request
			const amount = before !== null ? (players[ExtPlayerID]?.fp || 0) - before : (Number.isInteger(requestData[3]) ? requestData[3] : 0);
			MyGBs.addOwnContribution(ceId, amount);
		}
	},


	/**
	 * Stores the contributors of a GB. The state of the previous visit stays the baseline for
	 * the whole visit; after a level-up there is no baseline (rankings start over).
	 *
	 * @returns {Object} the contributors { <player_id>: { name, fp } }
	 */
	captureContributors: (store, ceId, level, rankings) => {
		const players = {};

		for (const row of rankings) {
			const playerId = row?.player?.player_id;
			if (playerId === undefined) continue; // free places without contributor

			players[playerId] = { name: row.player.name, fp: row.forge_points || 0 };
		}

		const existing = store[ceId];
		let prev = {}, prevAt = null;

		if (existing?.level === level && existing.visit === MyGBs.VisitTime) {
			// same visit: keep the baseline
			prev = existing.prev || {};
			prevAt = existing.prevCapturedAt || null;
		}
		else if (existing?.level === level) {
			// new visit: the state of the last visit becomes the baseline
			prev = existing.curr || {};
			prevAt = existing.capturedAt || null;
		}

		store[ceId] = {
			level,
			visit: MyGBs.VisitTime,
			capturedAt: +MainParser.getCurrentDate(),
			prevCapturedAt: prevAt,
			curr: players,
			prev,
		};

		MyGBs.write('Contributors', store);
		MyGBs.render();

		return players;
	},


	/**
	 * Own contribution to an own GB: counted in the snapshot, so it does not show up as a
	 * contribution of others at the next start
	 *
	 * @param ceId cityentity_id
	 * @param amount FP
	 */
	addOwnContribution: (ceId, amount) => {
		if (!(amount > 0)) return;

		const snapshot = MyGBs.read('Snapshot'),
			gb = snapshot?.gbs?.[ceId];
		if (!gb) return; // no snapshot yet, the next start creates it

		gb.own = (gb.own || 0) + amount;
		MyGBs.write('Snapshot', snapshot);
	},


	/**
	 * Counter on the Investment menu button: FP of other players since the last visit,
	 * until the tab was opened. Setting ShowMyGBsCounter (default on).
	 * Reads localStorage directly, the counter can be drawn before config.json is loaded.
	 */
	refreshCounter: () => {
		const show = MyGBs.hasNews();

		$('#mygbs-count').text(show ? HTML.FormatNumberShort(MyGBs.total()) : '').toggle(show);
	},


	/**
	 * The counter is shown: other players added FP since the last visit, the tab was not opened yet
	 *
	 * @returns {boolean}
	 */
	hasNews: () => localStorage.getItem('ShowMyGBsCounter') !== 'false' && !MyGBs.Seen && MyGBs.total() > 0,


	/**
	 * Builds the tab bar once around the body of a new Investment box:
	 * #InvestmentTabs (tab bar, #InvestmentBody of upstream, #MyGBsBody).
	 * Upstream keeps writing into #InvestmentBody by id.
	 */
	attachTab: () => {
		const box = $('#Investment');
		if (box.length === 0 || $('#InvestmentTabs').length > 0) return;

		const wrapper = $('<div id="InvestmentTabs" class="window-body" />'),
			tabs = $('<div class="tabs" />');

		$('#InvestmentBody').before(wrapper);
		wrapper.append(tabs, $('#InvestmentBody'), $('<div id="MyGBsBody" />'));

		MyGBs.renderTabs();
	},


	/**
	 * @param tab 'investment' or 'mygbs'
	 */
	selectTab: (tab) => {
		const wrapper = $('#InvestmentTabs');
		if (wrapper.length === 0) return;

		wrapper.toggleClass('mygbs-active', tab === 'mygbs');

		if (tab === 'mygbs') {
			MyGBs.Seen = true;
			MyGBs.remove('Pending');
			MyGBs.refreshCounter();
			MyGBs.render();
		}

		MyGBs.renderTabs();
	},


	renderTabs: () => {
		const el = $('#InvestmentTabs > .tabs')[0];
		if (!el) return;

		const { html } = litHtml,
			active = $('#InvestmentTabs').hasClass('mygbs-active') ? 'mygbs' : 'investment',
			tab = (id, label) => html`
				<li class="${active === id ? 'active' : ''}">
					<a @click=${(e) => { e.preventDefault(); MyGBs.selectTab(id); }}><span>${label}</span></a>
				</li>`;

		litHtml.render(html`
			<ul class="horizontal dark-bg">
				${tab('investment', i18n('Boxes.MyGBs.TabInvestment'))}
				${tab('mygbs', i18n('Boxes.MyGBs.Tab'))}
			</ul>`, el);
	},


	/**
	 * Renders the tab if the box is open. Data and markup are separate steps,
	 * getViewModel collects, view renders.
	 */
	render: () => {
		const body = $('#MyGBsBody')[0];
		if (!body) return;

		litHtml.render(MyGBs.view(MyGBs.getViewModel()), body);
	},


	toggleRow: (ceId) => {
		if (MyGBs.expanded.has(ceId)) MyGBs.expanded.delete(ceId);
		else MyGBs.expanded.add(ceId);

		MyGBs.render();
	},


	/**
	 * Everything the tab shows, as plain data
	 *
	 * @returns {Object}
	 */
	getViewModel: () => {
		const progress = MyGBs.Progress,
			store = (progress ? MyGBs.read('Contributors') : null) || {};

		const rows = (progress?.rows || []).map(row => {
			// rankings of an older level do not belong to the current one
			const contrib = (store[row.ceId]?.level === row.level ? store[row.ceId] : undefined),
				curr = contrib?.curr,
				open = MyGBs.expanded.has(row.ceId);

			return {
				...row,
				name: MainParser.CityEntities?.[row.ceId]?.name || row.ceId,
				leveledUp: (row.prevLevel !== null && row.level !== row.prevLevel),
				percent: (row.needed > 0 ? Math.min(100, row.invested / row.needed * 100) : 100),
				myFp: (curr ? (curr[ExtPlayerID]?.fp || 0) : null),
				donators: (curr ? Object.keys(curr).length : null),
				open,
				detail: (open ? MyGBs.contributorsViewModel(contrib) : undefined),
			};
		});

		// changed GBs first, then by name
		rows.sort((a, b) => (b.changed - a.changed) || a.name.localeCompare(b.name));

		return {
			loaded: !!progress,
			since: progress?.since || null,
			total: MyGBs.total(),
			rows,
		};
	},


	/**
	 * Contributors of one GB, with what each added since the baseline
	 *
	 * @param contrib entry of MyGBsContributors_<id> for the current level, or undefined
	 * @returns {Object|null} null without rankings
	 */
	contributorsViewModel: (contrib) => {
		if (!contrib?.curr) return null;

		const prev = contrib.prev || {},
			hasBaseline = !!contrib.prevCapturedAt;

		const players = Object.entries(contrib.curr).map(([id, c]) => ({
			id: Number(id),
			name: c.name,
			fp: c.fp,
			delta: (hasBaseline ? c.fp - (prev[id]?.fp || 0) : 0),
		}));
		players.sort((a, b) => b.fp - a.fp);

		return { since: (hasBaseline ? contrib.prevCapturedAt : null), players };
	},


	/**
	 * Markup of the tab, a pure function of the view model
	 *
	 * @param vm result of getViewModel
	 * @returns {TemplateResult}
	 */
	view: (vm) => {
		const { html } = litHtml,
			t = (key) => i18n('Boxes.MyGBs.' + key),
			date = (ms) => moment(ms).format(i18n('DateTime'));

		const head = !vm.loaded ? t('NotLoaded')
			: !vm.since ? t('FirstLoad')
			: HTML.i18nReplacer(t(vm.total > 0 ? 'Since' : 'SinceNone'), { date: date(vm.since), fp: HTML.Format(vm.total) });

		return html`
			<div class="dark-bg toolbox-head mygbs-head">${head}</div>
			${vm.rows.length === 0 ? '' : html`
				<table class="foe-table mygbs-table">
					<thead class="sticky">
						<tr>
							<th>${i18n('Boxes.GreatBuildings.GreatBulding')}</th>
							<th>${i18n('Boxes.GreatBuildings.Level')}</th>
							<th>${t('Progress')}</th>
							<th>${t('DeltaFP')}</th>
							<th>${t('MyFP')}</th>
							<th>${t('Donators')}</th>
						</tr>
					</thead>
					<tbody>
						${vm.rows.map(row => MyGBs.viewRow(row, t, date))}
					</tbody>
				</table>`}`;
	},


	/**
	 * One GB, expanded with its contributors
	 */
	viewRow: (row, t, date) => {
		const { html } = litHtml,
			level = row.prevLevel === null ? html`– → ${row.level}` : row.leveledUp ? html`${row.prevLevel} → ${row.level}` : row.level;

		return html`
			<tr class="mygbs-row ${row.changed ? 'changed' : ''} ${row.open ? 'open' : ''}" @click=${() => MyGBs.toggleRow(row.ceId)}>
				<td>${row.name}</td>
				<td class="${row.leveledUp || row.newlyBuilt ? 'leveled' : ''}">${level}</td>
				<td class="progress"><div class="progbar" style="width: ${row.percent}%"></div>${HTML.Format(row.invested)} / ${HTML.Format(row.needed)}</td>
				<td>${row.changed && row.delta > 0 ? html`<strong class="success">+${HTML.Format(row.delta)}</strong>` : ''}</td>
				<td>${row.myFp !== null ? HTML.Format(row.myFp) : ''}</td>
				<td>${row.donators !== null ? row.donators : ''}</td>
			</tr>
			${row.open ? html`
				<tr class="mygbs-detail">
					<td colspan="6">${MyGBs.viewContributors(row.detail, t, date)}</td>
				</tr>` : ''}`;
	},


	viewContributors: (detail, t, date) => {
		const { html } = litHtml;

		if (!detail) {
			return html`<div class="mygbs-note">${t('NoContributors')}</div>`;
		}

		return html`
			<div class="mygbs-note">${detail.since ? HTML.i18nReplacer(t('ContributorsSince'), { date: date(detail.since) }) : t('ContributorsFirst')}</div>
			<table class="mygbs-contrib">
				<tr>
					<th>${i18n('General.Player')}</th>
					<th>${t('CurrentFP')}</th>
					<th>${t('DeltaFP')}</th>
				</tr>
				${detail.players.map(p => html`
					<tr class="${p.delta > 0 ? 'new' : ''} ${p.id === ExtPlayerID ? 'own' : ''}">
						<td>${p.name}</td>
						<td>${HTML.Format(p.fp)}</td>
						<td>${p.delta > 0 ? html`<strong class="success">+${HTML.Format(p.delta)}</strong>` : ''}</td>
					</tr>`)}
			</table>`;
	},
};


// Tab "Meine LGs" in the Investment box, built once when the box is created
{
	const buildBox = Investment.BuildBox;

	Investment.BuildBox = (...args) => {
		const created = $('#Investment').length === 0;
		const result = buildBox(...args);

		MyGBs.boxCreated = created && $('#Investment').length > 0;
		if (MyGBs.boxCreated) MyGBs.attachTab();

		return result;
	};
}


// Counter on the Investment menu button; with a counter the button opens the box on the "Meine LGs" tab
{
	const investmentBtn = _menu.investment_Btn;

	_menu.investment_Btn = () => {
		const btn = investmentBtn();

		// after the upstream handler, which has just created (or closed) the box
		btn.children('span').first().on('click', () => {
			if (MyGBs.boxCreated && MyGBs.hasNews()) MyGBs.selectTab('mygbs');
		});

		btn.append($('<span id="mygbs-count" class="hud-counter mygbs-counter" />').hide());
		setTimeout(MyGBs.refreshCounter);

		return btn;
	};
}
