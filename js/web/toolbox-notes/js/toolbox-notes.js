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
 * @type {{ActualGrp: number, init: Notes.init, notes: null, Listener: Notes.Listener, SetHeights: Notes.SetHeights, buildBox: Notes.buildBox, BuildSettingButtons: Notes.BuildSettingButtons, prepareContent: Notes.prepareContent, ActiveTab: number, ShowModal: Notes.ShowModal, SavePlayerToGroup: Notes.SavePlayerToGroup, SaveContent: Notes.SaveContent, EditMode: boolean, ApiToken: null, SaveModal: Notes.SaveModal, SaveItemModal: Notes.SaveItemModal, DeleteElement: Notes.DeleteElement, ActiveSubTab: number, Players: {}}}
 */
let Notes = {

	notes: null,

	/**
	 * Toogle state for edit mode
	 */
	EditMode: false,

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
				settings: true
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

				tab.push(`<li><a href="#tab-${n['id']}" data-id="${n['id']}"><span>${tabName}</span></a></li>`);

				for(let x in n['items']){

					if(!n['items'].hasOwnProperty(x)){break;}

					let itm = n['items'][x];

					subtab.push(`<li data-player="${PlayerNote.playerIdOf(itm) || ''}"><a href="#subtab-${itm['id']}" data-id="${itm['id']}" title="${itm['tab']}"><span>${PlayerNote.relationIcons(PlayerNote.playerIdOf(itm))}${itm['tab']}</span></a></li>`); // current neighbor/guild/friend icons, player id for the filter

					subdiv.push(`<div id='subtab-${itm['id']}' class="sub-tab" spellcheck="false" data-parent="${n['id']}" data-id="${itm['id']}">`);

					if(itm['player_data']){
						const player = JSON.parse(itm['player_data']);

						subdiv.push(`<div class="content-head-player">
										<span class="avatar" style="background-image:url('${srcLinks.GetPortrait(player['Avatar'])}')"></span>
										<div class="text">
											<span class="name">${player['PlayerName']}</span>
											<span class="clan-name"><em>#${player['PlayerID']}</em> ${player['ClanName'] ? '[' + player['ClanName'] + ']' : '&nbsp;'}</span>
										</div>
										<div class="info-text">${PlayerNote.relationIcons(Number(player['PlayerID']), true)}</div><!-- current neighbor/guild/friend icons -->
									</div>`);

					} else {
						subdiv.push(`<div class="content-head" contenteditable="true">${(itm['title'] === '' ? i18n('Boxes.Notes.DummyHeading') : itm['title'])}</div>`)
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

			// the settings button toggles the edit mode, which has nothing to edit without groups
			const canEdit = (grpCount > 0);
			$('#toolboxNotes-settings').toggleClass('disabled', !canEdit).attr('title', i18n(canEdit ? 'Boxes.Notes.Edit' : 'Boxes.Notes.EditDisabled'));
			if (!canEdit) Notes.EditMode = false;

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

		$('#toolboxNotesBody').on('click', '.tab-edit', function(){
			Notes.ShowModal('grp', $(this).data('id'));
		});

		$('#toolboxNotesBody').on('click', '.sub-tab-edit', function(){
			Notes.ShowModal('itm', $(this).data('id'));
		});

		// toggle edit buttons
		$('#toolboxNotes').on('click', '#toolboxNotes-settings', function(){
			if($(this).hasClass('disabled')) return; // nothing to edit yet

			if(!Notes.EditMode){
				Notes.BuildSettingButtons();
			} else {
				$('.tab-edit, .sub-tab-edit').remove();
			}

			Notes.EditMode = !Notes.EditMode;
		});


		$('#toolboxNotesBody').on('blur', '[contenteditable="true"]', function(){
			let $this = $(this).closest('.sub-tab');

			Notes.SaveContent($this);
		});

		// enter is pressed
		$('#toolboxNotesBody').on('keydown', '[contenteditable="true"]', function(e){

			if (e.keyCode === 13) {
				// prevent to enter a div instad a <br>
				document.execCommand('insertHTML', false, '<br><br>');
				// prevent the default behaviour of return key pressed
				return false;
			}
		});
		if (Notes.initDone) return;
		$('body').on('click', '.btn-delete', function() {
			if (confirm(i18n('Boxes.Notes.ConfirmDelete')))
				Notes.DeleteElement($(this).data('type'), $(this).data('id'));
		});

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
	 * Show a tiny modal for create, edit or delete a group or item
	 *
	 * @param type
	 * @param id
	 * @constructor
	 */
	ShowModal:(type, id)=> {

		let title = type === 'grp' ? i18n('Boxes.Notes.NewGroup') : i18n('Boxes.Notes.NewSide'),
			txt;

		if(id !== 'new'){

			if(type === 'grp'){
				txt = $('.horizontal').find(`[data-id="${id}"]`).text();
			} else {
				txt = $('.vertical').find(`[data-id="${id}"]`).text();
			}

			title = txt + ' - ' + i18n('Boxes.Notes.Edit');
		}

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


		if(id !== 'new'){
			let delBtn = $('<span />');

			delBtn
				.attr({
					role: 'button',
					class: `btn btn-delete`,
					'data-id': id,
					'data-type': type
				})
				.text(type === 'grp' ? i18n('Boxes.Notes.DeleteGroup') : i18n('Boxes.Notes.DeleteItem'))
			;

			$('#toolboxNotes-modalBody').append(delBtn);

		} else {
			let sort = $('<input />').attr({
				type: 'number',
				class: `inp-${type}-sort`,
				placeholder: i18n('Boxes.Notes.Sorting')
			});

			sort.wrap('<div />').insertAfter(`.inp-${type}-name`);
		}

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

				Notes.EditMode = false;
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

				Notes.EditMode = false;
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
	 * Create "Edit" buttons for the DOM
	 *
	 * @constructor
	 */
	BuildSettingButtons: ()=> {

		$('.tab-edit, .sub-tab-edit').remove();

		// Sortfunction for horizontal + Stop event
		$('ul.horizontal').sortable({
			axis: 'x',
			stop: function() {
				let grps = [];

				$('ul.horizontal li').each(function(idx){
					let id = $(this).find('a').data('id');

					grps.push({
						id: id,
						sort: idx
					});
				});

				Notes.Store.send({type:'grp',grps:grps,apiToken:Notes.ApiToken}, 'Notes/sort', (resp)=>{ // local store (Notes.Store) instead of the server
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

						$('.toolboxNotes').tabslet();
						Notes.BuildSettingButtons();
					}
				});
			}
		});


		$('ul.horizontal li').each(function(){
			let $this = $(this),
				id = $this.find('a').data('id'),
				left = $this.position().left,
				width = $this.width(),
				btn = $('<span />');

			btn.attr({
				class: 'tab-edit',
				'data-id': id
			}).css({
				left: ((left + width) - 28),
				top: 5
			});

			$('.tabs').append(btn);
		});

		$('.notice-wrapper').each(function(){
			let div = $(this),
				top = 43;

			// Sortfunction for vertical + Stop event
			div.find('ul.vertical').sortable({
				axis: 'y',
				stop: function(e, ui) {
					let itms = [],
						ul = $(ui.item).closest('ul');

					ul.find('li').each(function(idx){
						let id = $(this).find('a').data('id');

						itms.push({
							id: id,
							sort: idx
						});
					});

					Notes.Store.send({type:'itm',itms:itms,apiToken:Notes.ApiToken}, 'Notes/sort', (resp)=>{ // local store (Notes.Store) instead of the server
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

							$('.tabs-sub').tabslet();
							Notes.BuildSettingButtons();
						}
					});
				}
			});

			div.find('ul.vertical li').each(function(){
				let $this = $(this),
					id = $this.find('a').data('id'),
					btn = $('<span />');

				btn.attr({
					class: 'sub-tab-edit',
					'data-id': id
				}).css({
					top: top,
					left: 90
				});

				top += 32;

				div.append(btn);
			});
		});
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

				Notes.EditMode = false;
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
