# Toolbox-Patches in Helfer-Dateien (f24d1fd4 .. HEAD)

Basis: `git diff --name-status f24d1fd4 HEAD`, nur Status M (48 Dateien, ohne Bilder; die gelöschten `_i18n`-Dateien und `_locales/*` außer `de` sind D und hier nicht gelistet). Summe: +1765 / -538.
Klassen: EXTRACTABLE = Logik zieht in ein eigenes Toolbox-Modul, kein Core-Eingriff. HOOK = braucht eine kleine Core-Änderung. STAYS = bleibt Patch. REVERT = Änderung vermutlich unnötig.
Bei gemischten Dateien steht die Hauptklasse in der Tabelle, die Aufteilung unten bei "Details".

## Tabelle

| # | Datei | +/- | Hauptklasse | Mechanismus / Kernaussage |
|---|---|---|---|---|
| 1 | `.gitignore` | 1/1 | REVERT | `desktop.ini` -> `*.ini`; stattdessen `.git/info/exclude` |
| 2 | `README.md` | 17/22 | STAYS | Branding; Konflikt-Schutz per `.gitattributes` `merge=ours` (braucht lokal `git config merge.ours.driver true`) |
| 3 | `_locales/de/messages.json` | 4/4 | STAYS | Name/Beschreibung der Extension |
| 4 | `background.js` | 57/14 | HOOK | 1 Hook für `send2Server`; `onInstalled` EXTRACTABLE; Whitelist `send2Api` STAYS (upstream-würdig) |
| 5 | `content/alerts.html` | 2/2 | STAYS | Branding |
| 6 | `content/popup.html` | 12/7 | STAYS | Branding und Links |
| 7 | `css/web/boxes.css` | 79/1 | EXTRACTABLE | Toolbox-CSS per `HTML.AddCssFile('toolbox')` |
| 8 | `css/web/variables.css` | 1/0 | EXTRACTABLE | `:root`-Variable in Toolbox-CSS |
| 9 | `js/alerts.js` | 1/42 | REVERT | Wörterbuch wiederherstellen, nur `let lng = 'de'` (1 Zeile) |
| 10 | `js/popup.js` | 1/53 | REVERT | wie 9 |
| 11 | `js/foeproxy.js` | 16/14 | EXTRACTABLE | `FoEproxy.addRawHandler` merkt sich die ganze Antwort |
| 12 | `js/inject.js` | 13/3 | HOOK | Loader für `toolbox.json` (3 Zeilen), Basisversion, `de`-Fallback |
| 13 | `js/internal.json` | 10/3 | HOOK | zurück auf Upstream, eigene Liste `js/toolbox.json` |
| 14 | `manifest.json` | 5/12 | STAYS | Version, Permission `scripting`, Gecko-ID, Locale |
| 15 | `js/web/_helper/js/_helper.js` | 58/3 | HOOK | Box-Hook für Pin-Knopf; Min-Size-Fix STAYS (upstream-würdig) |
| 16 | `js/web/_i18n/de.json` | 185/19 | EXTRACTABLE | zweite Sprachdatei, Hook: 1 Zeile im i18n-Loader |
| 17 | `js/web/_languages/js/_languages.js` | 1/18 | EXTRACTABLE | eigenes Content-Script nach `_languages.js` im Manifest |
| 18 | `js/web/_main/js/_main.js` | 301/60 | HOOK | überwiegend EXTRACTABLE (Handler, Wrapper), Rest 3 Hooks + STAYS |
| 19 | `js/web/_menu/js/_menu.js` | 76/1 | EXTRACTABLE | `_menu.Items.push`, `_menu.ItemsData.push`, `_menu.<id>_Btn = ...` |
| 20 | `js/web/bluegalaxy/css/bluegalaxy.css` | 5/0 | EXTRACTABLE | Toolbox-CSS |
| 21 | `js/web/bluegalaxy/js/bluegalaxy.js` | 12/3 | STAYS | Diamanten-Spalte mitten in Schleife, Feature (upstream anbietbar) |
| 22 | `js/web/bonus-service/js/bonus-service.js` | 1/1 | REVERT | Tooltip-Präfix, rein kosmetisch |
| 23 | `js/web/calculator/css/calculator.css` | 104/0 | EXTRACTABLE | Toolbox-CSS |
| 24 | `js/web/calculator/js/calculator.js` | 173/5 | HOOK | ~130 Zeilen wandern nach `parts/`, ~35 Hook-Zeilen bleiben |
| 25 | `js/web/citymap/js/citymap.js` | 8/1 | STAYS | `trigger:'hover'` (Bugfix, upstream-würdig), Double-Opt-In |
| 26 | `js/web/closebox/js/closebox.js` | 7/2 | STAYS | `Ignore`-Liste, `fixdragdrop:false` |
| 27 | `js/web/dbexport/js/dbexport.js` | 1/1 | REVERT | Dateiname kosmetisch |
| 28 | `js/web/discord/js/discord.js` | 2/2 | REVERT | Testtext, Webhook-Name kosmetisch |
| 29 | `js/web/eventhandler/js/eventhandler.js` | 3/2 | HOOK | DB-Name + Legacy-Copy (Muster A oder B, s. u.) |
| 30 | `js/web/gexstat/js/gexstat.js` | 3/2 | HOOK | wie 29 |
| 31 | `js/web/guild_fights/js/guild_fights.js` | 23/3 | HOOK | DB-Muster; Badge EXTRACTABLE; Button 1 Zeile STAYS |
| 32 | `js/web/guildmemberstat/js/guildmemberstat.js` | 4/2 | HOOK | wie 29 |
| 33 | `js/web/hidden-rewards/js/hidden-rewards.js` | 48/13 | STAYS | Zukunftsliste in Filter-, Render- und Zähler-Logik verwoben |
| 34 | `js/web/indexdb/js/indexdb.js` | 261/148 | HOOK | ~85 % EXTRACTABLE (Funktionen überschreiben), ~15 Zeilen Hook |
| 35 | `js/web/investment/js/investment.js` | 1/0 | STAYS | `popout:`-Zeile (upstream anbietbar) |
| 36 | `js/web/negotiation/js/negotiation.js` | 3/2 | STAYS | Setting `AutomaticNegotiationForGbG` (upstream anbietbar) |
| 37 | `js/web/notice/css/notice.css` | 13/0 | EXTRACTABLE | Toolbox-CSS |
| 38 | `js/web/notice/js/notice.js` | 21/37 | HOOK | `send2Server`-Aufrufe per Wrapper umleiten, Rest ~10 Zeilen |
| 39 | `js/web/outposts/js/outposts.js` | 6/1 | STAYS | Double-Opt-In + `forceSend` |
| 40 | `js/web/part-calc/js/part-calc.js` | 49/5 | HOOK | 2 Funktionen auslagern, Logik-Zeilen bleiben |
| 41 | `js/web/part-calc/js/parts/settings.js` | 12/2 | STAYS | zwei Checkboxen im HTML-String |
| 42 | `js/web/popup/js/popup.js` | 114/4 | HOOK | ~105 Zeilen Shims auslagern, 2-3 Aufrufstellen bleiben; Branding STAYS |
| 43 | `js/web/qiprogress/js/qiprogress.js` | 3/2 | HOOK | wie 29 |
| 44 | `js/web/quests/js/quests.js` | 1/1 | REVERT | Tooltip-Präfix |
| 45 | `js/web/settings/config/config.json` | 30/13 | HOOK | Overlay-Merge in `Settings.LoadConfig` (2-3 Zeilen) |
| 46 | `js/web/settings/js/settings.js` | 11/3 | EXTRACTABLE | `Settings.StoreSettings`/`VersionInfo` umhängen; 1 Zeile Weblate STAYS |
| 47 | `js/web/srcLinks/js/srcLinks.js` | 3/2 | EXTRACTABLE | `MainParser.sendExtMessage` umhängen |
| 48 | `js/web/strategy-points/js/strategy-points.js` | 3/2 | HOOK | wie 29 |

