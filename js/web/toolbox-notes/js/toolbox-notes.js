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
 * @type {{ActualGrp: number, init: Notes.init, notes: null, Listener: Notes.Listener, SetHeights: Notes.SetHeights, buildBox: Notes.buildBox, prepareContent: Notes.prepareContent, ActiveTab: number, SavePlayerToGroup: Notes.SavePlayerToGroup, SaveContent: Notes.SaveContent, ApiToken: null, DeleteElement: Notes.DeleteElement, ActiveSubTab: number, Players: {}}}
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

				// one players group of type 'neighbor' (Notes.Store.mergePlayerGroups), shown as "players"
				if(n['player_group']){
					tabName = `👤 ${i18n('Boxes.Notes.SelectPlayerGroupNeighbor')}`;

				} else {
					tabName = n['group_name'];
				}

				// the players group always exists (Notes.Store.mergePlayerGroups), it is neither renamed nor deleted
				tab.push(n['player_group']
					? `<li class="notes-fixed"><a href="#tab-${n['id']}" data-id="${n['id']}"><span>${tabName}</span></a></li>`
					: `<li><a href="#tab-${n['id']}" data-id="${n['id']}" class="fh-tooltip" data-callback_tt="Notes.nameTT" data-type="grp"><span class="notes-name" data-type="grp" data-id="${n['id']}">${tabName}</span></a>${Notes.deleteButton('grp', n['id'])}</li>`);

				for(let x in n['items']){

					if(!n['items'].hasOwnProperty(x)){break;}

					let itm = n['items'][x];

					// current neighbor/guild/friend icons, player id for the filter. Player pages carry the player's name, only other pages are renamed
					subtab.push(itm['player_data']
						? `<li data-player="${PlayerNote.playerIdOf(itm) || ''}"><a href="#subtab-${itm['id']}" data-id="${itm['id']}" class="fh-tooltip" data-callback_tt="Notes.nameTT" data-type="player"><span>${PlayerNote.relationIcons(PlayerNote.playerIdOf(itm))}${itm['tab']}</span></a></li>`
						: `<li data-player=""><a href="#subtab-${itm['id']}" data-id="${itm['id']}" class="fh-tooltip" data-callback_tt="Notes.nameTT" data-type="itm"><span class="notes-name" data-type="itm" data-id="${itm['id']}">${itm['tab']}</span></a></li>`);

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
						// one name per page: the heading is the page name (Notes.Store.migrateTitles moved former own headings into the text)
						subdiv.push(`<div class="content-head-row"><div class="content-head" contenteditable="true" spellcheck="false">${itm['tab']}</div>${Notes.deleteButton('itm', itm['id'])}</div>`)
					}


					subdiv.push(`<div class="content-text" contenteditable="true">${itm['content'] || ''}</div>
								</div>`);
				}

				subcontent = `<div class='tabs-sub'>`;

				// "+" row on top of the page list like in browser sidebars, it does not scroll with the list.
				// A p, not a div: Tabslet treats every direct div of the sub tabs as a page
				if(n['player_group']){
					subcontent += PlayerNote.filterBar(); // filter by neighbor/guild/friend
					subcontent += `<p class="notes-add-row" role="button" data-action="player" data-group="${n['id']}">+ ${i18n('Boxes.Notes.AddPlayer')}</p>`;
				} else {
					subcontent += `<p class="notes-add-row" role="button" data-action="page" data-group="${n['id']}">+ ${i18n('Boxes.Notes.NewPage')}</p>`;
				}

				if(subtab.length > 0){
					subcontent += 	`<ul class='vertical'>${subtab.join('')}</ul>`;
				}

				subcontent += 		`${subdiv.join('')}
								</div>`;

				div.push(`<div id='tab-${n['id']}' class="notice-wrapper">${subcontent}</div>`);
			}

			content = `<div class='tabs toolboxNotes'>`;

			// "+" right of the tabs like in a browser, outside the scrolling tab row so it never covers a tab.
			// A span, not a div: Tabslet treats every direct div as a page
			content += `<ul class='horizontal dark-bg'>${tab.join('')}</ul><span class="notes-add-grp fh-tooltip" role="button" ${ToolboxTT.attrs(i18n('Boxes.Notes.NewGroupHint'))}>+</span>`;
			// soft edges of the scrolling tab row, outside the row so they never touch the players tab
			content += `<span class="notes-fade notes-fade-left"></span><span class="notes-fade notes-fade-right"></span>`;
			content += 		div.join('');
			content += `</div>`;

		}

		// no groups (the players group is created on opening, so only before the db is ready)
		else {
			content = `<div class='tabs toolboxNotes'><ul class='horizontal dark-bg'></ul><span class="notes-add-grp" role="button">+</span></div>`;
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
			Notes.EnableTabScrolling();

			// a page created in place continues in its text
			if (Notes.FocusText) {
				$(`#toolboxNotesBody #subtab-${Notes.FocusText} .content-text`).trigger('focus');
				Notes.FocusText = null;
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

		$('#toolboxNotesBody').on('click', '.notes-add-row', function(){
			if ($(this).data('action') === 'player') {
				PlayerNote.showPicker($(this).data('group')); // picker with search and filter over all known players, see player-note.js
			} else {
				Notes.StartNewItem($(this).data('group'));
			}
		});

		// trash icons on group tabs and page headers. Capture phase: Tabslet stops the click on
		// the tab li before it bubbles up, and the tab must not switch either
		$('#toolboxNotesBody')[0].addEventListener('click', function(e){
			if (e.target.closest('.notes-add-grp')) {
				e.preventDefault();
				e.stopPropagation();
				Notes.StartNewGroup();
				return;
			}

			const del = e.target.closest('.notes-del');

			if (!del) return;

			e.preventDefault();
			e.stopPropagation();
			Notes.ConfirmDelete($(del).data('type'), $(del).data('id'));
		}, true);

		// rename groups and pages in place
		$('#toolboxNotesBody').on('dblclick', '.notes-name', function(e){
			e.preventDefault();
			Notes.StartRename($(this));
		});

		$('#toolboxNotesBody').on('blur', '.sub-tab [contenteditable="true"]', function(){
			if ($(this).hasClass('content-head')) {
				Notes.SaveHeading($(this));
				return;
			}

			Notes.SaveContent($(this).closest('.sub-tab'));
		});

		// enter is pressed
		$('#toolboxNotesBody').on('keydown', '.sub-tab [contenteditable="true"]', function(e){

			// the heading is the page name: one line, Enter saves, Escape restores
			if ($(this).hasClass('content-head')) {
				if (e.key === 'Escape') {
					$(this).text(Notes.itemName($(this).closest('.sub-tab').data('id')));
				}
				if (e.key === 'Enter' || e.key === 'Escape') {
					e.preventDefault();
					this.blur();
				}
				return;
			}

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
	 * Page created in place by the "+ new page" row, see StartNewItem
	 */
	FocusText: null,


	/**
	 * "+" behind the group tabs: a new tab with a name input right before it. Enter or leaving
	 * creates the group and opens it, Escape or an empty name removes the tab again.
	 */
	StartNewGroup: ()=> {
		const ul = $('#toolboxNotesBody ul.horizontal');

		if (ul.find('.notes-new').length > 0) {
			return;
		}

		const li = $('<li class="notes-new" />').appendTo(ul);

		Notes.EditNewName(li, i18n('Boxes.Notes.GroupName'), (name) => {
			Notes.Store.send({id: 'new', type: 'grp', name: name}, 'Notes/set', (resp)=>{
				if (!Notes.SaveFailed(resp)) {
					Notes.notes = resp['notice'];
					// local ids only grow, so the newest group has the highest
					const newId = Math.max(...Notes.notes.map(g => g.id));
					Notes.ActiveTab = Notes.notes.findIndex(g => g.id === newId) + 1;
					Notes.ActiveSubTab = 1;
					Notes.buildBox();
				}
			});
		});

		ul.scrollLeft(ul[0].scrollWidth);
		ul.parent().removeClass('notes-tabs-more');
	},


	/**
	 * "+ new page" row: a new entry with a name input on top of the page list. Enter or leaving
	 * creates the page, opens it and puts the cursor into its text.
	 *
	 * @param groupId
	 */
	StartNewItem: (groupId)=> {
		const tabs = $(`#toolboxNotesBody #tab-${groupId} .tabs-sub`);
		let ul = tabs.children('ul.vertical');

		if (ul.find('.notes-new').length > 0) {
			return;
		}

		if (ul.length === 0) {
			ul = $(`<ul class='vertical' />`).insertAfter(tabs.children('.notes-add-row'));
		}

		const li = $('<li class="notes-new" />').prependTo(ul),
			group = (Notes.notes || []).find(g => g.id == groupId),
			first = group && group.items.length > 0 ? Math.min(...group.items.map(i => i.sort)) : 1;

		ul.scrollTop(0);

		Notes.EditNewName(li, i18n('Boxes.Notes.SideName'), (name) => {
			// on top of the list, where it was typed in
			Notes.Store.send({id: 'new', type: 'itm', name: name, grp: groupId, sort: first - 1}, 'Notes/set', (resp)=>{
				if (!Notes.SaveFailed(resp)) {
					Notes.notes = resp['notice'];
					const grpIdx = Notes.notes.findIndex(g => g.id == groupId),
						items = Notes.notes[grpIdx].items,
						newId = Math.max(...items.map(i => i.id));

					Notes.ActiveTab = grpIdx + 1;
					Notes.ActiveSubTab = items.findIndex(i => i.id === newId) + 1;
					Notes.FocusText = newId;
					Notes.buildBox();
				}
			});
		}, () => {
			if (ul.children('li').length === 0) ul.remove();
		});
	},


	/**
	 * Name input in a new tab or list entry
	 *
	 * @param li the new entry, removed again without a name
	 * @param placeholder
	 * @param onSave called with the cleaned name
	 * @param onCancel optional, after the entry is removed
	 */
	EditNewName: (li, placeholder, onSave, onCancel)=> {
		const input = $('<input type="text" class="notes-rename" />').attr('placeholder', placeholder);
		let done = false;

		const finish = (save) => {
			if (done) return;
			done = true;

			const name = MainParser.ClearText(input.val().trim());

			if (!save || name === '') {
				li.remove();
				if (onCancel) onCancel();
				return;
			}

			input.prop('disabled', true);
			onSave(name);
		};

		input
			.on('keydown', (e) => {
				e.stopPropagation();
				if (e.key === 'Enter') finish(true);
				if (e.key === 'Escape') finish(false);
			})
			.on('blur', () => finish(true))
			.on('click mousedown', (e) => e.stopPropagation());

		li.append($('<a />').append(input));
		input.trigger('focus');
	},


	/**
	 * @param resp answer of Notes.Store.send
	 * @returns {boolean} true after showing the error
	 */
	SaveFailed: (resp)=> {
		if (resp['status'] !== 'ERROR') {
			return false;
		}

		HTML.ShowToastMsg({
			head: 'Error',
			text: resp['msg'],
			type: 'error',
			hideAfter: 10000,
		});
		return true;
	},


	/**
	 * Save the content-text into the database (the heading is the page name, see SaveHeading)
	 *
	 * @param $this
	 * @constructor
	 */
	SaveContent: ($this)=> {
		let itmID = $this.data('id'),
			grpID = $this.data('parent'),
			cont = $this.find('.content-text').html();

		if(cont === null) {
			return;
		}

		// send content changes to server und change local object
		Notes.Store.send({id:itmID,grp:grpID,type:'cnt',cont:cont,apiToken:Notes.ApiToken}, 'Notes/set', (resp)=>{ // local store (Notes.Store) instead of the server

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

				Notes.notes[grpIdx].items[itmIdx]['content'] = cont;

				Notes.ActiveTab = (grpIdx + 1);
				Notes.ActiveSubTab = (itmIdx + 1);
			}
		});
	},


	/**
	 * The heading of a page is its name: saving it renames the page and its tab
	 *
	 * @param head the .content-head element
	 */
	SaveHeading: (head)=> {
		const id = head.closest('.sub-tab').data('id'),
			old = Notes.itemName(id),
			txt = MainParser.ClearText(head.text().trim());

		if (txt === '' || txt === old) {
			head.text(old);
			return;
		}

		Notes.Store.send({id: id, type: 'itm', name: txt}, 'Notes/set', (resp)=>{
			if(resp['status'] === 'ERROR') {
				head.text(old);
				HTML.ShowToastMsg({
					head: 'Error',
					text: resp['msg'],
					type: 'error',
					hideAfter: 10000,
				});
			}
			else {
				Notes.notes = resp['notice'];
				Notes.showItemName(id, txt);
			}
		});
	},


	/**
	 * @param id page id
	 * @returns {string} stored name of the page
	 */
	itemName: (id)=> {
		const item = (Notes.notes || []).flatMap(g => g.items).find(i => i.id == id);
		return item ? item.tab : '';
	},


	/**
	 * Shows a new page name in the tab (cut with ... when too long, full name in the tooltip) and the heading
	 *
	 * @param id page id
	 * @param name
	 */
	showItemName: (id, name)=> {
		const tabName = $(`#toolboxNotesBody .notes-name[data-type="itm"][data-id="${id}"]`);

		tabName.text(name);
		tabName.parents('a, li, ul').each(function(){ this.scrollLeft = 0; });

		const head = $(`#toolboxNotesBody #subtab-${id} .content-head`);
		if (!head.is(':focus')) {
			head.text(name);
		}
	},


	/**
	 * Tooltip of group and page tabs (customTooltip, shows at once unlike a title attribute):
	 * the full name, cut in the page list when too long, and how to rename
	 *
	 * @param e pointerenter event of the tab link
	 * @returns {string} HTML
	 */
	nameTT: (e)=> {
		const a = e.currentTarget,
			type = a.dataset.type,
			id = a.dataset.id,
			group = type === 'grp' ? (Notes.notes || []).find(g => g.id == id) : undefined,
			name = group ? group.group_name : Notes.itemName(id),
			esc = (text) => $('<div />').text(text).html();

		return `<div class="toolbox-tt">${esc(name)}${type === 'player' ? '' : `<small>${esc(i18n('Boxes.Notes.RenameHint'))}</small>`}</div>`;
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

		const order = (ul) => ul.children('li').not('.notes-fixed').map((idx, li) => ({ id: $(li).find('a').data('id'), sort: idx + 1 })).get();

		// the players group stays first, only the own groups move
		$('#toolboxNotesBody ul.horizontal').sortable({
			axis: 'x',
			distance: 5,
			items: '> li:not(.notes-fixed):not(.notes-new)',
			cancel: '.notes-del, input',
			stop: function() {
				$(this).prepend($(this).children('li.notes-fixed'));
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
	 * The tab row has no visible scrollbar (it covered the tabs), the mouse wheel scrolls it
	 * sideways like browser tab strips, and the open tab is scrolled into view.
	 */
	EnableTabScrolling: ()=> {
		const ul = $('#toolboxNotesBody ul.horizontal'),
			box = ul.parent(),
			// soft edges instead of hard cuts: left while tabs are scrolled away, right while more follow
			markMore = () => ul.each(function(){
				box
					.toggleClass('notes-tabs-more', this.scrollLeft + this.clientWidth < this.scrollWidth - 1)
					.toggleClass('notes-tabs-scrolled', this.scrollLeft > 0);
			});

		// the players tab sits left of the row, which starts right after it (its width depends on the font)
		const fixed = ul.children('li.notes-fixed');
		box[0].style.setProperty('--notes-fixed-w', (fixed.length ? Math.ceil(fixed.outerWidth()) + 2 : 0) + 'px');

		ul.off('scroll.notes').on('scroll.notes', markMore);

		ul.off('wheel.notes').on('wheel.notes', function(e){
			const ev = e.originalEvent,
				delta = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;

			if (this.scrollWidth <= this.clientWidth || delta === 0) return;

			this.scrollLeft += delta;
			e.preventDefault();
		});

		const active = ul.children('li.active')[0];
		if (active) {
			active.scrollIntoView({block: 'nearest', inline: 'nearest'});
		}

		markMore();
	},


	/**
	 * Trash icon of a group tab or page header
	 *
	 * @param type 'grp' or 'itm'
	 * @param id
	 * @returns {string} HTML
	 */
	deleteButton: (type, id)=> `<span class="notes-del fh-tooltip" role="button" data-type="${type}" data-id="${id}" ${ToolboxTT.attrs(i18n(type === 'grp' ? 'Boxes.Notes.DeleteGroup' : 'Boxes.Notes.DeleteItem'))}></span>`,


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
			pages > 0 ? $('<p />').addClass('notes-delete-text notes-delete-warning').text(HTML.i18nReplacer(i18n(pages === 1 ? 'Boxes.Notes.DeleteGroupPage' : 'Boxes.Notes.DeleteGroupPages'), { count: pages })) : '',
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

			// the wider input scrolled the tab (overflow hidden) to the left, the name would stay shifted
			name.parents('a, li, ul').each(function(){ this.scrollLeft = 0; });

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

					if (type === 'itm') {
						Notes.showItemName(id, txt);
					}
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

// the tooltip module resolves only known roots, Notes is registered here
Tooltips.register('Notes.nameTT', Notes.nameTT);
