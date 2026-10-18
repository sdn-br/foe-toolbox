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

// FoE Toolbox: own notes, separated from the FoE Helfer module js/web/notice (which stays
// upstream and is hidden in the menu, see toolbox-menu.js), so Helfer updates of its server
// based notes never reach these. Started as a copy of notice.js 4.8.3.0. Differences: local
// storage (notes-store), one players group with relation filter and picker (player-note),
// own ids (toolboxNotes) and texts (Boxes.Notes.*).

/**
 * @type {{ActualGrp: number, init: Notes.init, notes: null, Listener: Notes.Listener, SetHeights: Notes.SetHeights, buildBox: Notes.buildBox, prepareContent: Notes.prepareContent, ActiveTab: number, ShowModal: Notes.ShowModal, SavePlayerToGroup: Notes.SavePlayerToGroup, SaveContent: Notes.SaveContent, ApiToken: null, SaveModal: Notes.SaveModal, SaveItemModal: Notes.SaveItemModal, DeleteElement: Notes.DeleteElement, ActiveSubTab: number, Players: {}}}
 */
let Notes = {

	notes: null,

	/**
	 * Object for player picker
	 */
	Players: {},

	ActualGrp: 0,

	ActiveTab: 1,
	ActiveSubTab: 1,

	ApiToken: null,

	initDone:false,

	/**
	 * On init get the content
	 */
	init: ()=> {

		// the notes are stored locally (Notes.Store), no GlobalSend or API token needed
		if(Notes.notes === null){
			Notes.Store.send({}, 'Notes/get',(resp)=>{ // local store (Notes.Store) instead of the server
				if(resp['status'] === 'ERROR') {
					HTML.ShowToastMsg({
						head: 'Error',
						text: resp['msg'],
						type: 'error',
						hideAfter: 10000,
					});
				}
				else {
					Notes.notes = resp['notice'];

					Notes.buildBox(false);
				}
			});

		} else {
			Notes.buildBox(false);
		}
	},


	/**
	 * Put a empty box into the DOM
	 */
	buildBox: (event = true) => {
		if( $('#toolboxNotes').length < 1 )
		{
			// CSS into the DOM
			HTML.AddCssFile('toolbox-notes');

			HTML.Box({
				id: 'toolboxNotes',
				title: i18n('Boxes.Notes.Title'),
				ask: i18n('Boxes.Notes.HelpLink'),
				auto_close: true,
				dragdrop: true,
				resize: true,
				minimize: true,
				popout: () => MainParser.PopOut('toolboxNotes'), // pop-out window
			});

			Notes.Listener();
		}
		else if (!event)
		{
			HTML.CloseOpenBox('toolboxNotes');
			return;
		}

		Notes.Players = PlayerDict;

		// local notes, no GlobalSend requirement
		Notes.prepareContent();
	},


	/**
	 * Build the tabs
	 */
	prepareContent: ()=> {
		let tab = [],
			div = [],
			content;

		// content available
		if(Notes.notes){

			for(let i in Notes.notes){

				if(!Notes.notes.hasOwnProperty(i)){break;}

				const n = Notes.notes[i];
				let subtab = [],
					subdiv = [],
					subcontent,
					tabName;

				if(n['player_group']){
					switch (n['player_group']){
						case 'guild': tabName = `🛡 ${i18n('Boxes.Notes.SelectPlayerGroupGuild')}`; break;
						case 'friend': tabName = `👩🏼🤝🧑 ${i18n('Boxes.Notes.SelectPlayerGroupFriend')}`; break;
						case 'neighbor': tabName = `👤 ${i18n('Boxes.Notes.SelectPlayerGroupNeighbor')}`; break; // shown as "players", for any player, see player-note.js
					}

				} else {
					tabName = n['group_name'];
				}

				// the players group always exists (Notes.Store.mergePlayerGroups), it is neither renamed nor deleted
				tab.push(n['player_group']
					? `<li><a href="#tab-${n['id']}" data-id="${n['id']}"><span>${tabName}</span></a></li>`
					: `<li><a href="#tab-${n['id']}" data-id="${n['id']}" title="${i18n('Boxes.Notes.RenameHint')}"><span class="notes-name" data-type="grp" data-id="${n['id']}">${tabName}</span></a>${Notes.deleteButton('grp', n['id'])}</li>`);

				for(let x in n['items']){

					if(!n['items'].hasOwnProperty(x)){break;}

					let itm = n['items'][x];

					// current neighbor/guild/friend icons, player id for the filter. Player pages carry the player's name, only other pages are renamed
					subtab.push(itm['player_data']
						? `<li data-player="${PlayerNote.playerIdOf(itm) || ''}"><a href="#subtab-${itm['id']}" data-id="${itm['id']}" title="${itm['tab']}"><span>${PlayerNote.relationIcons(PlayerNote.playerIdOf(itm))}${itm['tab']}</span></a></li>`
						: `<li data-player=""><a href="#subtab-${itm['id']}" data-id="${itm['id']}" title="${itm['tab']} (${i18n('Boxes.Notes.RenameHint')})"><span class="notes-name" data-type="itm" data-id="${itm['id']}">${itm['tab']}</span></a></li>`);

					subdiv.push(`<div id='subtab-${itm['id']}' class="sub-tab" spellcheck="false" data-parent="${n['id']}" data-id="${itm['id']}">`);

					if(itm['player_data']){
						const player = JSON.parse(itm['player_data']);

						subdiv.push(`<div class="content-head-player">
										<span class="avatar" style="background-image:url('${srcLinks.GetPortrait(player['Avatar'])}')"></span>
										<div class="text">
											<span class="name">${player['PlayerName']}</span>
											<span class="clan-name"><em>#${player['PlayerID']}</em> ${player['ClanName'] ? '[' + player['ClanName'] + ']' : '&nbsp;'}</span>
										</div>
										<div class="info-text">${Notes.deleteButton('itm', itm['id'])}${PlayerNote.relationIcons(Number(player['PlayerID']), true)}</div><!-- current neighbor/guild/friend icons -->
									</div>`);

					} else {
						subdiv.push(`<div class="content-head-row"><div class="content-head" contenteditable="true">${(itm['title'] === '' ? i18n('Boxes.Notes.DummyHeading') : itm['title'])}</div>${Notes.deleteButton('itm', itm['id'])}</div>`)
					}


					subdiv.push(`<div class="content-text" contenteditable="true">${itm['content'] || ''}</div>
								</div>`);
				}

				subcontent = `<div class='tabs-sub'>`;

				if(n['player_group']){
					subcontent += PlayerNote.filterBar(); // filter by neighbor/guild/friend
					subcontent += 	`<span class="btn itm-btn" data-id="${n['player_group']}" data-group="${n['id']}">+ ${i18n('Boxes.Notes.NewPlayer')}</span>`;
				} else {
					subcontent += 	`<span class="btn itm-btn" data-id="new">+ ${i18n('Boxes.Notes.NewSide')}</span>`;
				}

				if(subtab.length > 0){
					subcontent += 	`<ul class='vertical'>${subtab.join('')}</ul>`;
				}

				subcontent += 		`${subdiv.join('')}
								</div>`;

				div.push(`<div id='tab-${n['id']}' class="notice-wrapper">${subcontent}</div>`);
			}

			content = `<div class='tabs toolboxNotes'>`;

			if(tab.length > 0){
				content += `<ul class='horizontal dark-bg'>${tab.join('')}</ul>`;
			}

			content += 		`<span class="btn grp-btn" data-id="new">+ ${i18n('Boxes.Notes.NewGroup')}</span>`;
			content += 		div.join('');
			content += `</div>`;

		}

		// all empty
		else {
			content = `<div class='toolboxNotes'>
							<span class="btn grp-btn" data-id="new">+ ${i18n('Boxes.Notes.NewGroup')}</span>
						</div>
						<div id='toolboxNotes_container'>
							<div class="empty-notice">${i18n('Boxes.Notes.NewGroupDesc')}</div>
						</div>`;
		}


		// wait for html in the DOM
		$('#toolboxNotes').find('#toolboxNotesBody').html(content).promise().done(function(){

			// ensure a valid tab is always active, otherwise Tabslet marks no tab
			// as active and "grp" stays empty when a new item is saved
			const grpCount = $('.toolboxNotes > ul.horizontal > li').length;

			if(!Number.isInteger(Notes.ActiveTab) || Notes.ActiveTab < 1 || Notes.ActiveTab > grpCount){
				Notes.ActiveTab = 1;
			}

			// init Tabslet
			$('.toolboxNotes').tabslet({
				active: Notes.ActiveTab
			});

			if( $('.tabs-sub').length > 0 ){
				// restore the last used sub tab in the active group, every other group starts at 1
				const activeSub = $('.toolboxNotes > .notice-wrapper').eq(Notes.ActiveTab - 1).find('.tabs-sub');

				$('.tabs-sub').each(function(){
					const $this = $(this),
						subCount = $this.find('ul.vertical li').length;

					let active = 1;

					if($this.is(activeSub) && Number.isInteger(Notes.ActiveSubTab) && Notes.ActiveSubTab >= 1 && Notes.ActiveSubTab <= subCount){
						active = Notes.ActiveSubTab;
					}

					$this.tabslet({
						active: active
					});
				});

				setTimeout(()=>{
					Notes.SetHeights();
				}, 150);

				PlayerNote.applyFilter(); // keep the player filter across renders
			}

			Notes.EnableSorting();
		});
	},


	/**
	 * DOM listeners
	 *
	 * @constructor
	 */
	Listener: ()=> {

		PlayerNote.bindFilter(); // player filter

		$('#toolboxNotesBody').on('click', '.grp-btn', function(){
			Notes.ShowModal('grp', $(this).data('id'));
		});

		$('#toolboxNotesBody').on('click', '.itm-btn', function(){
			const id = $(this).data('id');

			if(id !== 'new'){
				PlayerNote.showPicker($(this).data('group')); // picker with search and filter over all known players, see player-note.js

			} else {
				Notes.ShowModal('itm', id);
			}
		});

		// trash icons on group tabs and page headers
		$('#toolboxNotesBody').on('click', '.notes-del', function(e){
			e.preventDefault();
			e.stopPropagation();
			Notes.ConfirmDelete($(this).data('type'), $(this).data('id'));
		});

		// rename groups and pages in place
		$('#toolboxNotesBody').on('dblclick', '.notes-name', function(e){
			e.preventDefault();
			Notes.StartRename($(this));
		});

		$('#toolboxNotesBody').on('blur', '.sub-tab [contenteditable="true"]', function(){
			let $this = $(this).closest('.sub-tab');

			Notes.SaveContent($this);
		});

		// enter is pressed
		$('#toolboxNotesBody').on('keydown', '.sub-tab [contenteditable="true"]', function(e){

			if (e.keyCode === 13) {
				// prevent to enter a div instad a <br>
				document.execCommand('insertHTML', false, '<br><br>');
				// prevent the default behaviour of return key pressed
				return false;
			}
		});
		if (Notes.initDone) return;

		$('body').on('click', '#toolboxNotes-modalclose, #toolboxNotes-modal-playersclose', function(){
			$('.foe-helper-overlay').remove();
		});

		// save content when close box
		$('body').on('click', '#toolboxNotesclose', function(){
			let $this = $('.sub-tab:visible');
			if ($this.length == 0) return;
			Notes.SaveContent($this);
		});

		// check if user changes the box size
		let id;

		$('body').on('resize', '#toolboxNotes', function(){
			clearTimeout(id);
			id = setTimeout(Notes.SetHeights(), 150);
		});
		Notes.initDone = true;
	},


	/**
	 * Show a tiny modal to create a group or page (renaming is in place, deleting via the trash icons)
	 *
	 * @param type
	 * @param id
	 * @constructor
	 */
	ShowModal:(type, id)=> {

		let title = type === 'grp' ? i18n('Boxes.Notes.NewGroup') : i18n('Boxes.Notes.NewSide'),
			txt = '';

		HTML.Box({
			id: 'toolboxNotes-modal',
			title: title,
			auto_close: true,
		});

		$('body').prepend( $('<div class="foe-helper-overlay" />') );


		let inp = $('<input />'),
			btn = $('<span />');

		inp.attr({
			type: 'text',
			value: txt,
			id: `${type}-input`,
			placeholder: type === 'grp' ? i18n('Boxes.Notes.GroupName') : i18n('Boxes.Notes.SideName'),
			class: `inp-${type}-name`,
			'data-id': id
		});

		btn.attr({
				role: 'button',
				class: `btn save-${type}-name`,
				'data-id': id,
				'data-type': type,
				onclick: (type === 'itm' ? `Notes.SaveItemModal('${(id === 'new' ? "new" : id)}')` : `Notes.SaveModal('${type}', '${(id === 'new' ? "new" : id)}')`)
			})
			.text(i18n('Boxes.Notes.Save'))
			.wrap('<div class="text-right" />');


		$('#toolboxNotes-modalBody').append(inp);


		// no player group type selection, player pages live in the one "players" group (Notes.Store.mergePlayerGroups)

		$('#toolboxNotes-modalBody').append(btn);

		$(`.inp-${type}-name`).focus();
	},


	/**
	 * Function to save a group
	 *
	 * @param type
	 * @param id
	 * @constructor
	 */
	SaveModal: (type, id)=> {
		let nN = $(`.inp-${type}-name`).val(),
			txt = MainParser.ClearText(nN.trim()), // filter <script> Tags
			data = {
				id: id,
				type: type,
				name: txt,
				// no default, the local store appends a new group when the field is empty
				sort: $(`.inp-grp-sort`).val(),
				apiToken: Notes.ApiToken
			},
			grpSel = $('#player-grp option:selected');

		if( grpSel.length > 0 && grpSel.data('value') !== -1 ){ // the selection is gone, see ShowModal
			data['player_group'] = grpSel.data('value');

		} else if(txt === '') {
			return;

		} else {
			data['name'] = txt;
		}

		Notes.Store.send(data, 'Notes/set', (resp)=>{ // local store (Notes.Store) instead of the server
			if(resp['status'] === 'ERROR') {
				HTML.ShowToastMsg({
					head: 'Error',
					text: resp['msg'],
					type: 'error',
					hideAfter: 10000,
				});
			}
			else {
				Notes.notes = resp['notice'];

				if(id === 'new'){
					// a new group may have been sorted in anywhere; local ids only grow, so the newest has the highest
					const newId = Math.max(...Notes.notes.map(g => g.id));
					Notes.ActiveTab = Notes.notes.findIndex(g => g.id === newId) + 1;

				} else {
					// loose comparison, "id" comes from the DOM as a string
					Notes.ActiveTab = Notes.notes.findIndex(idx => (idx.id == id)) +1;
				}

				$('#toolboxNotes-modal').fadeToggle('fast', function(){
					$(this).remove();

					$('.foe-helper-overlay').remove();
				});

				Notes.buildBox();
			}
		});
	},


	/**
	 * Function to save a item
	 *
	 * @param id
	 * @constructor
	 */
	SaveItemModal: (id)=> {
		let nN = $('.inp-itm-name').val(),
			txt = nN.trim(),
			grp = $('ul.horizontal').find('li.active a').data('id');

		if(txt === ''){
			return;
		}

		// fallback: if no tab is marked as active use the first group, "grp" must never be empty
		if(grp === undefined){
			grp = $('ul.horizontal').find('li:first a').data('id');
		}

		let sortVal = $(`.inp-itm-sort`).val() || ($(`#tab-${grp}`).find('ul.vertical li').length +1);

		txt = MainParser.ClearText(txt);

		Notes.Store.send({id:id,type:'itm',name:txt,grp:grp,sort:sortVal,apiToken:Notes.ApiToken}, 'Notes/set', (resp)=>{ // local store (Notes.Store) instead of the server
			if(resp['status'] === 'ERROR') {
				HTML.ShowToastMsg({
					head: 'Error',
					text: resp['msg'],
					type: 'error',
					hideAfter: 10000,
				});
			}
			else {
				Notes.notes = resp['notice'];

				// loose comparisons, ids may arrive as strings from the DOM
				const group = Notes.notes.find(e => (e.id == grp));
				Notes.ActiveTab = Notes.notes.findIndex(idx => (idx.id == grp)) +1;

				if(id === 'new'){
					// the response already contains the new item as the last one
					Notes.ActiveSubTab = group.items.length;

				} else {
					Notes.ActiveSubTab = group.items.findIndex(i => (i.id == id)) +1;
				}

				$('#toolboxNotes-modal').fadeToggle('fast', function(){
					$(this).remove();

					$('.foe-helper-overlay').remove();
				});

				Notes.buildBox();
			}
		});
	},


	/**
	 * Save the content-head and -text into the database
	 *
	 * @param $this
	 * @constructor
	 */
	SaveContent: ($this)=> {
		let itmID = $this.data('id'),
			grpID = $this.data('parent'),
			head = $this.find('.content-head').html(),
			cont = $this.find('.content-text').html();

		if(cont === null) {
			return;
		}

		// send content changes to server und change local object
		Notes.Store.send({id:itmID,grp:grpID,type:'cnt',head:head,cont:cont,apiToken:Notes.ApiToken}, 'Notes/set', (resp)=>{ // local store (Notes.Store) instead of the server

			if(resp['status'] === 'ERROR') {
				HTML.ShowToastMsg({
					head: 'Error',
					text: resp['msg'],
					type: 'error',
					hideAfter: 10000,
				});
			}
			else {
				// loose comparisons, ids may arrive as strings from the DOM
				let grpIdx = Notes.notes.findIndex(g => (g.id == grpID)),
					itmIdx = grpIdx > -1 ? Notes.notes[grpIdx].items.findIndex(i => (i.id == itmID)) : -1;

				// unknown ids: the server accepted the save, just skip the local cache update
				if(itmIdx === -1){
					return;
				}

				Notes.notes[grpIdx].items[itmIdx]['title'] = head;
				Notes.notes[grpIdx].items[itmIdx]['content'] = cont;

				Notes.ActiveTab = (grpIdx + 1);
				Notes.ActiveSubTab = (itmIdx + 1);
			}
		});
	},


	SavePlayerToGroup: (id)=> {
		const data = {
			id: 'new',
			type: 'itm',
			name: PlayerDict[id]['PlayerName'],
			grp: Notes.ActualGrp,
			player: JSON.stringify(PlayerDict[id]),
			apiToken: Notes.ApiToken
		};

		// check if not double
		const group = Notes.notes.find(e => (e.id === Notes.ActualGrp));
		const player = group.items.find(e => (PlayerNote.playerIdOf(e) === Number(id))); // by id, a renamed player is still the same

		// Player is allways added
		if(player){
			return ;
		}

		// set the active Tab for reload
		Notes.ActiveTab = Notes.notes.findIndex(idx => idx.id === Notes.ActualGrp) + 1;

		Notes.Store.send(data, 'Notes/set', (resp)=>{ // local store (Notes.Store) instead of the server
			if(resp['status'] === 'ERROR') {
				HTML.ShowToastMsg({
					head: 'Error',
					text: resp['msg'],
					type: 'error',
					hideAfter: 10000,
				});
			}
			else {
				Notes.notes = resp['notice'];

				$('#toolboxNotes-modal-players').fadeToggle('fast', function(){
					$(this).remove();

					$('.foe-helper-overlay').remove();
				});

				Notes.buildBox();

				$('.custom-option-noticePlayers').bind('click');
			}
		});
	},


	/**
	 * Drag and drop sorting of groups and pages, always on. The minimum distance keeps
	 * a normal click a tab switch.
	 */
	EnableSorting: ()=> {
		const save = (type, list) => {
			Notes.Store.send({type: type, [type === 'grp' ? 'grps' : 'itms']: list}, 'Notes/sort', (resp)=>{
				if(resp['status'] === 'ERROR') {
					HTML.ShowToastMsg({
						head: 'Error',
						text: resp['msg'],
						type: 'error',
						hideAfter: 10000,
					});
				}
				else {
					Notes.notes = resp['notice'];
				}
			});
		};

		const order = (ul) => ul.children('li').map((idx, li) => ({ id: $(li).find('a').data('id'), sort: idx })).get();

		$('#toolboxNotesBody ul.horizontal').sortable({
			axis: 'x',
			distance: 5,
			cancel: '.notes-del, input',
			stop: function() {
				save('grp', order($(this)));
				// keep the dragged group open
				Notes.ActiveTab = $(this).children('li').index($(this).children('li.active')) + 1;
			}
		});

		$('#toolboxNotesBody ul.vertical').sortable({
			axis: 'y',
			distance: 5,
			cancel: 'input',
			stop: function() {
				save('itm', order($(this)));
				Notes.ActiveSubTab = $(this).children('li').index($(this).children('li.active')) + 1;
			}
		});
	},


	/**
	 * Trash icon of a group tab or page header
	 *
	 * @param type 'grp' or 'itm'
	 * @param id
	 * @returns {string} HTML
	 */
	deleteButton: (type, id)=> `<span class="notes-del" role="button" data-type="${type}" data-id="${id}" title="${i18n(type === 'grp' ? 'Boxes.Notes.DeleteGroup' : 'Boxes.Notes.DeleteItem')}"></span>`,


	/**
	 * Confirmation in the notes modal (no confirm(), it blocks the game and fails in the pop-out).
	 * A group with pages gets an extra warning.
	 *
	 * @param type 'grp' or 'itm'
	 * @param id
	 */
	ConfirmDelete: (type, id)=> {
		const group = type === 'grp' ? (Notes.notes || []).find(g => g.id == id) : undefined,
			item = type === 'itm' ? (Notes.notes || []).flatMap(g => g.items).find(i => i.id == id) : undefined,
			name = group ? group.group_name : (item ? item.tab : ''),
			pages = group ? group.items.length : 0;

		HTML.Box({
			id: 'toolboxNotes-modal',
			title: i18n(type === 'grp' ? 'Boxes.Notes.DeleteGroup' : 'Boxes.Notes.DeleteItem'),
			auto_close: true,
		});

		$('body').prepend( $('<div class="foe-helper-overlay" />') );

		$('#toolboxNotes-modalBody').append(
			$('<p />').addClass('notes-delete-text').text(HTML.i18nReplacer(i18n(type === 'grp' ? 'Boxes.Notes.DeleteGroupConfirm' : 'Boxes.Notes.DeleteItemConfirm'), { name: name })),
			pages > 0 ? $('<p />').addClass('notes-delete-text notes-delete-warning').text(HTML.i18nReplacer(i18n('Boxes.Notes.DeleteGroupPages'), { count: pages })) : '',
			$('<span />').attr({role: 'button', class: 'btn btn-delete'}).text(i18n('Boxes.Notes.Delete')).on('click', () => Notes.DeleteElement(type, id)),
			$('<span />').attr({role: 'button', class: 'btn'}).text(i18n('General.Cancel')).on('click', Notes.Store.CloseModal)
		);
	},


	/**
	 * Double click on a group or page name: an input in place, Enter or leaving saves, Escape cancels
	 *
	 * @param name the .notes-name span
	 */
	StartRename: (name)=> {
		if (name.find('input').length > 0) {
			return;
		}

		const type = name.data('type'),
			id = name.data('id'),
			old = name.text(),
			input = $('<input type="text" class="notes-rename" />').val(old);

		let done = false;

		const finish = (save) => {
			if (done) return;
			done = true;

			const txt = MainParser.ClearText(input.val().trim());

			if (!save || txt === '' || txt === old) {
				name.text(old);
				return;
			}

			name.text(txt);

			Notes.Store.send({id: id, type: type, name: txt}, 'Notes/set', (resp)=>{
				if(resp['status'] === 'ERROR') {
					name.text(old);
					HTML.ShowToastMsg({
						head: 'Error',
						text: resp['msg'],
						type: 'error',
						hideAfter: 10000,
					});
				}
				else {
					Notes.notes = resp['notice'];
					name.closest('li').find('a').attr('title', type === 'itm' ? `${txt} (${i18n('Boxes.Notes.RenameHint')})` : i18n('Boxes.Notes.RenameHint'));
				}
			});
		};

		input
			.on('keydown', (e) => {
				e.stopPropagation();
				if (e.key === 'Enter') finish(true);
				if (e.key === 'Escape') finish(false);
			})
			.on('blur', () => finish(true))
			// clicks in the input must not switch tabs or start dragging
			.on('click mousedown', (e) => e.stopPropagation());

		name.empty().append(input);
		input.trigger('focus').trigger('select');
	},


	/**
	 * Delete a group or item from the database
	 *
	 * @param type
	 * @param id
	 * @constructor
	 */
	DeleteElement: (type, id)=> {
		Notes.Store.send({type:type,id:id,apiToken:Notes.ApiToken}, 'Notes/del', (resp)=>{ // local store (Notes.Store) instead of the server
			if(resp['status'] === 'ERROR') {
				HTML.ShowToastMsg({
					head: 'Error',
					text: resp['msg'],
					type: 'error',
					hideAfter: 10000,
				});
			}
			else {
				Notes.notes = resp['notice'];

				// the deleted element may have been the active one, jump back to the first tab
				Notes.ActiveTab = 1;
				Notes.ActiveSubTab = 1;

				$('#toolboxNotes-modal').fadeToggle('fast', function(){
					$(this).remove();

					$('.foe-helper-overlay').remove();
				});

				Notes.buildBox();
			}
		});
	},


	/**
	 * Set the heigh from left ul li & content body at the resize
	 *
	 * @constructor
	 */
	SetHeights: ()=> {
		let h = $('#toolboxNotesBody').outerHeight() - 35;

		// horizontal UL
		$('ul.vertical').height(h  - 39);

		// text
		$('.content-text').height(h - $('.content-text').prev().height());
	},
};