## Antwort auf die Extension-Point-Frage

Kurz: **Nein, es gibt keine Registrierungs-API**, aber die Struktur ist so offen, dass ein Toolbox-Modul vieles von außen einhängen kann.

- **Skript-Laden** (`js/inject.js`): lädt `_main.js`, dann `vendor.json`, dann alle Einträge aus `js/internal.json` als `js/web/<name>/js/<name>.js` (+ `parts/<p>.js`). Parallel geladen, Ausführungsreihenfolge bleibt. Es gibt nur diese eine Liste. Das heißt: jedes neue Modul ändert `internal.json` (Konfliktstelle). Ein Loader für eine zweite Liste `js/toolbox.json` kostet 3 Zeilen in `inject.js` (die Datei ist ohnehin gepatcht). Achtung: `parts` hängen immer an einem Modul mit eigener Hauptdatei; Toolbox-Parts also unter `js/web/toolbox/js/parts/`.
- **Menü** (`_menu.js`): `_menu.Items` (Reihenfolge), `_menu.ItemsData` (Titel, Tooltip) und `_menu[<id>_Btn]` (Funktion, wird in `ListLinks` per Name aufgerufen) sind veränderliche Properties. Ein Modul, das nach `_menu.js` lädt, kann `push` und Zuweisung machen. Die drei Menü-Renderer (`_menu_right`, `_menu_bottom`, `_menu_box`) rufen `ListLinks` erst nach dem Start auf. Gespeicherte Reihenfolge (`MenuSort`) und versteckte Einträge behandeln neue Namen schon richtig. Icons: CSS `[id$=<id>-Btn] span` in eigener CSS-Datei. `HelperBeta.menu` taugt nicht (nur Beta-Gate).
- **Settings**: `Settings.Preferences` kommt aus `config.json`, geladen von `Settings.Init()` beim Laden von `settings.js` (asynchron, `fetch`). `BuildBody` rendert alles aus `Preferences` nach `group`, i18n-Keys `Settings.<name>.Title/Desc`. Keine Registrierung. Ein späteres Modul kann nicht sauber einhängen (Race: `Preferences` ist erst nach dem fetch gesetzt; Polling wäre nötig). Sauber: 2-3 Zeilen in `Settings.LoadConfig`, die `config.toolbox.json` (Einträge ergänzen, überschreiben per `name`, entfernen per Liste) mergen. Achtung Upstream-Bug: `BuildBody` macht bei `hidden` ein `break` statt `continue`, hidden-Einträge brechen die Gruppe ab; deshalb besser entfernen als verstecken.
- **i18n**: `_main.js` lädt `_i18n/<lng>.json` (+ `de` als Fallback) und ruft `i18n.translator.add` je Datei; spätere Dateien überschreiben vermutlich frühere Keys (vor Umstellung prüfen). Eine zweite Datei `toolbox.<lng>.json` braucht 1-2 Zeilen im Loader.
- **Proxy**: `addHandler`, `addMetaHandler`, `addRawHandler`, `addFoeHelperHandler`, `addWsHandler`, `addRequestHandler` reichen für alle Toolbox-Handler. `addRawHandler` bekommt `(xhr, requestData)` und läuft vor allen anderen Handlern, damit lässt sich die ganze Antwort (`responseData`) abgreifen.
- **Funktionen überschreiben**: Das Projekt nutzt globale `let X = {...}`-Objekte mit Property-Funktionen, Aufrufe laufen durch `Obj.fn()`. Überschreiben oder Umhängen (`const orig = Obj.fn; Obj.fn = (...a) => {...}`) funktioniert also. Der Preis ist Drift: ändert Upstream die Funktion, merkt es der Merge nicht. Gegenmaßnahme: ein Test oder Start-Check, der die Signatur/Länge oder einen Hash von `Obj.fn.toString()` gegen den erwarteten Wert prüft und beim Abweichen warnt.
- **CSS**: `HTML.AddCssFile('<modul>')` lädt `js/web/<modul>/css/<modul>.css` nachträglich, kommt also nach `boxes.css` (Kaskade stimmt).
- **Events**: `foe-helper#loaded`, `#mainloaded`, `#vendors-loaded`, `#StartUpDone`, `#jQuery-loaded`; Box-Erzeugung hat keinen Event (fehlt für Pin-Knopf).

