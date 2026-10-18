# Migration auf FoE Helfer 4.8.3.0

Basis: Upstream `mainIine/foe-helfer-extension` Commit `f24d1fd4` (v4.8.3.0).
Vorherige Basis: FoE Helfer 3.1.0.1 (`86f9439d`), Toolbox 1.24.0.0.

## Fortschritt

- [x] Import Helfer 4.8.3.0
- [x] 17 Branding, nur Deutsch, Update-/Reload-Logik, DB-Migration
- [x] 16 Datenmodell-Unterbau
- [x] 16a Bekannte Spieler: Name, Gilde und Avatar werden aktualisiert (Entscheidung Nutzer)
- [x] 1 Plünderhilfe / Stadtinformationen (`sabotage`)
- [x] 2 PvP Angriffe (`looting`)
- [x] 3 Snipehilfe: Vorab-Scan der LG-Übersicht
- [x] 4 Kostenrechner: Minimal-Investition, BP/Medaillen-Tabelle, FP im Lager
- [x] 5 Kostenrechner schreibt LGs in IndexedDB
- [x] 7 Verhandlungsassistent in Gildengefechten (GbG)
- [x] 8 Fenster fixieren
- [x] 9 Alarme `requireInteraction`
- [x] 10 Eigenanteilsrechner: 1 FP für Plätze ohne FP, Bonus pro LG
- [x] 11 Blaue Galaxie: Diamanten
- [x] 12 Versteckte Ereignisse: Zukunft + eigener Zähler
- [x] 13 Stadtübersicht: Scroll, Tooltips, Double-Opt-In
- [x] 14 Spielerlinks nur auf dem Icon
- [x] 15 Datenschutz: `GlobalSend` default aus, Double-Opt-In, Ban-Erkennung
- [x] Bugfix: `minWidth`/`minHeight` beim Resize vertauscht (`_helper.js`)

Entfällt: 6 GvG Angriffshilfe (GvG wurde im Spiel und upstream am 2024-03-18 entfernt).

**Notizen 17**
- Version `2.0.0.0`, `version_name` `2.0.0.0 (4.8.3.0)`; `inject.js` liest die Basisversion daraus (`extBaseVersion`). Settings zeigt "Basis: FoE Helfer 4.8.3.0".
- API-Parameter `&v=` mit Basisversion statt Toolbox-Version: wie bisher bei `SelfPlayer`, analog jetzt auch bei den neuen Aufrufen `OwnLGData` (`_main.js`) und `BuildingList` (`srcLinks.js`).
- Manifest: Upstream hat die Permission `tabs` entfernt; nur `scripting` ergänzt. `tabs.query` mit URL-Filter reicht die Host-Permission für `*.forgeofempires.com`. Die Firefox-ID des Helfers (`browser_specific_settings.gecko`) entfernt, sie gehört dem Helfer.
- `background.js`: Upstream hatte den Update-Tab auskommentiert. Toolbox-Logik wieder drin: bei `onInstalled` Reload-Abfrage per `scripting.executeScript` in allen offenen Spiel-Tabs und Wiki-Changelog im neuen Tab. Zusätzlich verlinkt der neue Upstream-Toast "Neue Version installiert" (`_main.js`) auf das Toolbox-Changelog statt foe-helper.com.
- Nur Deutsch: `inject.js` fällt auf `de` statt `en` zurück. Ein `user-language` im localStorage des Spiels, das die Toolbox nicht kennt (z. B. vom Helfer gesetzt), wird ignoriert, aber nicht überschrieben. `popup.js`/`alerts.js`: Wörterbuch und Übersetzungsschleife entfernt, das HTML ist der Text (die alte Toolbox lief für Nicht-Deutsch in einen TypeError). Settings: `Help` und `LoadBeta2` (Download der Helfer-Beta) entfernt, Weblate-Link entfernt.
- Branding analog erweitert auf Stellen, die es in 3.1.0.1 noch nicht gab: `Menu.NewVersion.Title`, `Menu.MetaLoader.*`, Präfixe "FoE-Helfer:"/"FoE-Helper:" in `Boxes.MergerGame.KeysLeft.*`, `StrategyPoints.*` und im Quest-Tooltip (`quests.js`). Discord-Webhook-Name und Testtext (`discord.js`) sowie das Box-Titel-Suffix (`_helper.js`) lauten "FoE Toolbox" (Doku an den Code angeglichen 2026-10-17). Bewusst wie in der alten Toolbox belassen: generische "Helfer"-Texte. Ebenso Upstream belassen: Titel " - FoE Helper" der neuen Pop-up-Fenster (`popup/js/popup.js`).
- IndexedDB: alle DBs haben eigene Namen, Haupt-DB `FoEToolbox2DB_<id>`, Modul-DBs `FoEToolbox2DB_<Modul>_<id>` (Events, GexStat, GuildFights, GuildMemberStat, FPCollector, Qi, GBG, Notice). Grund: 1.24 (Dexie 2.0.4) öffnet keine DB mit höherer Version als deklariert; die neue Version hob `FoEToolboxDB_` (v2 -> v3), `FoeHelperDB_GuildFights_` (v1 -> v21) und `FoeHelperDB_GuildMemberStat_` (v1 -> v2) an. Die übrigen Modul-DBs haben gleiche Store-Deklarationen, kollidieren aber mit einem parallel installierten Helfer.
- Einmalige Kopie beim ersten Start (neue DB existiert noch nicht, vor dem Öffnen geprüft): `IndexDB.copyFromLegacyDB` öffnet die Alt-DB ohne Schema (Dexie dynamic mode: kein Upgrade, kein Schreiben), kopiert alle Tabellen, die im neuen Schema existieren, und schließt sie. Alt-DBs werden nie beschrieben, angehoben oder gelöscht (auch `FoeHelperPrivateDB_<id>` nicht mehr). Quellen Haupt-DB in dieser Reihenfolge, die erste mit Daten gewinnt: `FoEToolboxDB_<id>`, `FoeHelperPrivateDB_<id>`, `FoeHelperDB_<id>`; "gefüllt" heißt irgendeine zu kopierende Tabelle hat Zeilen (Helfer 4.x leert `players` bei jedem Start). Quelle Modul-DB: gleichnamige `FoeHelperDB_<Modul>_<id>`. Upstream-Migration aus `FoeHelper_<id>`/`PlayerDB`/`StatsDb` entfällt wie in der alten Toolbox.
- Nicht kopiert: der Cache `buildingMeta`. Zeilenformat: keines der Schemas hat `upgrade()`-Funktionen. GuildFights: 1.24 speicherte keine `attrition`, beim Kopieren wird sie in `snapshots` und in `history.participation` mit 0 ergänzt (die Anzeige rechnet damit). GuildMemberStat: `gex`-Zeilen aus v1 haben kein `trial`, die Leser setzen 0 ein, Kopie unverändert. `FoeHelperDB_UnitsGEX_` (Modul entfallen) wird nicht kopiert.
- Protokoll in `localStorage` `FH_IndexDBLastMigraion`: je Kopie eine Zeile mit Zeit, Quelle (mit Version) und Ziel, darunter die Zeilenzahl je Tabelle, als ein Block je Kopie (die Kopien laufen parallel); wird nicht mehr geleert, auf 200 Zeilen begrenzt.
- Schema `version(3)` deklariert zusätzlich `neighborhoodAttacks` (PvP-Verlauf der Toolbox, kommt über die Kopie aus `FoEToolboxDB_`). Den Stand der Tests vor dieser Umstellung (Version hatte `FoEToolboxDB_` und Modul-DBs direkt angehoben) kann die Kopie nicht reparieren: wer damit getestet hat, kommt für diese DBs nicht mehr zu 1.24 zurück.
- `.gitignore`: nur `*.ini` aus der Toolbox übernommen, die Upstream-Einträge bleiben. README und `changelog.md` aus Toolbox `master`, `changelog-de/en.md` entfernt.

**Notizen 16**
- Proxy (`js/foeproxy.js`): Handler bekommen als drittes Argument `responseData` = die ganze Antwort (alle Einträge des Requests), wie in der alten Toolbox. Nur XHR; WebSocket-Handler und Meta-/Raw-Handler unverändert (auch alt nicht). Upstream ruft dafür jetzt `FoEproxy._proxyAction` in drei Schleifen auf (zusätzlich `StaticDataService.getMetadata` zuerst), alle drei reichen es durch.
- CityEntity-Flags: neue Funktion `MainParser.setToolboxEntityFlags()`, läuft in `CityEntityBuilder` direkt nach `correctBuildingType()` (Upstream lädt die Metadaten nicht mehr im Meta-Handler `city_entities`, sondern einzeln per Datei mit Cache in `buildingMeta`). Flags wie alt: `is_motivatable`, `is_polishable`, `chainId`, `is_chainBuilding`, `is_chainStartBuilding`, `bonus_multiplier`, `is_outpostBuilding`, `is_plunderable`.
- Anpassung: neben den klassischen `abilities` werden auch generische Gebäude (`GenericCityEntity`, `components.AllAge`) gelesen, mit denselben Quellen wie Upstream in `CityBuildings` (`setPolivationable`, `setChainBuilding`): Motivieren/Polieren aus `socialInteraction.interactionType`, Kette aus `chain` (`ChainStartConfig` = Startgebäude, `linkPositions.length` = `bonus_multiplier`). Alt galt jedes generische Gebäude mit irgendeiner Ability als motivierbar; das entfällt. `CityBuildings` selbst wird nicht aufgerufen, weil es fehlende `abilities` nicht abfängt und `linkPositions.length` nicht liefert. `is_plunderable`/`is_outpostBuilding` unverändert aus `abilities`.
- PlayerDict: `WonBattles` hatte Upstream schon. Neu: `IsActive`, `ScoreDate`/`ScoreReceiveDate`, `WonBattlesDate`/`WonBattlesReceiveDate` (zuletzt gestiegen / zuletzt empfangen, Abgleich mit der DB), `MainParser.loadPlayerIntoDict(id)`. `UpdatePlayerDict` und `UpdatePlayerDictCore` geben ein Promise zurück, das erst nach dem Schreiben in `players` erfüllt ist (`UpdatePlayerDict` wartet per `Promise.all` auf alle Spieler, alt nur auf den letzten; Fehler werden geloggt, das Promise wird trotzdem erfüllt).
- Neue Quellen in `UpdatePlayerDict`: `PlayerVO` (`OtherPlayerService.getOtherPlayerVO`), `Events` (`getEventsPaginated`), `PvPArena` (`PVPArenaService.getOverview`, unabhängig vom Upstream-Modul `pvparena`; die drei Handler stehen in `toolbox-main.js`), `VisitPlayer` (ruft kein Handler in `toolbox-main.js`, sondern 1 und 2 selbst, wie alt). Neu bei `VisitPlayer`: fehlt `other_player.era`, wird `other_player_era` genommen (so hat es alt `Looting.collectPlayer` gespeichert).
- IndexDB: `IndexDB.loadPlayer(id)` (wartet auf die DB), `addUserFromPlayerDictIfNotExists` schreibt zusätzlich `era`, `score`, `wonBattles` und die vier Datumsfelder. Anpassungen: unbekannte Werte überschreiben keine bekannten (alt setzte z. B. `era` auf `undefined`), neue Spieler per `put` statt `add` (parallele Updates desselben Spielers liefen in einen ConstraintError), Tippfehler `lastScoreReceiveData` korrigiert (gelesen wird beides, für Daten aus 1.x).
- `GarbageCollector` wie in der alten Toolbox: `players` und `neighborhoodAttacks` bleiben ein Jahr (nach `date`), abgelaufene Stadtschilde (`type` 5) werden gelöscht, `greatbuildings` nur von Spielern, die nicht mehr in `players` stehen. Nur `pvpActions` wird weiter geleert: Upstream nutzt die Tabelle nirgends mehr, die Toolbox nutzt `neighborhoodAttacks`. Damit ist die Datenverlust-Warnung aus 17 erledigt.
- Migration: die alte Toolbox kopierte `pvpActions` des Helfers nach `neighborhoodAttacks`. Entfällt, weil der Helfer die Tabelle bei jedem Start leert und 4.8.3 nichts mehr hineinschreibt. `neighborhoodAttacks` aus `FoeHelperPrivateDB_` kommt über den gleichnamigen Tabellen-Kopierer aus 17.
- Schema: keine neue Version nötig. `players` (`id,date`), `greatbuildings` (`playerId`) und `neighborhoodAttacks` (`playerId,date,type`) haben die Indizes, die 1-3 und der GarbageCollector brauchen. Die zusätzlichen Spielerfelder sind nicht indiziert (wie alt).
- Darauf können 1-3 bauen: `MainParser.UpdatePlayerDict(data.responseData, 'VisitPlayer').then(...)`, `MainParser.loadPlayerIntoDict(id)`, `PlayerDict[id].IsActive|ScoreDate|WonBattlesDate`, `IndexDB.db.neighborhoodAttacks`, `IndexDB.db.players`, `IndexDB.db.greatbuildings` bleiben über Neustarts erhalten, `CityEntity.is_plunderable` usw., Handler-Signatur `(data, postData, responseData)`.
- Offen: `is_plunderable` für generische Gebäude ist nicht geprüft (kein Plünder-Schutz-Component bekannt, die Regel ist die alte). Das PvP-Arena-Format (`opponents[].opposingPlayer.player`) ist nur aus dem alten Code übernommen; Zugriffe sind abgesichert.

