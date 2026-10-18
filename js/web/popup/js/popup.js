/*
 * *************************************************************************************
 *
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * You may use, distribute and modify this code under the
 * terms of the AGPL license.
 *
 * See file LICENSE.md or go to
 * https://github.com/mainIine/foe-helfer-extension/blob/master/LICENSE.md
 * for full license details.
 *
 * *************************************************************************************
 */

/**
 * Popup
 *
 * Displays existing HTML.Box modules in a separate browser pop-up window (without a URL bar).
 *
 * Use in a module:
 *   HTML.Box({ id: 'bluegalaxy', ..., MainParser.PopOut('bluegalaxy', 1100, 580 });
 */

let Popup = {

	/**
	 * Open pop-ups: id -> { win, options, restoreCss, observer, watchdog, lastSize }
	 */
	windows: {},

	/**
	 * Boxes whose pop-up window is currently being opened: id -> true
	 */
	_pending: {},


	/**
	 * Is there already a pop-up open for this box?
	 *
	 * @param id CSS ID of the box
	 * @returns {boolean}
	 */
	IsOpen: (id) => {
		const entry = Popup.windows[id];
		return !!(entry && entry.win && !entry.win.closed);
	},


	/**
	 * Moves an existing box (HTML.Box) into its own browser window.
	 * If the window is closed, the box returns to the main page.
	 *
	 * Uses the Document Picture-in-Picture API where available (Chromium):
	 * that window always stays on top of other windows, even when the game
	 * is focused. Falls back to a regular pop-up window (e.g. Firefox, or
	 * when another PiP window is already open).
	 *
	 * @param id       CSS ID of the box (z.B. 'bluegalaxy')
	 * @param options  {width, height, title, onClose, alwaysOnTop}
	 *                 alwaysOnTop: false forces a regular pop-up window
	 * @returns {boolean} true if the pop-up has been opened or is already open
	 */
	PopOut: (id, options = {}) => {

		if (Popup._pending[id]) {
			return true;
		}

		if (Popup.IsOpen(id)) {
			try { Popup.windows[id].win.focus(); } catch (e) { /* PiP windows cannot be focused */ }
			return true;
		}

		const box = document.getElementById(id);
		if (!box) {
			return false;
		}

		// Size: last saved > Options > current box size
		let size = null;
		try {
			size = JSON.parse(localStorage.getItem('PopupSize_' + id));
		} catch (e) { /* No entry/invalid entry */ }

		// TOOLBOX-BEGIN: never narrower than the box (a saved width may predate a wider box), height follows
		// the content (a saved height from other content left empty space or cut it off), and a PiP window
		// counts its own title bar into the requested height (offset measured in _adopt)
		const width  = Math.max((size && size.w) || options.width || 0, box.offsetWidth, 320),
			boxBody = box.querySelector('.window-body'),
			contentHeight = box.offsetHeight + (boxBody ? Math.max(0, boxBody.scrollHeight - boxBody.clientHeight) : 0),
			// Chrome shrinks a PiP window above roughly 30 % of the screen area, the width included (measured
			// on 1512x874: about 390000 px^2), so the height gives way first, the box content scrolls
			maxHeight = Math.floor(screen.availWidth * screen.availHeight * 0.28 / width),
			height = Math.min(Math.max(contentHeight, 220) + (parseInt(localStorage.getItem('PopupHeightOffset')) || 0),
				Math.round(screen.availHeight * 0.8), maxHeight);
		// TOOLBOX-END

		const boxTitle = box.querySelector('.window-head .title');
		// TOOLBOX: branding
		let title = options.title || (boxTitle ? boxTitle.textContent.trim() : 'FoE Toolbox');
		if (title.indexOf('FoE Toolbox') === -1) {
			title += ' - FoE Toolbox';
		}

		// Apply all extension style sheets from the main page + pop-up CSS
		let cssLinks = [];
		document.head.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
			if (link.href.indexOf(extUrl) === 0) {
				cssLinks.push(`<link rel="stylesheet" href="${link.href}">`);
			}
		});
		cssLinks.push(`<link rel="stylesheet" href="${extUrl}js/web/popup/css/popup.css?v=${extVersion}">`);

		// Document Picture-in-Picture: always-on-top, but only one window per tab
		const usePiP = options.alwaysOnTop !== false
			&& typeof documentPictureInPicture !== 'undefined'
			&& !documentPictureInPicture.window;

		Popup._pending[id] = true;

		if (usePiP) {
			documentPictureInPicture.requestWindow({width: width, height: height, preferInitialWindowPlacement: true}) // TOOLBOX: the requested size, not the size the user last dragged a PiP window to
				.then((win) => {
					$(win.document.head).html(`<meta charset="utf-8"><title>${title}</title>${cssLinks.join('')}`);
					win.document.body.className = 'foe-helper-popup';
					Popup._adopt(id, win, box, options, width, height);
				})
				.catch(() => {
					// no user gesture or API blocked - regular pop-up window instead
					Popup._openPopupWindow(id, box, options, width, height, title, cssLinks);
				});
			return true;
		}

		return Popup._openPopupWindow(id, box, options, width, height, title, cssLinks);
	},


	/**
	 * Fallback: opens a regular browser pop-up window (window.open) with a
	 * same-origin blob document and adopts the box once it is ready.
	 */
	_openPopupWindow: (id, box, options, width, height, title, cssLinks) => {

		const left = window.screenX + Math.max(0, Math.round((window.outerWidth - width) / 2)),
			top  = window.screenY + Math.max(0, Math.round((window.outerHeight - height) / 2));

		const winHtml = `<!DOCTYPE html>
			<html>
				<head>
					<meta charset="utf-8">
					<title>${title}</title>
					${cssLinks.join('\n\t\t\t\t\t')}
				</head>
				<body class="foe-helper-popup"></body>
			</html>`;

		const winUrl = URL.createObjectURL(new Blob([winHtml], {type: 'text/html;charset=utf-8'}));

		const win = window.open(
			winUrl,
			'foe-helper-popup-' + id,
			`popup=yes,width=${width},height=${height},left=${left},top=${top}`
		);

		if (!win) {
			URL.revokeObjectURL(winUrl);
			delete Popup._pending[id];
			HTML.ShowToastMsg({
				head: 'FoE Toolbox', // TOOLBOX: branding
				text: i18n('PopUp.Blocked'),
				type: 'error',
				hideAfter: 6000
			});
			return false;
		}

		// wait until the Blob document is ready (not the initial about:blank)
		const initTimer = setInterval(() => {
			if (win.closed) {
				clearInterval(initTimer);
				delete Popup._pending[id];
				return;
			}

			let ready = false;
			try {
				ready = win.document.readyState === 'complete'
					&& win.document.body
					&& win.document.body.classList.contains('foe-helper-popup');
			} catch (e) { /* not yet available */ }

			if (!ready) return;

			clearInterval(initTimer);
			URL.revokeObjectURL(winUrl);

			Popup._adopt(id, win, box, options, width, height);
		}, 20);

		return true;
	},


	/**
	 * Shared setup for both window types: moves the box into the target
	 * window and wires up tooltips, widgets and the closing lifecycle.
	 */
	_adopt: (id, win, box, options, width, height) => {

		const entry = Popup.windows[id] = {
			win: win,
			options: options,
			restoreCss: box.style.cssText,
			observer: null,
			watchdog: null,
			lastSize: {w: width, h: height}
		};

		delete Popup._pending[id];

		// Disable in-page drag-and-drop; it will be re-enabled when you return
		const header = document.getElementById(id + 'Header');
		if (header) {
			header.onpointerdown = null;
		}

		// TOOLBOX-BEGIN: remember how much of the requested height the window itself takes, save the content size
		// (a new PiP window first reports the requested size, its real inner size follows a moment later)
		setTimeout(() => {
			if (win.closed) return;
			const heightOffset = height - win.innerHeight;
			// only a window Chrome did not shrink (same width) tells the title bar height
			if (window.documentPictureInPicture?.window === win && win.innerWidth === width && heightOffset >= 0 && heightOffset < 150) {
				localStorage.setItem('PopupHeightOffset', String(heightOffset));
			}
			entry.lastSize = {w: win.innerWidth, h: win.innerHeight};
		}, 500);
		// TOOLBOX-END

		// Move the box, along with all its event bindings, to the pop-up
		box.classList.add('popup-mode');
		win.document.body.appendChild(win.document.adoptNode(box));

		// make the tooltip system (customTooltip) available in the pop-up as well
		if (typeof Tooltips !== 'undefined' && Tooltips.attach) {
			Tooltips.attach(win);
		}

		// jQuery UI widgets cache their document; rebuild them for the new one
		Popup._rebindUiWidgets(box);

		// inline handlers (onclick="...") must run in the main window's scope
		Popup._rebindInlineHandlers(box);

		// TOOLBOX: module code that looks up its elements natively must find them in the pop-up
		Popup._installLookupShims();

		// close the window when the module removes its own box (e.g.
		// HTML.CloseOpenBox); rebind inline handlers of re-rendered content
		entry.observer = new MutationObserver((mutations) => {
			if (!win.document.getElementById(id)) {
				win.close();
				return;
			}

			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					Popup._rebindInlineHandlers(node);
				}
			}
		});
		entry.observer.observe(win.document.body, {childList: true, subtree: true});

		win.addEventListener('pagehide', () => Popup._cleanup(id), {once: true});

		// Fallback in case `pagehide` never fires; also remembers the window size
		entry.watchdog = setInterval(() => {
			if (win.closed) {
				Popup._cleanup(id);
				return;
			}
			try {
				entry.lastSize = {w: win.innerWidth, h: win.innerHeight};
			} catch (e) { /* Window currently unavailable */ }
		}, 1000);
	},


	/**
	 * When a box’s pop-up closes, the box returns to the main page
	 *
	 * @param id CSS-ID der Box
	 */
	Close: (id) => {
		if (Popup.IsOpen(id)) {
			Popup.windows[id].win.close();
		}
	},


	/**
	 * Closes all open pop-ups
	 */
	CloseAll: () => {
		for (const id of Object.keys(Popup.windows)) {
			Popup.Close(id);
		}
	},


	/**
	 * Inline event handler attributes rebound by _rebindInlineHandlers
	 */
	_inlineEventAttrs: [
		'onclick', 'ondblclick', 'onchange', 'oninput', 'onblur', 'onfocus',
		'onsubmit', 'onkeyup', 'onkeydown', 'onmouseenter', 'onmouseleave',
		'onmouseover', 'onmouseout'
	],


	/**
	 * Inline handlers like onclick="*****.SaveSettings()" are compiled by
	 * the browser in the global scope of the element's own document. In a
	 * pop-up document the module globals of the main page do not exist there,
	 * so the handlers would fail. Recompile them as functions of the main
	 * window instead, where all modules are reachable.
	 *
	 * @param root element whose subtree (including itself) is processed
	 */
	_rebindInlineHandlers: (root) => {
		if (!root || root.nodeType !== 1) {
			return;
		}

		const selector = Popup._inlineEventAttrs.map(a => '[' + a + ']').join(',');
		const elements = [root, ...root.querySelectorAll(selector)];

		for (const el of elements) {
			for (const name of Popup._inlineEventAttrs) {
				const code = el.getAttribute(name);
				if (code) {
					try {
						el[name] = new Function('event', code);
					} catch (e) { /* invalid handler code */ }
				}
			}
		}
	},


	/**
	 * jQuery UI widgets (draggable/resizable) cache document/window at
	 * initialization time; after a document switch they listen on the wrong
	 * document and must be rebuilt with their current options.
	 *
	 * @param box the box element
	 */
	_rebindUiWidgets: (box) => {
		for (const name of ['draggable', 'resizable']) {
			$(box).find('.ui-' + name).addBack('.ui-' + name).each(function () {
				try {
					const options = $(this)[name]('option');
					$(this)[name]('destroy');
					$(this)[name](options);
				} catch (e) { /* widget not (or no longer) initialized */ }
			});
		}
	},


	// TOOLBOX-BEGIN: lookup shims for boxes in a pop-up
	/**
	 * jQuery.find before _installLookupShims replaced it, null while no shims are installed
	 */
	_nativeFind: null,


	/**
	 * Documents of all open pop-up windows
	 *
	 * @returns {Document[]}
	 */
	_documents: () => {
		const docs = [];
		for (const id in Popup.windows) {
			try {
				const win = Popup.windows[id].win;
				if (win && !win.closed) {
					docs.push(win.document);
				}
			} catch (e) { /* The pop-up is currently closing */ }
		}
		return docs;
	},


	/**
	 * A box in a pop-up is no longer part of the game document. Let
	 * document.getElementById/querySelector/querySelectorAll and jQuery.find
	 * fall back to the pop-up documents when the game document has no match,
	 * so modules that look up their elements natively keep working.
	 * Installed with the first pop-up and removed with the last one, so the
	 * game itself is not affected while no pop-up is open.
	 * Adapted from Forge Hammer (js/web/popout/js/popout.js).
	 */
	_installLookupShims: () => {
		if (Popup._nativeFind) return;

		const nativeGetById = Document.prototype.getElementById,
			nativeQuery = Document.prototype.querySelector,
			nativeQueryAll = Document.prototype.querySelectorAll;

		const shim = (name, value) => Object.defineProperty(document, name, {configurable: true, writable: true, value: value});

		shim('getElementById', function (id) {
			let el = nativeGetById.call(this, id);
			for (const doc of Popup._documents()) {
				if (el) break;
				el = nativeGetById.call(doc, id);
			}
			return el;
		});

		shim('querySelector', function (selector) {
			let el = nativeQuery.call(this, selector);
			for (const doc of Popup._documents()) {
				if (el) break;
				el = nativeQuery.call(doc, selector);
			}
			return el;
		});

		shim('querySelectorAll', function (selector) {
			const list = nativeQueryAll.call(this, selector);
			if (list.length) return list;

			for (const doc of Popup._documents()) {
				const popupList = nativeQueryAll.call(doc, selector);
				if (popupList.length) return popupList;
			}
			return list;
		});

		// $('#id') already goes through document.getElementById, everything else
		// through jQuery.find(selector, document, results)
		Popup._nativeFind = jQuery.find;
		jQuery.find = Object.assign(function (selector, context, results, seed) {
			const start = results ? results.length : 0,
				found = Popup._nativeFind(selector, context, results, seed);

			if (context === document && found.length === start) {
				for (const doc of Popup._documents()) {
					Popup._nativeFind(selector, doc, found, seed);
				}
			}
			return found;
		}, Popup._nativeFind);
	},


	/**
	 * Restores the native lookups replaced by _installLookupShims
	 */
	_removeLookupShims: () => {
		if (!Popup._nativeFind) return;

		delete document.getElementById;
		delete document.querySelector;
		delete document.querySelectorAll;

		jQuery.find = Popup._nativeFind;
		Popup._nativeFind = null;
	},
	// TOOLBOX-END


	/**
	 * Cleaning up when closing the pop-up: return the box to the main page,
	 * save the window size, execute callbacks
	 *
	 * @param id CSS-ID der Box
	 */
	_cleanup: (id) => {
		delete Popup._pending[id];

		const entry = Popup.windows[id];
		if (!entry) return;

		delete Popup.windows[id];
		if (Object.keys(Popup.windows).length === 0) { // TOOLBOX: lookup shims
			Popup._removeLookupShims();
		}
		clearInterval(entry.watchdog);
		if (entry.observer) {
			entry.observer.disconnect();
		}

		if (typeof Tooltips !== 'undefined' && Tooltips.detach) {
			Tooltips.detach(entry.win);
		}

		if (entry.lastSize && entry.lastSize.w > 0 && entry.lastSize.h > 0) {
			localStorage.setItem('PopupSize_' + id, JSON.stringify(entry.lastSize));
		}

		// if the box still exists in the pop-up (window closed by clicking the X),
		// return to the main page
		try {
			const box = entry.win.document.getElementById(id);
			if (box) {
				box.classList.remove('popup-mode');
				document.body.appendChild(document.adoptNode(box));
				box.style.cssText = entry.restoreCss;
				HTML.DragBox(box);
				Popup._rebindUiWidgets(box);
			}
		} catch (e) { /* Document has already been destroyed; the box must be reopened */ }

		try {
			if (!entry.win.closed) {
				entry.win.close();
			}
		} catch (e) { /* already closed */ }

		if (typeof entry.options.onClose === 'function') {
			entry.options.onClose();
		}
	}
};


(() => {
	const origInit = jQuery.fn.init;

	function PopupAwareInit(selector, context, root) {
		const result = new origInit(selector, context, root);

		if (result.length === 0 && typeof selector === 'string' && context == null && selector.charAt(0) !== '<') {
			for (const id in Popup.windows) {
				const win = Popup.windows[id].win;
				if (win && !win.closed) {
					try {
						const alt = new origInit(selector, win.document, root);
						if (alt.length > 0) {
							return alt;
						}
					} catch (e) { /* The pop-up is currently closing */ }
				}
			}
		}

		return result;
	}

	PopupAwareInit.prototype = jQuery.fn;
	jQuery.fn.init = PopupAwareInit;
})();


// Close all pop-ups when exiting or reloading the game
window.addEventListener('beforeunload', () => {
	Popup.CloseAll();
});