## Details je Gruppe

### background.js (57/14)
- `contextMessage` Branding (1 Zeile): REVERT-Kandidat, kosmetisch.
- `onInstalled` + `InstallConfirm` (+22): EXTRACTABLE. Zweiter `browser.runtime.onInstalled.addListener` in `toolbox-background.js`, geladen per `importScripts(...)` (1 Zeile oben in `background.js`, im Manifest für Firefox in `background.scripts`). Upstreams auskommentierter Block bleibt unberührt.
- `send2Api`-Whitelist (+3): STAYS. Sicherheitslücke upstream: jede Webseiten-Nachricht (`externally_connectable` forgeofempires.com) kann den Hintergrund-Prozess beliebige URLs abrufen lassen. Lohnt sich upstream zu melden/anzubieten.
- `case 'send2Server'` (+37): HOOK. Unbekannte Typen enden in `return APIerror('unknown request type')`; zwei Listener funktionieren nicht (der erste Antwortende gewinnt). Minimaler Hook vor diesem Return: `if (self.ToolboxBackground?.handle) return ToolboxBackground.handle(request, sender);` Der Case selbst zieht in `toolbox-background.js`.

### js/foeproxy.js (16/14) -> EXTRACTABLE
Einziger Nutzer des dritten Arguments `responseData` ist `looting.js` (`BattlefieldService` `all`, sucht `PVPArenaService`-Eintrag). Raw-Handler: bei `url` mit `game/json?h=` `JSON.parse(xhr.responseText)` in `Toolbox.currentResponse` ablegen (läuft synchron vor den Service-Handlern); `looting.js` liest die Variable. Die Datei geht vollständig auf Upstream zurück. Risiko: gering. Die WebSocket-Handler und `_proxyAction` bleiben unberührt.

