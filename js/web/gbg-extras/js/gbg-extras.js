/*
 * **************************************************************************************
 *
 * FoE Toolbox: small GBG features after Forge Hammer (js/web/guildfights).
 * Only wrappers, no change in the upstream files guild_fights.js and parts/province_map.js.
 *
 * - province map to tables: hovering a sector outlines it, marks its row in "Nächste"/"Eigene"
 *   and fills the adjacent sectors that open earlier (overlay canvas, wrapper around
 *   ProvinceMap.DrawOverlay), a legend below the map explains both while hovering; a click
 *   selects the row in "Nächste" for copy/Discord (wrapper around ProvinceMap.prepare)
 * - tab "Fortschritt": one bar per attacker (progress / maxProgress) and "highest / needed",
 *   after the build of the box and after every live update of a row (wrapper around
 *   Guild_fights.RefreshTable)
 * - snapshot log: column "Zermürbung" in the player log (sum per day) and the period log
 *   (per snapshot), from the attrition stored with every snapshot (wrapper around
 *   Guild_fights.BuildDetailViewContent)
 * - tab "Eigene" sortable with the table sorter, sort keys kept current after live
 *   updates of a row (wrapper around Guild_fights.UpdateProvinceCells)
 *
 * You may use, distribute and modify this code under the terms of the AGPL license.
 * See file LICENSE.md for full license details.
 *
 * **************************************************************************************
 */