**Notizen 16a**
- Entscheidung Nutzer: für Spieler, die schon in `players` stehen, werden jetzt auch `name`, `clanId`, `clanName` und `avatar` aktualisiert (alt und in 16 nur beim ersten Anlegen geschrieben). Regel bleibt: unbekannte Werte (`undefined`) überschreiben keine bekannten.
- Gildenaustritt: `clan_id` = 0 ohne `clan` gilt als bekannter Wert "keine Gilde". Dann wird `ClanName` im PlayerDict entfernt und `clanName` in der DB gelöscht, sonst bliebe der alte Gildenname stehen.
- Neue Spieler ohne bekannte Gilde bekommen weiter `clanId` 0 (wie alt).

**Notizen 1**
- Neues Modul `js/web/sabotage` (in `js/internal.json` registriert), Menüknopf `sabotage` (rot bis zum ersten Besuch, Warnung wie alt), Icon `css/images/menu/sabotage.png` aus der Toolbox, i18n nur in `de.json`.
- Settings wie alt: `ShowNeighborsLootables` (Ernte, default aus), `ShowPlayersAttDeffValues` (Angriff/Verteidigung, default **an**), beide mit `doubleoptin: true`. Achtung: 4.8.3 kennt `doubleoptin` noch nicht, die Bestätigung kommt erst mit 15.
- Anpassung: Boni und Produktionen kommen jetzt aus dem 4.8.3-Gebäudemodell (`CityBuildings.createBuilding`, ohne Verbündete, da die des besuchten Spielers unbekannt sind) statt aus eigenem Parsen der `abilities`. Werte: Summe `att/def_boost_attacker/defender` mit Feature `all` (über `Productions.getRatingValueForType`), Plünderabwehr = Boosts `plunder_repel` mit Feature `all`. `Unit.GetBoostSums` und `GoodsParser` entfallen. Damit zählen auch generische Gebäude (Komponenten) und die LG-Boni der Rework-LGs.
- Upstream zeigt im eigenen Profil-Fenster (`Profile.showOtherPlayer`) bei fremden Spielern absichtlich Zufallswerte für die Verteidigung; die Toolbox rechnet weiter echt.
- Plünderbar: `is_plunderable` aus 16, nicht motiviert (`state.isPolivated`), Zustand `collectable`. Gezählt werden Produktionen vom Typ `resources`/`special_goods` und Gildenmacht (`clan_power`). Generische Gebäude liefern ihre Produktion aus `productionOption` (neu, alt nur `current_product`). FP-Erkennung über `strategy_points` statt über den englischen Namen "Forge Point".
- "Stadt anzeigen"/Auge: öffnet die 4.8.3-Stadtkarte (`CityMap.init(true)`, nutzt `ActiveMap === 'OtherPlayer'`) und hebt das Gebäude per `highlighted` + `CityMap.FocusEntities` hervor. Nur sichtbar, solange man noch in dieser Stadt ist (die Karte kennt nur die aktuelle fremde Stadt).
- Bugfix: nächster Angriffszeitpunkt rechnete `moment.unix()` auf Millisekunden (`getCurrentDateTime`), jetzt `moment(ms)`.
- "Angriffe anzeigen" und der Stadtschild (Tabelle `neighborhoodAttacks`, Typ 5) hängen an `Looting` (Feature 2). Der Knopf erscheint nur, wenn das Modul geladen ist.
- Offen: Abwehr-"max" (+60 %) und Angriff-"max" (+50 %) sind die alten festen Aufschläge (Taverne/Gildenbonus), nicht geprüft. Kettenboni zählen ohne Prüfung der Verknüpfung (wie Upstream `getRatingValueForType`).

**Notizen 2**
- Neues Modul `js/web/looting` (in `js/internal.json` registriert), Menüknopf `looting` ohne Opt-in (wie alt), Bilder aus der Toolbox (`css/images/{sabotage,plunderrepel,shield,doubleloot}.png`, `css/images/menu/looting.png`, `js/web/x_img/doubleloot.png`), i18n nur in `de.json`.
- Verhältnis zu Upstream `pvparena`: anderes Feature. Upstream zeigt das Arena-Protokoll aus `PVPArenaService.getOverview` (`actions`, Ranglistenpunkte, Notizen) nur für die laufende Sitzung. Die Toolbox speichert eigene Kämpfe (Nachbarschaft und Arena), Plünderungen, abgewehrte Plünderungen und Stadtschilde dauerhaft in `neighborhoodAttacks` und filtert nach Spieler bzw. aktuellen Arena-Gegnern. Beide bleiben nebeneinander, keine gemeinsame Datenhaltung.
- Arena-Format `opponents[].opposingPlayer.player` ist bestätigt: Upstream `battle-assist` liest es in 4.8.3 genauso (damit ist das "Offen" aus 16 erledigt).
- Anpassung: Plünderung bei generischen Gebäuden liest die Ressourcen aus `state.productionOption.products[].playerResources` (alt nur `current_product.product.resources`, generische Gebäude wurden nie erfasst). `plunderById` sucht den passenden Request in `postData` statt immer den ersten.
- Bugfixes: Klick-Handler wurden bei jedem Neuzeichnen erneut gebunden ("nächste Seite" sprang mehrere Seiten), jetzt einmal beim Anlegen der Box. Seitenzahl beim Arena-Filter zählt nur Arena-Kämpfe (alt alle Einträge dieser Spieler). Einheiten-Icons über `Unit.PrepareCoords()` (4.8.3).
- Entfallen: tote Anzeige "Besucht" (`playerDate` war immer leer) samt Texten, `Looting.collectPlayer` (alt auskommentiert, ersetzt durch 16).
- Offen: `BattlefieldService`-Antwort (`defenderPlayerId`, `PVPArenaService.addLog`) und `CityMapService.reset` mit `LootedState`/`PlunderedState` sind nur aus dem alten Code übernommen, im Spiel nicht geprüft.

**Notizen 3**
- Neuer Part `js/web/calculator/js/parts/overview.js` (in `js/internal.json` unter `calculator.parts`), Box `LGInvestmentOverviewBox` mit Ton-Schalter (`CalculatorOverviewTone`, default aus), CSS am Ende von `calculator.css`. Setting `ShowPossibleInvestments` (default aus, `doubleoptin`, wirkt erst mit 15).
- Eigener Handler für `GreatBuildingsService.getOtherPlayerOverview` im Part (der Upstream-Handler in `_main.js` bleibt unverändert und läuft vorher, er füllt das PlayerDict). Spieler, Gilde und Aktivität (`IsActive` aus 16) kommen aus dem PlayerDict, bei Bedarf aus der DB (`loadPlayerIntoDict`).
- Anpassung: P1 über `GreatBuildings.GetP1(era, level)` (4.8.3, mit Formel für Level ohne Tabelle) statt `GreatBuildings.Rewards[era][level]` (alt: ohne Tabelleneintrag P1 = 0, LG fiel heraus).
- Anpassung: 4.8.3 hat keinen eigenen Kostenrechner-Menüknopf mehr (Kostenrechner steckt im Eigenanteilsrechner bzw. Split-View). Das alte `Calculator.Open()` (Umschalten zwischen Detail und Übersicht) entfällt. Die Übersicht öffnet sich automatisch beim Laden der LG-Liste; öffnet man danach ein LG eines **anderen** Spielers, schließt sie sich (wie alt "neuere Ansicht gewinnt"). Die Upstream-Boxen werden nicht angefasst.
- "Wiedererkannt" (grün, Gewinn/Kurs bekannt) braucht Einträge in `greatbuildings`. Die schreibt erst der Kostenrechner aus 5 (`RefreshGreatBuildingsDB`); bis dahin nur aus migrierten 1.24-Daten. Ohne Eintrag: "???" (neu gefunden) wie alt.
- Bugfixes: `BestKursNettoFP`/`BestKursEinsatz` waren implizite globale Variablen; fehlender PlayerDict-Eintrag warf einen TypeError.
- Offen: die Übersichtszeilen werden über `city_entity_id` gelesen (alter Feldname, in 4.8.3-Code nicht verwendet, dort nur `entity_id`); im Spiel prüfen. Die LG-Stufen (Kupfer/Silber/Gold) gehen nicht in P1 ein (wie alt). Wiederöffnen der geschlossenen Box geht nur über erneutes Öffnen der LG-Liste im Spiel (kein Menüknopf).
- Menüknopf `possibleInvestments` (Icon `calculator.png`, wie `sabotage`): öffnet die Box mit dem letzten Scan erneut; rot/Warnung bis ein Scan vorliegt; bei ausgeschalteter Einstellung `ShowPossibleInvestments` Toast-Hinweis. Ohne Einstellung wird kein Scan gespeichert, der Knopf bleibt dann rot. Im Spiel zu prüfen.

**Notizen 4**
- Upstream hat den Kostenrechner umgebaut (`MainParser.CurrentGB`, kombinierte Box `OwnPartBox` oder eigene Box `CalculatorBox` in der geteilten Ansicht, BP nach Stufen, Schweinchen-Spalte). Die Toolbox-Teile sitzen jetzt in `BuildTable`/`ShowBody` von `calculator.js`, Upstream-Logik unverändert.
- "FP im Lager": Zeile "Verfügbare Forgepunkte" im Kopf (`StrategyPoints.AvailableFP`, Text `Boxes.Calculator.AvailableFP` gab es upstream schon).
- Anpassung BP/Medaillen-Tabelle: statt drei nebeneinander liegender Tabellen (`costTableFordern`, `costTableBPMeds`, `costTableAggressiveInvestment`) eine Tabelle mit drei Spaltengruppen (Fördern | BP/Medaillen/Schweinchen | Minimal Investition), getrennt durch eine Linie, mit Gruppenkopf "Fördern mit: x%" und "Minimal Investition". Grund: die BP-Zelle hat in 4.8.3 Stufen-Icons und kann höher werden, getrennte Tabellen würden die Zeilen verschieben.
- "Minimal Investition" (`Calculator.AggressiveInvestmentCells`): Einsatz zum Absichern, Differenz, Kurs, Farben und Tooltips wie alt (rot bei zu wenig FP im Lager, eigener Platz blau mit Kurs). Die Farbe gilt nur für die Zellen der Gruppe, nicht für die ganze Zeile. Neu: der Einsatz lässt sich wie die Fördern-Spalte per Klick in das Spiel übernehmen (`copy-fp`).
- Texte: `Boxes.Calculator.Profit` heißt in 4.8.3 "Differenz" (alt "Gewinn"), übernommen. Neu in `de.json`: `AggressiveInvestment`, `Rate`, `TTRate`, `TTAggressiveInvestmentFPStockLow`. `Calculator.FormatKurs` ersetzt das `FormatOverviewKurs` aus 3.
- "Spieler-Aktivität" (Delta-Tabelle) stand alt nur in der Übersicht (Feature 3, erledigt). Im Kostenrechner zeigt Upstream inzwischen selbst ein Aktivitäts-Icon (`activity_*`); nichts übernommen.

**Notizen 5**
- `Calculator.RefreshGreatBuildingsDB` wie alt: nach jedem Rendern der Tabelle (`BuildTable`) werden Level, investierte FP (`state.invested_forge_points`, fehlt bei 0 FP, dann 0 statt alt `undefined`), FP des Rangs mit dem besten Kurs und dessen Einsatz in `greatbuildings` geschrieben, vorher der Spieler per `addUserFromPlayerDictIfNotExists` (sonst löscht der GarbageCollector das LG beim nächsten Start).
- Bugfix aus Upstream/alt: `BestKursNettoFP`/`BestKursEinsatz` waren in 4.8.3 nur block-lokal (tote Variablen), jetzt am Anfang von `BuildTable` deklariert.
- Neu: beim Durchscrollen der LG-Stufen (`Parts.IsPreviousLevel`) wird nicht geschrieben, die Ränge gehören dann zu einer anderen Stufe. Fehler beim Schreiben (z. B. ConstraintError bei zwei schnellen Renderings) werden geloggt, nicht geworfen.
- Damit bekommt 3 Daten: öffnet man ein fremdes LG mit sichtbarem Kostenrechner, erscheint es bei der nächsten LG-Übersicht dieses Spielers grün ("Wiedererkannt"), solange Level und investierte FP gleich sind. Geschrieben wird nur, wenn der Kostenrechner gerendert wird (eigene Box oder kombinierte Box ohne "Eigenanteilsrechner für alle LGs"), wie alt nur bei offenem Kostenrechner.

**Notizen 7**
- Wie alt: Setting `AutomaticNegotiationForGbG` (Gruppe Boxes, default aus, `doubleoptin`, Bestätigung kommt mit 15). Ist es an, bricht `Negotiation.StartNegotiation` im Kontext `guildBattleground` nicht mehr ab (Upstream-Guard "no negotiation helper for GBG" bleibt sonst unverändert, inkl. rotem Menüknopf).
- Das Upstream-Setting `AutomaticNegotiation` ist in 4.8.3 versteckt (`hidden`, immer an); der Assistent öffnet sich also bei jeder Verhandlung, mit dem neuen Setting auch in GbG.
- Nachgezogen für 1 und 3: die Einstellungen brauchen in 4.8.3 einen Eintrag `Settings.Entry.<Name>` für den Untertab-Namen. Ergänzt für `ShowNeighborsLootables`, `ShowPlayersAttDeffValues`, `ShowPossibleInvestments` und `AutomaticNegotiationForGbG` (vorher stand dort der i18n-Schlüssel).
- Offen: ob die GbG-Verhandlung im Spiel 2026 noch dasselbe Format wie die normale Verhandlung hat (`NegotiationGameService.startNegotiation`, `context`), ist nicht geprüft. Upstream sperrt GbG seit Jahren, Fehler in diesem Pfad würden upstream also nicht auffallen.

