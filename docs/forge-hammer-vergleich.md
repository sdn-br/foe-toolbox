# Forge Hammer vs. FoE Helfer als Upstream der FoE Toolbox

Stand: 2026-10-17. Alle Repos nur gelesen. Arbeitskopie für Git-Analysen: Scratch-Klon von Forge Hammer mit `refs/helfer/master` und neu `refs/helfer/beta` (aus dem lokalen Helfer-Repo geholt).

Markierung: **[V]** = im Code/Git verifiziert, **[A]** = abgeleitet/vermutet.

## 0. Kurzfassung

- Split-Paar [V]: Forge Hammer `6534996053615a90e6eae62b7a90013ba98d61ff` = Helfer `b3270ba9d56bf8ce5a6005a82465fc5a54d5db6b`. Beide: Yvi, 2026-05-31 20:40:21 +0200, "Update citymap.js", **identischer Tree** `7f4ef1cb496954ec5dced996e3bda4f65ab08831`, Manifest 4.3.0.0.
- Das Kernteam des Helfers (Yvi alias outoftheline, Beelzebob6666) arbeitet seit dem Split nur noch an Forge Hammer. Den Helfer macht seitdem fast allein mainIine.
- Forge Hammer hat alle Datenübertragung an foe-helper.com entfernt und den gesamten Code auf einen Namespace `FH.*` umgebaut. Das macht einen Wechsel der Toolbox zu einem großen, aber überwiegend mechanischen Umbau.
- Lizenz: auf allen drei Seiten byte-identische AGPLv3. Nichts verbietet Fork oder Wiederverwendung.
- Keine der Toolbox-Sonderfunktionen (Plünderhilfe, PvP-Verlauf, Snipe-Vorab-Scan, GbG-Verhandlung) ist in Forge Hammer. Eine ausdrückliche Policy dagegen gibt es auch nicht; die GbG-Sperre im Verhandlungsassistenten ist auf beiden Seiten gleich.
- Empfehlung: vorerst beim Helfer bleiben, Forge Hammer beobachten; Wechsel erst bei klarem Auslöser (siehe Abschnitt 8).

## 1. Split-Punkt

| | Forge Hammer | FoE Helfer |
|---|---|---|
| Letzter gemeinsamer Commit | `6534996053615a90e6eae62b7a90013ba98d61ff` | `b3270ba9d56bf8ce5a6005a82465fc5a54d5db6b` |
| Tree | `7f4ef1cb…` | `7f4ef1cb…` (gleich) |
| Erster eigener Commit danach | `3929e7c3a` Merge 'upstream/beta' (2026-05-31), dann `f99219351` "Rename" | `1ef31cc90` "Guild Members: fix guild goods accumulation" (Yvi, 2026-06-01) |
| Tip | `ef25ea621` (2026-10-17, 1.8.2) | `f24d1fd4e` (2026-09-29, 4.8.3.0) |

Methode [V]: Commits beider Seiten über (Author-Zeit, Autor, Subject) abgeglichen: 7.723 Treffer. Der jüngste Treffer ist das Paar oben; der Tree-Vergleich bestätigt Gleichstand. Nach dem Split gibt es keinen gemeinsamen Commit mehr (einziger gleicher Subject: "Merge branch 'beta'").

Hintergrund [V]: Das Forge-Hammer-Repo ist die Fortsetzung von Yvis persönlichem Fork `outoftheline/foe-helfer-extension`. Ihre Merges "Merge remote-tracking branch 'upstream/…'" reichen bis 2020 zurück; der letzte ist `3929e7c3a` am Split-Tag. Danach fließt nichts mehr zwischen den Linien.

Diff zwischen den Linien (im Scratch-Klon):
- `git diff 6534996053 main`: Forge Hammer seit Split
- `git diff b3270ba9d5 refs/helfer/master`: Helfer seit Split
- `git diff main refs/helfer/master`: direkt, weil die Split-Trees gleich sind

Helfer `beta` ist vollständig in `master` enthalten (0 Commits nur in beta) [V].

## 2. Aktivität und Team

### Commits pro Monat seit Split (ohne Merges) [V]

| Monat | Forge Hammer | Helfer |
|---|---:|---:|
| 2026-06 | 180 | 15 |
| 2026-07 | 277 | 73 |
| 2026-08 | 169 | 31 |
| 2026-09 | 54 | 20 |
| 2026-10 (bis 17.) | 31 | 0 |
| Summe | 713 (784 mit Merges) | 139 (193 mit Merges) |

Commit-Zahlen täuschen. mainIine macht wenige, große Commits mit langen Sammel-Subjects (Median 127 Zeichen). Nach Code-Umfang (nur `.js`, ohne Whitespace) [V]:
- Forge Hammer seit Split: +21.089 / −13.143 Zeilen (davon ~5.000 neuer Stadtplaner `planner/`).
- Helfer seit Split: +30.000 / −18.453 Zeilen (viel davon Aufteilen großer Module in `parts/`, also Verschieben).
- Eigener JS-Umfang: Split 55.523, Forge Hammer 62.663, Helfer 67.840 Zeilen.