### js/inject.js + internal.json + manifest.json
- inject.js: (a) `bv` aus `version_name` (5 Zeilen) -> alternativ Konstante im Toolbox-Modul (`Toolbox.BaseVersion`), dann `extBaseVersion` in `_main.js` und `inject.js` weg; Preis: bei jedem Upstream-Merge von Hand pflegen (Test dagegen, der `manifest.version_name` mit der Konstante vergleicht). (b) `de`-Fallback und `uLng`-Prüfung (8 Zeilen): STAYS (Branding/Sprachlogik). (c) Neu: `toolbox.json` laden (3 Zeilen, HOOK).
- internal.json: HOOK. Mit `toolbox.json` geht die Datei auf Upstream zurück (sabotage, looting, fh-compat, gbg-actionlog, calculator-`overview`, notice-`store` wandern; `parts` für Calculator/Notice laufen als `{name:'toolbox', parts:[...]}` oder eigene Hauptdateien, da Parts nur mit Hauptdatei geladen werden).
- manifest.json: STAYS, unvermeidlich. Konfliktrisiko mittel (Upstream hebt oft Version und Permissions).

### js/web/_main/js/_main.js (301/60), Aufteilung
| Hunk | +/- | Klasse | Mechanismus |
|---|---|---|---|
| `extBaseVersion` | 1/0 | HOOK | hängt an inject.js (a) |
| i18n-Fallback `de` | 3/3 | STAYS | |
| `getWorlds`-Guard, `SendLGData`-Guard, `SelfPlayer`-Check, `IsGlobalSendEnabled`, `&v=`-Parameter (`SelfPlayer`, `OwnLGData`, `srcLinks`), Timeout 1s->5s | ~20 | EXTRACTABLE | `MainParser.sendExtMessage` umhängen: bei `type 'send2Api'` ohne GlobalSend verwerfen, `&v=` ersetzen. Timeout (1 Zahl im Inneren): bleibt Patch oder Wrapper mit eigenem Timeout |
| `send2Server` (Umleitung über Background, `forceSend`) | ~35/15 | EXTRACTABLE | `MainParser.send2Server` komplett ersetzen (Upstream ruft `fetch` direkt, die Toolbox die Message). Drift-Check nötig |
| `checkForDB` GBGActionLog, Notice.Store | 2/0 | EXTRACTABLE | `FoEproxy.addHandler('StartupService','getData', ...)` im Toolbox-Modul, nach `_main` registriert |
| `getOtherPlayerVO`/`getEventsPaginated` + `PVPArenaService.getOverview` | 14/0 | EXTRACTABLE | eigene `addHandler` |
| GB im besuchten Viertel anklicken, `updateVisitedCity`, `CityMapService.reset` | ~35/3 | STAYS | greift in Closure-Variablen `gbCityMapEntity`/`gbUpdateData`, nicht von außen erreichbar. Sieht nach Bugfix aus -> upstream anbieten |
| ChangeLog-Link, MetaLoader-Titel, Konsole-Log | 3/3 | STAYS (Branding; Konsole-Log REVERT) | |
| `setToolboxEntityFlags` + Aufruf | 70/0 + 1 | EXTRACTABLE + HOOK | Funktion in Toolbox-Modul; Aufruf: Wrapper um `MainParser.correctBuildingType` oder 1 Hook-Zeile in `CityEntityBuilder` |
| Link-Funktionen Spieler/Gilde/Gebäude (nur Icon ist Link) | 6/3 | STAYS | 3 Einzeiler; alternativ Wrapper, lohnt kaum |
| `UpdatePlayerDict`/`UpdatePlayerDictCore`/`loadPlayerIntoDict` | ~160/40 | EXTRACTABLE | Core: Upstream-Struktur zurück (das Entfernen der `if (PlayerID !== undefined)`-Klammer hat die ganze Funktion eingerückt, jetzt Diff-Rauschen). Toolbox wrappt `UpdatePlayerDictCore` (Original läuft synchron, danach Extras: `IsActive`, `ClanName` löschen, Datumsfelder, DB-Schreiben, Promise sammeln). Neue Quellen laufen über eigene Handler, die `Core` direkt rufen. `loadPlayerIntoDict` wandert als Toolbox-Funktion. Risiko mittel: Reihenfolge der Seiteneffekte |

