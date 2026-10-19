/*
 * **************************************************************************************
 *
 * FoE Toolbox: focus targets of the own guild as a bar over the GBG map plus a countdown
 * on the GBG menu button, after Forge Hammer ("Zeige Markierungen", js/web/guildfights).
 * Only reads data Guild_fights already keeps (MapData, own.signals, alerts, colors).
 *
 * Settings live in LiveFightSettings (showGbgTargets, gbgTargetsPosition, same keys as
 * Forge Hammer) and are added to the GBG settings box by wrapping
 * Guild_fights.ShowLiveFightSettings and Guild_fights.SaveLiveFightSettings.
 * The menu counter span is added in toolbox-menu (wrapper around _menu.gildFight_Btn).
 *
 * You may use, distribute and modify this code under the terms of the AGPL license.
 * See file LICENSE.md for full license details.
 *
 * **************************************************************************************
 */

let GbgTargets = {

	containerId: 'toolboxGbgTargets',
	positions: ['top', 'bottom', 'left'],
	intervalId: null,
	refreshTimeout: null,
	lastOrder: null,
	settings: null,


	/**
	 * Reads the live fight settings, called on load and after saving them
	 */
	loadSettings: () => {
		let s = JSON.parse(localStorage.getItem('LiveFightSettings') || 'null') || {};

		GbgTargets.settings = {
			show: s.showGbgTargets ?? 1,
			position: GbgTargets.positions.includes(s.gbgTargetsPosition) ? s.gbgTargetsPosition : 'top',
			showServerTime: s.showServerTime ?? 0,
		};
	},


	/**
	 * Coalesces the refresh of several handlers in one frame. Deferred because the
	 * websocket "all" handler of Guild_fights is registered after this module and
	 * updates the provinces only after our handler ran.
	 */
	scheduleRefresh: () => {
		if (GbgTargets.refreshTimeout) return;

		GbgTargets.refreshTimeout = setTimeout(() => {
			GbgTargets.refreshTimeout = null;
			GbgTargets.refresh();
		}, 0);
	},


	/**
	 * Focus targets of the own guild without own sectors: open sectors first, then by opening time
	 *
	 * @returns {{targets: Object[], now: number}}
	 */
	getTargets: () => {
		let mapData = Guild_fights.MapData,
			own = mapData?.battlegroundParticipants?.find(p => p.clan.id === ExtGuildID),
			now = GameTime.get();

		if (!own || !Array.isArray(own.signals)) return { targets: [], now };

		let provinces = mapData.map?.provinces || [],
			targets = [];

		for (let signal of own.signals) {
			if (signal.signal !== 'focus') continue;

			let province = provinces.find(p => (p.id || 0) === (signal.provinceId || 0));
			if (!province || province.ownerId === own.participantId) continue;

			targets.push(province);
		}

		const isOpen = p => !(p.lockedUntil > now);

		targets.sort((a, b) => {
			if (isOpen(a) || isOpen(b)) return isOpen(b) - isOpen(a);
			return a.lockedUntil - b.lockedUntil;
		});

		return { targets, now };
	},


	/**
	 * Time label of a target: opening time when more than 30 min are left, else a countdown
	 *
	 * @param province
	 * @param now server time in seconds
	 * @returns {string} empty for open sectors
	 */
	timeLabel: (province, now) => {
		let remaining = province.lockedUntil - now;

		if (!(remaining > 0)) return '';

		if (remaining > 1800) {
			let offset = GbgTargets.settings.showServerTime ? -60 * (Guild_fights.serverOffset ?? 0) : 0;
			return i18n('Boxes.GuildFights.Time') + ' ' + moment.unix(province.lockedUntil).add(offset, 'seconds').format('HH:mm');
		}

		return i18n('Boxes.GuildFights.Count') + ' ' + moment.utc(remaining * 1000).format('mm:ss');
	},


	/**
	 * Updates bar and menu counter, runs every second while there is something to show
	 */
	refresh: () => {
		if (!GbgTargets.settings.show || !Guild_fights.MapData) {
			GbgTargets.removeBar();
			GbgTargets.updateMenuCounter(null, 0);
			GbgTargets.stopInterval();
			return;
		}

		let { targets, now } = GbgTargets.getTargets(),
			showBar = targets.length > 0 && ActiveMap === 'gg';

		if (showBar) {
			GbgTargets.renderBar(targets, now);
		}
		else {
			GbgTargets.removeBar();
		}

		// the first locked target is the next one to open, open sectors sort before it
		let next = targets.find(p => p.lockedUntil > now);
		GbgTargets.updateMenuCounter(next, now);

		if (showBar || next) {
			if (!GbgTargets.intervalId) GbgTargets.intervalId = setInterval(GbgTargets.refresh, 1000);
		}
		else {
			GbgTargets.stopInterval();
		}
	},


	stopInterval: () => {
		clearInterval(GbgTargets.intervalId);
		GbgTargets.intervalId = null;
	},


	removeBar: () => {
		$('#' + GbgTargets.containerId).remove();
		GbgTargets.lastOrder = null;
	},


	/**
	 * Countdown "H:mm" on the GBG menu button until the next locked focus target
	 *
	 * @param {?Object} province next locked target or null
	 * @param {number} now server time in seconds
	 */
	updateMenuCounter: (province, now) => {
		let counter = $('#gildFight-Btn .toolbox-gbg-target-counter');
		if (counter.length === 0) return;

		if (!province) {
			counter.text('').removeClass('hud-counter-red');
			return;
		}

		let remaining = province.lockedUntil - now;

		counter
			.text(moment.utc(remaining * 1000).format('H:mm'))
			.toggleClass('hud-counter-red', remaining < 144);
	},


	/**
	 * Builds or updates the bar. Tiles are kept per province so the hover on an icon
	 * survives the update every second.
	 *
	 * @param {Object[]} targets sorted focus targets
	 * @param {number} now server time in seconds
	 */
	renderBar: (targets, now) => {
		let container = $('#' + GbgTargets.containerId);

		if (container.length === 0) {
			HTML.AddCssFile('gbg-targets');
			// alert button styles
			HTML.AddCssFile('guild_fights');

			container = $(`<div id="${GbgTargets.containerId}"></div>`).appendTo('body');

			container.on('click', '.deletealertbutton', function (e) {
				e.stopPropagation();
				Guild_fights.DeleteAlert($(this).data('id'));
			});
			container.on('click', '.setalertbutton', function (e) {
				e.stopPropagation();
				Guild_fights.SetAlert($(this).data('id'));
			});
		}

		container.attr('class', 'pos-' + GbgTargets.settings.position);

		let order = targets.map(p => p.id || 0).join(','),
			orderChanged = order !== GbgTargets.lastOrder,
			active = new Set();

		GbgTargets.lastOrder = order;

		for (let province of targets) {
			let id = province.id || 0,
				open = !(province.lockedUntil > now),
				tile = container.children(`.gbgTarget[data-id="${id}"]`),
				isNew = tile.length === 0;

			active.add(String(id));

			if (isNew) {
				tile = $(`<div class="gbgTarget" data-id="${id}">
					<div class="progress"></div>
					<b class="signal-countdown"></b>
					<span class="title">
						<span class="gbgTargetActions">
							<span class="battleType"></span>
							<img src="${srcLinks.get('/guild_battlegrounds/map/shared/guild_battlegrounds_target.png', true)}" alt="" />
							<span class="createGBGNotification"></span>
						</span>
						<b class="name"></b>
					</span>
				</div>`);
			}

			if (isNew || orderChanged) {
				tile.appendTo(container);
			}

			tile.toggleClass('open', open);
			tile.find('.battleType').toggleClass('red', !!province.isAttackBattleType);
			GbgTargets.setHtml(tile.find('.name'), $('<div />').text(province.title).html());
			tile.find('.signal-countdown').text(GbgTargets.timeLabel(province, now));
			GbgTargets.setHtml(tile.find('.createGBGNotification'), Guild_fights.GetAlertButton(id));
			GbgTargets.setHtml(tile.find('.progress'), open ? GbgTargets.progressBars(province.conquestProgress || []) : '');
		}

		container.children('.gbgTarget[data-id]').each(function () {
			if (!active.has(String($(this).data('id')))) $(this).remove();
		});

		GbgTargets.fitTiles(container, targets, now);
	},


	/**
	 * Avoids rewriting unchanged markup every second (keeps hover and tooltips stable)
	 */
	setHtml: (el, html) => {
		if (el.data('html') === html) return;
		el.data('html', html).html(html);
	},


	/**
	 * One bar per attacking guild in its color. Rebuilt from conquestProgress, so bars
	 * of attackers that left the list disappear (Forge Hammer kept them).
	 *
	 * @param {Object[]} conquestProgress
	 * @returns {string}
	 */
	progressBars: (conquestProgress) => {
		return conquestProgress.map(p => {
			let color = Guild_fights.SortedColors?.find(c => c.id === p.participantId);
			if (!color || !p.maxProgress) return '';

			let width = Math.min(100, (p.progress || 0) / p.maxProgress * 100);
			return `<div style="background-color:${color.main};width:${width}%"></div>`;
		}).join('');
	},


	/**
	 * Hides the tiles that do not fit into the bar of the chosen position and adds a last
	 * tile "+N" whose tooltip lists the hidden sectors. Measured after rendering, the tile
	 * sizes depend on position, content and viewport.
	 *
	 * @param container
	 * @param {Object[]} targets in tile order
	 * @param {number} now
	 */
	fitTiles: (container, targets, now) => {
		let tiles = container.children('.gbgTarget[data-id]').removeClass('is-hidden').get(),
			more = container.children('.gbgTargetMore');

		more.addClass('is-hidden');

		let box = container[0].getBoundingClientRect(),
			outside = el => {
				let r = el.getBoundingClientRect();
				return r.right > box.right + 0.5 || r.bottom > box.bottom + 0.5;
			},
			visible = tiles.findIndex(outside);

		if (visible === -1) return;

		if (more.length === 0) {
			more = $(`<div class="gbgTarget gbgTargetMore fh-tooltip" data-callback_tt="ToolboxTT.text"><span class="title"><b></b></span></div>`);
		}
		more.appendTo(container).removeClass('is-hidden');

		tiles.slice(visible).forEach(t => t.classList.add('is-hidden'));

		while (visible > 0 && outside(more[0])) {
			tiles[--visible].classList.add('is-hidden');
		}

		let hidden = targets.slice(visible);

		more.find('b').text('+' + hidden.length);
		more.attr('data-tt-head', i18n('Boxes.GuildFights.GBGTargetsMore'));
		more.attr('data-tt', hidden.map(p => `${p.title}: ${GbgTargets.timeLabel(p, now) || i18n('Boxes.GuildFights.GBGTargetsOpen')}`).join('\n'));
	},


	/**
	 * Settings rows in the display tab of the GBG settings box
	 */
	settingsHtml: () => {
		let s = GbgTargets.settings,
			options = [
				['top', 'Boxes.GuildFights.GBGTargetsPositionTop'],
				['bottom', 'Boxes.GuildFights.GBGTargetsPositionBottom'],
				['left', 'Boxes.GuildFights.GBGTargetsPositionLeft'],
			].map(([value, key]) => `<option value="${value}"${s.position === value ? ' selected="selected"' : ''}>${i18n(key)}</option>`).join('');

		return `<hr>
			<p><label for="showgbgtargets"><input id="showgbgtargets" name="showgbgtargets" type="checkbox"${s.show ? ' checked="checked"' : ''} /> ${i18n('Boxes.GuildFights.GBGTargetsShow')}</label></p>
			<p><label for="gbgtargetsposition">${i18n('Boxes.GuildFights.GBGTargetsPosition')} <select id="gbgtargetsposition" name="gbgtargetsposition">${options}</select></label></p>`;
	},
};