Trend [V]: Beide Seiten flachen ab. Forge Hammer von 277 (Juli) auf 54 (Sept.). Helfer seit 2026-09-29 ohne Commit (18 Tage).

### Team [V]

| | Forge Hammer seit Split | Helfer seit Split |
|---|---|---|
| Autoren | Yvi 508, Beelzebob6666 195, Arklur 9, Colton Capps 1 | mainIine 88, Weblate 42, Yvi 5 (letzter 2026-06-11), Wolf 4 |
| Merger | — | Daniel Siekiera (Gründer, merged PRs) |

Vor dem Split (seit 2025-06) waren die Haupt-Entwickler des Helfers: Beelzebob6666 ~309, Yvi/outoftheline ~379 (gleiche Mail `yvi@outoftheline.net`), Weblate 132, Daniel Siekiera 43. mainIine hatte vor dem Split 38 Commits, den letzten 2024-06-18 [V].

Das heißt: **beide früheren Kern-Entwickler sind komplett zu Forge Hammer gegangen.** Der Helfer hängt heute praktisch an einer Person (mainIine). Forge Hammer hängt an zwei Personen.

### Release-Signale [V]

- Helfer: 24 Versionssprünge seit Split (4.3.0.1 am 2026-06-26 bis 4.8.3.0 am 2026-09-29). Repo `github.com/mainIine/foe-helfer-extension`, Weblate (`i18n.foe-helper.com`), Docs `docs.foe-helper.com`, Discord, Ko-fi. Das README beschreibt einen Build über `manifests/build.js`, das Verzeichnis `manifests/` fehlt aber im Repo (nur `manifest.json` ist versioniert).
- Forge Hammer: Tags v0.9 (2026-06-14) bis v1.8.2 (2026-10-09), 14 Tags. Repo `github.com/outoftheline/forge-hammer`, eigener Discord, Ko-fi `forgehammer`, `privacy.md` mit DSGVO-Text, Kontakt `forgehammer@outoftheline.de`. Manifest-Vorlagen `manifests/chromium` und `manifests/firefox`.

### Aussagen zum Grund des Forks

Ausdrücklich steht der Grund nirgends [V]. Es gibt nur diese Hinweise:
- README: "A fork of the FoE Helper Browser Extension".
- changelog-en.md 0.9, "Removed": "Any Links to FoE Helper, including city transmission"; "Notes: They relied on the website for storage, so the had to go for now".
- 0.9 "New": "Translations: to replace weblate, a translation tool was added".
- 1.1: "Added a warning, when FoE Helper was detected".
- Commits: `fa9c079b5` "More renaming and API removal", `73f959afb` "Remove more Helper stuff", `df9d1f05e` "remove foe-helper leftovers in translation data and custom events".
- Settings-Text: "Forge Hammer is a browser extension for Forge of Empires for players by players. We are not affiliated with InnoGames."

[A] Daraus lässt sich nur vermuten: Die Trennung betrifft vor allem die Website foe-helper.com, den Datenversand dorthin und Weblate. Forge Hammer hat alles davon entfernt. Über persönliche oder organisatorische Gründe steht nichts im Repo. Das Wiki "Switching-from-FoE-Helper-to-Forge-Hammer" (im Code verlinkt) habe ich nicht gelesen.

## 3. Features

### Modul-Verzeichnisse `js/web/*` gegenüber dem Split [V]

**Helfer, neu:** `allies`, `ascended`, `building-marker`, `checklist`, `citysearch`, `gbbonus`, `inventory`, `popup`, `webrequest`, `guild_fights` (ersetzt `guildfights`).
**Helfer, entfernt:** `campagnemap`, `guildfights`.

**Forge Hammer, neu:** `gbCalc`, `gbg-actionlog`, `notes`, `popout`, außerdem Top-Level `planner/` (eigene Stadtplaner-Seite).
**Forge Hammer, entfernt:** `_i18n` (Übersetzungen jetzt in `_languages/json`), `_menu_bottom`, `_menu_box`, `_menu_right` (alles in `_menu`), `city-builder`, `notice`.

`js/internal.json`: Der Helfer lädt Module jetzt mit Unter-Dateien (`{"name": "calculator", "parts": ["settings"]}` usw.). Forge Hammer hat eine flache Liste ohne `parts` [V].

### In einfachen Worten

