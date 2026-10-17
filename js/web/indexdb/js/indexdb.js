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

/*
*   Toolbox tables (kept across starts, see GarbageCollector)
*
*   "neighborhoodAttacks" structure (PvP history of the toolbox, replaces the unused upstream "pvpActions")
*   {
*       playerId: number,
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
*       resources: Object,
*       doubleLoot: boolean | undefined, // double loot bonus is applied or not
*       doubleLootApplied: boolean // true when double bonus is applied
*       sp: number, // strategy points
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
*       score: number | undefined,
*       lastScoreChangeDate: Date | undefined, // last time the score was seen rising
*       lastScoreReceiveDate: Date | undefined, // last time the score was received
*       wonBattles: number | undefined,
*       lastWonBattlesChangeDate: Date | undefined,
*       lastWonBattlesReceiveDate: Date | undefined,
*       date: Date, // last time the player was seen
*   }
*
*   "greatbuildings" structure
*   {
*       id: number,
*       playerId: number,
*       name: string,
*       level: number,
*       currentFp: number,
*       bestRateNettoFp: number
*       bestRateCosts: number,
*       date: Date, // last visit date
*   }
*
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
        db.open().catch((e) => {
            //console.error(e);
            setTimeout(() => {
                IndexDB.Init(playerId);
            }, 100);
        });

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
            IndexDB.rewardDBCleanup()
        }, 10 * 1000);
    },

    // DB index schema
    _applyIndexSchema(db) {
        db.version(1).stores({
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

        db.version(2).stores({
            players: 'id,date',
            pvpActions: '++id,playerId,date,type',
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
        db.version(3).stores({
            buildingMeta: 'id, hash, json',
            // Toolbox 1.x table (PvP attacks). Declared here so that upgrading an existing
            // FoEToolboxDB_ (schema v2) does not drop it; Dexie deletes undeclared tables on upgrade.
            neighborhoodAttacks: '++id,playerId,date,type',
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

        // Take over the data of a previous "FoE Helper Private" or FoE Helfer installation.
        // Both run in the game page as well, so their DBs are visible in this origin.
        // The source DBs are opened without a declared schema (Dexie dynamic mode),
        // so it does not matter which schema version they have.
        const foeHelperPrivDBName = 'FoeHelperPrivateDB_' + playerId;
        const foeHelperDBName = 'FoeHelperDB_' + playerId;

        let sourceDBName = foeHelperPrivDBName;
        let sourceDB = await openIfFilled(foeHelperPrivDBName);
        if (!sourceDB) {
            sourceDBName = foeHelperDBName;
            sourceDB = await openIfFilled(foeHelperDBName);
        }

        if (sourceDB) {
            log(`Found DB "${sourceDBName}"`);
            const destTables = IndexDB.db.tables.map(t => t.name);
            const tables = {};
            for (const table of sourceDB.tables) {
                // buildingMeta is only a cache and is rebuilt anyway
                if (table.name !== 'buildingMeta' && destTables.includes(table.name)) {
                    tables[table.name] = table.name;
                }
            }
            await cloneTables(sourceDB, tables);
            sourceDB.close();
        }

        // "FoE Helper Private" is discontinued, its DB can go.
        // The FoE Helfer DB is kept: the FoE Helfer may still be installed and uses it.
        if (await Dexie.exists(foeHelperPrivDBName)) {
            log(`Deleting old DB "${foeHelperPrivDBName}"`);
            await Dexie.delete(foeHelperPrivDBName);
        }

        async function openIfFilled(name) {
            if (!await Dexie.exists(name)) {
                return null;
            }
            const sdb = new Dexie(name);
            await sdb.open();
            // Not only "players": the FoE Helfer 4.x clears its players table on every start,
            // so a DB counts as filled as soon as any table (except the cache) has rows
            for (const table of sdb.tables) {
                if (table.name !== 'buildingMeta' && await table.count()) {
                    return sdb;
                }
            }
            sdb.close();
            return null;
        }

        // Copy tables.
        // Basicly this is not transaction safe to bulkAdd, but we can ignore it because
        // `await getDb()` is used before insert or update.
        async function cloneTables(source, tables) {
            const destTables = Object.keys(tables);
            for (let destTable of destTables) {
                const sourceTable = tables[destTable];
                log(`  Copy ${sourceTable} => ${destTable}...`);
                await IndexDB.db[destTable].clear();
                await IndexDB.db[destTable].bulkAdd(await source.table(sourceTable).toArray());
            }
        }

        function clearLog() {
            localStorage.setItem('FH_IndexDBLastMigraion', '');
        }

        function log(text) {
            //console.log('mergeDatabases: ' + text);
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
            // console.log(`Cloning DB "${srcName}" v${sdb.verno} => "${dstName}" v${version}`);

            // console.log('Dumping schema...');
            const schema = sdb.tables.reduce((result, table) => {
                // console.log(` => ${table.name}...`);
                result[table.name] = (
                    [table.schema.primKey]
                        .concat(table.schema.indexes)
                        .map(indexSpec => indexSpec.src)
                ).toString();
                return result;
            }, {});
            // console.log('Schema:', schema);
            ddb.version(version).stores(schema);

            return sdb.tables.reduce(
                (result, table) => result
                    // .then(() => console.log(`Cloning table ${table.name}...`))
                    .then(() => table.toArray())
                    .then(rows => ddb.table(table.name).bulkAdd(rows) ),
                Promise.resolve()
            ).then((x) => {
                sdb.close();
                ddb.close();
               // console.log(`Clonning DB is finished, created "${dstName}"`);
            })
        });
    },


    /**
    * Remove old records from db to avoid overflow
    *
    * @returns {Promise<void>}
    */
    GarbageCollector: async () => {
        // Expiry time for db with 1 record per day
        const daylyExpiryTime = moment().subtract(1, 'years').toDate();

        // Expiry time for db with 1 record per hour
        const hourlyExpiryTime = moment().subtract(8, 'days').toDate();

        // Keep logs for guild battlegrounds for 2 weeks
        const gbgExpiryTime = moment().subtract(2, 'weeks').toDate();

        // Toolbox: players, their great buildings and the PvP history are kept for a year
        // (upstream clears players and greatbuildings on every start)
        const playerExpiryTime = moment().subtract(1, 'years').toDate();

        await IndexDB.getDB();
        // upstream table, not used by the toolbox (PvP history lives in neighborhoodAttacks)
        await IndexDB.db.pvpActions.clear();

        await IndexDB.db.neighborhoodAttacks.where('date').below(playerExpiryTime).delete();

        // Remove expired city shields (Looting.ACTION_TYPE_SHIELDED)
        const now = moment().unix();
        await IndexDB.db.neighborhoodAttacks
            .where('type').equals(5)
            .and(item => item.expireTime < now)
            .delete();

        await IndexDB.db.players.where('date').below(playerExpiryTime).delete();

        // great buildings of players no longer known
        const leftPlayers = await IndexDB.db.players.toCollection().primaryKeys();
        await IndexDB.db.greatbuildings.where('playerId').noneOf(leftPlayers).delete();

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

    rewardDBCleanup: async () => {
        //reward type for shard, Ad chests and shards was changed around april 11 and code was amended for that on May 19 - this will switch all old entries for incidents to the new type
        if (!localStorage.getItem("HiddenRewardOverwrite")) {
            let x = await IndexDB.db.statsRewards.toArray();
            let y= [];
            x.forEach(a=>{
                if (a.type=="hidden_reward") {
                    a.type="shards"
                    y.push(a)
                }
                if (a.type=="default" || a.type=="living_city") {
                    a.type="hidden_reward"
                    y.push(a)
                }
                });
            IndexDB.db.statsRewards.bulkPut(y);
            localStorage.setItem("HiddenRewardOverwrite","done");
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
     * Add user from PlayerDict if not added, otherwise update the
     * toolbox fields (era, score, won battles and their dates)
     *
     * @param playerId
     * @param updateDate update an existing player as well
     * @returns {Promise<void>}
     */
    addUserFromPlayerDictIfNotExists: async (playerId, updateDate) => {
        const playerFromDB = await IndexDB.loadPlayer(playerId);
        const player = PlayerDict[playerId];
        if (!player) return;

        const fields = {
            era: player.Era,
            score: player.Score,
            lastScoreChangeDate: player.ScoreDate,
            lastScoreReceiveDate: player.ScoreReceiveDate,
            wonBattles: player.WonBattles,
            lastWonBattlesChangeDate: player.WonBattlesDate,
            lastWonBattlesReceiveDate: player.WonBattlesReceiveDate,
        };
        // unknown values must not overwrite known ones
        for (const key of Object.keys(fields)) {
            if (fields[key] === undefined) delete fields[key];
        }

        if (!playerFromDB) {
            // put instead of add: parallel updates of the same player must not fail
            await IndexDB.db.players.put(Object.assign({
                id: playerId,
                name: player.PlayerName,
                clanId: player.ClanId || 0,
                clanName: player.ClanName,
                avatar: player.Avatar,
                era: 'unknown', // Era can be discovered when user is visited
            }, fields, {
                date: MainParser.getCurrentDate(),
            }));
        }
        else if (updateDate) {
            await IndexDB.db.players.update(playerId, Object.assign(fields, {
                date: MainParser.getCurrentDate(),
            }));
        }
    },


    /**
     * Load a player from the db, waits until the db is ready
     *
     * @param playerId
     * @returns {Promise<Object|undefined>}
     */
    loadPlayer: async (playerId) => {
        await IndexDB.getDB();
        return IndexDB.db.players.get(playerId);
    }
};