**Notizen 8**
- Wie alt: jede verschiebbare Box (`HTML.Box` mit `dragdrop`) bekommt in der Kopfzeile den Knopf `window-dragtoggle` (`<id>-dragtoggle`), außer mit `fixdragdrop: false` (nur `CloseBox`, wie alt). Zustand pro Box in `localStorage` `<id>Draggable` (default verschiebbar). Das Menü (`menu_box`, Box-Menü) hat den Knopf damit auch.
- Anpassung: neue Hilfsfunktion `HTML.IsDraggable(id)`; `HTML.DragBox` entfernt bei fixierter Box den Handler statt einen `toggle`-Parameter zu nehmen (alt: `DragBox(el, save, toggle)`). Damit bleibt eine fixierte Box auch fixiert, wenn sie aus einem Pop-up-Fenster (`popup.js`, neu in 4.8.3) zurückkommt. Im Pop-up ist der Knopf ausgeblendet.
- Icon: das alte Sprite-Feld (`box-sprite.png` bei -220px) belegt in 4.8.3 das Pop-out-Icon, das Sprite wird deshalb nicht ersetzt. Das Icon (Verschiebe-Pfeile, gelb = fixiert) kommt als SVG per `::after` wie Upstreams `window-split`. Neuer Tooltip `Boxes.General.DragToggle`. Das ungenutzte alte `_menu_box.ToggleDraggable` und `Boxes.Menu.ToggleDrag` entfallen.
- `CloseBox` wie alt: `Ignore: ['menu_box']` (Alle ausblenden/schließen lässt das Box-Menü stehen; in 4.8.3 hätte "Alle schließen" das Menü entfernt), Titel ohne Suffix (`onlyTitle`). `Ignore` liegt anders als alt nicht in `CloseBox.Settings`, damit es nicht in `CloseBoxSettings` gespeichert wird.
- Die Resize-Nebenänderung (`minWidth`/`minHeight` aus CSS) gehört zum Bugfix-Punkt, s. dort.

**Notizen 9**
- Geprüft, nichts zu tun: `background.js` setzt in `triggerAlert` `requireInteraction: alert.data.persistent||false` (außer Firefox, dort gibt es die Option nicht; die Toolbox hat kein Firefox-Manifest mehr) und bei `showNotification` `requireInteraction: options.persistent`. Beides entspricht der alten Toolbox.

**Notizen 10**
- Zwei Optionen im Einstellungsdialog des Eigenanteilsrechners (`parts/settings.js`, neu in 4.8.3 ausgelagert): "1 FP für Plätze ohne FP berechnen" (`OneFPForNonFPPlace`) und "Bonuseinstellung pro LG speichern" (`ArcBonusForEachGB`), gespeichert wie alt unter `OwnPart_<Name>_<Spieler-ID>`.
- `OneFPForNonFPPlace` default aus wie alt: ein Platz mit Belohnung, aber ohne FP zählt dann 0 statt 1 FP. Achtung: das ändert das Upstream-Verhalten (Upstream rechnet immer 1 FP), s. offene Fragen.
- `ArcBonusForEachGB`: Arche-Prozente unter `OwnPart_ArcPercents_<cityentity_id>_<Spieler-ID>` (`Parts.ArcPercentsStorageKey`). Anpassung: alt wurden die Prozente nur beim ersten Rendern der Sitzung geladen (beim Wechsel auf ein anderes LG galten die alten Werte weiter, gespeichert wurde aber unter dem neuen LG), jetzt bei jedem LG-Wechsel. Ohne gespeicherte Werte für das LG gelten die globalen Prozente, erst dann die Standardwerte 90 % (alt direkt 90 %, und das Standard-Array wurde durch die Knöpfe verändert).

**Notizen 11**
- Upstream hat die Blaue Galaxie neu geschrieben (Gebäude aus `MainParser.CityBuildingsData`, `state.production[]`, sortierbare Icon-Spalten, kein "Erwarteter Bonus" mehr). Diamanten jetzt als eigene sortierbare Spalte nach FP (Icon aus `productions.png` wie im Produktions-Tab "Diamanten"), sie zählen wie alt 1:1 in die Gesamtbewertung (`CombinedValue`) und halten ein Gebäude in der Liste (auch im 23,5-h-Filter).
- Quelle: Produktionen vom Typ `resources` mit `resources.premium` (alt `products.premium`, gleiche Bedeutung; so liest auch Upstream `productions.js` Diamanten).
- Entfällt: der Diamanten-Anteil im "Erwarteten Bonus" (`EstimatedBonus`), die Anzeige gibt es in 4.8.3 nicht mehr.
- Offen: Diamanten aus generischen Belohnungen (`genericReward`, z. B. Diamanten-Pakete) werden nicht gezählt, das Format ist nicht bekannt. Ob die Galaxie Diamanten verdoppelt, ist nicht geprüft (alt angenommen).

**Notizen 12**
- Wie alt: Ereignisse mit `startTime` in der Zukunft stehen in `HiddenRewards.FutureCache` und in der Liste nach den aktiven mit "Erscheint <relativ>" (orange, `warning`). Eigener oranger Zähler `#hidden-future-reward-count` (unten rechts am Menüknopf, Farbe `--hud-counter-warn`), gezählt nach derselben Einstellung `CountRelics` wie der normale Zähler (`HiddenRewards.GetCount`).
- Anpassung: Upstream-Name `FilteredCache` für die aktiven Ereignisse bleibt (alt umbenannt in `ActiveCache`). Upstream setzt inzwischen selbst Timer auf den Startzeitpunkt (`RefreshGui`), damit wandert ein Ereignis von selbst aus der Zukunfts- in die aktive Liste.
- Bugfix gegenüber alt: die Box schloss sich nach `getOverview`, sobald **eine** der beiden Listen leer war (`||`); jetzt nur, wenn beide leer sind. `RefreshGui` ohne geladene Ereignisse warf einen TypeError, jetzt Abbruch.
- Die Warnung "zweispurige Straße fehlt" betrifft weiter nur aktive Ereignisse (wie Upstream).

**Notizen 13**
- Scroll zum aktiven Gebäude: hat Upstream inzwischen selbst, nichts übernommen. Das aktive Gebäude heißt in 4.8.3 `.highlighted` (alt `.pulsate`), bleibt beim Neuzeichnen erhalten (`SetMapBuildings` liest `ActiveId` aus dem DOM) und `CityMap.FocusEntities` zentriert es (Produktionen "auf der Karte zeigen", Zoom-Wechsel, Toolbox-Auge aus 1). Der alte Parameter `ActiveEntityId` von `CityMap.init` und `scrollToActiveElementOrCenter` entfallen.
- Tooltips: `trigger: 'hover'` an beiden Bootstrap-Tooltip-Aufrufen in `citymap.js` (Außenposten/QI und Hauptstadt). Die Gebäude der Hauptstadt nutzen in 4.8.3 meist den eigenen Tooltip (`fh-tooltip`, nur Hover), dort war nichts zu tun.
- Double-Opt-In wie alt: `window.confirm(Boxes.CityMap.SendDoubleOptIn)` vor dem Senden der Stadt (`CityMap.SubmitData`) und eines Außenpostens (`Outposts.SubmitData`). Anders als alt erst nach der Prüfung auf den API-Token (den verlangt 4.8.3 neu), damit ohne Token nicht erst gefragt und dann abgebrochen wird. Text wie alt (Ziel `api.foe-rechner.de`, Anzeige auf foe-helper.com), Tippfehler korrigiert.
- Versand unabhängig von `GlobalSend` (alt `forceSend = true`): kommt mit 15.

**Notizen 14**
- Wie alt: `MainParser.GetPlayerLink`, `GetGuildLink` und `GetBuildingLink` setzen den Link nur auf das Icon, der Name steht davor als Text. Gilt auch für die neue Upstream-Linkquelle ForgeDB (`linkSite = siteForgedb`), die Ziel-URLs sind unverändert.
- Nicht geprüft: ob eine Upstream-Box den Namen über das `<a>` ausliest oder stylt (z. B. Farbe des Namens über `.external-link`). Im Code keine Stelle gefunden, die den Linktext liest.

**Notizen 15**
- `GlobalSend` default aus und mit `doubleoptin` (Gruppe bleibt wie Upstream "About", alt eigene Gruppe "Sending"). Beschreibung um den alten Bann-Hinweis ergänzt, neuer Text `Settings.GlobalSend.DoubleOptIn`.
- Double-Opt-In jetzt ausgewertet (`settings.js`): Einträge mit `"doubleoptin": true` bekommen die Klasse `doubleoptin`, beim **Einschalten** fragt `window.confirm(Settings.<Name>.DoubleOptIn)`, bei Abbruch bleibt der Schalter aus und nichts wird gespeichert (wie alt). Betrifft `ShowNeighborsLootables`, `ShowPlayersAttDeffValues`, `ShowPossibleInvestments`, `AutomaticNegotiationForGbG`, `GlobalSend`. Ausschalten geht ohne Rückfrage.
- `MainParser.send2Server(data, ep, success, error, forceSend = false)`: sendet nur mit `GlobalSend` oder `forceSend` (alt 4. Parameter, in 4.8.3 ist der 4. der neue Fehler-Callback). `forceSend` setzen nur Stadtplaner und Außenposten (nach dem Double-Opt-In aus 13) und der Notizen-Import (nach seiner Rückfrage). Neu `MainParser.IsGlobalSendEnabled()` liest `localStorage` direkt, weil manche Handler vor dem Laden der `config.json` laufen.
- Versand über den Background wie alt: neuer Nachrichtentyp `send2Server` in `background.js` (POST mit `fetch`, Antwort `{status, statusText, body}`), Fehler gehen an den Fehler-Callback. Anders als alt: nur die URL `https://api.foe-rechner.de/` und Endpunkte aus `[A-Za-z0-9/_-]` erlaubt (die Nachricht ist auch von der Spielseite aus erreichbar), Parameter per `URLSearchParams`.
- Timeout von `sendExtMessage` 1 s -> 5 s wie alt (Server-Anfragen laufen jetzt durch den Background).
- Neu gegenüber alt, gleiche Absicht ("ohne GlobalSend wird nichts gesendet"): Upstream 4.8.3 schickt zusätzlich ungefragt die Weltenliste (`Worlds`), eigene LG-Daten (`OwnLGData`, `SendLGData`) und die Gebäudeliste (`BuildingList`, `srcLinks.js`) an die API. Diese drei laufen jetzt nur noch mit `GlobalSend`, wie `SelfPlayer` schon alt. S. offene Fragen.
- Notizen: eigene Module, lokal, ohne `GlobalSend`, s. "Notizen lokal". Die Ban-Erkennung (Antwort ohne Fehler, aber ohne `notice` -> `Boxes.Notice.BannedFromApi`) gilt nur noch für den Import vom Helfer-Server.
- Entfällt: der alte Guard in `Notice.SaveContent` (`if (GlobalSend === true) return`) war verdreht und hätte das Speichern bei aktiver Übermittlung verhindert. Das alte Debug-`console.log` im Background entfällt.
- Achtung: die Einstellungen liegen im `localStorage` der Spielseite. Läuft parallel der FoE Helfer, teilen sich beide den Schlüssel `GlobalSend`.

**Notizen Bugfix Resize**
- Geprüft: in 4.8.3 ist nichts vertauscht, `HTML.Resizeable` nutzt feste Werte (`minHeight: 100`, `minWidth: 220`, Sonderfall `menu_box` 101/87). Vertauscht war nur die alte Toolbox-Nebenänderung zu 8 (`minHeight` aus `min-width`, `minWidth` aus `min-height`), das ist ein echter Fehler: die CSS-Werte sind Breiten bzw. Höhen der Box (z. B. `#Castle` `min-width: 360px`, `#CalculatorBox` 280px, City-Builder 600px).
- Übernommen in richtiger Zuordnung: `minWidth` aus `min-width`, `minHeight` aus `min-height` der Box, nur `px`-Werte größer 0 (alt hätte `0px` oder Prozentwerte wie `40%` übernommen), sonst die Upstream-Werte 220/100. Der Sonderfall `menu_box` bleibt (alt entfernt), das Menü hat keine CSS-Mindestgröße.

### Delta-Analyse (Toolbox 1.24.0.0 gegen Helfer 3.1.0.1)


Stand der Analyse: Toolbox `master` (48c8823, 2023-03-24) gegen Upstream-Export von `86f9439d`; Upstream HEAD = `master` v4.8.3.0. Beide Repos nur gelesen.

### Methodik und Baseline-Check
- Baseline: `manifest.json` Upstream = 3.1.0.1, Toolbox = `1.24.0.0 (3.1.0.1)` (`version_name`). Viele Module sind byte-identisch (kits, discord, castle, productions, investment, greatbuildings, guildfights, eventhandler, alerts, minigame_aztecs, scoutingtimes). Die Baseline ist passend; kein naeherer Stand noetig. Ein Vergleich mit Nachbarversionen wurde nicht gemacht.
- `vendor/` ist identisch zur Baseline (kein Diff).
- `origin/topic-rewrite` (letzter Commit 2021-03-29, c52744f): vollstaendig in `master` enthalten (0 Commits nur im Branch, Merge-Base = Branch-Spitze, master ist 78 Commits weiter). Kein Handlungsbedarf.
- Wiki "Unterschiede zum FoE-Helfer" (Repo `sdn-br/foe-toolbox.wiki`). Das Wiki-`Changelog.md` ist inhaltlich gleich zu `changelog.md` im Repo, nur anders formatiert.

### Zusammenfassung

Klassen: (a) eigenes Feature, (b) Upstream-Feature, das Toolbox behaelt, Upstream aber entfernt hat, (c) Aenderung an Upstream-Feature, (d) Branding/Infrastruktur.
"Upstream HEAD": ja/nein/teilweise = Feature (in irgendeiner Form) in v4.8.3.0 vorhanden.