**Nur im Helfer** [V aus Changelog/Code]:
- Inventar-Übersicht mit Eigenschafts-Filter.
- Majestätische (zeitlich begrenzte) Gebäude in einer Box (`ascended`).
- Goldene Pfeile auf der Stadt, die Gebäude markieren (`building-marker`), plus Gebäudesuche (`citysearch`).
- Checkliste aus Spielnachrichten (`checklist`).
- LG-Bonus-Übersicht je Prestige-Stufe (`gbbonus`).
- "Web Requests": GbG-Sektordaten an einen eigenen Server schicken (`webrequest`).
- City Builder (Stadtplaner im Spiel), aufgeteilte Produktions-Bewertung, Mehrstufen-LGs im Kostenrechner, Split-View für Kostenrechner/Eigenanteilsrechner.
- Notizen über foe-helper.com (`notice`, braucht API-Token).

**Nur in Forge Hammer** [V aus Changelog/Code]:
- Themes/Skins (`css/themes/*`, Setting `Skins`), Spielfarben-Filter, Sounds pro Modul.
- Eigenes Übersetzungs-Werkzeug statt Weblate.
- Lokale Notizen/To-dos (`ForgeHammerDB_Notes_<id>`).
- GbG-Aktionslog (`gbg-actionlog`), GbG-Ziele auf der Karte, GbG-Statistik mit Diagrammen.
- Stadtplaner als eigene Seite (`planner/`).
- Pop-out-Fenster für mehrere Boxen (`popout`); der Helfer hat dafür `popup`.
- Investment-Tab "My GBs" (Arklur).

**Gemeinsam, aber getrennt weiterentwickelt:** Kostenrechner, Eigenanteilsrechner, Blaue Galaxie, Produktionen, Stadtkarte, Verhandlungsassistent, Gildenkämpfe.

### Settings `config.json` [V]

- Nur Helfer: `About`, `ApiToken`, `GlobalSend`, `Help`, `MenuLength`, `SelectedMenu`, `ShowShopAssist`.
- Nur Forge Hammer: `CalcGBReminder`, `DateTimeFormat`, `Filters`, `MenuAppearance`, `ModuleSounds`, `Skins`.
- Format der Einträge ist gleich (`name`, `status`, `group`, `sort`, `callback`, `hidden`). Keine Seite kennt `doubleoptin` (das bringt erst die Toolbox).

## 4. Technik

### Manifest [V]

| | Helfer 4.8.3.0 | Forge Hammer 1.8.2 | Toolbox 2.0.0.0 |
|---|---|---|---|
| MV | 3 (+ `background.scripts` für Firefox, Gecko-ID) | 3 (Chromium); Firefox-Vorlage MV2 | 3 |
| permissions | alarms, storage, notifications, clipboardWrite | alarms, storage, **tabs**, notifications, clipboardWrite | wie Helfer + scripting |
| host_permissions | forgeofempires, foe-helper.com, *.foe-helper.com, *.foe-rechner.de | nur `*.forgeofempires.com` | wie Helfer |
| externally_connectable | Spielseite + `"ids": ["*"]` | nur Spielseite | wie Helfer |
| update_url | keine | keine | keine |
| Popup | `content/popup.html` | `content/info.html` | `content/popup.html` |

Firefox-Vorlage Forge Hammer: `strict_min_version 140.0`, ID `@forge-hammer`, `data_collection_permissions` (websiteActivity, websiteContent, personalCommunications, browsingActivity) [V].

[A] `"ids": ["*"]` bei Helfer und Toolbox heißt: jede andere installierte Erweiterung kann dem Background Nachrichten schicken (`onMessageExternal` hängt am selben Handler). Die Toolbox schränkt ihren `send2Server`-Typ auf `api.foe-rechner.de` ein; das bleibt aber eine offene Fläche, die Forge Hammer nicht hat.

### Struktur und Code-Stil [V]

Forge Hammer hat praktisch alle globalen Namen umgebaut:
- `FoEproxy` → `FH.proxy` (378 → 0 Treffer für `FoEproxy`)
- `MainParser` → `Main` bzw. `FH.Main`
- `i18n('…')` → `FH.t('…')` (1.818 → 0 bzw. 1.924 Aufrufe)
- `localStorage` → `FH.Storage` mit Präfix `Hammer.` (liest alte, unpräfixierte Schlüssel einmal und kopiert sie)
- `ExtPlayerID`, `ExtWorld`, `ExtGuildID` → `FH.Player.ID`, `FH.World`, `FH.Guild.ID`
- `PlayerDict` → `FH.Players`; `GoodsData` → `FH.Goods`; `HTML.i18nReplacer` → `FH.helper.str.Replacer`
- `HTML` gibt es weiter, zusätzlich als `FH.HTML`.
- CSS von `css/web/*` nach `css/*`, Bilder von `css/images` nach `images/`.

Der Helfer hat seinerseits Module in `parts/` aufgeteilt (`calculator/parts/settings`, `part-calc/parts/{copybox,powerleveling,settings}`, `productions/parts/{rating,tables}`, `guild_fights/parts/…`, `citymap/parts/city-buildings`) und Zeilenenden normalisiert (Wolf, 2026-08-22).

