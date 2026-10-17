# Box-Audit FoE Toolbox (Basis Helfer 4.8.3.0)

Vergleich `f24d1fd4` (Upstream) gegen Branch `feature/helfer-4.8.3`, Stand 2026-10-17. Alle Pfade relativ zum Repo.

## 1. Konventionen in Helfer 4.8 (belegt an bluegalaxy, productions, pvparena, part-calc, compare_friends_threads, marketoffers)

**Wichtigster Befund vorab:** 4.8 hat kein Light/Dark-Theme. Es gibt genau ein Design (braunes Spiel-Look), definiert als CSS-Variablen in `css/web/variables.css` (`--beige`, `--sunflower`, `--success`, `--danger-red`, `--info-blue`, `--table-bg-*`, `--text-dark`, `--black-65` ...). "Theme-aware" heißt hier also: Variablen aus `variables.css` statt Hex/rgba. Es gibt keinen `prefers-color-scheme`-Zweig.

**HTML.Box** (`js/web/_helper/js/_helper.js`, `HTML.Box`, Doku im JSDoc darüber). Übliche Kombination der modernen Module:
`id, title, auto_close: true, dragdrop: true, minimize: true, resize: true, settings: () => X.ShowSettings(), popout: () => MainParser.PopOut('<id>', w, h)`, optional `ask` (Hilfe-Link), `active_maps: 'main'`, `speaker`. Position und Größe stehen in der Modul-CSS (`#id { top; right; width; height }`), Body mit `overflow-y: auto`. Box wird nur einmal angelegt (`if ($('#id').length === 0)`), danach `HTML.CloseOpenBox(id)` als Toggle. CSS per `HTML.AddCssFile('<modul>')`.

**Rendering:** Zwei Stile leben nebeneinander im Upstream. `h.push('<tr>...' + x + '...')` (Array + join) ist weiter sehr verbreitet (part-calc 144 Stellen, productions 95, market 69, marketoffers 59, eventhandler 52). Template-Literals in `h.push(\`...\`)` und Arrow-Helfer pro Zelle (bluegalaxy: `iconTh = (col, icon, title) => \`<th ...>\``) sind der neuere Stil und der Zielstil für Neues. Kein jQuery-Elementbau für Inhalte. Escaping über `HTML.escapeHtml`, Zahlen über `HTML.Format`/`HTML.FormatNumberShort`, Texte mit Platzhaltern über `HTML.i18nReplacer(i18n(key), {x: ..})`, Tooltips über `title="${HTML.i18nTooltip(...)}"` (bzw. `fh-tooltip`/`td-tooltip` mit `data-original-title`).

**Tabellen:** `<table class="foe-table">`, sortierbar `class="foe-table sortable-table"` mit `<thead><tr class="sorter-header">` und `<th data-type="<tbody-klasse>">`, Zahlen-Zellen mit `data-number="..."`, Spalte ohne Sortierung `class="no-sort"`, danach einmal `$('.sortable-table').tableSorter()` (Plugin `tableSorter/table-sorter` aus `js/vendor.json`). Filter: `<input class="filterTable">` + `HTML.FilterTable`. Export: Klasse `exportable` + `HTML.ExportTable`. `<thead class="sticky">` für festen Kopf. Zustandsfarben über Zeilen-/Zellklassen (`success`, `error`, `warning`, `info`, `bg-green/bg-red`), Kopfblöcke über `<div class="dark-bg ...">` plus CSS-Klasse statt Inline-Style.

**Tabs:** HTML `<div class="tabs"><ul class="horizontal dark-bg"><li class="..."><a href="#id">..</a></li></ul><div id="id">..</div></div>`, Init per jQuery-Plugin `.tabslet({active: n})`. Hilfsfunktionen `SetTabs/GetTabs/SetTabContent/GetTabContent` pro Modul (productions, pvparena, gbg-actionlog). Kein zentraler Helfer in `HTML`.

**Buttons:** `<button class="btn">` oder `<span class="btn">`, Varianten `btn-slim`, `btn-green`, `btn-delete`, `btn-active`, `btn-group`. Definitionen in `css/web/boxes.css`.

**i18n:** `i18n('Boxes.<Modul>.<Key>')`. Toolbox hat nur `de.json` (Branding-Entscheidung), also neue Keys dort anlegen.

