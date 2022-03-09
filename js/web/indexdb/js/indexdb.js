/*
 * **************************************************************************************
 * Copyright (C) 2021 FoE-Helper team - All Rights Reserved
 * You may use, distribute and modify this code under the
 * terms of the AGPL license.
 *
 * See file LICENSE.md or go to
 * https://github.com/mainIine/foe-helfer-extension/blob/master/LICENSE.md
 * for full license details.
 *
 * **************************************************************************************
 */

/*
*   "neighborhoodAttacks" structure
*   {
*      playerId: number,
*       date: Date,
*       type: ACTION_TYPE_BATTLE_WIN | ACTION_TYPE_BATTLE_LOSS | ACTION_TYPE_BATTLE_SURRENDERED,
*       battle: {
*           myArmy: Unit[],
*           otherArmy: Unit[],
*           round: number,
*           auto: boolean,
*           era: string,
*       }
*   }
*   OR
*   {
*       playerId: number,
*       date: Date,
*       type: Looting.ACTION_TYPE_LOOTED,
*       resources: Object, //
*       doubleLoot: boolean | undefined, // double loot bonus is applied or not
*       doubleLootApplied: boolean // true when double bonus is applied
*       sp: number, * strategy points
*       important: boolean, // if not supplies or money only
*       entityId: number, // foe city entity Id
*       buildId: string, // key for BuildingNamesi18n
*   }
*   OR
*   {
*       type: Looting.ACTION_TYPE_SHIELDED,
*       playerId: number,
*       date: Date,
*       expireTime: number, // timestamp. usage: new Date(expireTime * 1000)
*   }
*   where Unit =
*   {
*       startHP: number, // usually 10
*       endHp: number,
*       attBoost: number,
*       defBoost: number,
*       unitTypeId: string,
*       ownerId: number, // other player id
*   }
*
*   "players" structure
*   {
*       id: number,
*       name: string,
*       clanId: number, // 0 if no clan
*       clanName: string | undefined,
*       avatar: string,
*       era: string | 'unknown',
*       date: new Date(), // last visit date
*   }
*
*   "greatbuildings" structure
*   {
*       id: number,
*       playerid: number,
*       name: string,
*       level: number,
*       currentfp: number,
*       bestratenettofp: number
*       bestratecosts: number,
*       date: new Date(), // last visit date
*   }
*  "statsGBGPlayers", Battle ground leader board
* {
*   date: Date,
*   players: {
*       id: number, // player id
*       n: number, // negotiations won
*       b: number, // battles won,
*       r: number, // rank
*   }[]
* }
* Structure of "statsGBGPlayerCache". Battle ground player cache
* {
*   id: number, // player id
*   name: string,
*   avatar: string,
*   date: Date
* }
* Structure of "statsRewards" db
* {
*   date: Date,
*   type: 'battlegrounds_conquest' | 'guildExpedition' | 'spoilsOfWar' | 'diplomaticGifts',
*   amount: number,
*   reward: string, // eg. resource#strategy_points#10
* }
* Structure "statsRewardTypes" db is same FOE "GenericReward" class
* {
*   "id": "premium_50",
*   "name": "50 Бриллиантов",
*   "description": "",
*   "iconAssetName": "diamond",
*   "isHighlighted": true,
*   "flags": ["rare"], // Note: flag is not rarity of guild expedition reward
*   "type": "resource",
*   "subType": "premium",
*   "amount": 50,
* }
* Structure of "statsUnitsD", "statsUnitsH"
* {
*   date: Date,
*   army: Object // key - id of unit, value - number of units
* }
* Structure of "statsTreasurePlayerH", "statsTreasurePlayerD" DBs
* {
*   date: Date,
*   resources: Object, // key is id of resource
* }
* Structure of "statsTreasureClanH", "statsTreasureClanD" DBs
* {
*   date: Date,
*   resources: Object,
*   clandId: number
* }
*/

