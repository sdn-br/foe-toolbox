/*
 * **************************************************************************************
 * Copyright (C) 2026 FoE-Helper team - All Rights Reserved
 * You may use, distribute and modify this code under the
 * terms of the AGPL license.
 *
 * See file LICENSE.md or go to
 * https://github.com/mainIine/foe-helfer-extension/blob/master/LICENSE.md
 * for full license details.
 *
 * **************************************************************************************
 */

$(async function(){

	const Alerts = (() => {
		async function extApiCall(request) {
			const res = await browser.runtime.sendMessage(request);
			if (res.ok) {
				return res.data;
			} else {
				throw new Error("EXT-API error: "+res.error);
			}
		}
		return {
			getAll: function() {
				return extApiCall({type: 'alerts', action: 'getAll'});
			},
			getAllRaw: function() {
				return extApiCall({type: 'alerts', action: 'getAllRaw'});
			},
			create: function(data) {
				throw new Error("Not supported");
			},
			delete: function(id) {
				return extApiCall({type: 'alerts', action: 'delete', id: id});
			}
		};
	})();

	$('body').on('click', '.foe-link', ()=> {
		chrome.tabs.create({url: "https://github.com/sdn-br/foe-toolbox"});
	});


	const list = document.getElementById('list');

	const alerts = await Alerts.getAllRaw();
	if (alerts == null) return;

	for (let alert of alerts) {
		const item = document.createElement('li');
		// TODO: discuss: should an actual link be saved
		const link = document.createElement('a');
		link.href = '#';
		link.innerText = alert.server;
		link.addEventListener('click', () => {
			chrome.tabs.query({url: alert.server+'/*'}, list => {
				if (list.length > 0) {
					const tab = list[0];
					chrome.tabs.update(tab.id, {active: true});
					chrome.windows.update(tab.windowId, {focused: true});
				} else {
					chrome.tabs.create({url: alert.server+'/game/index'});
				}
			});
		});
		item.appendChild(link);

		item.appendChild(document.createTextNode(alert.data.title));
		item.appendChild(document.createTextNode(alert.data.body));

		const time = document.createElement('span');
		time.classList.add('text-right');
		time.innerText = new Date(alert.data.expires).toString();
		item.appendChild(time);

		const id = alert.id;
		const deleteBtn = document.createElement('button');
		deleteBtn.innerText = '❌';
		deleteBtn.addEventListener('click', () => {
			item.remove();
			Alerts.delete(id);
		});
		item.appendChild(deleteBtn);

		list.appendChild(item);
	}

});
