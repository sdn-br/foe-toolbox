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
- [ ] 14 Spielerlinks nur auf dem Icon
- [ ] 15 Datenschutz: `GlobalSend` default aus, Double-Opt-In, Ban-Erkennung
- [ ] Bugfix: `minWidth`/`minHeight` beim Resize vertauscht (`_helper.js`)

Entfällt: 6 GvG Angriffshilfe (GvG wurde im Spiel und upstream am 2024-03-18 entfernt).

**Notizen 17**
- Version `2.0.0.0`, `version_name` `2.0.0.0 (4.8.3.0)`; `inject.js` liest die Basisversion daraus (`extBaseVersion`). Settings zeigt "Basis: FoE Helfer 4.8.3.0".
- API-Parameter `&v=` mit Basisversion statt Toolbox-Version: wie bisher bei `SelfPlayer`, analog jetzt auch bei den neuen Aufrufen `OwnLGData` (`_main.js`) und `BuildingList` (`srcLinks.js`).
- Manifest: Upstream hat die Permission `tabs` entfernt; nur `scripting` ergänzt. `tabs.query` mit URL-Filter reicht die Host-Permission für `*.forgeofempires.com`. Die Firefox-ID des Helfers (`browser_specific_settings.gecko`) entfernt, sie gehört dem Helfer.
- `background.js`: Upstream hatte den Update-Tab auskommentiert. Toolbox-Logik wieder drin: bei `onInstalled` Reload-Abfrage per `scripting.executeScript` in allen offenen Spiel-Tabs und Wiki-Changelog im neuen Tab. Zusätzlich verlinkt der neue Upstream-Toast "Neue Version installiert" (`_main.js`) auf das Toolbox-Changelog statt foe-helper.com.
- Nur Deutsch: `inject.js` fällt auf `de` statt `en` zurück. Ein `user-language` im localStorage des Spiels, das die Toolbox nicht kennt (z. B. vom Helfer gesetzt), wird ignoriert, aber nicht überschrieben. `popup.js`/`alerts.js`: Wörterbuch und Übersetzungsschleife entfernt, das HTML ist der Text (die alte Toolbox lief für Nicht-Deutsch in einen TypeError). Settings: `Help` und `LoadBeta2` (Download der Helfer-Beta) entfernt, Weblate-Link entfernt.
- Branding analog erweitert auf Stellen, die es in 3.1.0.1 noch nicht gab: `Menu.NewVersion.Title`, `Menu.MetaLoader.*`, Präfixe "FoE-Helfer:"/"FoE-Helper:" in `Boxes.MergerGame.KeysLeft.*`, `StrategyPoints.*` und im Quest-Tooltip (`quests.js`). Bewusst wie in der alten Toolbox belassen: Box-Titel-Suffix " - FoE Helper" (`_helper.js`), Discord-Webhook-Name, generische "Helfer"-Texte. Ebenso Upstream belassen: Titel " - FoE Helper" der neuen Pop-up-Fenster (`popup/js/popup.js`).
- IndexedDB: Haupt-DB heißt `FoEToolboxDB_<id>`, Modul-DBs bleiben `FoeHelperDB_*_<id>` (wie in der alten Toolbox). Migration nur bei neuer Toolbox-DB: Quelle `FoeHelperPrivateDB_<id>`, sonst `FoeHelperDB_<id>`. Anders als alt: Quell-DBs werden ohne Schema geöffnet (Dexie dynamic mode; die alte Version mit fest `version(1)` scheiterte an neueren Helfer-DBs), kopiert werden alle gleichnamigen Tabellen außer dem Cache `buildingMeta`, "gefüllt" heißt irgendeine Tabelle hat Zeilen (Helfer 4.x leert `players` bei jedem Start). Upstream-Migration aus `FoeHelper_<id>`/`PlayerDB`/`StatsDb` entfällt wie in der alten Toolbox.
- Anders als alt: `FoeHelperDB_<id>` wird nach dem Kopieren **nicht** gelöscht (liegt im selben Origin, ein parallel installierter Helfer würde seine Daten verlieren). `FoeHelperPrivateDB_<id>` wird weiter gelöscht.
- Schema `version(3)` deklariert zusätzlich `neighborhoodAttacks`, damit ein Upgrade einer bestehenden `FoEToolboxDB_` (v2 aus 1.24) die Tabelle nicht verwirft (Dexie löscht nicht deklarierte Tabellen beim Upgrade). `pvpActions` legt Dexie dabei neu an. Achtung Zwischenstand: der Upstream-`GarbageCollector` leert weiter `players`/`greatbuildings`/`pvpActions` bei jedem Start; das gehört zu 2/16 (erledigt in 16, s. Notizen 16).
- `.gitignore`: nur `*.ini` aus der Toolbox übernommen, die Upstream-Einträge bleiben. README und `changelog.md` aus Toolbox `master`, `changelog-de/en.md` entfernt.