let IndexDB = {
    db: null,

    _dbPromise: new Promise(resolveCb => window._dbPromiseResolver = resolveCb),


    /**
     * Resolve db when ready for using.
     * SHOULD be always used in FoEproxy.addHandler.
     * In Boxes you can use IndexDB.db
     * @returns {Promise<void>}
     */
    getDB: () => {
        return IndexDB._dbPromise;
    },


    Init: async (playerId) => {
        const primaryDBName = 'FoEToolboxDB_' + playerId; //Create different IndexDBs if two players are sharing the same PC playing on the same world
        const isNewDB = !await Dexie.exists(primaryDBName);

        const db = IndexDB.db = new Dexie(primaryDBName);
        IndexDB._applyIndexSchema(db);
        db.open();

        try {
            if (isNewDB) {
                await IndexDB.mergeDatabases(playerId);
            }
        } catch (e) {
            console.error(e);
        }
        window._dbPromiseResolver(db);

        setTimeout(() => {
            IndexDB.GarbageCollector();
        }, 10 * 1000);
    },

    // DB index schema
    _applyIndexSchema(db) {
        db.version(1).stores({
            players: 'id,date',
            neighborhoodAttacks: '++id,playerId,date,type',
            greatbuildings: '++id,playerId,name,&[playerId+name],level,currentFp,bestRateNettoFp,bestRateCosts,date',
            forgeStats: '++id,type,amount,date', // FP Collector
            statsGBGPlayers: 'date', // battleground
            statsGBGPlayerCache: 'id, date', // Cache of players for using in gbgPlayers
            statsRewards: 'date', // Collected rewards by Himeji, etc
            statsRewardTypes: 'id', // Human readable cache info about rewards
            statsUnitsD: 'date',
            statsUnitsH: 'date',
            statsTreasurePlayerH: 'date',
            statsTreasurePlayerD: 'date',
            statsTreasureClanH: 'date, clanId',
            statsTreasureClanD: 'date, clanId',
        });

        db.version(2).stores({
            players: 'id,date',
            neighborhoodAttacks: '++id,playerId,date,type',
            greatbuildings: '++id,playerId,name,&[playerId+name],level,currentFp,bestRateNettoFp,bestRateCosts,date',
            investhistory: '++id,playerId,entity_id,&[playerId+entity_id],name,level,max_progress,current_progress,profit,currentFp,fphistory,date',
            forgeStats: '++id,type,amount,date', // FP Collector
            statsGBGPlayers: 'date', // battleground
            statsGBGPlayerCache: 'id, date', // Cache of players for using in gbgPlayers
            statsRewards: 'date', // Collected rewards by Himeji, etc
            statsRewardTypes: 'id', // Human readable cache info about rewards
            statsUnitsD: 'date',
            statsUnitsH: 'date',
            statsTreasurePlayerH: 'date',
            statsTreasurePlayerD: 'date',
            statsTreasureClanH: 'date, clanId',
            statsTreasureClanD: 'date, clanId',
        });
    },

    /**
     * Database migration util function. Should be called once
     */
    mergeDatabases: async (playerId) => {
        // Skip if main db is not empty
        if (await IndexDB.db.players.count()) { return; }
        clearLog();

        //log('Looks like your db is empty, trying to populate db using old databases');

        let foeHelperPrivDB = null;
		let foeHelperDB = null;

        // DB from previous FoE Helper Private
        const foeHelperPrivDBName = 'FoeHelperPrivateDB_' + playerId;
        if (await Dexie.exists(foeHelperPrivDBName)) {
            foeHelperPrivDB = new Dexie(foeHelperPrivDBName);
            foeHelperPrivDB.version(1).stores({
                players: 'id,date',
				neighborhoodAttacks: '++id,playerId,date,type',
				greatbuildings: '++id,playerId,name,&[playerId+name],level,currentFp,bestRateNettoFp,bestRateCosts,date',
				forgeStats: '++id,type,amount,date', // FP Collector
                statsGBGPlayers: 'date', // battleground
				statsGBGPlayerCache: 'id, date', // Cache of players for using in gbgPlayers
				statsRewards: 'date', // Collected rewards by Himeji, etc
				statsRewardTypes: 'id', // Human readable cache info about rewards
				statsUnitsD: 'date',
				statsUnitsH: 'date',
				statsTreasurePlayerH: 'date',
				statsTreasurePlayerD: 'date',
				statsTreasureClanH: 'date, clanId',
				statsTreasureClanD: 'date, clanId',
            });
            foeHelperPrivDB.open();
            if (!(await foeHelperPrivDB.players.count())) {
                foeHelperPrivDB = null;
            }
        }
		
		const foeHelperDBName = 'FoeHelperDB_' + playerId;
		if (await Dexie.exists(foeHelperDBName)) {
            foeHelperDB = new Dexie(foeHelperDBName);
            foeHelperDB.version(1).stores({
				players: 'id,date',
				pvpActions: '++id,playerId,date,type',
				greatbuildings: '++id,playerId,name,&[playerId+name],level,currentFp,bestRateNettoFp,bestRateCosts,date',
				forgeStats: '++id,type,amount,date', // FP Collector
				statsGBGPlayers: 'date', // battleground
				statsGBGPlayerCache: 'id, date', // Cache of players for using in gbgPlayers
				statsRewards: 'date', // Collected rewards by Himeji, etc
				statsRewardTypes: 'id', // Human readable cache info about rewards
				statsUnitsD: 'date',
				statsUnitsH: 'date',
				statsTreasurePlayerH: 'date',
				statsTreasurePlayerD: 'date',
				statsTreasureClanH: 'date, clanId',
				statsTreasureClanD: 'date, clanId',
            });
            foeHelperDB.open();
            if (!(await foeHelperDB.players.count())) {
                foeHelperDB = null;
            }
        }

        if (foeHelperPrivDB) {
            log(`Found DB "${foeHelperPrivDBName}"`)
            await cloneTables(foeHelperPrivDB, {
                players: 'players',
				neighborhoodAttacks: 'neighborhoodAttacks',
				greatbuildings: 'greatbuildings',
				forgeStats: 'forgeStats', // FP Collector
				statsGBGPlayers: 'statsGBGPlayers',
				statsGBGPlayerCache: 'statsGBGPlayerCache',
				statsRewards: 'statsRewards',
				statsRewardTypes: 'statsRewardTypes', 
				statsUnitsD: 'statsUnitsD',
				statsUnitsH: 'statsUnitsH',
				statsTreasurePlayerH: 'statsTreasurePlayerH',
				statsTreasurePlayerD: 'statsTreasurePlayerD',
				statsTreasureClanH: 'statsTreasureClanH',
				statsTreasureClanD: 'statsTreasureClanD'
            });
        } else if (foeHelperDB) {
			log(`Found DB "${foeHelperDBName}"`)
            await cloneTables(foeHelperDB, {
				players: 'players',
				pvpActions: 'neighborhoodAttacks',
				greatbuildings: 'greatbuildings',
				forgeStats: 'forgeStats', // FP Collector
				statsGBGPlayers: 'statsGBGPlayers',
				statsGBGPlayerCache: 'statsGBGPlayerCache',
				statsRewards: 'statsRewards',
				statsRewardTypes: 'statsRewardTypes', 
				statsUnitsD: 'statsUnitsD',
				statsUnitsH: 'statsUnitsH',
				statsTreasurePlayerH: 'statsTreasurePlayerH',
				statsTreasurePlayerD: 'statsTreasurePlayerD',
				statsTreasureClanH: 'statsTreasureClanH',
				statsTreasureClanD: 'statsTreasureClanD'
            });
		}
		
        log('Deleting old databases');
        await Dexie.delete(foeHelperPrivDBName);
		await Dexie.delete(foeHelperDBName);
        log('Done.');

        // Copy tables.
        // Basicly this is not transaction safe to bulkAdd, but we can ignore it because
        // `await getDb()` is used before insert or update.
        async function cloneTables(source, tables) {
            const destTables = Object.keys(tables);
            for (let destTable of destTables) {
                const sourceTable = tables[destTable];
                log(`  Copy ${sourceTable} => ${destTable}...`);
                await IndexDB.db[destTable].clear();
                await IndexDB.db[destTable].bulkAdd(await source[sourceTable].toArray());
            }
        }

        function clearLog() {
            localStorage.setItem('FH_IndexDBLastMigraion', '');
        }

        function log(text) {
            console.log('mergeDatabases: ' + text);
            let logTxt = localStorage.getItem('FH_IndexDBLastMigraion') || '';
            logTxt += text + '\n';
            localStorage.setItem('FH_IndexDBLastMigraion', logTxt);
        }
    },


    /**
     * Util function for making backup of db easier
     * @example
     *   // copy with name + _copy
     *   IndexDB.cloneDB('PlayerDB');
     *   // equals to
     *   IndexDB.cloneDB('PlayerDB', 'PlayerDB_copy');
     *   // copy and set version to 1
     *   IndexDB.cloneDB('PlayerDB', 'PlayerDB_copy', 1);
     */
    cloneDB: async (srcName, dstName, version) => {
        dstName = dstName || srcName + '_copy';
        const sdb = new Dexie(srcName),
              ddb = new Dexie(dstName);

        if (await Dexie.exists(dstName)) {
            console.error(`Aborted. Please firstly delete "${dstName}" before continue.`);
            return false;
        }

        return sdb.open().then(() => {
            // Clone scheme
            version = version || sdb.verno;
            console.log(`Cloning DB "${srcName}" v${sdb.verno} => "${dstName}" v${version}`);

            console.log('Dumping schema...');
            const schema = sdb.tables.reduce((result, table) => {
                console.log(` => ${table.name}...`);
                result[table.name] = (
                    [table.schema.primKey]
                        .concat(table.schema.indexes)
                        .map(indexSpec => indexSpec.src)
                ).toString();
                return result;
            }, {});
            console.log('Schema:', schema);
            ddb.version(version).stores(schema);

            return sdb.tables.reduce(
                (result, table) => result
                    .then(() => console.log(`Cloning table ${table.name}...`))
                    .then(() => table.toArray())
                    .then(rows => ddb.table(table.name).bulkAdd(rows) ),
                Promise.resolve()
            ).then((x) => {
                sdb.close();
                ddb.close();
                console.log(`Clonning DB is finished, created "${dstName}"`);
            })
        });
    },


    /**
    * Remove old records from db to avoid overflow
    *
    * @returns {Promise<void>}
    */
    GarbageCollector: async () => {
        const neighborhoodAttackExpiryTime = moment().subtract(1, 'years').toDate();
		// Expiry time for db with 1 record per day
        const daylyExpiryTime = moment().subtract(1, 'years').toDate();
        // Expiry time for db with 1 record per hour
        const hourlyExpiryTime = moment().subtract(8, 'days').toDate();
        // Keep logs for guild battlegrounds for 2 weeks
        const gbgExpiryTime = moment().subtract(2, 'weeks').toDate();

        await IndexDB.getDB(); 
        await IndexDB.db.neighborhoodAttacks
            .where('date').below(neighborhoodAttackExpiryTime)
            .delete();

        // Remove expired city shields
        await IndexDB.db.neighborhoodAttacks
            .where('type').equals(5)
            .and((item)=>{ return item.expireTime < moment().unix() })
            .delete();

        await IndexDB.db.players
            .where('date').below(neighborhoodAttackExpiryTime)
            .delete();

        let LeftPlayers = await IndexDB.db.players
            .where('id').above(0)
            .keys();

        await IndexDB.db.greatbuildings
            .where('playerId').noneOf(LeftPlayers)
            .delete();

        for (const table of ['statsRewards', 'statsUnitsD', 'statsTreasurePlayerD', 'statsTreasureClanD']) {
            await IndexDB.db[table].where('date').below(daylyExpiryTime).delete();
        }

        for (const table of ['statsUnitsH', 'statsTreasurePlayerH', 'statsTreasureClanH']) {
            await IndexDB.db[table].where('date').below(hourlyExpiryTime).delete();
        }

        for (const table of ['statsGBGPlayers', 'statsGBGPlayerCache']) {
            await IndexDB.db[table].where('date').below(gbgExpiryTime).delete();
        }
    },


    /**
     * Calculate estimated space used in db
     * In fact db is more compact than returned value because this is not json
     */
    calculateSpace: async () => {
        let totalSize = 0;
        const db = IndexDB.db;
        for (let table of db.tables.map(it => it.name)) {
            const data = await db[table].limit(20).toArray();
            const count = await db[table].count();
            const sizePerItemBytes = (new Blob([JSON.stringify(data)]).size) / data.length;
            totalSize += count * sizePerItemBytes;
        }
        return parseInt(totalSize);
    },


    /**
     * Add user from PlayerDict if not added, without era information
     *
     * @param playerId
     * @param updateDate
     * @returns {Promise<void>}
     */
    addUserFromPlayerDictIfNotExists: (playerId, updateDate) => {
		let player = PlayerDict[playerId];
		let promise = new Promise((resolve, reject)=>{});
		return IndexDB.loadPlayer(playerId).then((playerFromDB) => {
			if (!playerFromDB) {
				if (player) {
					promise = IndexDB.db.players.add({
						id: playerId,
						name: player.PlayerName,
						clanId: player.ClanId || 0,
						clanName: player.ClanName,
						avatar: player.Avatar,
						era: player.Era || 'unknown',
						score: player.Score,
						lastScoreChangeDate: player.ScoreDate,
						lastScoreReceiveData:player.ScoreReceiveDate, 
						wonBattles: player.WonBattles,
						lastWonBattlesChangeDate: player.WonBattlesDate,
						lastWonBattlesReceiveDate: player.WonBattlesReceiveDate,
						date: MainParser.getCurrentDate(),
					});
				}
			}
			else if (updateDate) {
				promise = IndexDB.db.players.update(playerId, {
					era: player.Era,
					score: player.Score,
					lastScoreChangeDate: player.ScoreDate,
					lastScoreReceiveData:player.ScoreReceiveDate, 
					wonBattles: player.WonBattles,
					lastWonBattlesChangeDate: player.WonBattlesDate,
					lastWonBattlesReceiveDate: player.WonBattlesReceiveDate,
					date: MainParser.getCurrentDate(),
				});
			}
		}).catch((error) => {
			promise.reject(error);
		});
		return promise;
    },
	
	loadPlayer: (playerId) => {
		return IndexDB.getDB().then(() => {
			return IndexDB.db.players.get(playerId);
		}); 
	}
};
