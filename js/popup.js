/*
 * **************************************************************************************
 * Copyright (C) 2022 FoE-Helper team - All Rights Reserved
 * You may use, distribute and modify this code under the
 * terms of the AGPL license.
 *
 * See file LICENSE.md or go to
 * https://github.com/mainIine/foe-helfer-extension/blob/master/LICENSE.md
 * for full license details.
 *
 * **************************************************************************************
 */

let lng = window.navigator.language.split('-')[0];

let i18n = {
	'de' : {
		'title' : 'FoE Helfer',
		'intro' : "Eine inoffizielle Browser-Erweiterung für Forge of Empires.",
		'donate' : 'Spenden',
		'desc' : "Dir gefällt diese kleine kostenlose Extension?<br> Jede kleine Spende ist immer gern gesehen.",
		'thanks' : 'Vielen Dank!'
	},
};

$(function(){
	$('body').on('click', '.foe-link', ()=> {
		chrome.tabs.create({url: "https://foe-rechner.de/"});
	});

	$('body').on('click', '.paypal-link', ()=> {
		chrome.tabs.create({url: "https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=CNZWYJWRFY3T2&source=url"});
	});

	if(lng !== 'de'){
		$('[data-translate]').each(function(){
			let txt = $(this).data('translate');

			if( i18n[lng][txt] !== undefined ){
				$(this).html( i18n[lng][txt]);
			} else {
				$(this).html( i18n['en'][txt]);
			}
		});
	}
});
