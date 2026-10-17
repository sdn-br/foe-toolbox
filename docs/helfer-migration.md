# Migration auf FoE Helfer 4.8.3.0

Basis: Upstream `mainIine/foe-helfer-extension` Commit `f24d1fd4` (v4.8.3.0).
Vorherige Basis: FoE Helfer 3.1.0.1 (`86f9439d`), Toolbox 1.24.0.0.

## Fortschritt

- [x] Import Helfer 4.8.3.0
- [x] 17 Branding, nur Deutsch, Update-/Reload-Logik, DB-Migration
- [ ] 16 Datenmodell-Unterbau
- [ ] 1 Plünderhilfe / Stadtinformationen (`sabotage`)
- [ ] 2 PvP Angriffe (`looting`)
- [ ] 3 Snipehilfe: Vorab-Scan der LG-Übersicht
- [ ] 4 Kostenrechner: Minimal-Investition, BP/Medaillen-Tabelle, FP im Lager
- [ ] 5 Kostenrechner schreibt LGs in IndexedDB
- [ ] 7 Verhandlungsassistent in Gildengefechten (GbG)
- [ ] 8 Fenster fixieren
- [ ] 9 Alarme `requireInteraction`
- [ ] 10 Eigenanteilsrechner: 1 FP für Plätze ohne FP, Bonus pro LG
- [ ] 11 Blaue Galaxie: Diamanten
- [ ] 12 Versteckte Ereignisse: Zukunft + eigener Zähler
- [ ] 13 Stadtübersicht: Scroll, Tooltips, Double-Opt-In
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
- Schema `version(3)` deklariert zusätzlich `neighborhoodAttacks`, damit ein Upgrade einer bestehenden `FoEToolboxDB_` (v2 aus 1.24) die Tabelle nicht verwirft (Dexie löscht nicht deklarierte Tabellen beim Upgrade). `pvpActions` legt Dexie dabei neu an. Achtung Zwischenstand: der Upstream-`GarbageCollector` leert weiter `players`/`greatbuildings`/`pvpActions` bei jedem Start; das gehört zu 2/16.
- `.gitignore`: nur `*.ini` aus der Toolbox übernommen, die Upstream-Einträge bleiben. README und `changelog.md` aus Toolbox `master`, `changelog-de/en.md` entfernt.

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
