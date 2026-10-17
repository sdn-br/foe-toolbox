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

FoEproxy.addHandler('HiddenRewardService', 'getOverview', (data, postData) => {
    let fromHandler = true;
    HiddenRewards.Cache = HiddenRewards.prepareData(data.responseData.hiddenRewards);

    HiddenRewards.GEprogress = JSON.parse(localStorage.getItem('HiddenRewards.GEprogress')||'0');

    HiddenRewards.RefreshGui(fromHandler);
    if (HiddenRewards.FirstCycle) { //Timer setzen
        HiddenRewards.FirstCycle = false;
        data.responseData.hiddenRewards.forEach(x=>{
            if (x.startTime && x.startTime>GameTime.get())
                setTimeout(HiddenRewards.RefreshGui, (x.startTime+5-GameTime.get())*1000)
        })
    }
});

FoEproxy.addHandler('GuildExpeditionService', 'getOverview', (data, postData) => {
    HiddenRewards.GEprogress = data?.responseData?.progress?.currentEntityId || 0;
    localStorage.setItem('HiddenRewards.GEprogress', JSON.stringify(HiddenRewards.GEprogress));
    HiddenRewards.RefreshGui();
});

FoEproxy.addHandler('GuildExpeditionService', 'getState', (data, postData) => {
    for (let x in data.responseData) {
        if (!data.responseData.hasOwnProperty(x)) continue;
        if (!data.responseData[x].hasOwnProperty('currentEntityId')) continue;
        HiddenRewards.GEprogress = data.responseData[x].currentEntityId;
        localStorage.setItem('HiddenRewards.GEprogress', JSON.stringify(HiddenRewards.GEprogress));
        HiddenRewards.RefreshGui();
    }
});


/**
 *
 * @type {{init: HiddenRewards.init, prepareData: HiddenRewards.prepareData, BuildBox: HiddenRewards.BuildBox, RefreshGui: HiddenRewards.RefreshGui, Cache: null, FilteredCache : null, FirstCycle : true, GEprogress:0, GElookup:[0,0,1,1,1,2,2,3,3,3]}}
 */