| # | Feature | Klasse | ca. Zeilen | Upstream HEAD | GvG/obsolet |
|---|---------|--------|-----------:|---------------|-------------|
| 1 | Plünderhilfe / Stadtinformationen (`sabotage`) | b | 811 + ~130 in _main/_menu | nein | nein |
| 2 | PvP Angriffe (`looting`) inkl. IndexDB `neighborhoodAttacks` | b | 1088 + ~100 | teilweise (anderes Modul `pvparena`) | nein |
| 3 | Snipehilfe: Vorab-Scan LG-Übersicht (`LGInvestmentOverviewBox`) | b | ~330 in calculator.js | nein | nein |
| 4 | Kostenrechner: "Minimal Investition", BP/Medaillen-Tabelle, FP im Lager, Spieler-Aktivität | c | ~250 | nein | nein |
| 5 | Kostenrechner schreibt GBs in IndexDB (`RefreshGreatBuildingsDB`) | c | ~40 | teilweise | nein |
| 6 | GvG Angriffshilfe (Fight-HUD, Strg+Alt+A/D/S) + GvGMap-Tweaks | a | ~130 js + 187 css | nein (GvG am 2024-03-18 entfernt, "RIP GvG") | **GvG** |
| 7 | Verhandlungsassistent in Gildengefechten (GbG) | b | ~10 + Setting | nein (Upstream: "no negotiation helper for GBG") | GbG (Gilden-Schlachtfelder), existiert noch im Spiel |
| 8 | Fenster fixieren (Drag-Toggle) | a | ~80 + css + menu | nein | nein |
| 9 | Alarme: `requireInteraction` (persistent) | c | 1 Zeile | ja (`background.js`) | nein |
| 10 | Eigenanteilsrechner: "1FP für Plätze ohne FP", Bonus pro LG speichern | a | ~40 | nein | nein |
| 11 | Blaue Galaxie: Diamanten-Spalte | a | ~16 | nein | nein |
| 12 | Versteckte Ereignisse: Zukunfts-Ereignisse mit eigenem Zähler | a | ~70 | nein | nein |
| 13 | Stadtübersicht: Scroll zum aktiven Gebäude, Tooltips per Hover, Double-Opt-In beim Senden | c | ~55 | teilweise (Upstream liest `ActiveId` aus dem DOM) | nein |
| 14 | Spielerlinks nur auf dem Link-Icon | c | 3 Zeilen | nein (Upstream verlinkt Name + Icon) | nein |
| 15 | Datenschutz: `GlobalSend` default aus, Double-Opt-In, Versand via background, Ban-Erkennung | a/c | ~150 | teilweise (Setting existiert, default `true`) | nein |
| 16 | Spieler-/CityEntity-Datenmodell für 1-3 (PlayerDict, `is_plunderable` u.a., `responseData` im Proxy) | a (Unterbau) | ~200 | nein | nein |
| 17 | Branding, de-only, Update/Install-Logik, Reload-Abfrage, DB-Migration | d | s. unten | n/a | nein |

Empfehlung zum Lesen: 1-3 und 7 sind die Features, die laut Wiki "auf Drängen von InnoGames" aus dem Helfer entfernt wurden (Bann-Risiko; im Toolbox-Code mit Double-Opt-In abgesichert).

### Details je Feature

#### 1. Plünderhilfe / Stadtinformationen (Klasse b)
- Beschreibung: Beim Besuch einer fremden Stadt Angriffs-/Verteidigungswerte (inkl. Armee-Boni), plünderbare Produktionen (fertig/laufend, nach Wichtigkeit), Plünderabwehr, Stadtschild-Info, Alarm für nächsten möglichen Angriff.
- Dateien: `js/web/sabotage/js/sabotage.js` (729), `js/web/sabotage/css/sabotage.css` (82), `css/images/sabotage.png`, `css/images/plunderrepel.png`, `css/images/shield.png`, `css/images/menu/sabotage.png`, `js/internal.json` (Modul registriert), `js/web/_menu/js/_menu.js` (`sabotage_Btn`), `js/web/_main/js/_main.js` (CityEntity-Flags `is_plunderable`, `is_motivatable`, `is_polishable`, Chain-Infos; Handler `getOtherPlayerVO`/`getEventsPaginated`), `css/web/boxes.css` (Menü-Icon), i18n `Boxes.Sabotage.*`, `Menu.Sabotage.*`, `Boxes.Neighbors.*`.
- Settings: `ShowPlayersAttDeffValues` (default an, Opt-In), `ShowNeighborsLootables` (default aus, Opt-In).
- Upstream HEAD: nein (kein `sabotage`/`looting`-Verzeichnis, keine Treffer).
- Hinweis: Das Modul heisst im Code "Sabotage" (Originalname `read-buildings.js`), im UI "Stadtinformationen". Im Wiki unter "Plünderhilfe".
- Obsolet: kein Hinweis im Code. Plündern/Nachbarschaft existiert im Spiel weiter.

#### 2. PvP Angriffe (`looting`) (Klasse b)
- Beschreibung: Historie von Nachbarschafts- und PvP-Arena-Kämpfen (Sieg/Niederlage/Aufgabe/Autokampf, Armeen mit Werten, geplünderte Items, Doppelbonus, Stadtschild-Ende), Filter nach Spieler, aktuelle PvP-Arena-Gegner, Summen FP.
- Dateien: `js/web/looting/js/looting.js` (841), `js/web/looting/css/looting.css` (247), `css/images/doubleloot.png`, `js/web/x_img/doubleloot.png`, `css/images/menu/looting.png`, `js/web/indexdb/js/indexdb.js` (Tabelle `neighborhoodAttacks` statt Upstream `pvpActions`, Cleanup abgelaufener Einträge, Migration aus `FoeHelperPrivateDB_*`), `js/web/_menu/js/_menu.js` (`looting_Btn`), `_main.js` (`PVPArenaService.getOverview` -> PlayerDict), i18n `Boxes.Looting.*`.
- Upstream HEAD: teilweise. Es gibt ein anderes Modul `js/web/pvparena` (PvPArena-Kampfliste) und noch eine Tabelle `pvpActions` im IndexDB-Schema. Eine Plünder-Historie gibt es nicht.
- Obsolet: kein Hinweis.
- Achtung: Datenmodell-Konflikt zu Upstream (`neighborhoodAttacks` vs. `pvpActions`), falls die DB-Migration mit übernommen wird.

#### 3. Snipehilfe: Mögliche Investitionen (Klasse b)
- Beschreibung: Beim Öffnen der LG-Übersicht eines Spielers wird die Liste gescannt und mögliche (lohnende) Einzahlungen werden vorab angezeigt (Gebäude, Level, Eingez./Gesamt, Gewinn, Kurs, Farbcode "neu gefunden/wiedererkannt/keine Einzahlung", Ton). Detail- und Übersichtsansicht werden über `Calculator.Open()` gesteuert.
- Dateien: `js/web/calculator/js/calculator.js` (`Open`, `initCalculator`, `ShowPossibleInvestments`, `PlayOverviewSound`, ca. 330 Zeilen), `js/web/calculator/css/calculator.css`, `_main.js` (Handler `getOverviewForGuild`-artig, Setting-Abfrage), `_menu.js` (`Calculator.Open(true)`), i18n `Boxes.LGInvestmentOverviewBox.*`, `Boxes.Calculator.PlayerInactive|PlayerActivityUnknown`.
- Setting: `ShowPossibleInvestments` (default aus, Opt-In).
- Upstream HEAD: nein (keine Treffer für `LGInvestmentOverviewBox`, `Calculator.Overview`).
- Obsolet: kein Hinweis.

#### 4. Kostenrechner-Erweiterungen (Klasse c)
- Beschreibung: (i) dritte Tabelle "Minimal Investition" (`AggressiveInvestment`, nutzt `SaveRankCosts`) mit Einsatz/Gewinn/Kurs und Warnung bei zu wenig FP im Lager; (ii) BP/Medaillen aus der Fordern-Tabelle in eigene Tabelle `costTableBPMeds` ausgelagert; (iii) Anzeige "FP im Lager" im Kopf.
- Dateien: `js/web/calculator/js/calculator.js` (gesamt 591 Diff-Zeilen inkl. Feature 3), `js/web/calculator/css/calculator.css` (90), i18n `Boxes.Calculator.AggressiveInvestment|TTAggressiveInvestmentFPStockLow|Rate|Profit`.
- Upstream HEAD: nein (`costTableBPMeds`, `AggressiveInvestment` nicht vorhanden; nur `costTableFordern`). `SaveRankCosts` selbst existiert upstream weiter.
- Obsolet: kein Hinweis.

#### 5. Kostenrechner -> GB-Datenbank (Klasse c)
- Beschreibung: `RefreshGreatBuildingsDB` schreibt Level, aktuelle FP und besten Kurs je LG in die IndexDB-Tabelle `greatbuildings` (Grundlage für Feature 3, "wiedererkannt").
- Dateien: `calculator.js` (ca. 40 Zeilen), `indexdb.js` (Cleanup `greatbuildings`).
- Upstream HEAD: teilweise (`bestRateNettoFp` und Tabelle `greatbuildings` existieren, Details nicht geprüft).

#### 6. GvG Angriffshilfe + GvGMap-Tweaks (Klasse a) — GvG-bezogen
- Beschreibung: Optisches Overlay (`#gvgfight-hud`) markiert die Kampfknöpfe (Auto-Kampf/OK bzw. Schnittpunkt "Idealspot", Belagerungsarmee, Bezahlen+Platzieren, manueller Angriff). Hotkeys Strg+Alt+A (Overlay), Strg+Alt+D (Idealspot/Auto+OK), Strg+Alt+S (manuell). Knopf im GvG-HUD. Zusätzlich: GvGMap-Titel "BETA", Felsen/Wasser-Sektoren im Tooltip als "---", i18n `Terrain_rocks|water`.
- Dateien: `js/web/gvg/js/gvg.js` (~130 Diff-Zeilen, Datei 1413 Zeilen), `js/web/gvg/css/gvg.css` (187), `js/web/x_img/gvg-army.png`, `gvg-army.xcf`, i18n `Settings.ShowGvGFightHud.*`.
- Setting: `ShowGvGFightHud` (default aus).
- Upstream HEAD: nein. GvG-Modul komplett gelöscht (`4e8fd585` "RIP GvG", `2d11fac1` "Delete gvg.js", 2024-03-18). Die Toolbox-GvG-Basis (`gvg.js`, GvGMap) ist selbst ebenfalls weg.
- **GvG-Flag: ja.** Gesamtes Feature obsolet, wenn GvG im Spiel nicht mehr existiert; auch das übrige `js/web/gvg` (identisch zur Baseline) hat keine Entsprechung mehr.

#### 7. Verhandlungsassistent in Gildengefechten (Klasse b)
- Beschreibung: Assistent startet auch im Kontext `guildBattleground`. Upstream bricht dort ab und färbt nur den Menüknopf rot.
- Dateien: `js/web/negotiation/js/negotiation.js` (1 Zeile: `&& !Settings.GetSetting('AutomaticNegotiationForGbG')`), `settings/config/config.json`, i18n `Settings.AutomaticNegotiationForGbG.*`.
- Setting: `AutomaticNegotiationForGbG` (default aus, Opt-In).
- Upstream HEAD: nein (Guard "no negotiation helper for GBG" bleibt).
- GvG-Flag: nein. GbG = Gildenschlachtfelder, nicht GvG. Der Begriff "Gildengefechte" im Wiki bezeichnet hier GbG (siehe Abweichungen unten).

#### 8. Fenster fixieren (Klasse a)
- Beschreibung: Button in der Fensterkopfzeile (`window-dragtoggle`) und im Menü (`Boxes.Menu.ToggleDrag`) schaltet Verschiebbarkeit um, Status in `localStorage` (`<id>Draggable`).
- Dateien: `js/web/_helper/js/_helper.js` (56), `js/web/_menu_box/js/_menu_box.js`, `js/web/settings/js/settings.js` (`dragdrop: true`), `js/web/closebox/js/closebox.js` (`Ignore: ['menu_box']`, `fixdragdrop: false`), `css/web/boxes.css` (`.window-dragtoggle`, ~50), `css/images/hud/box-sprite.png` (neues Sprite-Icon).
- Upstream HEAD: nein (`window-dragtoggle`, `fixdragdrop` ohne Treffer).
- Nebenänderung in `_helper.js`: Resize-`minWidth/minHeight` aus CSS statt fest (und menu_box-Sonderfall entfernt). Vertauschte Werte (`min-width` -> `minHeight`) sehen wie ein Bug aus.

#### 9. Alarme: `requireInteraction` (Klasse c)
- Datei: `background.js` (Zeile `requireInteraction: alert.data.persistent`).
- Upstream HEAD: ja (`requireInteraction: alert.data.persistent||false`). Nichts zu übernehmen.

#### 10. Eigenanteilsrechner (Klasse a)
- Beschreibung: Option "1FP für Plätze ohne FP berechnen" (`OneFPForNonFPPlace`); Option "Bonuseinstellung pro LG speichern" (`ArcBonusForEachGB`, Arche-Prozente je `cityentity_id`, `DefaultArchPercents`).
- Dateien: `js/web/part-calc/js/part-calc.js` (39 Diff-Zeilen), i18n `Boxes.OwnpartCalculator.OneFPForNonFPPlace|ArcBonusForEachGB`.
- Upstream HEAD: nein (beide Namen ohne Treffer; Upstream `ArcPercents` global).
- Wiki: nicht erwähnt (nur im Changelog 1.19.2.0 / 1.2x).

#### 11. Blaue Galaxie: Diamanten (Klasse a)
- Dateien: `js/web/bluegalaxy/js/bluegalaxy.js` (16), i18n `Boxes.BlueGalaxy.Diamonds`.
- Upstream HEAD: nein (keine Diamanten-Spalte).
- Wiki: nicht erwähnt (Changelog "Diamanten werden jetzt mit angezeigt").

