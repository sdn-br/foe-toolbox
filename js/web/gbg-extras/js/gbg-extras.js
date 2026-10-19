/*
 * **************************************************************************************
 *
 * FoE Toolbox: small GBG features after Forge Hammer (js/web/guildfights).
 * Only wrappers, no change in the upstream files guild_fights.js and parts/province_map.js.
 *
 * - province map to tables: hovering a sector marks its row in "Nächste"/"Eigene" and
 *   highlights the adjacent sectors that open earlier (overlay canvas, wrapper around
 *   ProvinceMap.DrawOverlay), a click selects the row in "Nächste" for copy/Discord
 *   (wrapper around ProvinceMap.prepare)
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
		ProvinceMap.DrawOverlay();
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


	/**
	 * Draws the earlier opening neighbours onto the overlay canvas, after the
	 * watermarks and the pulse outline of the original DrawOverlay
	 */
	drawAdjacent: () => {
		if (GbgExtras.adjacentIds.length === 0 || !(ProvinceMap.Overlay instanceof HTMLCanvasElement)) return;

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

		ctx.restore();
	},
};


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
		return result;
	};
}