**CSS:** pro Modul `js/web/<modul>/css/<modul>.css`, alles unter `#<boxid>` gescopet, Farben aus Variablen (bluegalaxy: 0 Hex, 7 `var()`), keine `!important`, keine Inline-Styles außer dynamischen Werten (z. B. Breite einer Balkenanzeige).

**Events:** Delegiert und einmalig beim Anlegen der Box: `$('#id').on('click', '.sel', fn)`. Kein `onclick="..."` im Markup in neuem Code (Upstream hat es noch in discord 15x, guild_fights 17x, idleGame 9x).

## 2. Audit der Toolbox-eigenen Boxen

Gesamtbild: Die Toolbox-Boxen sind überwiegend näher an 4.8 als befürchtet. Sie sind erst im Zuge der Migration auf 4.8.3 entstanden bzw. angepasst worden (Variablen, `foe-table`, delegierte Events, `AddCssFile`). Die echten Lücken sind klein und konkret.

### 2.1 Looting / PvP-Angriffe (`js/web/looting/js/looting.js` 806 Z., `css/looting.css` 262 Z.)
Das PvP-Angriffe-Fenster ist `looting`. Es ist **nicht** das upstream `pvparena` (das ist ein anderes Feature, siehe `docs/helfer-migration.md`, Notizen 2).
Stand: Template-Literals, Render-Helfer (`RenderAction`, `RenderActionContent`, `RenderArmy`, `RenderUnit`), Events delegiert einmal beim Anlegen, `.btn`/`btn-active`, Tooltips über `HTML.i18nTooltip`. Das ist 4.8-Stil.
Abweichungen:
- **Hartcodierte Farben (16 Stellen in `looting.css`)**, nur 2 `var()`: `#7F5A34`/`#3D250F` (= `--border-table-top` / `--border-table-bottom`, Variablen existieren), `#FFB539` (= `--sunflower`), `#1e1`/`#ff5026`/`#1e7e34`/`#b39690` (= `--limegreen`/`--danger-red`/`--success` oder neue Variable), Zeilen-Hintergründe `rgba(128,255,128,.1)` usw. (= `--table-bg-success/-error/-info/-bright`, alle vorhanden), Hover `rgba(255,255,255,.2)`.
- **Inline-Style** `style="padding:5px 0 3px;"` am `dark-bg`-Kopf (Z. 495): in eine CSS-Klasse. `style="width: ${healthPerc}%"` (Z. 795) ist dynamisch und okay.
- **Kein `foe-table`**: Die Aktionsliste ist ein eigenes Flex-Layout aus `div.action-row` (Karten-Zeilen mit Avatar/Info/Inhalt). Das ist eine bewusste Layoutwahl und kein Altlast-Markup. Nicht sortier- oder filterbar (Filter laufen über Buttons und DB-Abfrage, passt zur Paginierung). Kein Umbau nötig, außer man will Kopfzeile/Sortierung.
- **Summentabelle** (`calculateSP`, Z. 560 ff.) ist `<table>` ohne `foe-table`, mit eigener CSS (`.strategy-points table`): auf `foe-table` umstellbar.
- **Fehlt:** `resize: true` (Breite fest `#lootingBody { width: 670px; max-height: 600px }`), `settings`. Fester Pixelwert statt resizebar ist die größte Optik-Abweichung zu productions/bluegalaxy/pvparena.
- Box-Position nicht in CSS gesetzt (`#looting` hat keine `top/left`), Rest über `dragdrop`-Default.
Aufwand: **S bis M**. S = Farben auf Variablen, Inline-Style raus, Summentabelle `foe-table`. M zusätzlich: `resize` mit flexibler Breite (Layout `.action-row` hängt an festen Spaltenbreiten 95/110 px).