#### 12. Versteckte Ereignisse: Zukunft (Klasse a)
- Beschreibung: Zukünftige Ereignisse (`starts` in der Zukunft) werden in der Liste mit "Erscheint ..." gezeigt und mit eigenem orangen Zähler (`hud-future-counter`) am Menüknopf gezählt.
- Dateien: `js/web/hidden-rewards/js/hidden-rewards.js` (71), `js/web/_menu/js/_menu.js`, `css/web/boxes.css`, `css/web/variables.css` (`--hud-counter-warn`), i18n `Boxes.HiddenRewards.Appears`.
- Upstream HEAD: nein (nur `FilteredCache` der aktiven Ereignisse).

#### 13. Stadtübersicht / Karten (Klasse c)
- Beschreibung: `CityMap.init(..., ActiveEntityId)`, Scroll auf aktives Gebäude (`scrollToActiveElementOrCenter`), Tooltips `trigger: 'hover'`; Double-Opt-In-Dialog vor Senden der Stadt an den Server (auch Außenposten).
- Dateien: `js/web/citymap/js/citymap.js` (56), `js/web/outposts/js/outposts.js` (4), i18n `Boxes.CityMap.SendDoubleOptIn`.
- Upstream HEAD: teilweise. Upstream hat `ActiveId` aus dem DOM (`.highlighted`), kein Double-Opt-In. Toolbox-`citymap.js` hat gegenüber der Baseline teils weniger (`Data === false`-Zweig für getrennte Städte fehlt) -> Toolbox-Version wirkt hier stellenweise älter als 3.1.0.1. Nicht verifiziert.

#### 14. Spielerlinks (Klasse c)
- `js/web/_main/js/_main.js` (`GetPlayerLink|GetGuildLink|GetBuildingLink`): Link nur auf dem Icon, nicht auf dem Namen.
- Upstream HEAD: nein (verlinkt Name + Icon).

#### 15. Datenschutz / Senden (Klasse a/c)
- `GlobalSend` default `false` (Upstream `true`), mit Double-Opt-In-Bestätigung (`"doubleoptin": true` im Config + `settings.js`, i18n `*.DoubleOptIn`); `MainParser.send2Server` nur bei aktivem Setting (außer `forceSend`) und läuft über `background.js` (`send2Server` per `fetch`); `Notice` erkennt Sperre ("BannedFromApi") anhand der API-Antwort und sendet dann nicht mehr; Notizen laden nur bei `GlobalSend`; Proxy-Timeout 1000 -> 5000 ms; Debug-`console.log` bleibt drin.
- Dateien: `_main.js`, `background.js`, `settings.js`, `config.json`, `notice.js` (16), `foeproxy.js` (reicht `responseData` an Handler durch, wird von Looting genutzt).
- Upstream HEAD: teilweise (`GlobalSend` existiert, `send2Server` existiert, Rest nein).
- Wiki: nicht erwähnt.

#### 16. Unterbau (Klasse a, nur zusammen mit 1-3 sinnvoll)
- `_main.js`: `PlayerDict` erweitert (`IsActive`, `WonBattles`, Datumsfelder, `loadPlayerIntoDict`, Promise-Rückgabe), IndexDB-Funktionen `loadPlayer`, `addUserFromPlayerDictIfNotExists` auf Promise umgebaut, CityEntity-Flags. Dateien: `_main.js` (208 Diff-Zeilen), `indexdb.js` (318), `foeproxy.js` (24).
- Nicht einzeln übernehmenswert.

#### 17. Branding / Infrastruktur (Klasse d)
- Manifest: `default_locale: de`, Version `1.24.0.0`, `version_name "1.24.0.0 (3.1.0.1)"`, zusätzliche Permission `scripting`.
- `background.js`: Notification-Kontext "FoE Toolbox", Update-Hook öffnet GitHub-Wiki-Changelog (statt foe-helper.com), Reload-Abfrage in allen offenen FoE-Tabs per `scripting.executeScript` (`InstallConfirm`).
- `js/inject.js`: liest Basisversion aus `version_name` -> `extBaseVersion`; `_main.js` sendet `extBaseVersion` an die API (`SelfPlayer ... &v=`). Settings zeigt "Basis: FoE Helfer x".
- Nur Deutsch: `_locales/` nur `de`, `js/web/_i18n/` nur `de.json`, `_languages.js` nur `de`; `_main.js` Fallback-Sprache `de` statt `en`; `popup.js` ohne andere Sprachen. Entfernt: alle anderen Sprachen, `LoadBeta`, `Help`, Weblate-Link, `Settings.Version.Link` auf eigenes Changelog, `manifests/firefox`, `changelog-de/en.md` (ersetzt durch `changelog.md`), `private code.js`.
- Texte/Icons: popup.html, alerts.html, README, `images/app*.png`, DB-Export-Dateiname `foe_toolbox_export`, Bonus-Service-Titel, `foe-toolbox.xcf`, `sabotage.xcf`.
- IndexDB: Migration aus `FoeHelperPrivateDB_<id>` und `FoeHelperDB_<id>` in die Haupt-DB (Hinweis: Toolbox-Basis stammt aus "FoE Helper Private").
- Kleinere Rückschritte ggü. Baseline (Toolbox hat weniger): `_menu_bottom.InsertMenuItem` fehlt, ein paar de.json-Texte weichen ab (z.B. "Gewinn" statt "Differenz", `Settings.ShowOwnPartOnAllGBs.Desc`).

### Abweichungen Wiki gegen Code
- Wiki "Gildengefechte: Alarme für Provinzen wieder löschen": im Code kein Unterschied (`guildfights/` ist identisch zur Baseline). Das Feature ist wohl ebenfalls schon im Upstream 3.1.0.1 oder wird anders erreicht. Kein Delta.
- Wiki "GvG: Hilfe für Kampfbuttons" = Feature 6. Das Wiki nennt aber nicht die Hotkeys und nicht die GvGMap-Tweaks.
- Wiki "Verhandlungsassistent in den Gildengefechten" = GbG (Feature 7), nicht GvG.
- Wiki "Alarme bleiben unter Windows offen" = Feature 9, inzwischen in Upstream.
- Wiki "Fenster fixieren" = Feature 8.
- Im Wiki fehlen: Features 4, 5, 10, 11, 12, 13, 14, 15 (nur im Changelog bzw. Code).
- Wiki-Feature "PvP Angriffe" heisst im Code `looting`, "Plünderhilfe" heisst im Code `sabotage`/UI "Stadtinformationen".
- Wiki-Hinweis, viele Features seien per Default aus: stimmt (`config.json`: `GlobalSend`, `ShowNeighborsLootables`, `ShowPossibleInvestments`, `ShowGvGFightHud`, `AutomaticNegotiationForGbG` = aus; `ShowPlayersAttDeffValues` = an). Ausserdem ein Setting mit `"status": false` statt `true` (zweiter Eintrag der Liste ab Zeile 42, vermutlich `AutomaticNegotiation`/`ShowOwnPartOnAllGBs`-Nachbar; Zuordnung nicht verifiziert).

### Rauschen (nicht bewertet)
- Binär/Bilder: `images/app*.png` (neu), `css/images/hud/box-sprite.png` (geändert), neue Bilder `doubleloot.png`, `plunderrepel.png`, `sabotage.png`, `shield.png`, `menu/{looting,sabotage,citymap_external}.png`, `x_img/{doubleloot,gvg-army}.png`; `.xcf`: `foe-toolbox.xcf`, `gvg-army.xcf`, `sabotage.xcf`.
- `citymap_external.png` liegt in `css/images/menu/` und wird im Code nirgends referenziert (toter Asset).
- Fehlende Upstream-Sprachen (`_locales`, `_i18n`, 20+ Dateien) und `manifests/firefox`.
- Reine Whitespace-/Format-Änderungen (`diff -w` ignoriert).

### Unsicherheiten
- Baseline wurde nicht gegen Nachbarversionen verglichen; viele Module sind identisch, daher ist 3.1.0.1 plausibel.
- "Upstream HEAD: teilweise" bei 2, 5, 13, 15 beruht auf Stichproben per `git grep`, nicht auf vollständigem Code-Vergleich.
- Zeilenzahlen sind Diff-Zeilen (`diff -w`, `>`/`<`) bzw. Dateigröße, nur Richtwerte.
- Prüfung "Spiel-Feature noch vorhanden" nur aus dem Code, nicht aus dem Spiel. Nur GvG ist durch den Upstream-Commit "RIP GvG" belegt.

## Übernahme aus Forge Hammer: GbG-Aktions-Log

Quelle: `forge-hammer` `js/web/gbg-actionlog` ("Copyright (C) 2026 Forge Hammer & Arklur", Header unverändert).

- Modul `js/web/gbg-actionlog` (JS + CSS) fast unverändert übernommen, damit spätere Forge-Hammer-Änderungen per Diff nachgezogen werden können. Abweichungen im JS: DB-Name und Legacy-Kopie in `checkForDB`, `GuildFights` -> `Guild_fights` (Standardwert von `loadActionLog`, `serverOffset`). Im CSS: Forge-Hammer-Variablen auf Toolbox-Variablen umgestellt (`--bg-light` -> `--background-light`, `--bg-dark` -> `--text-darker`, `--text` -> `--beige`), `.btn-round` im Modul ergänzt.
- Kompatibilitätsschicht `js/web/fh-compat`: bildet nur die `FH.*`-Namen ab, die das Modul nutzt: `FH.t` -> `i18n`, `FH.HTML` -> `HTML`, `FH.helper` -> `helper`, `FH.proxy` -> `FoEproxy`, `FH.Main` -> `MainParser`, `FH.Storage.getItem/setItem` -> `localStorage` ohne Präfix `Hammer.` und ohne das Kopieren fremder Schlüssel, `FH.DateFormat.get('dateLong'|'dateTimeLong')` -> `i18n('Date')`/`i18n('DateTime')`. Dazu `ProvinceMap.SectorMapping` (Kurznamen der Sektoren beider Karten nach Karten-ID), weil die Toolbox nur die Sektoren der aktuellen Karte kennt. Ist schon ein globales `FH` da (Forge Hammer parallel installiert), wird es nicht ersetzt.
- `i18nOr` braucht keine Anpassung: `i18n` gibt einen fehlenden Schlüssel unverändert zurück.
- IndexedDB `FoEToolbox2DB_GBG_<id>` (Schema wie Forge Hammer: v1 `ActionLog`, v2 `ActionLogBatch`). Einmalige Kopie aus `FoeHelperDB_GBG_<id>` (Name in Forge Hammer) über `IndexDB.openWithLegacyCopy`, die Alt-DB wird nur gelesen. `foe-helper#gbgDBloaded` kommt erst nach dem Öffnen.
- Einhängen: `checkForDB` per `StartupService`-Handler in `toolbox-main.js`; in `guild_fights.js` Knopf "Aktions-Log" neben "Snapshot Log" (immer sichtbar, auch wenn "Snapshot Log" per Einstellung aus ist), Zähler `#GBGActionLogCount` im Handler `getBattleground`, entfernt beim Verlassen der Karte (`ActiveMapUpdated`). Zähler-CSS in `boxes.css` (eigene Regel, `.hud-counter` gilt nur in `.hud-btn`).
- Einstellungen im Fenster (Schraubenschlüssel): Anzeigedauer der Meldung, Stunden bis der Zähler rot wird. `localStorage`-Schlüssel `GBGActionLogToastSeconds`, `GBGActionLogRedAfterHours`, `GBGActionLogLastCollected`, `GBGActionLogBuildingNames`. "Serverzeit anzeigen" (`LiveFightSettings.showServerTime`) gibt es in der Toolbox nicht, Zeiten sind immer lokal.
- Texte: `Boxes.GBGActionLog.*` und `General.Total` neu in `de.json`, nach der Forge-Hammer-`de.json`; dort halb englische oder falsche Texte (`RangeCap*`, `Toast.PrevLoadTime`, `Toast.CurrLoadTime`, `RedAfterHoursHint`) neu übersetzt.
- Kein neuer Netzwerkzugriff; Icons der Spalten kommen wie sonst über `srcLinks` vom Spiel-CDN.

## Notizen lokal

Upstream speichert die Notizen nur auf `api.foe-rechner.de` (`Notice/get|set|sort|del`), also nur mit `GlobalSend` und API-Token. Die Toolbox speichert sie lokal, in eigenen Modulen getrennt vom Helfer.