Ähnlichkeit wichtiger Dateien (Helfer gegen Forge Hammer, nach Rückbenennung der `FH.*`-Namen, Whitespace ignoriert; grobe Zeilenzählung) [V, Näherung]:

| Datei | abweichende Zeilen |
|---|---:|
| `indexdb.js` | 2 % |
| `hidden-rewards.js` | 6 % |
| `_menu.js` | 18 % |
| `part-calc.js` | 32 % |
| `settings.js` | 33 % |
| `_main.js` | 48 % |
| `_helper.js` | 54 % |
| `negotiation.js` | 61 % |
| `citymap.js` | 63 % |
| `bluegalaxy.js` | 67 % |
| `calculator.js` | 71 % |
| `productions.js` | 74 % |

### i18n [V]

- Helfer: `js/web/_i18n/*.json` (26 Sprachen), `_locales`, Weblate.
- Forge Hammer: `js/web/_languages/json/*.json` (26 Sprachen, UTF-8 mit BOM), in-game Übersetzungs-Tool, Fallback `en`, Aufruf `FH.t()`.
- Toolbox: nur `de.json`, Fallback `de`.

### Datenversand an externe Server

Helfer 4.8.3 [V]:
- `ApiURL = 'https://api.foe-rechner.de/'`.
- `GlobalSend` default `true`. `SelfPlayer` hängt an `GlobalSend`.
- **Ohne** Abfrage von `GlobalSend` gesendet: Weltenliste (`WorldService.getWorlds` → `Worlds`), eigene LG-Daten (`OwnLGData`), Gebäudeliste (`BuildingList`, alle 7 Tage mit 0,5 % Zufall, `srcLinks.js`).
- Stadtplaner/Außenposten (`CityPlanner`) und Notizen (`Notice/*`) senden mit API-Token.
- Kein `privacy.md` im Repo.

Forge Hammer [V]:
- Kein `ApiURL`, kein `GlobalSend`, kein `ApiToken`, keine foe-helper/foe-rechner-Hosts.
- `Main.send2Server` steht noch im Code, wird aber nirgends aufgerufen und nutzt ein nicht definiertes `ApiURL` (toter Code).
- Ausgehende Requests: nur Dateien der eigenen Erweiterung, Spieldateien vom InnoGames-CDN (Gebäude-Metadaten, `ForgeHX`), Discord-Webhooks, die der Nutzer selbst einträgt.
- Externe Links (nur Anzeige): `foe.scoredb.io`, `foestats.com`.
- `privacy.md`: "Your data remains local on your computer and is not transmitted elsewhere by the extension".

Toolbox (feature/helfer-4.8.3) [V aus Doku/Diff]: `GlobalSend` default aus mit Double-Opt-In; auch `Worlds`, `OwnLGData`, `BuildingList` nur noch mit `GlobalSend`; Versand über den Background.

### IndexedDB [V]

| DB | Helfer | Forge Hammer | Toolbox |
|---|---|---|---|
| Haupt-DB | `FoeHelperDB_<id>` v3 | `FoeHelperDB_<id>` v3 (gleiches Schema) | `FoEToolbox2DB_<id>` |
| Events | `FoeHelperDB_Events_<id>` | gleich | `FoEToolbox2DB_Events_<id>` |
| GexStat, GuildMemberStat, FPCollector, Qi | `FoeHelperDB_<Modul>_<id>` | gleich | `FoEToolbox2DB_<Modul>_<id>` |
| GbG | `FoeHelperDB_GuildFights_<id>` (v21) | `ForgeHammer_GBG_<id>` v1, einmalige Migration aus `FoeHelperDB_GuildFights_<id>` (liest v1 und v21) | `FoEToolbox2DB_GuildFights_<id>` |
| GbG-Log | — | `FoeHelperDB_GBG_<id>` | — |
| Notizen | (Server) | `ForgeHammerDB_Notes_<id>` | (Server) |

Folgen:
- Forge Hammer und Helfer teilen sich die meisten DB-Namen. Deshalb verweigert Forge Hammer das Laufen neben dem Helfer (siehe unten).
- Die Toolbox-Kopierlogik (`copyFromLegacyDB`) würde Forge-Hammer-Daten automatisch mitnehmen, weil die Quellnamen `FoeHelperDB_*` gleich sind [A]. Für GbG müsste `ForgeHammer_GBG_` als zusätzliche Quelle dazu.

### Nebeneinander laufen [V]

Forge Hammer `_main.js` prüft beim Start `window.ExtbaseData`, `window.FH?.Basedata`, `i18n` und `window.GetFights`. Findet es etwas, legt es ein Vollbild-Overlay "FoE-Helper detected!!! Please remove or deactivate …" bzw. "Hammer duplicate detected" über das Spiel und bricht ab. Eine Toolbox auf Helfer-Basis definiert `GetFights` und `i18n` und löst diese Sperre also aus [A, aus dem Code gelesen, nicht im Browser getestet].

