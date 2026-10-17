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

$(function(){
	// Open external links in new tab
	$('body').on('click', '.foe-link', ()=> {
		chrome.tabs.create({url: "https://foe-rechner.de/"});
	});

	$('body').on('click', '.paypal-link', ()=> {
		chrome.tabs.create({url: "https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=CNZWYJWRFY3T2&source=url"});
	});

	// Set current year in footer
	const yearEl = document.getElementById('year');
	if (yearEl) {
		yearEl.textContent = String(new Date().getFullYear());
	}

});
