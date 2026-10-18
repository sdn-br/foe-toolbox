/*
 * **************************************************************************************
 *
 * FoE Toolbox: extensions of MainParser (_main.js), kept out of the upstream file.
 * Upstream functions are only wrapped (original called, toolbox code before or after),
 * the list of wrapped functions is in docs/helfer-migration.md.
 *
 * Timing: _main.js runs before all modules, but FoEproxy queues every response until
 * all scripts (including js/toolbox.json) are loaded. Handlers registered here therefore
 * also see StartupService and the metadata, after the handlers of _main.js.
 *
 * You may use, distribute and modify this code under the terms of the AGPL license.
 * See file LICENSE.md for full license details.
 *
 * **************************************************************************************
 */

// base version of the FoE Helfer this toolbox is built on (see inject.js), global like extVersion
const extBaseVersion = ExtbaseData.extBaseVersion;


Object.assign(MainParser, {

	/**
	 * Whether data may be sent to the foe-helper API (setting GlobalSend, default off).
	 * Reads localStorage directly, some handlers run before the settings (config.json) are loaded.
	 *
	 * @returns {boolean}
	 */
	IsGlobalSendEnabled: () => (localStorage.getItem('GlobalSend') === 'true'),


	/**
	 * Replaces fetch in MainParser.send2Server (1 marked line there): the request runs in the
	 * background script (background.js, type send2Server). Returns the part of a fetch
	 * Response that send2Server reads.
	 *
	 * @param {string} url as built by send2Server
	 * @param {{body: string}} init
	 * @returns {Promise<{status: number, statusText: string, json: function(): Promise<any>}>}
	 */
	fetchViaBackground: async (url, init) => {
		const params = new URL(url).searchParams;

		const response = await MainParser.sendExtMessage({
			type: 'send2Server',
			url: ApiURL,
			endpoint: url.slice(ApiURL.length).split('/?')[0],
			playerId: params.get('player_id'),
			guildId: params.get('guild_id'),
			world: params.get('world'),
			data: JSON.parse(init.body).data
		});

		// sendExtMessage has logged the reason already
		if (!response) throw new Error('no response from the background script');

		return {
			status: response.status,
			statusText: response.statusText,
			json: () => (response.body === null ? Promise.reject(new Error(response.error)) : Promise.resolve(response.body))
		};
	},


	/**
	 * Load a player from the IndexDB into the PlayerDict
	 * if it is not known in this session yet
	 *
	 * @param PlayerID
	 * @returns {Promise<void>}
	 */
	loadPlayerIntoDict: (PlayerID) => {
		if (PlayerDict[PlayerID] !== undefined) return Promise.resolve();

		return IndexDB.loadPlayer(PlayerID).then(PlayerFromDB => {
			if (!PlayerFromDB || PlayerDict[PlayerID] !== undefined) return;

			let Player = PlayerDict[PlayerID] = { PlayerID: PlayerID };
			if (PlayerFromDB['name'] !== undefined) Player['PlayerName'] = PlayerFromDB['name'];
			if (PlayerFromDB['clanName'] !== undefined) Player['ClanName'] = PlayerFromDB['clanName'];
			if (PlayerFromDB['clanId'] !== undefined) Player['ClanId'] = PlayerFromDB['clanId'];
			if (PlayerFromDB['avatar'] !== undefined) Player['Avatar'] = PlayerFromDB['avatar'];
			if (PlayerFromDB['era'] !== undefined && PlayerFromDB['era'] !== 'unknown') Player['Era'] = PlayerFromDB['era'];
			if (PlayerFromDB['score'] !== undefined) Player['Score'] = PlayerFromDB['score'];
			if (PlayerFromDB['wonBattles'] !== undefined) Player['WonBattles'] = PlayerFromDB['wonBattles'];
			if (PlayerFromDB['lastWonBattlesReceiveDate'] !== undefined) Player['WonBattlesReceiveDate'] = PlayerFromDB['lastWonBattlesReceiveDate'];
			if (PlayerFromDB['lastWonBattlesChangeDate'] !== undefined) Player['WonBattlesDate'] = PlayerFromDB['lastWonBattlesChangeDate'];
			// Toolbox 1.x wrote the misspelled "lastScoreReceiveData"
			let ScoreReceiveDate = PlayerFromDB['lastScoreReceiveDate'] || PlayerFromDB['lastScoreReceiveData'];
			if (ScoreReceiveDate !== undefined) Player['ScoreReceiveDate'] = ScoreReceiveDate;
			if (PlayerFromDB['lastScoreChangeDate'] !== undefined) Player['ScoreDate'] = PlayerFromDB['lastScoreChangeDate'];
		}).catch(e => console.error(e));
	},
});