[A] Umgekehrt gilt ähnliches: Zwei Erweiterungen derselben Codebasis im MAIN-World der Spielseite kollidieren bei `let MainParser`/`let HTML` (Top-Level-`let` in klassischen Scripts) bzw. bei der Prüfung `typeof globalThis.FH == 'undefined'` im Proxy. Eine Toolbox auf Forge-Hammer-Basis müsste den Namespace `FH` umbenennen, wenn sie neben Forge Hammer laufen soll.

### background.js [V]

- Gemeinsame Nachrichtentypen: alerts, create, delete, get, getAll, getAllRaw, message, preview, previewId, setData, showNotification, storeData, test.
- Nur Helfer: `send2Api`, `triggerNow`. Nur Forge Hammer: `buildingMetaIds`, `buildingMetaSet`.
- `onInstalled`: Forge Hammer lädt alle offenen Spiel-Tabs ohne Rückfrage neu (`chrome.tabs.update`, deshalb die `tabs`-Permission). Die Toolbox fragt per `scripting.executeScript` nach.

## 5. Lizenz

[V] `LICENSE.md` ist in Helfer, Forge Hammer, Toolbox (beide Branches) **byte-identisch** (MD5 `13a1999816e406118ec3372de06aaa7a`, 650 Zeilen): unveränderte GNU AGPL v3. Abschnitt "7. Additional Terms" ist der Standardtext, es gibt keine zusätzlichen Bedingungen.

Datei-Header:
- Helfer (150 Dateien): "Copyright (C) 2026 FoE-Helper team - All Rights Reserved / You may use, distribute and modify this code under the / terms of the AGPL license."
- Forge Hammer (alte Dateien): "Copyright (C) 2026 FoE-Helper team - All Rights Reserved / Licensed under AGPL - see LICENSE.md for details."
- Forge Hammer (19 neue/geänderte Dateien) zusätzlich: "Copyright (C) 2026 Forge Hammer".
- READMEs: Helfer "_This is an Open Source Project under the [AGPLv3 License](LICENSE.md)._", Toolbox "_Dies ist ein Open Source Projekt unter der [AGPLv3 Lizenz](LICENSE.md)._". Forge Hammer nennt die Lizenz im README nicht, nur in `LICENSE.md` und den Headern.

Bewertung [A]: "All Rights Reserved" widerspricht der Lizenz nur scheinbar; die Header gewähren ausdrücklich Nutzung, Weitergabe und Änderung nach AGPL. Nichts schränkt einen Fork oder die Übernahme von Code aus einer der beiden Linien ein. Pflichten wie bisher: Quellcode offen halten (die Toolbox ist auf GitHub), AGPL behalten, Copyright-Hinweise nicht entfernen. Wer Code aus Forge Hammer übernimmt, sollte die Zeile "Copyright (C) 2026 Forge Hammer" mitnehmen. Markennamen ("FoE Helper", "Forge Hammer") sind kein Lizenzthema, aber Branding sollte wie bisher klar getrennt sein.

## 6. Passung der Toolbox-Änderungen auf Forge Hammer

Grundlage: `git diff f24d1fd4 HEAD` im Toolbox-Branch (~4.700 Zeilen hinzugefügt ohne gelöschte Sprachdateien) und `docs/helfer-migration.md`. Zusätzlich habe ich für jeden Hunk geprüft, ob seine alten Zeilen (nach Rückbenennung der `FH.*`-Namen) in der Forge-Hammer-Datei vorkommen [V, Skript-Näherung]: z. B. `hidden-rewards.js` 6/6, `indexdb.js` 5/5, `_menu.js` 4/4, `closebox.js` 4/4, `part-calc.js` 6/7, `_main.js` 11/26, `bluegalaxy.js` 1/8, `calculator.js` 0/8, `_helper.js` 1/8.

Stufen: **wie ist** = nur mechanische Umbenennung; **klein** = wenige Stellen anders einhängen; **groß** = an anderer Codebasis neu bauen.

