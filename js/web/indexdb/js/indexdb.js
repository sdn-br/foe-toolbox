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
        // Own name, the DBs of the toolbox 1.x ("FoEToolboxDB_") stay untouched so that 1.x can still be used.
        // Different DBs per player if two players are sharing the same PC playing on the same world
        const primaryDBName = 'FoEToolbox2DB_' + playerId;
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
            // PvP history of the toolbox, filled from the toolbox 1.x DB on first start
            neighborhoodAttacks: '++id,playerId,date,type',
        });
    },

    /**
     * Database migration util function. Should be called once, when the main DB was just created.
     * Takes over the data of the toolbox 1.x or, if there is none, of a previous
     * "FoE Helper Private" or FoE Helfer installation. All of them run in the game page as well,
     * so their DBs are visible in this origin.
     */
    mergeDatabases: async (playerId) => {
        // Skip if main db is not empty
        if (await IndexDB.db.players.count()) { return; }

        await IndexDB.copyFromLegacyDB(IndexDB.db, [
            'FoEToolboxDB_' + playerId,
            'FoeHelperPrivateDB_' + playerId,
            'FoeHelperDB_' + playerId,
        ], {
            // only a cache, rebuilt anyway
            skipTables: ['buildingMeta'],
        });
    },


    /**
     * Opens a toolbox DB with a declared schema. If the DB did not exist yet,
     * it is filled once with the data of the given legacy DBs (see copyFromLegacyDB).
     * Used by the modules with an own DB.
     *
     * @param {Dexie} db destination DB, schema already declared, not opened yet
     * @param {string[]} legacyNames legacy DB names in priority order
     * @param {Object} [options] see copyFromLegacyDB
     * @returns {Promise<void>}
     */
    openWithLegacyCopy: async (db, legacyNames, options) => {
        try {
            // decided before opening, opening creates the DB
            const isNewDB = !await Dexie.exists(db.name);
            await db.open();

            if (isNewDB) {
                await IndexDB.copyFromLegacyDB(db, legacyNames, options);
            }
        } catch (e) {
            console.error(e);
        }
    },


    /**
     * Copies the data of a legacy DB into a freshly created toolbox DB.
     *
     * Legacy DBs (toolbox 1.x, FoE Helfer, FoE Helper Private) are read only: they are
     * opened without a declared schema (Dexie dynamic mode), so no upgrade happens,
     * it does not matter which schema version they have, and nothing is written to them.
     * They are never deleted either, so the old installation keeps working.
     *
     * The first legacy DB with data wins. Only tables that exist in the destination schema are copied.
     *
     * @param {Dexie} db destination DB with a declared schema
     * @param {string[]} legacyNames legacy DB names in priority order
     * @param {Object} [options]
     * @param {string[]} [options.skipTables] tables not to copy (caches)
     * @param {Object<string, function(Object): Object>} [options.transformRows] per table: converts a
     *        legacy row into the format of the current schema
     * @returns {Promise<string|null>} name of the legacy DB the data was copied from
     */
    copyFromLegacyDB: async (db, legacyNames, options = {}) => {
        const skipTables = options.skipTables || [];
        const transformRows = options.transformRows || {};
        const destTables = db.tables.map(t => t.name).filter(name => !skipTables.includes(name));

        for (const legacyName of legacyNames) {
            const source = await openIfFilled(legacyName);
            if (!source) continue;

            try {
                log(`Copy "${legacyName}" (v${source.verno}) => "${db.name}"`);
                for (const sourceTable of source.tables) {
                    const tableName = sourceTable.name;
                    if (!destTables.includes(tableName)) continue;

                    try {
                        let rows = await sourceTable.toArray();
                        if (transformRows[tableName]) {
                            rows = rows.map(transformRows[tableName]);
                        }
                        const destTable = db.table(tableName);
                        // clear + add in one transaction: no mix with rows written meanwhile
                        await db.transaction('rw', destTable, async () => {
                            await destTable.clear();
                            await destTable.bulkAdd(rows);
                        });
                        log(`  ${tableName}: ${rows.length} rows`);
                    } catch (e) {
                        log(`  ${tableName}: failed (${e && e.name})`);
                        console.error(e);
                    }
                }
            } finally {
                source.close();
            }
            return legacyName;
        }
        return null;

        // Opens a legacy DB read only (dynamic mode), null if it does not exist
        // or has no rows in the tables to copy
        async function openIfFilled(name) {
            if (!await Dexie.exists(name)) {
                return null;
            }
            const sdb = new Dexie(name);
            await sdb.open();
            // Not only "players": the FoE Helfer 4.x clears its players table on every start,
            // so a DB counts as filled as soon as any table to copy has rows
            for (const table of sdb.tables) {
                if (destTables.includes(table.name) && await table.count()) {
                    return sdb;
                }
            }
            sdb.close();
            return null;
        }

        // Migration log in localStorage, one line per copied DB and table.
        // Copies happen only once per DB, the log is limited anyway.
        function log(text) {
            const lines = (localStorage.getItem('FH_IndexDBLastMigraion') || '').split('\n').filter(l => l);
            lines.push(`${moment().format('YYYY-MM-DD HH:mm:ss')} ${text}`);
            localStorage.setItem('FH_IndexDBLastMigraion', lines.slice(-200).join('\n') + '\n');
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
     * Add user from PlayerDict if not added, otherwise update name, guild,
     * avatar and the toolbox fields (era, score, won battles and their dates)
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
            name: player.PlayerName,
            clanId: player.ClanId,
            clanName: player.ClanName,
            avatar: player.Avatar,
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
        // clanId 0 = known to have no guild, a stored guild name is outdated
        if (fields.clanId === 0) fields.clanName = undefined;

        if (!playerFromDB) {
            // put instead of add: parallel updates of the same player must not fail
            await IndexDB.db.players.put(Object.assign({
                id: playerId,
                clanId: 0,
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