**Notizen 16**
- Proxy (`js/foeproxy.js`): Handler bekommen als drittes Argument `responseData` = die ganze Antwort (alle Einträge des Requests), wie in der alten Toolbox. Nur XHR; WebSocket-Handler und Meta-/Raw-Handler unverändert (auch alt nicht). Upstream ruft dafür jetzt `FoEproxy._proxyAction` in drei Schleifen auf (zusätzlich `StaticDataService.getMetadata` zuerst), alle drei reichen es durch.
- CityEntity-Flags: neue Funktion `MainParser.setToolboxEntityFlags()`, läuft in `CityEntityBuilder` direkt nach `correctBuildingType()` (Upstream lädt die Metadaten nicht mehr im Meta-Handler `city_entities`, sondern einzeln per Datei mit Cache in `buildingMeta`). Flags wie alt: `is_motivatable`, `is_polishable`, `chainId`, `is_chainBuilding`, `is_chainStartBuilding`, `bonus_multiplier`, `is_outpostBuilding`, `is_plunderable`.
- Anpassung: neben den klassischen `abilities` werden auch generische Gebäude (`GenericCityEntity`, `components.AllAge`) gelesen, mit denselben Quellen wie Upstream in `CityBuildings` (`setPolivationable`, `setChainBuilding`): Motivieren/Polieren aus `socialInteraction.interactionType`, Kette aus `chain` (`ChainStartConfig` = Startgebäude, `linkPositions.length` = `bonus_multiplier`). Alt galt jedes generische Gebäude mit irgendeiner Ability als motivierbar; das entfällt. `CityBuildings` selbst wird nicht aufgerufen, weil es fehlende `abilities` nicht abfängt und `linkPositions.length` nicht liefert. `is_plunderable`/`is_outpostBuilding` unverändert aus `abilities`.
- PlayerDict: `WonBattles` hatte Upstream schon. Neu: `IsActive`, `ScoreDate`/`ScoreReceiveDate`, `WonBattlesDate`/`WonBattlesReceiveDate` (zuletzt gestiegen / zuletzt empfangen, Abgleich mit der DB), `MainParser.loadPlayerIntoDict(id)`. `UpdatePlayerDict` und `UpdatePlayerDictCore` geben ein Promise zurück, das erst nach dem Schreiben in `players` erfüllt ist (`UpdatePlayerDict` wartet per `Promise.all` auf alle Spieler, alt nur auf den letzten; Fehler werden geloggt, das Promise wird trotzdem erfüllt).
- Neue Quellen in `UpdatePlayerDict`: `PlayerVO` (`OtherPlayerService.getOtherPlayerVO`), `Events` (`getEventsPaginated`), `PvPArena` (`PVPArenaService.getOverview`, eigener Handler in `_main.js`, unabhängig vom Upstream-Modul `pvparena`), `VisitPlayer` (ruft kein Handler in `_main.js`, sondern 1 und 2 selbst, wie alt). Neu bei `VisitPlayer`: fehlt `other_player.era`, wird `other_player_era` genommen (so hat es alt `Looting.collectPlayer` gespeichert).
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