// Nothing is sent to the foe-helper API without GlobalSend (getWorlds, SelfPlayer, SendLGData, ...).
// The API gets the version of the FoE Helfer the data format comes from, not the toolbox version.
{
	const sendExtMessage = MainParser.sendExtMessage;

	MainParser.sendExtMessage = (data) => {
		if (data?.type === 'send2Api') {
			if (!MainParser.IsGlobalSendEnabled()) return Promise.resolve();

			data = Object.assign({}, data, { url: data.url.replace('&v=' + extVersion, '&v=' + extBaseVersion) });
		}
		return sendExtMessage(data);
	};
}


// Only with the setting GlobalSend (default off) or an explicit, confirmed user action (forceSend)
{
	const send2Server = MainParser.send2Server;

	MainParser.send2Server = (data, ep, successCallback, errorCallback, forceSend = false) => {
		if (!MainParser.IsGlobalSendEnabled() && !forceSend) return;

		return send2Server(data, ep, successCallback, errorCallback);
	};
}


// Derived flags on every CityEntity, used by the city information (plunder helper) and the PvP history
{
	const correctBuildingType = MainParser.correctBuildingType;

	MainParser.correctBuildingType = () => {
		correctBuildingType();
		setEntityFlags();
	};

	/**
	 * - `is_motivatable`, `is_polishable`: can be motivated / polished
	 * - `chainId`, `is_chainBuilding`, `is_chainStartBuilding`, `bonus_multiplier`
	 *   (number of link positions of the chain building)
	 * - `is_outpostBuilding`: placed on another grid than the main city
	 * - `is_plunderable`: production can be plundered by neighbours
	 *
	 * Classic entities carry this information as `abilities`, generic entities
	 * (`GenericCityEntity`) as `components.AllAge` (same sources as `CityBuildings`).
	 * Needs the types from `correctBuildingType`.
	 */
	function setEntityFlags() {
		for (let id in MainParser.CityEntities) {
			if (!MainParser.CityEntities.hasOwnProperty(id)) continue;

			let e = MainParser.CityEntities[id],
				abilities = e.abilities || [],
				isGeneric = (e.__class__ === 'GenericCityEntity'),
				hasAbility = (cls) => abilities.some(a => a.__class__ === cls),
				interaction = e.components?.AllAge?.socialInteraction?.interactionType;

			e.is_motivatable = hasAbility('MotivatableAbility') || (isGeneric && interaction === 'motivate');
			e.is_polishable = hasAbility('PolishableAbility') || (isGeneric && interaction === 'polish');

			e.chainId = '';
			e.is_chainBuilding = false;
			e.is_chainStartBuilding = false;
			e.bonus_multiplier = 1;

			let chain = (isGeneric ? e.components?.AllAge?.chain : undefined);
			if (chain?.chainId) {
				e.chainId = chain.chainId;
				e.is_chainBuilding = true;
				e.is_chainStartBuilding = (chain.config?.__class__ === 'ChainStartConfig');
				if (chain.linkPositions !== undefined) e.bonus_multiplier = chain.linkPositions.length;
			}
			else {
				let chainAbility = abilities.find(a => a.chainId !== undefined);
				if (chainAbility) {
					e.chainId = chainAbility.chainId;
					e.is_chainBuilding = true;
				}
				e.is_chainStartBuilding = hasAbility('ChainStartAbility');
				abilities.forEach(a => {
					if (a.chainId !== undefined && a.linkPositions !== undefined) {
						e.bonus_multiplier = a.linkPositions.length;
					}
				});
			}

			e.is_outpostBuilding = abilities.some(a => a.gridId !== undefined && a.gridId !== 'main');

			e.is_plunderable = (
				!e.is_outpostBuilding && (
					e.type === 'production' || e.type === 'goods' || (
						(e.type === 'residential' || e.type === 'clan_power_production' || (e.type === undefined && isGeneric)) &&
						!hasAbility('AddResourcesToGuildTreasuryAbility') &&
						!hasAbility('RandomChestRewardAbility') &&
						!hasAbility('NotPlunderableAbility')
					)
				)
			);
		}
	}
}