- Eigene Module: `toolbox-notes` (Box, Objekt `Notes`, Box-Id `toolboxNotes`, CSS `toolbox-notes.css`, Texte `Boxes.Notes.*`), `notes-store` (`Notes.Store`, Datenschicht) und `player-note` (Spielergruppe, Filter, Spielerauswahl, Notiz in der Sabotage-Box). `toolbox-notes` begann als Kopie von `notice.js` 4.8.3.0. Das Helfer-Modul `js/web/notice` ist unverändert Upstream und wird weiter geladen, aber nie geöffnet: der Menüknopf `notice` (gleiche Id, gleicher Platz) öffnet per Wrapper um `_menu.notice_Btn` (`toolbox-menu`) die Toolbox-Notizen. Helfer-Updates der Server-Notizen erreichen die Toolbox so nicht.
- IndexedDB `FoEToolbox2DB_Notice_<id>` (Name aus der Zeit vor der Trennung, bleibt; v1: `groups` `++id,sort`, `items` `++id,groupId,sort`). Keine Alt-DB, nichts zu kopieren. Öffnen per `Notes.Store.checkForDB` aus `toolbox-main.js`.
- `Notes.Store.send(data, ep, callback)` beantwortet die früheren Endpunkte `Notice/get|set|sort|del` lokal mit der Antwortform der API: `{status: 'OK', notice}`, `notice` ist das Array der Gruppen `{id, group_name, player_group, sort, items: [{id, tab, title, content, player_data, sort}]}`, sortiert nach `sort`, bei Gleichstand nach `id`. `Notes/set` mit `type: 'cnt'` (nur der Text) -> nur `{status: 'OK'}`. Fehler kommen als `{status: 'ERROR', msg}` und landen im Fehler-Toast. `Notes/get` führt vorher die Spielergruppen zusammen (`mergePlayerGroups`) und übernimmt alte Überschriften (`migrateTitles`).
- Ids vergibt die DB (Zahlen). Ids aus dem DOM kommen teils als Text, der Store wandelt sie um. Neue Spieler-Seiten werden hinten angehängt.
- Import: Knopf "Notizen von FoE-Helfer importieren" in den Einstellungen (Reiter "Info + Website") unter dem Feld "Website API-Token", per Wrapper um `Settings.ApiTokenInput` (`notes-store`). Ohne API-Token meldet der Klick `Boxes.Notes.ImportNotPossible`. `GlobalSend` ist nicht nötig: der Import ist wie Stadtplaner und Außenposten ein ausdrücklicher, bestätigter Schritt und sendet mit `forceSend`. Die Rückfrage (Modal, kein `confirm()`) nennt die Zahl der lokalen Gruppen und Seiten und sagt, dass lokal Angelegtes nicht auf dem Server liegt. Danach genau eine Anfrage `Notice/get` über `MainParser.send2Server` (Background). Antwort ohne `notice` = gesperrt: `Boxes.Notes.BannedFromApi`, lokale Daten bleiben. Leeres `notice`: `Boxes.Notes.ImportEmpty`, lokale Daten bleiben. Erfolg: in einer Transaktion `groups` und `items` ersetzen, Spielergruppen zusammenführen, Box öffnen, Toast. Fehler: lokale Daten bleiben, Fehler-Toast.
- Das ist der einzige Netzwerkzugriff der Notizen. Kein Hochladen, kein Abgleich.
- Ein Name pro Seite: die Überschrift im Seitenkopf ist der Seitenname (Feld `tab`), Bearbeiten dort benennt Seite und Reiter um (Enter oder Verlassen speichert, Escape stellt wieder her). Im Reiter wird ein langer Name mit ... gekürzt, der Tooltip zeigt ihn ganz (Helfer-Tooltip `fh-tooltip` mit `Notes.nameTT`, erscheint sofort, ein `title` hätte die feste Wartezeit des Browsers). Das Feld `title` des Helfers entfällt: `Notes.Store.migrateTitles` setzt es einmalig leer und schiebt eine abweichende Überschrift (nicht der Platzhalter `Boxes.Notes.DummyHeading`) als fette erste Zeile an den Anfang des Textes. Läuft beim Öffnen und nach dem Import.
- Bearbeiten ohne Bearbeiten-Modus (kein Zahnrad): Papierkorb rechts im Gruppen-Reiter und oben rechts im Seitenkopf, Rückfrage im Notizen-Modal statt `confirm()` (blockiert das Spiel, im Pop-out unbrauchbar), bei Gruppen mit Seiten zusätzlich `Boxes.Notes.DeleteGroupPages`. Umbenennen per Doppelklick auf den Namen im Reiter (Enter oder Verlassen speichert, Escape bricht ab). Sortieren per Ziehen, immer an, ab 5 px Strecke, damit ein Klick weiter den Reiter wechselt. Die Gruppe "Spieler" steht immer vorn (`Notes.Store.read`) und zieht nicht mit, sortiert werden nur die eigenen Gruppen. Die Gruppe "Spieler" hat weder Papierkorb noch Umbenennen, Spielerseiten heißen wie der Spieler und haben nur den Papierkorb.

## Pop-out für weitere Fenster

Upstream `popup.js` verschiebt die Box per `adoptNode` in ein eigenes Fenster und leitet nur `$('…')` dorthin um (`PopupAwareInit`). Module, die ihre Elemente nativ suchen, finden sie im Pop-out nicht.

- `popup.js`: `document.getElementById`, `querySelector`, `querySelectorAll` und `jQuery.find` suchen im Pop-out weiter, wenn das Spieldokument keinen Treffer hat. Nach Forge Hammer (`js/web/popout/js/popout.js`, `installShims`). Aktiv nur, solange mindestens ein Pop-out offen ist. `PopupAwareInit` bleibt unverändert (Upstream).
- Pop-out-Knopf neu (`popout:` in `HTML.Box`, ohne Größe, also aktuelle Boxgröße, danach die gemerkte): PvP Angriffe (`looting`), Stadtinformationen (`sabotageInfo`), Mögliche Investitionen (`LGInvestmentOverviewBox`), LG Fördern (`CalculatorBox`), LG Rechner (`OwnPartBox`), Investitionen (`Investment`), Notizen (`notices`), Gefechts-Logbuch (`GBGActionLog`). LG Investitionen (`greatbuildings`) hatte ihn schon.
- Bekannte Grenzen: Handler, die per `$('body').on(...)` oder `$(document).on(...)` am Spieldokument hängen, sehen Klicks im Pop-out nicht. Betrifft "beim Schließen speichern" der Notizen (das `blur` des Textfelds speichert vorher schon, bleibt so). Dialoge der Notizen (Gruppe, Seite, Spieler) öffnen im Spielfenster.
- Gefechts-Logbuch: Aktions-Auswahl und Spaltenfilter schließen bei Klick daneben über `$(document).on('click.gbgal')`. Die Logik steht jetzt in `GBGActionLog.closeOnOutsideClick`, ein zweiter Handler an der Box ruft sie auf, wenn die Box im Pop-out liegt (`ownerDocument !== document`). Im Spielfenster läuft weiter nur der Handler am Dokument.
- Stadtinformationen: `Sabotage.OtherPlayersBuildings` entfernt die Box bei jedem Besuch und baut sie neu auf, das schloss das Pop-out. Solange `Popup.IsOpen('sabotageInfo')`, bleibt die Box stehen und wird neu gefüllt (der Aufbau nutzt eine vorhandene Box ohnehin).
- Fenstergröße (`popup.js`, markierter Block): Upstream nimmt die gemerkte Größe `PopupSize_<id>` vor der Boxgröße. Die Toolbox nimmt als Breite mindestens die Boxbreite (eine alte gemerkte Breite schnitt sonst das X ab) und als Höhe immer die Inhaltshöhe (220 px bis 80 % der Bildschirmhöhe), eine von Hand vergrößerte Höhe wird also nicht gemerkt. Bild-im-Bild rechnet die eigene Titelleiste in die angeforderte Höhe, der gemessene Abzug steht in `PopupHeightOffset` und wird aufgeschlagen.

## LG-Daten bei Klick in einer besuchten Stadt

Upstream-Fehler (seit Helfer 4.4.0.0, in 4.8.3 nicht behoben): Ein fremdes LG, direkt in der besuchten Stadt angeklickt, füllt `MainParser.CurrentGB` nicht, LG Rechner und LG Fördern bleiben bei "Deaktiviert: Öffne zuerst das LG eines anderen Spielers!". Das Spiel schickt dann nur `GreatBuildingsService.getConstruction` und nimmt die Entity aus den Besuchsdaten, `getOtherPlayerCityMapEntity` kommt nur beim Öffnen aus der LG-Übersicht. Upstream nimmt die lokale Entity nur für eigene LGs.

- `_main.js`, Handler `GreatBuildingsService`: passt keine Entity zur Anfrage, kommt sie aus `CityMap.OtherPlayer.mapData` (aus `visitPlayer`), wenn Id und Spieler stimmen. `gbUpdateData` wird wie im Handler `getOtherPlayerCityMapEntity` vorbereitet, damit Bonus und Zeitalter aus `getConstruction` übernommen werden. Der Weg über die LG-Übersicht bleibt unverändert (frische Entity vom Server).
- `getConstruction` enthält keinen Fortschritt, das Spiel zeigt ihn ebenfalls aus den Besuchsdaten. Nach einer Einzahlung antwortet das Spiel mit `CityMapService.reset` (früher `updateEntity`). `updateVisitedCity` übernimmt die Entity aus beiden in `mapData`, wenn sie dort schon steht, und ersetzt auch die gemerkte Entity (`gbCityMapEntity`, `gbUpdateData`), weil ein erneutes Öffnen desselben LGs `mapData` nicht noch einmal liest.
- Forge Hammer löst es anders (eigener LG-Speicher `FH.GBCalc.getGB`), nicht übernommen.

## Erweiterungspunkte in Upstream-Dateien

Ziel: Upstream-Dateien bleiben so nah am Original, dass `git merge` wenig Konflikte bringt. Upstream-Funktionen werden nie ersetzt, nur umhüllt (Original aufrufen, davor oder danach ergänzen) oder über einen kleinen Hook im Kern erweitert. Jede verbleibende Änderung in einer Upstream-Datei trägt einen Marker: `// TOOLBOX:` bei einzelnen Zeilen, `// TOOLBOX-BEGIN` und `// TOOLBOX-END` um Blöcke. JSON kennt keine Kommentare, deshalb bleiben `internal.json`, `de.json` und `config.json` unverändert auf Upstream.

- Skripte: `js/toolbox.json` listet die eigenen Module, gleiches Format wie `js/internal.json`. `inject.js` hängt die Liste hinten an die Upstream-Liste an (2 Zeilen), gleiche Ladeart, die Reihenfolge bleibt. Fehlt die Datei (Beta-Loader), lädt nur Upstream. `parts` laden nur mit ihrer Hauptdatei, deshalb sind die früheren Teile `calculator/parts/overview.js` und `notice/parts/store.js` jetzt eigene Module (`calculator-overview`, `notice-store`, inzwischen `notes-store`).
- Texte: `js/web/_i18n/toolbox.de.json` enthält alle neuen Toolbox-Texte und die Toolbox-Fassung geänderter Upstream-Texte (Branding, `GlobalSend` u. a.). `_main.js` lädt die Datei nach der Upstream-Sprachdatei (1 Zeile). Der Übersetzer behält den zuletzt geladenen Wert, die Toolbox gewinnt. Den nicht mehr genutzten Upstream-Text `Boxes.Notice.GlobalSendRequired` lassen wir stehen.
- Einstellungen: `js/web/settings/config/config.toolbox.json` mit `entries` und `remove`. `Settings.LoadConfig` mischt sie in die Upstream-`config.json` (Block mit Marker): ein Eintrag mit vorhandenem `name` überschreibt dessen Felder an Ort und Stelle, neue Einträge kommen ans Ende (innerhalb ihrer Gruppe also hinter die Upstream-Einträge), Namen aus `remove` fallen weg. Entfernen statt `hidden`, weil `BuildBody` bei `hidden` die Gruppe abbricht (`break` statt `continue`, Upstream-Fehler).
- Proxy: `js/foeproxy.js` ist wieder Upstream. `looting.js` merkt sich per `FoEproxy.addRawHandler` die XHR der laufenden `game/json`-Anfrage. Raw-Handler laufen synchron direkt vor den Service-Handlern derselben XHR, deshalb liest der `BattlefieldService`-Handler dort alle Einträge der Antwort (gesucht wird der `PVPArenaService`-Eintrag). Die Antwort wird nur bei einem Kampf ein zweites Mal geparst.
- Menü: `_menu.js` ist wieder Upstream. Das Modul `toolbox-menu` (letzter Eintrag in `js/toolbox.json`) trägt die Knöpfe `sabotage`, `possibleInvestments` und `looting` per `_menu.Items.splice` (hinter `playerProfile`), `_menu.ItemsData.push` und `_menu.<id>_Btn` ein. Die Menüs entstehen erst nach `StartUpDone`, dann sind alle Module geladen. Die IDs sind unverändert, gespeicherte Reihenfolge (`MenuSort`) und versteckte Knöpfe gelten weiter. Den zweiten Zähler für künftige Ereignisse hängt ein Wrapper um `_menu.hiddenRewards_Btn` an.
- Kern: das Modul `toolbox-main` (erster Eintrag in `js/toolbox.json`) trägt die Toolbox-Logik aus `_main.js`: Wrapper (siehe `scripts/toolbox-wraps.txt`), Handler `getOtherPlayerVO`, `getEventsPaginated`, `PVPArenaService.getOverview` und `StartupService` (`checkForDB` von `GBGActionLog` und `Notes.Store`), `MainParser.IsGlobalSendEnabled`, `loadPlayerIntoDict`, `fetchViaBackground` sowie `extBaseVersion`. Zeitpunkt: `FoEproxy` hält alle Antworten zurück, bis alle Skripte samt `js/toolbox.json` geladen sind (`foe-helper#loaded`), deshalb sehen auch spät registrierte Handler `StartupService` und die Metadaten; sie laufen nach den Handlern aus `_main.js`, die `ExtPlayerID` setzen. In `_main.js` bleiben mit Marker: Sprach-Fallback `de` und `toolbox.de` (i18n-Loader), der Besucher-Stadt-Fix im Handler `GreatBuildingsService` samt `updateVisitedCity` und Handler `CityMapService.reset` (braucht die Closure-Variablen `gbCityMapEntity`/`gbUpdateData`), `fetch` -> `MainParser.fetchViaBackground` in `send2Server` (Anfrage läuft im Background-Skript), Timeout 5 s in `sendExtMessage`, Link nur auf dem Icon (3 Zeilen), Changelog-Link und Konsolen-Log (Branding).