let GbgExtras = {

	// sector under the mouse on the province map and its earlier opening neighbours
	hoveredId: null,
	adjacentIds: [],
	// a drag scrolls the zoomed map, its closing click must not select a row
	mouseDown: null,


	/**
	 * Province of the map data, sector 0 has no id in the game data
	 *
	 * @param {number} id
	 * @returns {Object|undefined}
	 */
	findProvince: (id) => Guild_fights.MapData?.map?.provinces?.find(p => (p.id || 0) === id),


	/**
	 * Listeners on the freshly created map canvas. The overlay canvas above it
	 * ignores the mouse (pointer-events: none), so the map canvas gets the events.
	 */
	attachMapListeners: () => {
		const canvas = ProvinceMap.Map;
		if (!(canvas instanceof HTMLCanvasElement)) return;

		GbgExtras.setHovered(null);

		const provinceAt = (e) => {
			const point = ProvinceMap.getCanvasPoint(e);
			return ProvinceMap.findProvinceAt(point.x, point.y);
		};

		canvas.addEventListener('mousemove', e => GbgExtras.setHovered(provinceAt(e)));
		canvas.addEventListener('mouseleave', () => GbgExtras.setHovered(null));
		canvas.addEventListener('mousedown', e => {
			GbgExtras.mouseDown = { x: e.clientX, y: e.clientY };
		});
		canvas.addEventListener('click', e => {
			const down = GbgExtras.mouseDown;
			if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;

			const province = provinceAt(e);
			if (!province) return;

			// only "Nächste" rows can be copied or sent, like Forge Hammer
			const row = $(`#nextup #timer-${province.id}`);
			if (row.length === 0) return;

			row.toggleClass('highlight-row');
			Guild_fights.ToggleCopyButton();
		});
	},


	/**
	 * @param {Object|null} province Province object of the map or null
	 */
	setHovered: (province) => {
		const id = province ? province.id : null;
		if (id === GbgExtras.hoveredId) return;

		GbgExtras.hoveredId = id;
		GbgExtras.adjacentIds = province ? GbgExtras.earlierNeighbours(province.id) : [];

		GbgExtras.markHoveredRows();
		GbgExtras.renderLegend();
		ProvinceMap.DrawOverlay();
	},


	/**
	 * Legend in the corner of the map while a sector is hovered, the outline and the
	 * filled neighbours are not self-explanatory
	 */
	renderLegend: () => {
		let legend = $('#gbgHoverLegend');

		if (GbgExtras.hoveredId === null) {
			legend.hide();
			return;
		}

		if (legend.length === 0) {
			legend = $('<div id="gbgHoverLegend" />').appendTo('#ProvinceMapBody');
		}

		const t = (key) => i18n('Boxes.GuildFights.HoverLegend.' + key);

		legend.empty().append(
			$('<div />').append('<span class="gbg-legend-outline"></span>', document.createTextNode(t('Sector'))),
			GbgExtras.adjacentIds.length > 0
				? $('<div />').append('<span class="gbg-legend-fill"></span>', document.createTextNode(HTML.i18nReplacer(t('Earlier'), { count: GbgExtras.adjacentIds.length })))
				: ''
		).show();
	},


	/**
	 * Marks the rows of the hovered sector, also after a rebuild of the live box
	 */
	markHoveredRows: () => {
		$('#LiveGildFighting tr.gbg-map-hover').removeClass('gbg-map-hover');

		const id = GbgExtras.hoveredId;
		if (id === null) return;

		$(`#nextup #timer-${id}, #gbgowned #time-${id}`).addClass('gbg-map-hover');
	},


	/**
	 * Adjacent sectors that are still locked but open before the given one.
	 * Forge Hammer also counted neighbours whose lock time is long over (the game keeps
	 * lockedUntil after the unlock); here both have to be locked right now.
	 *
	 * @param {number} id
	 * @returns {number[]}
	 */
	earlierNeighbours: (id) => {
		const now = GameTime.get(),
			lockedUntil = GbgExtras.findProvince(id)?.lockedUntil;

		if (!(lockedUntil > now)) return [];

		const links = ProvinceMap.ProvinceData().find(p => p.id === id)?.connections || [];

		return links.filter(link => {
			const neighbour = GbgExtras.findProvince(link)?.lockedUntil;
			return neighbour > now && neighbour < lockedUntil;
		});
	},


	/** outline of the hovered sector, apart from the white border of the neighbours and the pulse of a table row */
	hoverColor: '#ffd24d',


	/**
	 * Draws the earlier opening neighbours and the outline of the hovered sector onto the
	 * overlay canvas, after the watermarks and the pulse outline of the original DrawOverlay
	 */
	drawAdjacent: () => {
		if (GbgExtras.hoveredId === null || !(ProvinceMap.Overlay instanceof HTMLCanvasElement)) return;

		const ctx = ProvinceMap.OverlayCTX,
			mapType = Guild_fights.MapData.map['id'];

		ctx.save();
		ctx.lineWidth = 3;
		ctx.strokeStyle = '#fff';

		for (const id of GbgExtras.adjacentIds) {
			const province = ProvinceMap.Provinces.find(p => p.id === id);
			if (!province) continue;

			const path = province.drawSectorShape(mapType);

			// translucent, the time on the sector stays readable
			ctx.globalAlpha = 0.45;
			ctx.fillStyle = province.owner.colors?.base || '#fff';
			ctx.fill(path);
			ctx.globalAlpha = 1;
			ctx.stroke(path);
		}

		// last, so it stays on top of the neighbours' borders
		const hovered = ProvinceMap.Provinces.find(p => p.id === GbgExtras.hoveredId);
		if (hovered) {
			ctx.lineWidth = 5;
			ctx.strokeStyle = GbgExtras.hoverColor;
			ctx.stroke(hovered.drawSectorShape(mapType));
		}

		ctx.restore();
	},


	/**
	 * Turns the progress numbers of the given rows of the "Fortschritt" tab into bars.
	 * Reads the map data, which the websocket handler updates before RefreshTable,
	 * so also attackers RefreshTable added without a number get theirs.
	 *
	 * @param {jQuery} rows tr elements of #progress
	 */
	renderProgressBars: (rows) => {
		rows.each(function () {
			const province = GbgExtras.findProvince(parseInt($(this).attr('data-id')) || 0),
				progress = province?.conquestProgress || [];

			if (progress.length === 0) return;

			const max = progress[0].maxProgress || 0;
			let highest = 0;

			for (const entry of progress) {
				const value = entry.progress || 0,
					bar = $(this).find('.attacker-' + entry.participantId);

				highest = Math.max(highest, value);
				if (bar.length === 0) continue;

				bar.addClass('gbg-progress-bar').text(value);
				bar[0].style.setProperty('--gbg-bar-width', (max > 0 ? Math.min(100, value / max * 100) : 0) + '%');
				bar[0].style.setProperty('--gbg-bar-color', ProvinceMap.getSectorColors(entry.participantId)?.main || '#888');
			}

			$(this).find('.required-progress').text(`${highest} / ${max}`);
		});
	},


	// the snapshot log can be redrawn before the DB answered, only the last call may write
	logToken: 0,


	/**
	 * Appends the attrition column to the table BuildDetailViewContent just drew.
	 * Reads the snapshots again with the same query and order as the original.
	 *
	 * @param {Object} d filter of BuildDetailViewContent ({ content, player_id, gbground })
	 * @param {number} token
	 * @returns {Promise<void>}
	 */
	addAttritionColumn: async (d, token) => {
		const content = d?.content || 'player',
			gbground = d?.gbground || Guild_fights.CurrentGBGRound,
			cell = value => `<td class="is-number text-center" data-number="${value}">${HTML.Format(value)}</td>`;

		if (content === 'player') {
			if (!d?.player_id) return;

			const snapshots = await Guild_fights.db.snapshots.where({ gbground: gbground, player_id: d.player_id }).toArray();
			if (token !== GbgExtras.logToken) return;

			// the stored attrition is the gain since the previous snapshot, like battles and negotiations
			const perDay = {};
			for (const snapshot of snapshots) {
				const day = moment.unix(snapshot.time).format('YYYYMMDD');
				perDay[day] = (perDay[day] || 0) + (snapshot.attrition || 0);
			}

			const table = $('#gbgPlayerLogTable');
			if (table.find('th.gbg-attrition').length > 0) return;

			table.find('thead tr.sorter-header').append(GbgExtras.attritionHeader('gbg-playerlog-group'));
			table.find('tbody tr').each(function () {
				const day = moment.unix($(this).children('td').first().data('number')).format('YYYYMMDD');
				$(this).append(cell(perDay[day] || 0));
			});
		}
		else if (content === 'filter') {
			const snapshots = await Guild_fights.db.snapshots.where({ gbground: gbground }).and(item =>
				item.date >= Guild_fights.curDateFilter && item.date <= Guild_fights.curDateEndFilter
			).toArray();
			if (token !== GbgExtras.logToken) return;

			snapshots.sort((a, b) => b.time - a.time);

			const table = $('#GuildFightsLogTable'),
				rows = table.find('tbody tr');

			// several players share one snapshot time, so rows match by position
			if (table.find('th.gbg-attrition').length > 0 || rows.length !== snapshots.length) return;
			if (rows.toArray().some((row, i) => $(row).children('td').first().data('number') !== snapshots[i].time)) return;

			table.find('thead tr.sorter-header').append(GbgExtras.attritionHeader('gbg-log-group'));
			rows.each(function (i) {
				$(this).append(cell(snapshots[i].attrition || 0));
			});
		}
	},


	/**
	 * @param {string} group tbody class the table sorter sorts
	 * @returns {string}
	 */
	attritionHeader: (group) => `<th class="is-number text-center gbg-attrition" data-type="${group}">${i18n('Boxes.GuildFights.Attrition')}</th>`,


	/**
	 * Makes the table of the "Eigene" tab sortable: name and owner as text,
	 * countdown, slots and victory points as numbers
	 */
	makeOwnedSortable: () => {
		const table = $('#gbgowned table');
		if (table.length === 0) return;

		table.find('thead tr').addClass('sorter-header');
		table.find('thead th').attr('data-type', 'gbg-owned-group').each(function (i) {
			// first column the sector, second the owner if that column is shown
			if (i > (Guild_fights.showGuildColumn ? 1 : 0)) $(this).addClass('is-number');
		});
		table.find('tbody').addClass('gbg-owned-group');
		table.find('tbody tr').each(function () {
			GbgExtras.setOwnedSortKeys($(this));
		});

		table.tableSorter();
	},


	/**
	 * Sort keys of one row of the "Eigene" tab, from the map data
	 *
	 * @param {jQuery} row
	 */
	setOwnedSortKeys: (row) => {
		const province = GbgExtras.findProvince(parseInt(row.attr('data-id')) || 0);
		if (!province) return;

		// attr for a fresh read, data for a value the sorter already cached
		const set = (cells, key, value) => cells.attr('data-' + key, value).data(key, value);
		const cells = row.children('td');

		set(cells.filter('.prov-name'), 'text', province.title || '');
		if (Guild_fights.showGuildColumn) set(cells.eq(1), 'text', province.owner || '');
		set(cells.filter('.time-dynamic'), 'number', province.lockedUntil || 0);
		set(cells.filter('.slots-cell'), 'number', province.usedBuildingSlots || 0);
		set(cells.filter('.vp-cell'), 'number', province.victoryPoints || 0);
	},
};