### 2.2 Sabotage / Plünderhilfe (`js/web/sabotage/js/sabotage.js` 537 Z., `css/sabotage.css` 89 Z.)
Abweichungen:
- **Echter Bug, nicht nur Stil:** In `showResult` (Z. ~340 ff.) werden die Click-Handler (`.show-entity`, `.button-showcity`, `.button-showloot`) auf `#sabotageInfoBody` bei **jedem** Render erneut gebunden. Der Kommentar "body is replaced on every render" stimmt nicht: nur `.html()` wird ersetzt, das Body-Element bleibt. Folge: nach dem n-ten Render feuert ein Klick n-mal (`CityMap.init` mehrfach, `Looting.Show` mehrfach). Gleiche Fehlerklasse, die in Looting schon behoben wurde ("nächste Seite sprang mehrere Seiten"). Fix: Handler einmal im `if ($('#sabotageInfo').length === 0)`-Block binden.
- **Inline-`onclick`** im Markup (`onclick="Sabotage.SetAlert(...)"`, Z. ~324): auf delegierten Handler mit `data-`-Attributen umstellen.
- **String-Konkatenation** mit `h.push('<..>' + x)` und ~25 einzelne `h.push`-Zeilen. Zulässig (Upstream macht es auch), aber Z. 305-318 (`attdeftab`, 15 Zellen) sind ein guter Kandidat für Template-Literal + Zell-Helfer.
- **Inline-Styles**: `style="padding:5px 0 3px;"` (Z. 283), `<span style="color:grey;">` (Z. 243/244, in Daten eingebettet, besser Klasse `text-grey`, existiert schon im Kostenrechner).
- **Hartcodierte Farbe:** `rgba(121, 8, 8, 0.3)` für `tr.bg-red` = `--table-bg-error`. Der Rest nutzt Variablen.
- **Tabelle `#attdeftab`** ist `<table>` mit `td`-Kopfzeilen (`<td class="army">` statt `<th>`), ohne `foe-table`. Die Produktionstabelle ist dagegen schon `foe-table`.
- **Fehlt:** `resize` (nur `min-width: 550px; max-width: 600px`), `settings`, `ask`. Buttons nutzen `.btn`, aber `<span class="btn">` ohne `role`.
- Fester `max-height: 440px` im Body.
Aufwand: **S** (Bug + onclick + Farben + Inline-Styles), **M** mit Umbau `attdeftab` und `resize`.

### 2.3 LG-Investitionsübersicht (`js/web/calculator/js/parts/overview.js` 235 Z., CSS in `calculator.css` ab Zeile "pre-scan")
Stand: CSS ist sauber auf Variablen (0 Hex). Box-Optionen wie bei Upstream-Kalkulatoren (kein `resize` bei Upstream-Calculator ebenfalls). Handler einmal gebunden.
Abweichungen:
- **Inline-Style** `style="padding:5px 0 3px;"` (Z. ~113), wie oben.
- **Reine `h.push('<..>' + ..)`-Konkatenation** (ca. 25 Stellen), gemischt mit einem Template-Literal. Der Zeilenblock (5 Zellen mit gleichem `StrongClass`) schreit nach Zell-Helfer.
- **Deutsche Bezeichner** im Code (`Gewinn`, `BestKurs`, `GewinnString`, `KursString`, `Einzahlungen`), Upstream-Calculator macht das teils auch, neuere Module schreiben Englisch.
- **Tooltip der Farblegende** über eigenes CSS (`.color-description` mit `:hover`-Popup, ca. 35 Zeilen) statt `title="${HTML.i18nTooltip(...)}"`/`fh-tooltip`. Der Ersatz würde ~35 CSS-Zeilen sparen.
- **N+1 DB-Zugriffe**: pro Zeile `await IndexDB.db.greatbuildings.where(...).first()` in der Schleife. Besser einmal `where('playerId').equals(id).toArray()` und Map. Performance, nicht Optik.
- **Tabelle** `#OverviewTable` ist `foe-table`, aber nicht sortierbar (`sortable-table`/`sorter-header` fehlt), kein `text-center`-Mix-Problem.
- Stern-/Wahrheitswert-Klassen als `<strong class="success|warning|error">` statt Zell-/Zeilenklasse, daher das Override `#LGInvestmentOverviewBox strong { color: var(--sunflower) }`. Funktioniert, ist aber eine Sonderregel.
- Mitgeänderter Kostenrechner (`calculator.js`, +178 Z.): gleiche Konkatenation (`'<th class="group-start">' + ...`), `AggressiveInvestmentCells` baut aber sauber mit Template-Literal und nutzt `--table-bg-*`. Gut.
Aufwand: **S** (Inline-Style, Tooltip auf Standard, N+1), **M** wenn auch Rendering auf Zell-Helfer/Template-Literals und Sortierung.