| # | Feature | Hook-Punkte in Forge Hammer | Stufe |
|---|---|---|---|
| 17 | Branding, nur Deutsch, Update/Reload, DB-Migration | `FH.Storage`-Präfix `Hammer.` umstellen; i18n-System anders (`_languages/json`, `FH.t`, Übersetzungs-Tool, Fallback `en`); Duplikat-Sperre anpassen; `onInstalled` lädt zwangsweise neu; DB-Namen und `copyFromLegacyDB` übertragbar (`indexdb.js` fast gleich), Quellen um `ForgeHammer_GBG_`, `FoeHelperDB_GBG_`, `ForgeHammerDB_Notes_` ergänzen | mittel bis groß |
| 16 | Datenmodell (Proxy `responseData`, CityEntity-Flags, PlayerDict, IndexDB) | `FH.proxy._proxyAction(service, method, data, postData)` ruft `callback(data, postData)` wie im Helfer; Forge Hammer hat nur **eine** sortierte Schleife statt drei → dritter Parameter an 2–3 Stellen. `Main.correctBuildingType()` und `Main.CityEntityBuilder()` vorhanden → Einhängepunkt für `setToolboxEntityFlags` da. `UpdatePlayerDict`/`UpdatePlayerDictCore` vorhanden, Dict heißt `FH.Players`. `addUserFromPlayerDictIfNotExists`, `GarbageCollector`, `players`/`greatbuildings` vorhanden | klein |
| 16a | Bekannte Spieler aktualisieren | wie 16 | klein |
| 1 | Plünderhilfe (`sabotage`, neu) | `CityBuildings.createBuilding`, `Productions.getRatingValueForType`, `Technologies.Eras`, `CityMap.OtherPlayer`, `CityMap.init(event)`, `LastMapPlayerID`, `Alerts.getAll` vorhanden. **Fehlt:** `CityMap.FocusEntities` (Forge Hammer scrollt per `.highlighted` + `scrollTo`), `HTML.i18nReplacer` → `FH.helper.str.Replacer`, `GoodsData` → `FH.Goods` | klein |
| 2 | PvP-Verlauf (`looting`, neu) | `Unit.Types/GetBoostSums/GetBoostDict/PrepareCoords`, `srcLinks.GetPortrait`, `IndexDB.getDB`, PvP-Arena-Service vorhanden; nur Umbenennungen | wie ist / klein |
| 3 | Snipe-Vorab-Scan (`calculator/parts/overview.js`) | Handler `getOtherPlayerOverview` vorhanden. Forge Hammer kennt keine `parts` in `internal.json` → eigenes Modul oder in `calculator.js`. `GreatBuildings.GetP1` fehlt (Forge Hammer nutzt die Tabelle `GreatBuildings.Rewards`) → Funktion mitbringen | klein bis mittel |
| 4 | Kostenrechner: Minimal-Investition, Tabelle, FP im Lager | `BuildTable`/`ShowBody` gibt es, aber `calculator.js` weicht zu ~71 % ab; kein Split-View (`CalculatorBox`), kein `SaveRankCosts`; Forge Hammer hat eigene BP-Logik ("highest tier blueprints") | groß |
| 5 | Kostenrechner schreibt LGs in IndexedDB | Tabelle `greatbuildings` gleich, `Parts.IsPreviousLevel` vorhanden; Einhängen in die andere `BuildTable` | klein bis mittel |
| 7 | GbG-Verhandlungsassistent | Wächter in `Negotiation.StartNegotiation` identisch aufgebaut (`CONST_Context_GBG`, `//No Negotiation helper for GBG`) → eine Zeile + Setting | wie ist |
| 8 | Fenster fixieren | `HTML.Box`, `HTML.DragBox(el, save)`, `HTML.Resizeable` vorhanden, aber `HTML.Box` auf beiden Seiten unterschiedlich umgebaut; Forge Hammer hat eigene Pop-out-Logik (`popout`-Option, `HTML.Boxes`); Box-Menü steckt in `_menu.js` | mittel |
| 9 | Alarme `requireInteraction` | in Forge Hammer `background.js` vorhanden | nichts zu tun |
| 10 | Eigenanteilsrechner: 1 FP, Bonus pro LG | Einstellungsdialog liegt in `part-calc.js` (kein `parts/settings.js`); `Parts.GetStorageKey(name, entityId)` und `ArcPercents` gleich | klein |
| 11 | Blaue Galaxie: Diamanten | Forge Hammer hat die Helfer-Neufassung nicht, sondern eine eigene Fassung mit `CombinedValue` und `CityBuildingsData` → Patch neu schreiben, ~20 Zeilen | klein |
| 12 | Versteckte Ereignisse: Zukunft + Zähler | `hidden-rewards.js` fast gleich (`FilteredCache`, gleicher Filter `StartTime > …`), `hiddenRewards_Btn` gleich | wie ist |
| 13 | Stadtübersicht: Tooltips, Double-Opt-In beim Senden | Tooltips (`.tooltip(` ohne `trigger`) vorhanden → 2 Zeilen. Senden an foe-helper gibt es in Forge Hammer nicht mehr (`CityMap.SubmitData` nur noch in alten Sprachdateien) | wie ist / entfällt |
| 14 | Spielerlinks nur auf dem Icon | `Main.GetPlayerLink/GetGuildLink/GetBuildingLink` vorhanden | wie ist |
| 15 | Datenschutz (`GlobalSend`, Double-Opt-In, Versand via Background, Ban-Erkennung) | Versand, `GlobalSend`, Notizen-API gibt es nicht → größtenteils **entfällt**. Bleibt: Double-Opt-In-Mechanik in `settings.js` für 1, 3, 7 (Settings-Format gleich) | klein |
| Bugfix | Resize-Mindestgröße | `HTML.Resizeable` vorhanden | klein |