Hinweis: "Warte auf Schreiben in `players`" (Promise) braucht dann ein Toolbox-eigenes Sammelverfahren (`Toolbox.Players.settled()`), weil `UpdatePlayerDict` das Promise nicht zurückgibt.

### _menu.js (76/1) -> EXTRACTABLE
Alles bis auf eine Stelle von außen möglich (siehe Extension-Point-Antwort). Die eine Stelle: `hidden-future-reward-count`-Span im Hidden-Rewards-Button. Wird im Toolbox-Modul beim Zähler-Update bei Bedarf per jQuery an `#hiddenRewards-Btn` angehängt (hängt mit hidden-rewards.js zusammen). Bei Reihenfolge-Risiko: das Modul muss nach `_menu` in der Liste stehen.

### Branding-Einzeiler (REVERT-Kandidaten)
`bonus-service` (Tooltip), `quests` (Tooltip), `dbexport` (Dateiname), `discord` (Testtext + Webhook-Name), `background.js` `contextMessage`, `console.log` in `_main.js`. Zusammen ~7 Zeilen, Konflikte nur, wenn Upstream genau diese Zeile ändert. Entscheidung Produkt vs. Konfliktfläche; `docs/helfer-migration.md` sagt, der Discord-Webhook-Name bleibe "wie in der alten Toolbox" (Helper), der Diff ändert ihn aber auf "FoE Toolbox": Doku und Code widersprechen sich.