GbgTargets.loadSettings();


{
	const showSettings = Guild_fights.ShowLiveFightSettings;

	Guild_fights.ShowLiveFightSettings = (...args) => {
		const result = showSettings(...args);
		$('#LiveGildFightingSettingsBox #gbgsettings-display').append(GbgTargets.settingsHtml());
		return result;
	};
}


{
	const saveSettings = Guild_fights.SaveLiveFightSettings;

	// the original rebuilds LiveFightSettings from its own fields only, so ours are merged afterwards
	Guild_fights.SaveLiveFightSettings = (...args) => {
		const show = $('#showgbgtargets').is(':checked') ? 1 : 0,
			position = $('#gbgtargetsposition').val();

		const result = saveSettings(...args);

		let value = JSON.parse(localStorage.getItem('LiveFightSettings') || 'null') || {};
		value.showGbgTargets = show;
		if (GbgTargets.positions.includes(position)) value.gbgTargetsPosition = position;
		localStorage.setItem('LiveFightSettings', JSON.stringify(value));

		GbgTargets.loadSettings();
		GbgTargets.refresh();

		return result;
	};
}


FoEproxy.addHandler('GuildBattlegroundService', 'getBattleground', () => GbgTargets.scheduleRefresh());

FoEproxy.addWsHandler('GuildBattlegroundSignalsService', 'updateSignal', () => GbgTargets.scheduleRefresh());

// province updates (lockedUntil, ownerId, conquestProgress); a conquered target drops out via ownerId
FoEproxy.addWsHandler('GuildBattlegroundService', 'all', () => GbgTargets.scheduleRefresh());

FoEproxy.addFoeHelperHandler('ActiveMapUpdated', () => GbgTargets.scheduleRefresh());
