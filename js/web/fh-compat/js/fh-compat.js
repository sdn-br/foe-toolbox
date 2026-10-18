/*
 * **************************************************************************************
 *
 * FoE Toolbox: compatibility layer for the modules ported from Forge Hammer (gbg-actionlog).
 *
 * Forge Hammer moved the FoE Helfer globals into the namespace "FH". This file maps the
 * FH names those modules use back onto the FoE Helfer globals, so the ported files stay
 * close to upstream and later Forge Hammer changes can be diffed and taken over.
 * Only names the ported modules really use belong here; nothing else may rely on it.
 *
 * You may use, distribute and modify this code under the terms of the AGPL license.
 * See file LICENSE.md for full license details.
 *
 * **************************************************************************************
 */

// A parallel Forge Hammer installation brings its own FH into the same page, it must not be replaced
if (typeof globalThis.FH === 'undefined') {
	globalThis.FH = {
		t: (...args) => i18n(...args),

		HTML: HTML,
		helper: helper,
		proxy: FoEproxy,
		Main: MainParser,

		// Forge Hammer prefixes its keys with "Hammer." and copies unprefixed keys over;
		// the Toolbox uses plain keys and never writes keys of other extensions
		Storage: {
			getItem: (key) => localStorage.getItem(key),
			setItem: (key, value) => localStorage.setItem(key, value),
		},

		// Forge Hammer lets the user choose the formats, the Toolbox has the fixed ones from de.json
		DateFormat: {
			get: (type) => i18n(type === 'dateLong' ? 'Date' : 'DateTime'),
		},
	};
}
else {
	console.warn('FoE Toolbox: a global "FH" already exists (Forge Hammer installed?), the ported Forge Hammer modules use it as is.');
}

// Forge Hammer keeps the sector table of both maps by map id, the Toolbox only builds the one of
// the current map (ProvinceMap.ProvinceData). The action log needs the short names of older
// rounds too, possibly on the other map. Index = province id; same order as ProvinceData.
ProvinceMap.SectorMapping = Object.fromEntries(Object.entries({
	volcano_archipelago: 'A1M B1O C1N D1B A2S A2T B2S B2T C2S C2T D2S D2T A3V A3X A3Y A3Z B3V B3X B3Y B3Z C3V C3X C3Y C3Z D3V D3X D3Y D3Z A4A A4B A4C A4D A4E A4F A4G A4H B4A B4B B4C B4D B4E B4F B4G B4H C4A C4B C4C C4D C4E C4F C4G C4H D4A D4B D4C D4D D4E D4F D4G D4H',
	waterfall_archipelago: 'X1X A2A B2A C2A D2A E2A F2A A3A A3B B3A B3B C3A C3B D3A D3B E3A E3B F3A F3B A4A A4B A4C B4A B4B B4C C4A C4B C4C D4A D4B D4C E4A E4B E4C F4A F4B F4C A5A A5B A5C A5D B5A B5B B5C B5D C5A C5B C5C C5D D5A D5B D5C D5D E5A E5B E5C E5D F5A F5B F5C F5D',
}).map(([map, shorts]) => [map, shorts.split(' ').map((short, id) => ({ id, short }))]));