### _helper.js (58/3) -> HOOK
- Pin-Knopf (`fixdragdrop`, `HTML.IsDraggable`, `DragBox`-Änderung): `HTML.Box` hat keinen Event. Minimaler Hook: am Ende von `HTML.Box` ein `window.dispatchEvent(new CustomEvent('foe-helper#boxCreated', {detail: args}))`; Knopf einfügen und `DragBox`-Verhalten (`onpointerdown = null`) im Toolbox-Modul. `DragBox` muss weiter eine Anfangsprüfung bekommen (1 Hook-Zeile `if (HTML.IsDraggable && !HTML.IsDraggable(id)) ...`) oder per Wrapper um `HTML.DragBox` (aufgerufen als `HTML.DragBox`). Risiko: `closebox.js` setzt `fixdragdrop:false` (STAYS-Zeile).
- `cssMinSize` (~8 Zeilen): STAYS, Bugfix (Mindestgröße ignoriert CSS-`min-width`) -> upstream anbieten.
- Titel-Suffix " - FoE Toolbox": STAYS (1 Zeile).

### i18n/de.json (185/19) -> EXTRACTABLE
19 Zeilen ändern bestehende Keys (Branding: `FoE Helper` -> `FoE Toolbox`, `GlobalSend`-Texte, `HideHelperDuringBattle` u. a.), 185 neue Keys (alle Toolbox-Texte). Mit `toolbox.de.json` + 1-2 Zeilen im Loader (Überschreib-Reihenfolge prüfen) geht `de.json` auf Upstream zurück. Das ist die Datei mit dem höchsten Konfliktrisiko, weil Upstream sie bei fast jedem Release anfasst.

### Datenbank-Muster (eventhandler, gexstat, guildmemberstat, qiprogress, strategy-points, guild_fights; je 2-3 Zeilen)
Jedes Modul ändert `DBName` und ersetzt `db.open()` durch `await IndexDB.openWithLegacyCopy(...)`. Zwei Wege:
- **Muster A (Hook)**: Je Modul `IndexDB.ModuleDBName('Events', id)` und `openWithLegacyCopy`. Bleibt 2 Zeilen je Datei (12 Zeilen gesamt, mit Marker). Robust, sichtbar.
- **Muster B (null Zeilen)**: Toolbox-Modul ersetzt global `Dexie` durch eine Unterklasse (Namen `FoeHelperDB_*` -> `FoEToolbox2DB_*`, `open()` kopiert vorher aus der Legacy-DB, `transformRows` für Guild Fights in einer Tabelle im Toolbox-Modul). Alle sechs Dateien und der Name in `indexdb.js` gehen auf Upstream zurück. Preis: Magie, die jede neue Dexie-Nutzung stillschweigend umbiegt, und Reihenfolge mit dem vendor-Skript. Empfehlung: erst A, B nur wenn die 12 Zeilen schmerzen.
- `guild_fights.js` zusätzlich: Badge-Handler (`getBattleground` ergänzen) EXTRACTABLE als eigener `addHandler` in `gbg-actionlog.js`; `$('#GBGActionLogCount').remove()` per `addFoeHelperHandler('ActiveMapUpdated')` ebenso. Button `GBGActionLog.toggleWindow()` im Box-HTML: 1 Zeile STAYS.