### 2.4 GBG-Aktionslog (`js/web/gbg-actionlog/js/gbg-actionlog.js` 1370 Z., `css/gbg-actionlog.css` 277 Z.)
Das ist die modernste der Toolbox-Boxen (Forge-Hammer-Port, das selbst auf 4.x aufsetzt).
Stand: `foe-table sortable-table`, `sorter-header`, `tableSorter()`, `tabslet`, Settings-Callback, `resize`, `popout`, Tab-Helfer wie in productions, Lazy-Tabs, Export, Filter. Alle Standardmittel vorhanden.
Abweichungen:
- **`FH.*`-Namespace** (`FH.HTML.Box`, `FH.t`, `FH.Storage`, `FH.DateFormat`) über `js/web/fh-compat/js/fh-compat.js`. Bewusst, damit Diffs gegen Forge Hammer möglich bleiben (dokumentiert in `docs/forge-hammer-vergleich.md`). Wer "Helfer-Stil" will, müsste diese Schicht entfernen: dann gibt es keinen Abgleich mit Forge Hammer mehr. Entscheidung für den Nutzer, kein technischer Mangel.
- **Hartcodierte Farben (13 Hex/rgba)**: Heatmap-Stufen `rgba(254,220,0,.25)` ... `rgba(147,9,9,.95)` und Statusfarben `#be1a1a`, `#6b3f16`, `#36a983`, `#25cc25`, `#eed21e`, `#dfdfdf`, `#111`, `#c00f0f`. Das sind Fachfarben (Heatmap, Aktionstypen), die in 4.8 auch anderswo hartcodiert sind (guild_fights, gexstat). Besser als eigene Variablen am Dateianfang, aber kein Muss.
- **Inline-`onclick`** in den Settings (`<button onclick="GBGActionLog.saveSettings()">`, Z. ~668) und 1 Inline-`display:none` im Popup (Z. 478).
- Settings als Box-Settings-Overlay über `innerHTML` (wie Upstream üblich).
- Mischung Leerzeichen/Tabs und 4er-Einrückung (Upstream-Mix).
Aufwand: **S**.

### 2.5 Notizen (`js/web/notice/js/notice.js`, `js/web/notice/js/parts/store.js` 360 Z., `css/notice.css` +13 Z.)
`store.js` ist reine Datenschicht (Dexie, ersetzt die API), eigene UI nur der Import-Button und das Bestätigungs-Modal. Das Modal nutzt dieselbe Mechanik wie der Upstream-Editiermodus (`HTML.Box` `notices-modal` + `foe-helper-overlay`), also gleicher Stil. Der Button ist jQuery-Elementbau (`$('<span />').attr({role:'button', class:'btn ...'})`), passt zum übrigen `notice.js`, das Upstream ebenfalls so baut. CSS: 2 Regeln, nur Layout, keine Farben. `notice.js` selbst ist Upstream-Stil und bewusst nah an Upstream gehalten (Merge-Fähigkeit), inklusive `apiToken:Notice.ApiToken` in den Payloads (tot, harmlos). Popout wurde ergänzt.
Aufwand: **keiner** nötig. Optional S: Toast-Texte `'Error'` hartcodiert (steht so auch in Upstream).

### 2.6 Weitere Toolbox-eigene Boxen und Zusätze
- **Kostenrechner Zusatz** (`calculator.js`, `calculator.css`): siehe 2.3, CSS nur Variablen. Kein Befund.
- **Eigenanteilsrechner** (`part-calc.js` +54 Z., `parts/settings.js`): Zusätze im Stil der Umgebung (Konkatenation). Kein Befund.
- **Versteckte Ereignisse** (`hidden-rewards.js`, `boxes.css` `.hud-future-counter`): Upstream-Stil (4 Leerzeichen, `h.push('<td ...>' + ..)`). `--hud-counter-warn: #d07e03` neu in `variables.css`, korrekt als Variable. Kein Befund.
- **HUD/Box-Chrome** (`boxes.css` +80 Z.): `.window-dragtoggle` mit Inline-SVG als `data:`-URI und fest codierten Farben `%23c8cdd4` / `%23ffd063`. In CSS-Variablen nicht möglich (data-URI), alternativ als Sprite-Bild wie die anderen `window-*`-Buttons (Upstream nutzt `box-sprite.png`). Aufwand S, rein kosmetisch. `#GBGActionLogCount` nutzt Variablen.
- **HTML.Box** (`_helper.js`): Toolbox-Titel-Suffix `<small><em> - FoE Toolbox</em></small>`, Dragtoggle. Kein Altstil.
- **Neue Menüknöpfe** `[id$=sabotage-Btn] span` usw.: gleiche Form wie Upstream.