let HiddenRewards = {

    Cache: null,
    FilteredCache : null,
    FutureCache : [], // TOOLBOX: events that have not started yet
    FirstCycle: true,
    GEprogress:0,
    GElookup:[0,0,1,1,1,2,2,3,3,3],

	/**
	 * Box in den DOM
	 */
    init: () => {
        if ($('#HiddenRewardBox').length < 1) {

            HTML.AddCssFile('hidden-rewards');

            HTML.Box({
                'id': 'HiddenRewardBox',
                'title': i18n('Boxes.HiddenRewards.Title'),
                'ask': i18n('Boxes.HiddenRewards.HelpLink'),
                'auto_close': true,
                'dragdrop': true,
                'minimize': true,
                'resize': true,
                settings: () => HiddenRewards.ShowSettingsButton(),
			    active_maps:"main"
            });

            //moment.locale(18n('Local'));

            HiddenRewards.RefreshGui();

        } else {
            HTML.CloseOpenBox('HiddenRewardBox');
        }
    },


	/**
	 * Daten aufbereiten
	 */
    prepareData: (Rewards) => {
        let data = [];

        for (let idx in Rewards) {
            if (!Rewards.hasOwnProperty(idx)) continue;

            let position = Rewards[idx].position.context;
            let positionX = Rewards[idx].position.position || 0;
            let isGE = false;
            let SkipEvent = true;
            let twolane = false

            // prüfen ob der Spieler in seiner Stadt eine zweispurige Straße hat
            if (position === 'cityRoadBig') {
                if (CurrentEraID >= Technologies.Eras.ProgressiveEra) SkipEvent = false
                twolane = true
            }
            else {
                SkipEvent = false;
            }
            if (position === 'cityUnderwater') {
                SkipEvent = true;
            }

            if (position === 'guildExpedition') isGE = true;

            if (SkipEvent) {
                continue;
            }

            const positionI18nLookupKey = 'HiddenRewards.Positions.' + position;
            const positionI18nLookup = i18n('HiddenRewards.Positions.' + position);

            if (positionI18nLookupKey !== positionI18nLookup) {
                position = positionI18nLookup;
            }

            data.push({
                type: Rewards[idx].type,
                position: position,
                starts: Rewards[idx].startTime,
                expires: Rewards[idx].expireTime,
                isGE: isGE,
                positionGE: positionX,
                twolane: twolane
            });
        }

        data.sort(function (a, b) {
            if (a.expires < b.expires) return -1;
            if (a.expires > b.expires) return 1;
            return 0;
        });

        return data;
    },

    /**
     * Filtert den Cache erneut basierend auf aktueller Zeit + aktualisiert Counter/Liste falls nötig
     *
     */
    RefreshGui: (fromHandler = false) => {
        HiddenRewards.FilteredCache = [];
        HiddenRewards.FutureCache = []; // TOOLBOX: future events, Cache is unset before the first event list
        if (!HiddenRewards.Cache) return;

        for (let i = 0; i < HiddenRewards.Cache.length; i++) {
	    let StartTime = moment.unix(HiddenRewards.Cache[i].starts|0),
		EndTime = moment.unix(HiddenRewards.Cache[i].expires);
            HiddenRewards.Cache[i].isVis = true;
            if (EndTime < MainParser.getCurrentDateTime()) continue; // TOOLBOX: future events are collected below
            if (HiddenRewards.Cache[i].isGE && !(HiddenRewards.GElookup[HiddenRewards.Cache[i].positionGE] <= Math.floor((HiddenRewards.GEprogress % 32)/8))) {
                HiddenRewards.Cache[i].isVis = false;
            }
            // TOOLBOX: future events get their own list and counter
            if (StartTime > MainParser.getCurrentDateTime()) {
                HiddenRewards.FutureCache.push(HiddenRewards.Cache[i]);
                continue;
            }
            HiddenRewards.FilteredCache.push(HiddenRewards.Cache[i]);
        }

        HiddenRewards.SetCounter();

        if ($('#HiddenRewardBox').length >= 1) {
            if(fromHandler && HiddenRewards.FilteredCache.length === 0 && HiddenRewards.FutureCache.length === 0 && $('#HiddenRewardBox').length) // TOOLBOX: future events
            {
                $('#HiddenRewardBox').fadeOut('500', function() {
                    $(this).remove();
                });
            }
            else
            {
                HiddenRewards.BuildBox();
            }
        }
    },


	/**
	 * Inhalt der Box in den BoxBody legen
	 */
    BuildBox: () => {
        let h = [];

        let twolane = 0 < [...new Set(Object.values(MainParser.CityMapData).filter(x=>x.type=="street").map(x=>x.cityentity_id))].filter(x=>MainParser.CityEntities[x].requirements.street_connection_level == 2).length
        let warning = HiddenRewards.FilteredCache.filter(x=>x.twolane).length > 0 && !twolane
        if (warning) {
            h.push(`<div class="dark-bg"><div class="warning">${i18n("Boxes.HiddenRewards.twolaneWarning")}</div></div>`)
        }
        h.push('<table class="foe-table">');

        h.push('<thead>');
        h.push('<tr>');
        h.push('<th>' + i18n('HiddenRewards.Table.type') + '</th>');
        h.push('<th>' + i18n('HiddenRewards.Table.position') + '</th>');
        h.push('<th>' + i18n('HiddenRewards.Table.expires') + '</th>');
        h.push('</tr>');
        h.push('</thead>');

        h.push('<tbody>');

        // TOOLBOX: active events first, then the future ones ("Erscheint ...")
        const Events = (HiddenRewards.FilteredCache || []).concat(HiddenRewards.FutureCache || []);

        if (Events.length > 0) {
            for (let idx in Events) {

                if (!Events.hasOwnProperty(idx)) { // TOOLBOX: active and future events
                    break;
                }

                let hiddenReward = Events[idx], // TOOLBOX: active and future events
                    isFuture = HiddenRewards.FutureCache.includes(hiddenReward);


                h.push(`<tr ${!hiddenReward.isVis ? 'class="unavailable"':''}>`);
                let img =  hiddenReward.type;
                if (hiddenReward.type.indexOf('outpost') > -1) {
                    img = 'Shard_' + hiddenReward.type.substr(hiddenReward.type.length-2, 2);
                }
                h.push('<td class="incident" title="' + HTML.i18nTooltip(hiddenReward.type) + '"><img src="' + extUrl + 'js/web/hidden-rewards/images/' + img + '.png" alt=""></td>');
                h.push('<td>' + hiddenReward.position + '</td>');
                // TOOLBOX-BEGIN: future events show when they appear
                if (isFuture) {
                    h.push('<td class="warning">' + i18n('Boxes.HiddenRewards.Appears') + ' ' + moment.unix(hiddenReward.starts).fromNow() + '</td>');
                }
                else {
                    h.push('<td class="">' + i18n('Boxes.HiddenRewards.Disappears') + ' ' + moment.unix(hiddenReward.expires).fromNow() + '</td>');
                }
                // TOOLBOX-END
                h.push('</tr>');
            }
        }
        else {
            h.push('<td colspan="3">' + i18n('Boxes.HiddenRewards.NoEvents') + '</td>');
        }

        h.push('</tbody>');

        h.push('</table>');

        $('#HiddenRewardBoxBody').html(h.join(''));
    },


	SetCounter: ()=> {
	// TOOLBOX-BEGIN: counting moved to GetCount for the second counter
        let CountRelics = JSON.parse(localStorage.getItem('CountRelics') || 0);

        let count = HiddenRewards.GetCount(HiddenRewards.FilteredCache, CountRelics);
        $('#hidden-reward-count').text(count).toggle(count > 0);

        // TOOLBOX: own counter for future events
        let futureCount = HiddenRewards.GetCount(HiddenRewards.FutureCache, CountRelics);
        $('#hidden-future-reward-count').text(futureCount).toggle(futureCount > 0);
        // TOOLBOX-END
	},


	// TOOLBOX-BEGIN
	/**
	 * Number of events in a list, depending on the setting CountRelics
	 * (0 = all, 1 = only visible ones, 2 = without guild expedition)
	 *
	 * @param {Object[]} list
	 * @param {number} CountRelics
	 * @returns {number}
	 */
	GetCount: (list, CountRelics) => {
        list = list || [];
        if (CountRelics == 1) return list.filter(x => x.isVis).length;
        if (CountRelics == 2) return list.filter(x => !x.isGE).length;
        return list.length;
	},
	// TOOLBOX-END

    ShowSettingsButton: () => {
        let CountRelics = JSON.parse(localStorage.getItem('CountRelics') || 0);
        let h = [];
        h.push(`<p class="text-center"><label for="countrelics">${i18n('Settings.CountRelics')}<label><br>`);
        h.push(`<select oninput="HiddenRewards.SaveSettings(this.value)"/><option value="0" ${CountRelics == 0 ? 'selected="selected"': ''}>${i18n('Boxes.HiddenRewards.CountAll')} </option><option value="1" ${CountRelics == 1 ? 'selected="selected"': ''}>${i18n('Boxes.HiddenRewards.onlyVis')} </option><option value="2" ${CountRelics == 2 ? 'selected="selected"': ''}>${i18n('Boxes.HiddenRewards.none')} </option></p>`);
        $('#HiddenRewardBoxSettingsBox').html(h.join(''));
    },

    /**
    *
    */
    SaveSettings: (value='0') => {
        localStorage.setItem('CountRelics', value);
        HiddenRewards.SetCounter();
    },
};