- IndexDB: das Modul `toolbox-indexdb` ergänzt `IndexDB` um `copyLegacyMainDB`, `openWithLegacyCopy`, `copyFromLegacyDB`, `guildFightsLegacyRows`, `toolboxGarbageCollector` und `loadPlayer` und hängt Tabelle `neighborhoodAttacks` per Wrapper an Schema-Version 3 an (Dexie mischt die Stores in die vorhandene Version). In `indexdb.js` bleiben 3 Zeilen mit Marker: DB-Name `FoEToolbox2DB_`, in `Init` Aufruf `copyLegacyMainDB` statt `mergeDatabases` (die Upstream-Migration löscht ihre Quell-DBs; die Upstream-Funktion bleibt unverändert und ungenutzt stehen) und in `GarbageCollector` Aufruf `toolboxGarbageCollector` statt `players.clear()`/`greatbuildings.clear()`. `Init` läuft erst im `StartupService`-Handler, dann sind alle Module geladen.
- Modul-DBs (`eventhandler`, `gexstat`, `guild_fights`, `guildmemberstat`, `qiprogress`, `strategy-points`): je 2 Zeilen mit Marker in `checkForDB`, der Name `FoEToolbox2DB_<Modul>_<id>` und `IndexDB.openWithLegacyCopy` mit der Alt-DB `FoeHelperDB_<Modul>_<id>` statt `db.open()`. Guild Fights übergibt `IndexDB.guildFightsLegacyRows` (Zermürbung 0 für Zeilen aus 1.x). GuildMemberStat braucht keine Umwandlung, v1-Zeilen fehlt nur `trial`, die Leser nehmen dann 0. Außerdem in `guild_fights.js` mit Marker: Zähler `#GBGActionLogCount` (Handler `getBattleground`, `ActiveMapUpdated`) und Knopf "Aktions-Log".

- PvP-Arena: `pvparena.js` mit Marker, `StartPvPArena(responseData, refreshOnly)` zeichnet mit `refreshOnly` eine offene Box nur neu (`Show` würde sie schließen). `looting.js` hängt nach einem Arena-Kampf den Eintrag aus `PVPArenaService.addLog` vorn an die gemerkte Übersicht und ruft das auf, Upstream liest die Kämpfe nur bei `getOverview`.

Umhüllte Upstream-Funktionen: maßgeblich ist `scripts/toolbox-wraps.txt` (Funktion, Upstream-Datei und je ein Kommentar, was der Wrapper ergänzt). `scripts/toolbox-check.sh` meldet, wenn Upstream eine davon ändert.

## Upstream-Merge

1. `git fetch upstream`, dann vor dem Merge `scripts/toolbox-check.sh`. Ohne Optionen vergleicht es die bisherige Upstream-Basis (Merge-Base mit `upstream/master`) mit `upstream/master` und meldet (b) umhüllte Funktionen, die Upstream geändert hat, und (c) von der Toolbox gelöschte Pfade, die Upstream geändert hat. Bei (b) prüfen, ob der Wrapper noch passt (Parameter, Rückgabewert, Zeitpunkt), sonst nach dem Merge anpassen. Nach dem Merge geht dasselbe mit `--upstream $(git merge-base ORIG_HEAD upstream/master)..upstream/master`.
2. Auf einem eigenen Branch `git merge upstream/master`. Die Pfade aus (c) (`_locales/*` außer `de`, `js/web/_i18n/*` außer `de.json`, `changelog-*.md`) kommen als modify/delete-Konflikt: `git rm <pfad>`. In Upstream-Dateien die Upstream-Fassung übernehmen und die markierten `TOOLBOX`-Stellen wieder einsetzen.
3. Nach dem Merge-Commit `scripts/toolbox-check.sh`: (a) muss leer sein, jede Änderung in einer Upstream-Datei trägt einen `TOOLBOX`-Marker. Dateien ohne Kommentare (`*.json`, `*.md`, `images/*`) prüft (a) nicht.
4. Basisversion nachziehen: `version_name` in `manifest.json` (`<toolbox> (<helfer>)`, daraus liest `inject.js` `extBaseVersion` für Settings und den API-Parameter `&v=`) und Titel sowie Basis-Commit am Anfang dieser Datei.
5. Syntax prüfen, Erweiterung neu laden und die Browser-Tests der betroffenen Features durchgehen.

## Entscheidungen