Weitere Hook-Punkte [V]:
- `_menu`-Muster gleich: `_menu.Items`, `_menu.MakeButton(slug, red)`, `<id>_Btn`-Funktionen, Tooltip-Liste `{ id, title, description, warning }`. Nur `i18n` → `FH.t`, `_menu.toolTipp` → `FH.menu.toolTipp`.
- `Settings.GetSetting`, `config.json`-Format gleich; `doubleoptin` gibt es auf keiner Seite.
- `HTML.Box`, `HTML.AddCssFile`, `HTML.ShowToastMsg`, `HTML.escapeHtml`, `HTML.CloseOpenBox`, `HTML.Format` vorhanden.
- `MainParser.sendExtMessage` → `FH.Main.sendExtMessage` vorhanden.

### Aufwand [A]

**Wechsel auf Forge Hammer jetzt:**
- Neue Module (sabotage, looting, overview, ~1.600 Zeilen JS + CSS): Umbenennen per Skript, dann ein paar fehlende Helfer-Funktionen nachbauen (`FocusEntities`, `GetP1`).
- 16, 16a, 7, 12, 13, 14: kleine Eingriffe, ein Großteil der Hunks passt nach Umbenennung.
- 4 und 8: an Forge Hammers anderer Kostenrechner- bzw. Box-Logik neu bauen.
- 15 schrumpft stark, weil Forge Hammer nichts sendet.
- 17 ist größer als beim Helfer: anderes i18n-System, Storage-Präfix, Duplikat-Sperre, Manifest-Vorlagen, zusätzliche DB-Quellen für die Kopie.
- Grobe Schätzung: etwa **1,0–1,3 × der gerade erledigten Helfer-4.8.3-Migration** (die laut Git in 27 Commits an einem Tag lief) plus der komplette Browser-Test aus `docs/helfer-migration.md` noch einmal. Der Testaufwand ist der eigentliche Kostentreiber, nicht der Code.
- Nutzer verlieren gegenüber dem Helfer: Inventar-Übersicht, Gebäude-Marker/Suche, Checkliste, Majestätische Gebäude, LG-Bonus-Übersicht, City Builder, Split-View, Web Requests. Sie gewinnen: Themes, lokale Notizen, GbG-Log, Stadtplaner-Seite, Pop-outs.

**Beim Helfer bleiben:**
- Keine Einmalkosten. Pro Helfer-Release ein Rebase der ~45 berührten Dateien. mainIine baut viel um (Aufteilen in `parts/`, große Sammel-Commits), Konflikte sind also wahrscheinlich, bleiben aber an bekannten Stellen.
- Die Datenschutz-Patches (15) müssen bei jedem Release neu geprüft werden, weil der Helfer neue Uploads ohne `GlobalSend` einbaut (zuletzt `Worlds`, `OwnLGData`, `BuildingList`).

## 7. Toolbox-Sonderfunktionen in Forge Hammer?

[V] Keine davon ist vorhanden:
- Plünderhilfe/Sabotage: kein `sabotage`, kein `lootable`, kein `ShowNeighborsLootables`/`ShowPlayersAttDeffValues`. "plunder" kommt nur bei FP-Sammler (`plunderReward`), Moppelhelfer (wer hat mich geplündert), Tooltip "can not be plundered" und Event-Handler vor.
- PvP-Verlauf/Looting: kein `looting`, keine Tabelle `neighborhoodAttacks`. `pvpActions` steht im Schema, wird wie im Helfer kaum genutzt; es gibt das gemeinsame `pvparena`-Modul.
- Snipe-Vorab-Scan: nichts (`LGInvestmentOverviewBox`, `ShowPossibleInvestments` fehlen). Neu ist nur `gbCalc` (sammelt LG-Daten aus besuchten Städten für den eigenen Rechner, kein Scan der LG-Übersicht).
- GbG-Verhandlung: Sperre wie im Helfer (`return; //No Negotiation helper for GBG`).

Policy [V]: Keine ausdrückliche Policy gegen solche Funktionen in README, Changelog oder Code. Die Haltung kommt aus der gemeinsamen Geschichte:
- 2020-06-20 Daniel Siekiera "plunder removed" (Modul `plunderer` gelöscht, `2022e4c5b`).
- Helfer-Changelog 3.10.0.0 (gemeinsame Zeit): "GG Aktive Spieler: Modul entfernt auf Anfrage durch Inno"; "Wiederholtes Bauen: … Obwohl das Feature an sich grünes Licht von Inno bekommen hat, könnte es trotzdem vorkommen, dass die Bot-Erkennung ausgelöst wird."
- Forge Hammer übernimmt die Warnung beim Wiederholten Bauen ("might trigger INNOs bot detection and may cause a short ban period").