## 3. Upstream-Boxen mit altem Stil (Schnellscan, Kennzahlen aus Skript, nicht tief geprüft)

Wichtig: Der Upstream selbst ist heterogen. `h.push('..' + ..)`-Konkatenation ist dort kein Altstil-Merkmal, sondern Normalfall. Gelistet sind nur auffällige Abweichungen.

| Modul | Auffälligkeit |
|---|---|
| `profile` | ca. 290 Hex/rgba-Treffer in `profile.css`, eigene Farbvariablen (`--main-background` usw.) statt `variables.css`, eigenes dunkelblaues Design (Absicht, aber bricht aus dem Rest) |
| `cardgame` | 24 Inline-Styles, 21 Hex in der CSS, nur 11 `var()` |
| `mergergame` | 21 Inline-Styles |
| `guild_fights` | 22 Inline-Styles, 17 `onclick=`, 20 Hex in CSS, Datei mit 5081 Zeilen |
| `discord` | 15 `onclick=`, 15 Inline-Styles, ~50 Template-Zeilen mit Markup |
| `idleGame` | 9 `onclick=`, 9 Inline-Styles, 5 Tabellen |
| `gexstat` | 26 Hex in der CSS, 3 `onclick` |
| `unit` | 17 Hex in `unit.css` (Button-Verläufe, Gradients statt `--btn-bg*`), 7 Inline-Styles |
| `citymap` | 41 Hex in CSS (Gebäudefarben, teils Absicht, `--background-color-*` existieren aber schon), 7 `onclick` |
| `city-builder` | 15 Hex, 7 Inline-Styles |
| `guildmemberstat` | 19 `<table>` gegen 16 `foe-table`, 13 Hex, 8 Inline-Styles |
| `negotiation` | 14 Hex in CSS, 0 Tabellenklassen außer 1 |
| `allies`, `shopAssist` | 8 Inline-Styles je Modul |
| `auctions` | nacktes `<table>` ohne `foe-table`, 0 `var()` in JS-Nähe, Settings-Dialog im Alt-Stil |
| `market` | Konkatenation 69x, 1 Tabelle `filters` ohne `foe-table` |
| `eventhandler`, `market`, `marketoffers` | 50-70 `h.push('..' + ..)`, aber sonst Standard (`foe-table sortable-table exportable`) |
| `part-calc` | 144 `h.push('..' + ..)`, 13 Inline-Styles, größtes Einzelmodul im Konkatenationsstil |
| `findGB`, `investment`, `stats` | je 1 bis 2 `<table>` ohne `foe-table` |

Ohne `resize` obwohl Listenbox (Auswahl): `battle-assist`, `castle`, `gexstat`-Teile, `hidden-rewards`, `negotiation`, `part-calc`, `calculator`, `eventchests`, `recurring-quests`. Bei den Rechnern ist das Absicht (feste Größe).

## 4. Empfehlung zur Reihenfolge

1. **Sabotage**: Handler-Bug (Mehrfachbindung) zuerst, unabhängig vom Restyling (S).
2. **Looting, Sabotage, Übersicht**: Farben auf `variables.css`, Inline-Styles in CSS, Inline-`onclick` raus. Eine gemeinsame CSS-Klasse für den `dark-bg`-Kopfblock (heute 3x `padding:5px 0 3px`) in `boxes.css`. Zusammen S.
3. **Looting**: `resize` mit flexibler Breite, Summentabelle `foe-table` (M).
4. **Übersicht**: Tooltip auf Standard, N+1 beseitigen, optional sortierbar (S bis M).
5. **GBG-Log, Notizen**: nicht anfassen, außer die Entscheidung fällt, `fh-compat` aufzugeben.
6. **Dragtoggle-Icon**: als Sprite statt Inline-SVG (S, optional).
Gesamt: etwa 1 bis 2 Tage für 2 bis 4. Keine der Boxen braucht einen Neubau.