// PlayerDict: the toolbox also tracks activity (IsActive, when score and won battles were last
// received and last seen rising) and stores every player in the IndexDB (table players).
// UpdatePlayerDict returns a promise that resolves when all its players are written.
{
	const updatePlayerDict = MainParser.UpdatePlayerDict,
		updatePlayerDictCore = MainParser.UpdatePlayerDictCore;

	// DB writes started by the current (synchronous) UpdatePlayerDict call
	let pendingWrites = null;

	MainParser.UpdatePlayerDict = (d, Source, ListType = undefined) => {
		const outer = pendingWrites,
			writes = pendingWrites = [];

		try {
			updatePlayerDict(d, Source, ListType);
			updatePlayerDictToolbox(d, Source);
		}
		finally {
			pendingWrites = outer;
		}

		return Promise.all(writes).then(() => undefined);
	};

	MainParser.UpdatePlayerDictCore = (Player) => {
		let PlayerID = Player?.['player_id'];
		// the original ignores players without id (and throws without a player)
		if (PlayerID === undefined) return Promise.resolve();

		updatePlayerDictCore(Player);

		// player left the guild, drop the outdated guild name
		if (Player['clan_id'] === 0 && Player['clan'] === undefined) delete PlayerDict[PlayerID]['ClanName'];
		if (Player['is_active'] !== undefined) PlayerDict[PlayerID]['IsActive'] = Player['is_active'];

		const write = IndexDB.loadPlayer(PlayerID).then((PlayerFromDB) => {
			let p = PlayerDict[PlayerID],
				now = MainParser.getCurrentDate();

			if (PlayerFromDB) {
				p['WonBattlesReceiveDate'] = (p['WonBattles'] !== undefined ? now : PlayerFromDB.lastWonBattlesReceiveDate);
				p['WonBattlesDate'] = ((PlayerFromDB.wonBattles === undefined && p['WonBattles'] !== undefined) || PlayerFromDB.lastWonBattlesChangeDate === undefined || PlayerFromDB.wonBattles < p['WonBattles'] ? now : PlayerFromDB.lastWonBattlesChangeDate);
				p['ScoreReceiveDate'] = (p['Score'] !== undefined ? now : (PlayerFromDB.lastScoreReceiveDate || PlayerFromDB.lastScoreReceiveData));
				p['ScoreDate'] = ((PlayerFromDB.score === undefined && p['Score'] !== undefined) || PlayerFromDB.lastScoreChangeDate === undefined || PlayerFromDB.score < p['Score'] ? now : PlayerFromDB.lastScoreChangeDate);
			}
			else {
				p['WonBattlesReceiveDate'] = (p['WonBattles'] !== undefined ? now : undefined);
				p['WonBattlesDate'] = (p['WonBattles'] !== undefined ? now : undefined);
				p['ScoreReceiveDate'] = (p['Score'] !== undefined ? now : undefined);
				p['ScoreDate'] = (p['Score'] !== undefined ? now : undefined);
			}

			return IndexDB.addUserFromPlayerDictIfNotExists(PlayerID, true);
		}).catch(e => console.error(e));

		pendingWrites?.push(write);
		return write;
	};

	// sources upstream does not know, the original ignores them
	function updatePlayerDictToolbox(d, Source) {
		// OtherPlayerService.getOtherPlayerVO
		if (Source === 'PlayerVO') {
			MainParser.UpdatePlayerDictCore(d);
		}

		// OtherPlayerService.getEventsPaginated
		else if (Source === 'Events') {
			for (let i in d?.events) {
				if (d.events[i].other_player !== undefined) {
					MainParser.UpdatePlayerDictCore(d.events[i].other_player);
				}
			}
		}

		// OtherPlayerService.visitPlayer, called by the toolbox modules
		else if (Source === 'VisitPlayer') {
			if (d?.other_player) {
				let Player = d.other_player;
				if (Player['era'] === undefined && d['other_player_era'] !== undefined) {
					Player = Object.assign({}, Player, { era: d['other_player_era'] });
				}
				MainParser.UpdatePlayerDictCore(Player);
			}
		}

		// PVPArenaService.getOverview
		else if (Source === 'PvPArena') {
			for (let i in d?.opponents) {
				if (!d['opponents'].hasOwnProperty(i)) continue;
				let Player = d['opponents'][i]?.opposingPlayer?.player;
				if (Player) MainParser.UpdatePlayerDictCore(Player);
			}
		}
	}
}


// Player profile, event history and PvP arena also update the player data.
// Registered before the other toolbox modules (first in js/toolbox.json), their handlers read the PlayerDict.
FoEproxy.addHandler('OtherPlayerService', 'getOtherPlayerVO', (data, postData) => {
	MainParser.UpdatePlayerDict(data.responseData, 'PlayerVO');
});

FoEproxy.addHandler('OtherPlayerService', 'getEventsPaginated', (data, postData) => {
	MainParser.UpdatePlayerDict(data.responseData, 'Events');
});

FoEproxy.addHandler('PVPArenaService', 'getOverview', (data, postData) => {
	MainParser.UpdatePlayerDict(data.responseData, 'PvPArena');
});


// DBs of the toolbox modules, after the handler of _main.js has set ExtPlayerID
FoEproxy.addHandler('StartupService', 'getData', (data, postData) => {
	GBGActionLog.checkForDB(ExtPlayerID);
	Notes.Store.checkForDB(ExtPlayerID);
});