### js/web/indexdb/js/indexdb.js (261/148) -> HOOK, fast alles verschiebbar
- Doku-Kommentar (+60): Toolbox-Modul.
- `mergeDatabases` ersetzt (-139/+15): `IndexDB.mergeDatabases` im Toolbox-Modul überschreiben; die Upstream-Funktion bleibt als toter Code stehen und konfliktfrei.
- `openWithLegacyCopy`, `copyFromLegacyDB` (+~85), `loadPlayer`, `addUserFromPlayerDictIfNotExists` (komplett ersetzt): ins Toolbox-Modul, per `Object.assign(IndexDB, {...})`.
- `Init`: Name `FoEToolbox2DB_` (1 Zeile, STAYS oder Muster B) und Schema `neighborhoodAttacks` (1 Zeile). Minimaler Hook: `IndexDB.ExtraStores` im `version()`-Aufruf mergen (die Schema-Version darf nach `open` nicht mehr erweitert werden).
- `GarbageCollector`: `players.clear()`/`greatbuildings.clear()` ersetzen durch Aufruf `IndexDB.toolboxGarbage?.()` (HOOK, 2-4 Zeilen); die neuen Löschregeln ziehen ins Toolbox-Modul.

### calculator.js (173/5), part-calc.js (49/5), notice.js (21/37), popup/js/popup.js (114/4)
- calculator: `RefreshGreatBuildingsDB` + `AggressiveInvestmentCells` (~130) per `Object.assign(Calculator, {...})` nach `parts/` (gleiches Muster wie `part-calc/parts/settings.js`). Bleiben Hook-Stellen in `CalcBody`: Tabellenkopf mit Gruppen (+8), Zellen-Aufruf (+1), `RefreshGreatBuildingsDB`-Aufruf (+13), FP-im-Lager-Zeile (+2), Variablen-Hoisting (+4), `popout:`-Zeile (+1). Ca. 30 Zeilen mit Marker.
- part-calc: `ArcPercentsStorageKey`, `LoadArcPercents` (~30) auslagern. Logikzeilen (`OneFPForNonFPPlace`, Laden, Speichern, Reset) bleiben; `settings.js` (Parts): zwei Checkboxen im HTML-String + Speichern STAYS. Upstream anbietbar wären die Optionen kaum (Verhalten "immer 1 FP" ist Upstream-Entscheidung).
- notice: `Notice.Store.send` ersetzt 8 `MainParser.send2Server`-Aufrufe. Besser: `MainParser.send2Server` (siehe `_main`, ersetzt ohnehin) leitet Endpunkte `Notice/*` an `Notice.Store.send` um, dann sind die 8 Aufrufe unverändert. Übrig: Entfernen von API-Token/GlobalSend-Prüfung in `Notice.Show` (~25 Zeilen, nicht außen lösbar; ein Hook `Notice.Backend?.skipAuth` wäre möglich), `BuildImportButton`-Aufruf, Sort-Default, Tab-Auswahl nach "neu" (4 Zeilen). Ziel: ~10-15 Zeilen.
- popup/popup.js: Shims (+105) per `Object.assign(Popup, {...})` auslagern. Bleiben: Aufruf `_installLookupShims()` beim Öffnen (+1) und Rückbau im Close (+3), Branding (4 Zeilen STAYS). Die Shims sind "adapted from Forge Hammer" und eignen sich als Upstream-Beitrag.

### settings (config.json 30/13, settings.js 11/3)
- config.json: Overlay-Merge-Hook in `Settings.LoadConfig` (siehe oben). `GlobalSend` (Default `false`, `doubleoptin`) per Overlay-Override, `Help`/`LoadBeta2` per Remove-Liste. Datei geht auf Upstream zurück.
- settings.js: `StoreSettings` umhängen (Wrapper liest `doubleoptin` aus `Settings.Preferences`, nicht aus der CSS-Klasse; `BuildBody` muss nicht mehr geändert werden, da Aufruf `Settings.StoreSettings($(this))` in `BuildBody` über die Property läuft). `VersionInfo` umhängen (zusätzliche `dt/dd`-Zeile "Basis" + Link): wrappen oder ersetzen. 1 Zeile (Weblate-Link) STAYS.