// Upstream subtracts half the map size on volcano_archipelago, but the map context keeps its
// translate to the centre and isPointInPath applies it as well, so the point moved twice and no
// sector was found (upstream the details on click did not work either). Adding the translate of
// the context back gives the point in the coordinates isPointInPath compares with.
{
	const getCanvasPoint = ProvinceMap.getCanvasPoint;

	ProvinceMap.getCanvasPoint = (e) => {
		const point = getCanvasPoint(e),
			transform = ProvinceMap.MapCTX?.getTransform();

		return transform ? { x: point.x + transform.e, y: point.y + transform.f } : point;
	};
}


{
	const prepare = ProvinceMap.prepare;

	ProvinceMap.prepare = (...args) => {
		HTML.AddCssFile('gbg-extras');
		const result = prepare(...args);
		GbgExtras.attachMapListeners();
		return result;
	};
}


{
	const drawOverlay = ProvinceMap.DrawOverlay;

	ProvinceMap.DrawOverlay = (...args) => {
		const result = drawOverlay(...args);
		GbgExtras.drawAdjacent();
		return result;
	};
}


{
	const buildFightContent = Guild_fights.BuildFightContent;

	Guild_fights.BuildFightContent = (...args) => {
		HTML.AddCssFile('gbg-extras');
		const result = buildFightContent(...args);
		GbgExtras.markHoveredRows();
		$('#progress thead th').last().text(i18n('Boxes.GuildFights.HighestOfRequired'));
		GbgExtras.renderProgressBars($('#progress tbody tr'));
		GbgExtras.makeOwnedSortable();
		return result;
	};
}


{
	const refreshTable = Guild_fights.RefreshTable;

	Guild_fights.RefreshTable = (data, ...rest) => {
		const result = refreshTable(data, ...rest);
		// a locked sector fades out of the tab, nothing to draw
		if (!data?.lockedUntil) GbgExtras.renderProgressBars($(`#progress tr#province-${data?.id || 0}`));
		return result;
	};
}


{
	const buildDetailViewContent = Guild_fights.BuildDetailViewContent;

	Guild_fights.BuildDetailViewContent = async (...args) => {
		const token = ++GbgExtras.logToken;
		const result = await buildDetailViewContent(...args);
		await GbgExtras.addAttritionColumn(args[0], token);
		return result;
	};
}


{
	const updateProvinceCells = Guild_fights.UpdateProvinceCells;

	Guild_fights.UpdateProvinceCells = (id, ...rest) => {
		const result = updateProvinceCells(id, ...rest);
		// the VP cell gets replaced, slots may have changed
		const row = $(`#gbgowned #time-${id}`);
		if (row.length > 0) GbgExtras.setOwnedSortKeys(row);
		return result;
	};
}