[A] Beide Linien folgen also derselben vorsichtigen Linie gegenüber InnoGames. Forge Hammer hat seit dem Split nichts in Richtung Plündern/Snipen ergänzt. Dass die Forge-Hammer-Entwickler Toolbox-Funktionen übernehmen würden, ist nicht zu erwarten.

## 8. Risiken und Empfehlung

### Risiken, wenn die Toolbox beim Helfer bleibt

- Bus-Faktor 1: mainIine ist fast der einzige Entwickler; die früheren Kern-Entwickler sind weg. Seit 18 Tagen kein Commit.
- Große Sammel-Commits und laufende Umbauten (Module in `parts/`) machen jeden Rebase konfliktanfällig.
- Datenschutz-Abweichung wächst: der Helfer sendet standardmäßig an `api.foe-rechner.de`, teils ohne `GlobalSend`. Die Toolbox muss das bei jedem Release nachziehen.
- `externally_connectable.ids: ["*"]` bleibt geerbt.
- Nebeneinander mit Forge Hammer geht nicht (Forge Hammer sperrt sich bei Helfer-Code) [A, aus Code].

### Risiken bei Wechsel auf Forge Hammer

- Einmaliger großer Umbau: Namespace `FH.*`, anderes i18n, anderes Storage, andere Kostenrechner- und Box-Logik. Kompletter Browser-Test noch einmal.
- Bus-Faktor 2 (Yvi, Beelzebob6666). Aktivität fällt seit Juli deutlich (277 → 54 Commits im Monat). Junges Projekt (seit Juni 2026).
- Funktionsverlust für Toolbox-Nutzer (Inventar, Gebäude-Marker, Checkliste, City Builder usw.).
- Forge Hammer teilt DB-Namen mit dem Helfer und sperrt sich gegen parallel laufende Helfer-Abkömmlinge. Eine FH-basierte Toolbox müsste den Namespace `FH` umbenennen, um neben Forge Hammer zu laufen.
- Erzwungener Tab-Reload bei Installation und `tabs`-Permission (änderbar).

### Empfehlung

**Vorerst beim Helfer bleiben, Forge Hammer beobachten.**

Gründe:
1. Die Toolbox wurde gerade auf 4.8.3.0 gebracht und getestet. Ein Wechsel kostet noch einmal etwa denselben Aufwand plus den vollen Browser-Test, ohne dass die Toolbox dadurch eine eigene Funktion gewinnt.
2. Der Helfer hat mehr und neuere Module; er bewegt sich nach Code-Umfang nicht langsamer als Forge Hammer, auch wenn er weniger Commits hat.
3. Der wichtigste Vorteil von Forge Hammer (kein Datenversand) hat die Toolbox mit Feature 15 schon selbst abgedeckt.
4. Forge Hammer ist jung und verliert gerade an Tempo. Ob es sich hält, lässt sich in 3–6 Monaten besser sagen.

Auslöser für einen Wechsel (dann neu bewerten):
- Der Helfer bleibt mehrere Monate ohne Release, während das Spiel Updates bringt.
- mainIine baut Kernstellen so um, dass ein Rebase teurer wird als der Wechsel (z. B. Proxy, `_main.js`, IndexedDB).
- Neue Helfer-Uploads ohne Opt-in häufen sich.
- Forge Hammer hält sein Tempo und gewinnt weitere Entwickler.

Sinnvoll schon jetzt [A]: Toolbox-Code möglichst in eigenen Modulen und dünnen Einhängepunkten halten (wie bei `sabotage`, `looting`, `overview`). Das senkt die Kosten für beide Wege. Einzelne gute Forge-Hammer-Ideen (z. B. zentrales `Storage` mit Präfix, lokale Notizen) lassen sich wegen gleicher Lizenz gezielt übernehmen.

## 9. Was verifiziert ist und was nicht

Verifiziert im Code/Git: Split-Paar und Tree-Gleichheit, Commit- und Autorenzahlen, Versionen/Tags, Modul-Listen, Settings-Unterschiede, Manifeste, Lizenzdateien und Header, ausgehende URLs und `send2Server`-Aufrufe, DB-Namen und Schemas, Proxy-Signatur, vorhandene/fehlende Funktionen, Duplikat-Sperre, GbG-Wächter, Fehlen der Toolbox-Sonderfunktionen.

Abgeleitet/nicht geprüft: Gründe des Forks; Laufzeitverhalten (nichts im Browser getestet); Kollision zweier Erweiterungen auf der Spielseite; Aufwandsschätzung; Ähnlichkeitsprozente sind eine grobe Zeilen-Näherung nach Umbenennung; Issues, Store-Bewertungen und Nutzerzahlen beider Projekte (nicht im Repo, nicht gesucht); Forge-Hammer-Wiki nicht gelesen.