### Kleinere STAYS, upstream-würdig
`citymap.js` `trigger:'hover'` (Tooltip bleibt hängen), `_helper.js` `cssMinSize`, `background.js` Whitelist `send2Api`, `_main.js` Besucher-Stadt-Fix, `investment.js`/`notice.js`/`part-calc.js`/`calculator.js` `popout:`-Option, `negotiation.js` GbG-Setting, `popup/js/popup.js` Shims. Nach Abwägung eher als Issue/MR upstream, nicht als Toolbox-Patch pflegen.

## Zusammenfassung

Zählung nach Hauptklasse (48 Dateien): EXTRACTABLE 11, HOOK 17, STAYS 13, REVERT 7.
- Die 17 HOOK-Dateien enthalten überwiegend extrahierbaren Anteil (`indexdb.js`, `_main.js`, `calculator.js`, `popup/js/popup.js`, `notice.js`); echter Hook-Rest je Datei 1-35 Zeilen.
- Größte Gewinne (Zeilen und Konfliktwahrscheinlichkeit): `_i18n/de.json` (+185/-19, Upstream ändert sie ständig), `indexdb.js` (+261/-148), `_main.js` (+301/-60, v. a. `UpdatePlayerDict*`, `send2Server`, Entity-Flags), `popup/js/popup.js` (+105), CSS-Dateien (zusammen ~200 Zeilen), `internal.json`, `config.json`, `foeproxy.js`, `_menu.js` (+76).
- Vier kleine Core-Hooks tragen den Großteil: (1) `toolbox.json`-Loader in `inject.js`, (2) zweite i18n-Datei im Loader von `_main.js`, (3) Overlay-Merge in `Settings.LoadConfig`, (4) Fallback-Hook im Background-Message-Handler. Dazu Box-Event in `HTML.Box`, `IndexDB.ExtraStores`, Garbage-Hook.
- Es gibt keine fertige Registrierungs-API; die Strukturen (`_menu.Items/ItemsData/<id>_Btn`, Proxy-Handler, `Object.assign` auf Modul-Objekte) erlauben das meiste von außen, mit Drift-Risiko bei Wrappern (Gegenmittel: Signatur-/Hash-Check beim Start).
- Marker: einen festen Tag verwenden, z. B. `// TOOLBOX:` (Einzeiler) und `// TOOLBOX-BEGIN` / `// TOOLBOX-END` (Blöcke), damit `git grep TOOLBOX` die Restfläche zeigt; CI-Check, der Diffs gegen `f24d1fd4` ohne Marker meldet.
- Vorgeschlagene Reihenfolge (Gewinn je Aufwand): 1) Reverts und CSS (`alerts.js`/`popup.js` auf 1 Zeile, `.gitignore`, kosmetische Einzeiler, CSS-Dateien nach `toolbox.css`); 2) `toolbox.json` + `internal.json` zurück; 3) i18n-Overlay (`de.json`); 4) `foeproxy.js` per Raw-Handler; 5) `_menu.js` und Settings-Overlay (`config.json`, `settings.js`); 6) `_main.js`-Extraktion (Handler, `sendExtMessage`/`send2Server`-Wrapper, Entity-Flags, `UpdatePlayerDict`-Wrapper); 7) `indexdb.js` + DB-Muster A; 8) Hook-Dateien (`calculator`, `notice`, `popup`, `_helper`, `background`); 9) Upstream-Beiträge (Whitelist, Hover-Tooltip, Min-Size, Popout-Optionen, Besucher-Stadt-Fix).
- Unabhängig vom Code: `README.md` und `changelog*.md` (beide Seiten ändern) lassen sich per `.gitattributes` `merge=ours` schützen. Die gelöschten `_locales/*` und `_i18n/*` erzeugen bei jedem Merge Modify/Delete-Konflikte. Dort greift kein Merge-Treiber, Git ruft ihn bei Modify/Delete nicht auf. Abhilfe ist eine feste Merge-Anleitung in `docs/helfer-migration.md` (diese Pfade immer per `git rm` auflösen).
