/*
 * **************************************************************************************
 *
 * FoE Toolbox: extensions of IndexDB (indexdb.js), kept out of the upstream file.
 * Own DB names (FoEToolbox2DB_*), the DBs of the toolbox 1.x, FoE Helfer and FoE Helper Private
 * are only read (one-time copy on first start), never written or deleted, so a return to 1.x
 * stays possible. indexdb.js keeps 3 marked lines (DB name, copyLegacyMainDB, toolboxGarbageCollector),
 * the wrapped functions are listed in docs/helfer-migration.md.
 *
 * You may use, distribute and modify this code under the terms of the AGPL license.
 * See file LICENSE.md for full license details.
 *
 * **************************************************************************************
 */

/*
 * Toolbox tables (kept across starts, see GarbageCollector)
 *
 * "neighborhoodAttacks" structure (PvP history of the toolbox, replaces the unused upstream "pvpActions")
 * {
 * 	playerId: number,
 * 	date: Date,
 * 	type: ACTION_TYPE_BATTLE_WIN | ACTION_TYPE_BATTLE_LOSS | ACTION_TYPE_BATTLE_SURRENDERED,
 * 	battle: {
 * 		myArmy: Unit[],
 * 		otherArmy: Unit[],
 * 		round: number,
 * 		auto: boolean,
 * 		era: string,
 * 	}
 * }
 * OR
 * {
 * 	playerId: number,
 * 	date: Date,
 * 	type: Looting.ACTION_TYPE_LOOTED,
 * 	resources: Object,
 * 	doubleLoot: boolean | undefined, // double loot bonus is applied or not
 * 	doubleLootApplied: boolean // true when double bonus is applied
 * 	sp: number, // strategy points
 * 	important: boolean, // if not supplies or money only
 * 	entityId: number, // foe city entity Id
 * 	buildId: string, // key for BuildingNamesi18n
 * }
 * OR
 * {
 * 	type: Looting.ACTION_TYPE_SHIELDED,
 * 	playerId: number,
 * 	date: Date,
 * 	expireTime: number, // timestamp. usage: new Date(expireTime * 1000)
 * }
 * where Unit =
 * {
 * 	startHP: number, // usually 10
 * 	endHp: number,
 * 	attBoost: number,
 * 	defBoost: number,
 * 	unitTypeId: string,
 * 	ownerId: number, // other player id
 * }
 *
 * "players" structure
 * {
 * 	id: number,
 * 	name: string,
 * 	clanId: number, // 0 if no clan
 * 	clanName: string | undefined,
 * 	avatar: string,
 * 	era: string | 'unknown',
 * 	score: number | undefined,
 * 	lastScoreChangeDate: Date | undefined, // last time the score was seen rising
 * 	lastScoreReceiveDate: Date | undefined, // last time the score was received
 * 	wonBattles: number | undefined,
 * 	lastWonBattlesChangeDate: Date | undefined,
 * 	lastWonBattlesReceiveDate: Date | undefined,
 * 	date: Date, // last time the player was seen
 * }
 *
 * "greatbuildings" structure
 * {
 * 	id: number,
 * 	playerId: number,
 * 	name: string,
 * 	level: number,
 * 	currentFp: number,
 * 	bestRateNettoFp: number
 * 	bestRateCosts: number,
 * 	date: Date, // last visit date
 * }
 *
 */

Object.assign(IndexDB, {

	/**
	 * Called by IndexDB.Init instead of mergeDatabases (1 marked line there), when the main DB was
	 * just created. The upstream migration deletes its source DBs, the toolbox only reads them.
	 * Takes over the data of the toolbox 1.x or, if there is none, of a previous
	 * "FoE Helper Private" or FoE Helfer installation. All of them run in the game page as well,
	 * so their DBs are visible in this origin.
	 *
	 * @param playerId
	 * @returns {Promise<void>}
	 */
	copyLegacyMainDB: async (playerId) => {
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
	 * Guild fights: the toolbox 1.x (schema v1) did not store the attrition, the readers expect a number.
	 * transformRows for openWithLegacyCopy in Guild_fights.checkForDB.
	 */
	guildFightsLegacyRows: (() => {
		const withAttrition = (row) => Object.assign({}, row, { attrition: row.attrition || 0 });

		return {
			snapshots: withAttrition,
			history: (row) => Object.assign({}, row, {
				participation: Array.isArray(row.participation) ? row.participation.map(withAttrition) : row.participation
			}),
		};
	})(),


	/**
	 * Called by IndexDB.GarbageCollector instead of clearing players and greatbuildings
	 * (1 marked line there): players, their great buildings and the PvP history are kept for a year.
	 *
	 * @returns {Promise<void>}
	 */
	toolboxGarbageCollector: async () => {
		const playerExpiryTime = moment().subtract(1, 'years').toDate();

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
	},
});


// PvP history of the toolbox, filled from the toolbox 1.x DB on first start.
// Dexie merges the stores into the version 3 declared by upstream.
{
	const applyIndexSchema = IndexDB._applyIndexSchema;

	IndexDB._applyIndexSchema = (db) => {
		applyIndexSchema.call(IndexDB, db);
		db.version(3).stores({
			neighborhoodAttacks: '++id,playerId,date,type',
		});
	};
}


// The toolbox also stores era, score, won battles and their dates, and updates name, guild
// and avatar of known players. Unknown values must not overwrite known ones.
{
	const addUserFromPlayerDictIfNotExists = IndexDB.addUserFromPlayerDictIfNotExists;

	IndexDB.addUserFromPlayerDictIfNotExists = async (playerId, updateDate) => {
		const isNew = !await IndexDB.loadPlayer(playerId);

		try {
			await addUserFromPlayerDictIfNotExists(playerId, updateDate);
		} catch (e) {
			// a parallel call has added the same player first, the update below still applies
			if (e?.name !== 'ConstraintError') throw e;
		}

		const player = PlayerDict[playerId];
		if (!player || (!isNew && !updateDate)) return;

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
		for (const key of Object.keys(fields)) {
			if (fields[key] === undefined) delete fields[key];
		}
		// clanId 0 = known to have no guild, a stored guild name is outdated (undefined removes it)
		if (fields.clanId === 0) fields.clanName = undefined;

		await IndexDB.db.players.update(playerId, fields);
	};
}