- Upstream-Uploads (Weltenliste, eigene LG-Daten, Gebäudeliste) laufen nur mit `GlobalSend`.
- "1 FP für Plätze ohne FP" bleibt default aus (abweichend vom Helfer).
- Bonus pro LG: ohne gespeicherten Wert gelten die globalen Prozente.
- `GlobalSend` teilt sich vorerst den localStorage-Schlüssel mit einem parallel installierten Helfer, kein eigener Schlüssel.
- `ShowPlayersAttDeffValues` ist default aus (Bann-Warnung), der Menüknopf weist ohne aktive Einstellung darauf hin.
- Alerts-Link im Popup bleibt ausgeblendet wie im Helfer.
- Firefox wird vorerst nicht unterstützt.
- Spieler in den Notizen: genau eine Spielergruppe, angezeigt als "👤 Spieler" (intern Gruppenart `neighbor`, damit Gruppen aus dem FoE Helfer passen). "+ Spieler" öffnet eine eigene Auswahl (`PlayerNote.showPicker`): alle bekannten Spieler aus der Sitzung (`PlayerDict`) und der lokalen Tabelle `players` (frühere Nachbarn, Arena-Gegner, besuchte Städte), ohne Anfragen ans Spiel, ohne einen selbst und Spieler mit Seite. Suche im Namen, dieselben Filter wie die Notizen, höchstens 50 Zeilen (Hinweis auf weitere), damit die Liste bei einem Jahr Spielerdaten schnell bleibt. Die Auswahl der Gruppenart beim Anlegen entfällt, ob jemand Nachbar, Gildenmitglied oder Freund ist, ändert sich (Nachbarschaft spätestens nach zwei Wochen). Stattdessen Symbole ⚔ 🛡 🤝 aus dem `PlayerDict` der laufenden Sitzung und ein Filter Alle/Nachbarn/Gilde/Freunde/Andere über den Spielerseiten (nicht gespeichert). `Notes.Store.mergePlayerGroups` legt die Gruppe beim Öffnen an und führt weitere Spielergruppen (Import, ältere Stände) in die erste zusammen: Seiten eines Spielers werden eine Seite, die Texte stehen untereinander. Läuft auch nach dem Import. Die Notiz in der Sabotage-Box (`player-note`, Issue #3) ist die Seite des Spielers in dieser Gruppe, Leeren löscht die Seite.
- Notizen nur lokal (`FoEToolbox2DB_Notice_<id>`), ohne `GlobalSend`. Einziger Netzwerkzugriff: manueller Import vom Helfer-Server (nur mit API-Token, nach Rückfrage), der den lokalen Stand ersetzt. Ist auf dem Server nichts gespeichert, bleibt der lokale Stand.
- Die GitHub-Action `.github/workflows/issues_handle.yml` des Helfers (schließt inaktive Issues nach 30 + 14 Tagen) ist entfernt, sie würde nach dem Merge in `master` auch die Issues der Toolbox schließen. Ändert Upstream die Datei, meldet `scripts/toolbox-check.sh` das unter (c).
- Eigene IndexedDB-Namen (`FoEToolbox2DB_*`), die DBs von 1.24 und Helfer werden nur gelesen (einmalige Kopie beim ersten Start), nie beschrieben oder gelöscht. Damit können Tester jederzeit zu 1.24 zurück; was in der Testphase neu entstand, sieht 1.24 nicht.

## Browser-Tests

Vorbereitung: Chrome, `chrome://extensions` -> Entwicklermodus -> "Entpackt laden" auf den Worktree. Spiel in einem Tab offen, DevTools (Konsole, Application -> IndexedDB) griffbereit. Nach jeder Code-Änderung Erweiterung neu laden und Spiel-Tab neu laden.

**17 Branding, Update, DB-Migration**
- Erweiterung entpackt laden, während ein Spiel-Tab offen ist: im Spiel-Tab erscheint die Reload-Abfrage, es öffnet sich kein Changelog-Tab.
- Popup und Einstellungen sind Deutsch, auch mit englischer Browsersprache.
- Frisches Profil mit 1.24-Daten (`FoEToolboxDB_<id>` v2, `FoeHelperDB_GuildFights_<id>` v1, `FoeHelperDB_GuildMemberStat_<id>` v1 usw.), dann diese Version laden: nach dem ersten Start enthalten `FoEToolbox2DB_<id>` (inkl. `neighborhoodAttacks`) und `FoEToolbox2DB_<Modul>_<id>` die Daten. Die Alt-DBs haben unverändert ihre Version (Application -> IndexedDB) und ihren Inhalt. `FH_IndexDBLastMigraion` im localStorage nennt Quelle und Ziel je DB.
- Zweiter Start: es wird nichts erneut kopiert (keine neuen Zeilen in `FH_IndexDBLastMigraion`).
- GuildFights: ein in 1.24 gespeicherter Verlauf (Spielerübersicht, alte Runde wählen) zeigt in der Spalte Zermürbung 0 statt `undefined`/`NaN`.
- Zurück zu 1.24 (diese Version entfernen, 1.24 laden): 1.24 startet ohne Fehler, ihre Daten sind da; Daten aus der Testphase fehlen dort erwartungsgemäß.
- Migration aus einem Profil nur mit `FoeHelperDB_<id>` (Helfer): nach dem ersten Start enthält `FoEToolbox2DB_<id>` die Daten, `FoeHelperDB_<id>` existiert unverändert weiter.

**16 Datenmodell**
- Spiel neu laden, 10 s warten: Tabelle `players` ist gefüllt und bleibt über Neustarts gefüllt, Einträge haben `score`, `wonBattles` und die Datumsfelder.
- Konsole: `Object.values(MainParser.CityEntities).filter(e=>e.is_plunderable).length` > 0.

**16a Bekannte Spieler**
- Einen bekannten Spieler besuchen, der Name, Avatar oder Gilde geändert hat; in `FoEToolbox2DB_<id>`, Tabelle `players`, stehen die neuen Werte.
- Ein Spieler ohne Gilde hat `clanId` 0 und kein `clanName`.

**1 Stadtinformationen (Plünderhilfe)**
- Vor dem ersten Besuch ist der Knopf "Stadtinformationen" rot mit Warnung.
- "Angriff/Verteidigung bei Spielern anzeigen" einschalten (jetzt default aus, Double-Opt-In-Abfrage erscheint), Nachbarn besuchen: Box zeigt Angriff, Verteidigung, Plünderabwehr.
- "Nachbarschafts-Ernte" einschalten: fertige Produktionen und ein plausibler nächster Angriffszeitpunkt erscheinen.
- "Alarm" legt einen Alarm an. Das Auge hebt das Gebäude auf der Stadtkarte hervor.
- Ein Gildenmitglied zeigt "nicht plünderbar".

**2 PvP Angriffe**
- Nachbarn angreifen: Kampf erscheint unter "PvP Angriffe" mit Armeen, Icons, Boosts.
- Plündern (auch ein generisches Gebäude): Eintrag mit Ressourcen, die FP-Summe steigt.
- PvP-Arena öffnen: Filter "PvP-Arena Gegner" ist aktiv. "nächste Seite" springt genau eine Seite weiter.
- "Angriffe anzeigen" in der Stadtinfo-Box filtert auf den Spieler.

**3 Snipehilfe (Vorab-Scan)**
- Vorab-Scan einschalten, LG-Liste eines fremden Spielers öffnen: Box "Mögliche Investitionen" mit Farben und Aktivitätshinweis.
- Ton-Schalter an: bei einem Treffer kommt ein Ton.
- LG eines anderen Spielers öffnen: die Box schließt sich.
- Einstellung aus: keine Box.

**Menüknopf "Mögliche Investitionen"**
- Einstellung aus: Klick zeigt einen Hinweis-Toast.
- Einstellung an, scannen, Box schließen, Knopf klicken: die Box kommt mit dem letzten Scan zurück.

**4 Kostenrechner**
- Fremdes LG öffnen (Kostenrechner sichtbar, kombinierte Box oder geteilte Ansicht): im Kopf steht "Verfügbare Forgepunkte: <Wert>", der Wert entspricht dem FP-Vorrat im Spiel.
- Tabelle hat drei Spaltengruppen mit Trennlinien: "Fördern mit: x%" (#, Einsatz, Differenz), BP/Medaillen (ggf. Schweinchen), "Minimal Investition" (Einsatz, Differenz, Kurs).
- Freier Platz mit Gewinn: Zellen der Minimal-Investition grün, Kurs in %, Tooltip "Kurs = ...". Platz nicht belegbar: "-" in grau. Platz, der das LG leveln würde: gelb mit Warn-Tooltip.
- Mehr Einsatz als FP im Lager: Einsatz rot, Tooltip "FP Vorrat ist zu niedrig".
- Eigener Platz: blaue Zellen mit eingezahltem Betrag und Kurs.
- Klick auf den Einsatz der Minimal-Investition übernimmt den Wert in das Einzahlungsfeld des Spiels.
- Arche-Prozent umschalten: Gruppenkopf "Fördern mit" zeigt den neuen Wert.

**5 LGs in IndexedDB**
- Fremdes LG mit sichtbarem Kostenrechner öffnen: in `FoEToolbox2DB_<id>`, Tabelle `greatbuildings`, steht ein Eintrag mit `playerId`, `name` (= `cityentity_id`), `level`, `currentFp`, `bestRateNettoFp`, `bestRateCosts`, `date`; der Spieler steht in `players`.
- Danach die LG-Liste desselben Spielers öffnen (Vorab-Scan an): das LG erscheint grün ("Wiedererkannt") mit Gewinn und Kurs statt "???", solange niemand eingezahlt hat.
- LG-Stufen durchscrollen (Pfeile im Spiel): der Eintrag bleibt bei der aktuellen Stufe.
- Spiel neu laden: der Eintrag bleibt erhalten.

**7 Verhandlungsassistent in Gildengefechten**
- Ohne Einstellung: Verhandlung auf einer GbG-Provinz starten, kein Assistent, Menüknopf "Verhandlung" wird rot (Upstream-Verhalten).
- Einstellung "Verhandlungsassistent für Gildengefechte" einschalten: Double-Opt-In-Abfrage; abbrechen lässt sie aus.
- Bestätigt: GbG-Verhandlung startet, der Assistent öffnet sich und rechnet wie bei einer normalen Verhandlung; Züge werden ausgewertet.
- Normale Verhandlung (z. B. Kontinentkarte) funktioniert weiter.

**8 Fenster fixieren**
- In der Kopfzeile einer verschiebbaren Box (z. B. Einstellungen, Kostenrechner, Box-Menü) gibt es den Knopf mit den Verschiebe-Pfeilen und Tooltip "Fenster fixieren/lösen".
- Klick: Pfeile werden gelb, die Box lässt sich nicht mehr ziehen. Box schließen und neu öffnen bzw. Spiel neu laden: bleibt fixiert (`localStorage` `<id>Draggable` = `false`). Erneuter Klick: wieder verschiebbar.
- "Alle schließen"-Box hat keinen Fixier-Knopf und keinen " - FoE Toolbox"-Zusatz im Titel. "Alle ausblenden" und "Alle schließen" lassen das Box-Menü stehen.
- Fixierte Box als Pop-up öffnen und zurückholen: der Knopf ist im Pop-up nicht sichtbar, nach der Rückkehr ist die Box weiter fixiert.

**9 Alarme**
- Alarm mit "dauerhaft" anlegen und auslösen lassen: die Benachrichtigung bleibt (unter Windows) stehen, bis man sie schließt.

**10 Eigenanteilsrechner**
- Einstellungen des Eigenanteilsrechners: zwei neue Optionen "1 FP für Plätze ohne FP berechnen" und "Bonuseinstellung pro LG speichern".
- LG mit einem Platz ohne FP-Belohnung (z. B. hohe Stufe, P5 nur Medaillen/BP): Option aus -> der Platz zählt 0 FP, Option an -> 1 FP (Mäzen-Anteil ändert sich entsprechend).
- "pro LG speichern" an: bei LG A Arche-Prozente ändern, LG B öffnen -> B zeigt die globalen Werte; B ändern, zurück zu A -> A zeigt seine eigenen Werte. Option aus: alle LGs teilen dieselben Werte.

**11 Blaue Galaxie**
- Blaue Galaxie einsammeln, Helfer öffnet sich: Spalte mit Diamanten-Icon nach FP. Gebäude mit Diamanten-Produktion zeigen die Menge, sind sortierbar und stehen auch ohne FP/Güter in der Liste.

**12 Versteckte Ereignisse**
- Mit einem Ereignis, das erst in der Zukunft erscheint (`startTime` > jetzt, z. B. nach dem Spielstart angekündigte Ereignisse): oranger Zähler unten rechts am Menüknopf, blauer Zähler zählt nur aktive.
- Box öffnen: zukünftige Ereignisse stehen nach den aktiven mit "Erscheint in ..." (orange).
- Zum Startzeitpunkt wandert das Ereignis in die aktive Liste, beide Zähler passen sich an.
- Einstellung "Zählen" (alle / nur sichtbare / ohne GE) wirkt auf beide Zähler.

**13 Stadtübersicht**
- Stadtkarte öffnen, auf ein Außenpostengebäude/QI-Gebäude klicken: der Tooltip verschwindet beim Wegbewegen der Maus (kein Hängenbleiben nach Klick).
- Produktionen -> "auf Karte zeigen": die Karte zentriert das hervorgehobene Gebäude (Upstream).
- Stadtplaner -> "Abschicken" (mit API-Token): Rückfrage "Bist du wirklich sicher ...". Abbrechen sendet nichts (Netzwerk-Tab des Background-Service-Workers bleibt leer), bestätigen sendet auch bei ausgeschaltetem `GlobalSend`.
- Dasselbe beim Außenposten ("Außenposten senden").

**14 Spielerlinks**
- "Links anzeigen" an: in Kostenrechner, Snipehilfe, Gildenmitgliederstatistik o. ä. ist nur das Link-Icon klickbar, ein Klick auf den Namen öffnet nichts. Das Icon öffnet die Spieler-/Gilden-/Gebäudeseite (auch mit Linkquelle ForgeDB).

**15 Datenschutz**
- Neues Profil: "Übermittlung an foe-helper.com" ist aus.
- Einschalten: Double-Opt-In-Abfrage; abbrechen -> bleibt aus. Dasselbe für "Angriff/Verteidigung bei Spielern anzeigen", "Nachbarschafts-Ernte", "Vorab-Scan der LG-Übersicht", "Verhandlungsassistent für Gildengefechte". Ausschalten ohne Abfrage.
- `GlobalSend` aus: im Netzwerk-Tab (Spielseite und Background-Service-Worker) keine Anfragen an `api.foe-rechner.de` beim Start (`SelfPlayer`), beim Öffnen eigener LGs (`OwnLGData`), in der Weltenauswahl (`Worlds`). Auch Notizen öffnen und bearbeiten sendet nichts (s. "Notizen lokal").
- API-Token gesetzt (`GlobalSend` egal): der Notizen-Import schickt `Notice/get` über den Background-Service-Worker, nicht über den Spiel-Tab, und nur nach der Rückfrage.

**Notizen lokal**
- `GlobalSend` aus, kein API-Token: Notizen öffnen, Hinweis "Lege zuerst eine Gruppe an". Im Netzwerk-Tab (Spiel-Tab und Background-Service-Worker) keine Anfragen an `api.foe-rechner.de`, auch nicht bei den folgenden Schritten.
- Gruppe anlegen, darin eine Seite; Überschrift und Text schreiben, in ein anderes Feld klicken. Spieler-Gruppe (z. B. Gildenmitglieder) anlegen, über "+ Spieler" einen Spieler wählen, Text schreiben. Derselbe Spieler ein zweites Mal wird nicht angelegt.
- In Application -> IndexedDB -> `FoEToolbox2DB_Notice_<id>` stehen die Gruppen in `groups`, die Seiten in `items` (Spieler-Seite mit `player_data`).
- Zahnrad: Reiter und Seiten per Ziehen umsortieren, Gruppe und Seite umbenennen, eine Seite und eine Gruppe löschen (Rückfrage). Box schließen und öffnen, Spiel-Tab neu laden: Reihenfolge, Namen, Texte und Löschungen sind erhalten.
- Einstellungen, Reiter "Info + Website": unter "Website API-Token" der Knopf "Notizen von FoE-Helfer importieren". Ohne Token: Fehler-Toast `ImportNotPossible`, nichts gesendet. Mit Token (auch ohne `GlobalSend`): Rückfrage, danach Import. Der Bearbeitungsmodus der Notizen hat keinen Import-Knopf mehr.
- Knopf: Modal "Dies löscht deinen lokalen Stand und ersetzt ihn durch den Inhalt vom FoE-Helfer-Server." mit "Importieren" und "Abbrechen". Abbrechen: nichts passiert, keine Anfrage. Importieren: eine Anfrage `Notice/get` im Background-Service-Worker, danach zeigt die Box genau den Stand vom Server, die lokalen Notizen sind weg (auch in der IndexedDB), Erfolgs-Toast.
- Ban (Antwort in DevTools überschreiben, `{"status":"OK"}` ohne `notice`): Modal zeigt "Du bist gesperrt!", lokale Notizen unverändert. Fehler (z. B. offline oder HTTP-Fehler): Fehler-Toast, lokale Notizen unverändert.

**Bugfix Resize**
- Burg-Box (`#Castle`, `min-width: 360px`) am Griff kleiner ziehen: hält bei 360 px Breite an. Eine Box ohne CSS-Mindestgröße hält bei 220 x 100 px an. Box-Menü lässt sich weiter bis ca. 101 x 87 px verkleinern.

**GbG-Aktions-Log (aus Forge Hammer)**
- Braucht laufende Gildengefechte. GbG-Karte öffnen, Gildengefechte-Spielerübersicht öffnen: neben "Snapshot Log" steht "Aktions-Log", ein Klick öffnet das Fenster "Gefechts-Logbuch", ein zweiter schließt es.
- Im Spiel das Gefechts-Log öffnen: Meldung mit der Zahl geladener Einträge; in `FoEToolbox2DB_GBG_<id>` stehen Zeilen in `ActionLog` und eine in `ActionLogBatch`. Erneut öffnen ohne neue Aktionen: 0 Einträge, keine neue Batch-Zeile.
- Reiter Details, Spieler-Report, Daten, Stundenweise Aktivität zeigen Daten; Sektoren mit Kurznamen (z. B. `A1M`), Aktionen und Verursacher auf Deutsch. Spaltenfilter und Sortierung funktionieren.
- "Export CSV" in jedem Reiter lädt eine Datei `GBGActionLog-<Reiter>-<Datum>.csv`, gefilterte Zeilen fehlen darin.
- Zähler: nach dem ersten Sammeln, nach mindestens einer Stunde die GbG-Karte erneut öffnen: links auf der Karte erscheint eine Zahl (Stunden seit dem letzten Sammeln). Ab der eingestellten Stundenzahl (Standard 8) ist sie rot. Gefechts-Log öffnen setzt sie zurück, Karte verlassen entfernt sie.
- Einstellungen: Anzeigedauer 0 -> keine Meldung mehr. Im Netzwerk-Tab keine neuen Anfragen außer Bildern vom Spiel-CDN.
- Migration: Profil mit Forge-Hammer-Daten (`FoeHelperDB_GBG_<id>`), erster Start: die Daten stehen in `FoEToolbox2DB_GBG_<id>`, die Alt-DB ist unverändert, `FH_IndexDBLastMigraion` nennt die Kopie.

**Pop-out**
- Jedes der acht neuen Fenster hat den Pop-out-Knopf. Klick öffnet das Fenster separat (Picture-in-Picture, sonst Pop-up), Schließen holt die Box zurück ins Spiel.
- Inhalt aktualisiert sich im Pop-out: PvP Angriffe und Stadtinformationen beim Besuch einer anderen Stadt, LG Fördern und LG Rechner beim Öffnen eines LGs, Mögliche Investitionen beim Öffnen einer Stadtübersicht, Investitionen nach dem Laden, Notizen beim Bearbeiten, Gefechts-Logbuch beim Wechsel des Reiters.
- Gefechts-Logbuch im Pop-out: Aktions-Auswahl (Spieler-Report) bzw. einen Spaltenfilter öffnen, daneben ins Fenster klicken, beides schließt. Im Spielfenster genauso, dort auch bei Klick ins Spiel.
- Alle Pop-outs geschlossen: `document.getElementById` ist wieder die native Funktion (`Object.hasOwn(document, 'getElementById') === false`).
- Die 16 Upstream-Pop-outs funktionieren weiter.
- Stadtinformationen im Pop-out, dann einen anderen Spieler besuchen: das Pop-out bleibt offen und zeigt den neuen Spieler.

**LG-Daten bei Klick in einer besuchten Stadt**
- Fremde Stadt besuchen, ein LG direkt in der Stadt anklicken: LG Rechner (bzw. LG Fördern in der geteilten Ansicht) rechnet statt "Deaktiviert".
- Dasselbe LG über die LG-Übersicht des Spielers öffnen: rechnet weiter.
- In ein fremdes LG einzahlen, schließen und in der Stadt erneut anklicken: Fortschritt zeigt den neuen Stand.

### Ungeprüfte Annahmen (aus den Notizen)
- 16: `is_plunderable` für generische Gebäude folgt der alten Regel aus `abilities`, kein Plünderschutz-Component bekannt.
- 1: Abwehr-"max" (+60 %) und Angriff-"max" (+50 %) sind alte feste Aufschläge; Kettenboni zählen ohne Prüfung der Verknüpfung.
- 2: `BattlefieldService`-Antwort (`defenderPlayerId`, `PVPArenaService.addLog`) und `CityMapService.reset` mit `LootedState`/`PlunderedState` stammen aus dem alten Code.
- 3: Übersichtszeilen von `getOtherPlayerOverview` haben noch `city_entity_id` (4.8.3 nutzt sonst `entity_id`); LG-Stufen gehen nicht in P1 ein.
- 5: `state.invested_forge_points` des LGs entspricht `current_progress` der Übersicht (sonst kein "Wiedererkannt").
- 7: GbG-Verhandlungen haben dasselbe Format wie normale (`NegotiationGameService.startNegotiation`, `context = guildBattleground`).
- 11: Diamanten kommen als `resources.premium`; Diamanten in `genericReward` werden nicht erkannt; Verdopplung durch die Galaxie angenommen.
- 12: `startTime` künftiger Ereignisse kommt schon in `HiddenRewardService.getOverview`.
- 14: keine Upstream-Box liest den Namen aus dem Link-`<a>`.
- 15: Antwort von `Notice/get` ohne Fehler und ohne `notice` bedeutet Sperre (alte Regel, gilt nur noch für den Notizen-Import); `api.foe-rechner.de` akzeptiert die Anfragen aus dem Background (Host-Permission vorhanden).
- Notizen lokal: die Antwortform der API (`group_name`, `player_group`, `items` mit `tab`, `title`, `content`, `player_data`) ist aus der Nutzung in `notice.js` abgeleitet, nicht aus einer API-Doku; der Import übernimmt nur diese Felder. Wie der Server bei gleichem `sort` ordnet, ist unbekannt (lokal: danach `id`).
