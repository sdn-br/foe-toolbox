## Changelog - Extension

##### 1.6.1.0
**Bugfix**
- Einstellungen
    - Verhandlungsassistent für Gildengefechte ist jetzt standardmäßig abgeschaltet
- Moppelassistent
    - Buttons (Nachbarn, Gildenmitglieder, Freunde) werden jetzt korrekt freigeschaltet, wenn man in der Socialbar die entsprechende Liste öffnet


##### 1.6.0.0
**Update**
- Einstellungen
    - Einstellung hinzugefügt, die den Verhandlungsassistenten für die Gefechte abschaltbar macht
	- Verhandlungsassistent für Gildengefechte und Nachbarschaftsplünderanzeige sind jetzt standardmäßig abgeschaltet

**Foe-Helfer**
- Alle relevanten Änderungen und Bugfixes bis einschließlich FoE Helfer 2.5.5.1 migriert


##### 1.5.4.2
**Bugfix**
- Forschungskosten
    - Das Zeitalter wird jetzt immer richtig ermittelt


##### 1.5.4.1
**Bugfix**
- Menü aus des FoE Helfer übernommen, weil die Ansicht durch das neue dynamische Menü zerstört wurde


##### 1.5.4.0
Keine internen Änderungen

Folgende Änderungen und Bugfixes aus FoE Helfer 2.5.2.7  migriert

**Update**
- Forschungskosten:
    - [#1622](https://github.com/dsiekiera/foe-helfer-extension/issues/1622) Das Fenster lässt sich nun individuell in der Größe verändern

**Bugfix**
- Notizen:
    - [#1627](https://github.com/dsiekiera/foe-helfer-extension/issues/1627) Es konnte keine neue Seite angelegt werden

- Kostenrechner:
    - [#1619](https://github.com/dsiekiera/foe-helfer-extension/issues/1619) Rundungsfehlern bei manchen Archefaktoren behoben

Folgende Änderungen und Bugfixes aus FoE Helfer 2.5.2.6  migriert

**Bugfix**
- Extension:
    - Motivieren/Polieren angepasst, API neu gestaltet

Folgende Änderungen und Bugfixes aus FoE Helfer 2.5.2.5  migriert

**Update**
- Notizen:
    - der letzte Tab wird "gemerkt" wenn neue Seiten angelegt werden

**Bugfix**
- Verhandlungsassistenen:
    - Optische Korrekturen am Verhandlungsassistenen

##### 1.5.3.0
Keine internen Änderungen

Folgende Änderungen und Bugfixes aus FoE Helfer 2.5.2.4  migriert

**BugFix**
- Verhandlungsassisten:
    - roten Rahmen beim falschen Auswählen eines Gutes gefixt

- Gefechtsassistent:
    - Das Fenster beim Verlieren einer Einheit aus dem nächsten ZA lässt sich nun "normal" wegklicken

Folgende Änderungen und Bugfixes aus FoE Helfer 2.5.2.3  migriert

**Update**
- Motivieren/Polieren:
    - Übermittlung an foe-rechner.de überarbeitet


##### 1.5.2.0
Interne Änderungen

**BugFix**
- Interne Spielerdatenbank
    - Ausnahme (Console log) beim öffnen der Ereignisliste behoben

Folgende Änderungen und Bugfixes aus FoE Helfer 2.5.2.2  migriert

**Update**
- Event/Schrittrechner:
    - [#1592](https://github.com/dsiekiera/foe-helfer-extension/issues/1592) Einstellung zum deaktivieren der Box hinzugefügt

- Gefechtsassistent:
    - Ab sofort wird auch einen Warnung ausgegeben wenn eine seltene Einheit des nächsten ZAs gestorben ist => Möglichkeit zu heilen

**BugFix**
- Eigenanteilsrechner:
    - [#1586](https://github.com/dsiekiera/foe-helfer-extension/issues/1586) Beim Ändern von Archefaktor oder externen Werten sprang der EA-Rechner auf das aktuelle Level zurück, falls zu einem höheren Level weitergescrollt wurde
    - [#1588](https://github.com/dsiekiera/foe-helfer-extension/issues/1588) EA Rechner ludt nicht bzw. aktualisierte sich, wenn externe Spalten befüllt wurden

- Legendäre Bauwerke:
    - [#1587](https://github.com/dsiekiera/foe-helfer-extension/issues/1587) LG-Investitionen Innovation Tower waren unterhalb von Level 10 verrutscht

- Forgepunkte Balken:
    - [#1589](https://github.com/dsiekiera/foe-helfer-extension/issues/1589) FP-Counter in GG zählte nicht hoch

- Notizen:
    - fehlenden "Speicher"-Button ergänzt

##### 1.5.1.0
Keine Interne Änderungen

Folgende Änderungen und Bugfixes aus FoE Helfer 2.5.2.1 migriert

**Neu**
- Gildenchat:
    - überarbeitet und mit verschiedenen "Räumen"

**Update**
- Tavernenbadge:
    - entfernt da es Inno nachgebaut hat

- Kostenrechner:
    - [#1504](https://github.com/dsiekiera/foe-helfer-extension/issues/1504) Redesign der "Kopieren" Funktion, Scheme ist ab sofort selber einstellbar

- Legendäre Bauwerke:
    - [#1518](https://github.com/dsiekiera/foe-helfer-extension/issues/1518) der erforderliche Platz Faktor kann ab sofort geändert werden
    - [#1574](https://github.com/dsiekiera/foe-helfer-extension/issues/1574) Unterstützung für blaue Galaxie hinzugefügt

- Infobox:
    - [#1542](https://github.com/dsiekiera/foe-helfer-extension/issues/1542) "Willkommenstext" kann mit "Box leeren" entfernt werden

**BugFix**
- Statistiken:
    - [#1522](https://github.com/dsiekiera/foe-helfer-extension/issues/1522) [#1568](https://github.com/dsiekiera/foe-helfer-extension/issues/1568) beim wechsel zwischen Außenposten und Stadt gab es einen Knick in der Statistik

- Marktplatz Filter:
    - [#1541](https://github.com/dsiekiera/foe-helfer-extension/issues/1541) hat man den Filter manuell geöffnet, wurde er nicht geöffnet
    - [#1543](https://github.com/dsiekiera/foe-helfer-extension/issues/1543) "fair bei niedrigem Lagerstand" wurde korrigiert
    
- Gildengefechte:
    - [#1547](https://github.com/dsiekiera/foe-helfer-extension/issues/1547) Tabellenkopf wurde überarbeitet
    
- Legendäre Bauwerke:
    - [#1567](https://github.com/dsiekiera/foe-helfer-extension/issues/1567) LG wurden dauerhauft ausgeblendet wenn die Güterkosten zu hoch waren

##### 1.5.0.0
Interne Änderungen

**Bugfix**
- Plünderhilfe
    - Die Plünderhilfe funktioniert jetzt auch zuverlässig aus dem Eventlog
	- Die Zeit bis zum nächsten möglichen Angriff wird jetzt anhand der Serverzeit ermittelt und funktioniert daher Fehlerfrei
	
Folgende Änderungen und Bugfixes aus FoE Helfer 2.5.2.0 migriert

**Neu**
- Gildenkassen Export:
    - [#670](https://github.com/dsiekiera/foe-helfer-extension/issues/670) [#926](https://github.com/dsiekiera/foe-helfer-extension/issues/926) [#1042](https://github.com/dsiekiera/foe-helfer-extension/issues/1042) klick alle Seiten durch bis zum gewünschten Datum, dann exportiere dir eine CSV; daraus kannst Du dir eine Excel Pivot Tabelle erstellen; einstellbar in den Einstellungen

- Marktplatz Filter:
    - beim betreten des Marktplatzes öffnet sich ein Fenster in dem alle Einträge nach belieben gefiltert werden können, die Seitenzahl zeigt sofort an wo im Spiel das Angebot anschließend zu finden ist; einstellbar in den Einstellungen

**Update**
- Legendäre Bauwerke:
    - [#1501](https://github.com/dsiekiera/foe-helfer-extension/issues/1501) can be calculated for a friend/guild member after a visit

- Infobox:
    - [#1509](https://github.com/dsiekiera/foe-helfer-extension/issues/1509) [#1515](https://github.com/dsiekiera/foe-helfer-extension/issues/1515) Style überarbeitet, für die neue Version (aktiv auf der Beta) angepasst

- Extension:
    - [#1514](https://github.com/dsiekiera/foe-helfer-extension/issues/1514) Boxen können durch anklicken in den Vordergrund geholt werden

- Event/Schrittrechner:
    - [#1532](https://github.com/dsiekiera/foe-helfer-extension/issues/1532) ab sofort werden auch Zutaten des Herbstevents korrekt erkannt

**BugFix**
- Infobox:
     - [#1439](https://github.com/dsiekiera/foe-helfer-extension/issues/1439) vierfach Einträge gefixt

- Kostenrechner:
    - [#1503](https://github.com/dsiekiera/foe-helfer-extension/issues/1503) falsche Farbe in der Differenz Spalte führte zu irretationen

- Infobox:
    - [#1506](https://github.com/dsiekiera/foe-helfer-extension/issues/1506) wenn eine Provinz in der GG eingenommen wurde diese Meldung doppelt mit einem anderern Event angezeigt
    - [#1520](https://github.com/dsiekiera/foe-helfer-extension/issues/1520) das löschen eines Gebäudes auf der GG Map erzeugte einen leeren Eintrag

- Legendäre Bauwerke:
    - [#1525](https://github.com/dsiekiera/foe-helfer-extension/issues/1525) wenn man die Kosten auf 0 stellte verschwand das LG
    
- Produktionsübersicht:
    - [#1528](https://github.com/dsiekiera/foe-helfer-extension/issues/1528) Boosts von Markusdom. Leuchtturm etc. wurden bei deaktivierter Übermittlung an foe-rechner.de ignoriert

##### 1.4.4.0
Interne Änderungen

**Update**
- Plünderhilfe
    - Stadt-Plan kann jetzt immer aufgerufen werden
	
- Kostenrechner
    - Es wird nun eine Warnung angezeigt, wenn ein Spieler laut Inno als inaktiv gilt.
	
- IndexDB
    - Einige Vorbereitungen um Inaktivität anderer Spieler leichter feststellen zu können

##### 1.4.3.0
Interne Änderungen

**Update**
- Plünderhilfe
    - Box-Layout überarbeitet

##### 1.4.2.1
Interne Änderungen

**Bugfix**
- Plünderhilfe
    - Sortierung funktioniert jetzt auch in sehr hohen Zeitaltern
	
##### 1.4.2.0
Interne Änderungen

**Bugfix**
- Plünderhilfe
    - Funktioniert wieder

**Update**
- Plünderhilfe
    - Sortierung der Produktionen jetzt nach Anzahl der möglichen Produktionen (inkl. Gewichtung der Güter) und nicht mehr nach Namen des Gebäudes
	
##### 1.4.1.0
Interne Änderungen

**Update**
- Kostenrechner 
    - Der Kostenrechner öffnet jetzt immer wieder automatisch, wenn man ein LG öffnet, so lange das Mögliche Investitionen Fenster noch aktiv ist
	
##### 1.4.0.3
Interne Änderungen

**Bugfix**
- Verhandlungsassistent 
    - Funktioniert jetzt wieder
	
##### 1.4.0.2
Interne Änderungen

**Bugfix**
- Ereignisse 
    - Gildenexpedition wurde angezeigt
	
##### 1.4.0.1
Interne Änderungen

**Update**
- Datenbank 
    - Es werden bei einer Erstinstallation die Daten aus dem original FoE Helfer migriert
	
##### 1.4.0.0
Interne Änderungen

**Bugfix**
- Gildengefechte
    - Fehlende Übersetzung gefixed
	
Folgende Änderungen und Bugfixes aus FoE Helfer 2.5.1.0 migriert

**Neu**
- Eigenanteilsrechner:
    - Powerleveln hinzugefügt: 
        - ein neuer Button, unten rechts, startet diese Funktion in einer extra Box
        - Stufen bis > 100 Verfügbar
        - Gebäude mit Doppelernten werden berücksichtigt

**Update**
- Notizen:
    - [#1300](https://github.com/dsiekiera/foe-helfer-extension/issues/1300) Notizen werden beim schliessen der Box gespeichert

- Einstellungen:
    - [#1413](https://github.com/dsiekiera/foe-helfer-extension/issues/1413) Buttons aus dem Menü in die neue Einstellungsbox verschoben
    
- Produktionsübersicht:
    - [#1424](https://github.com/dsiekiera/foe-helfer-extension/issues/1424) Bonus von Botschaftern und Gildenboni wurde bei der Rückkehr beim Rathaus nicht angezeigt

- Kostenrechner:
    - [#1433](https://github.com/dsiekiera/foe-helfer-extension/issues/1433) korrekte Formatierung ergänzt
    
- Stadtübersicht:
    - [#1438](https://github.com/dsiekiera/foe-helfer-extension/issues/1438) auf der Map werden beim Mouseover die Zeitalter angezeigt

**BugFix**
- Infobox:
    - [#1375](https://github.com/dsiekiera/foe-helfer-extension/issues/1375) doppelte Einträge gefixt

- Statistiken:
    - [#917](https://github.com/dsiekiera/foe-helfer-extension/issues/917) "seit Dienstag" gefixt

- Übersetzungen:
    - [#924](https://github.com/dsiekiera/foe-helfer-extension/issues/924) String gefixt

- Ereignisse:
    - [#1321](https://github.com/dsiekiera/foe-helfer-extension/issues/1324) Counter im Menü zählt nun korrekt

- Produktionsübersicht:
    - [#1343](https://github.com/dsiekiera/foe-helfer-extension/issues/1343) Produktionen konnten doppelt erscheinen

- Eigenanteilsrechner:
    - [#1378](https://github.com/dsiekiera/foe-helfer-extension/issues/1378) beim Öffnen fremder LGs wurde der eigene Spielernamen angezeigt

- Notizen:
    - [#1454](https://github.com/dsiekiera/foe-helfer-extension/issues/1454) Content wurde zu breit angezeigt

- Kostenrechner:
    - [#1471](https://github.com/dsiekiera/foe-helfer-extension/issues/1471) Tooltip bliebt manchmal hängen
    - [#1495](https://github.com/dsiekiera/foe-helfer-extension/issues/1495) Farben der Level-Warnung angepasst

##### 1.3.1.1
Interne Änderungen

**BugFix**
- Mögliche Investitionen
    - Möglicher Fix für LG aktualsiert nicht, wenn letzter Platz nicht mehr belegbar ist

##### 1.3.1.0
Interne Änderungen

**Update**
- Mögliche Investitionen
    - Layout geändert

Folgende Änderungen und Bugfixes aus FoE Helfer 2.5.0.1 migriert

**BugFix**
- Eigenanteilsrechner:
    - [#1317](https://github.com/dsiekiera/foe-helfer-extension/issues/1317) Sound beim Wechseln einer wiederholbaren "gib X FP aus" Quest wird nicht zuverlässig wiedergegeben
    - [#1318](https://github.com/dsiekiera/foe-helfer-extension/issues/1318) Ton im Kostenrechner komm in Bronzezeit bis FMA auch bei der Quest "erforsche 2 Technologien"

- versteckte Ereignisse:
    - [#1295](https://github.com/dsiekiera/foe-helfer-extension/issues/1295) blaues Zählericon verhinderte Klick
    - [#1314](https://github.com/dsiekiera/foe-helfer-extension/issues/1314) doppelte Straßen wurden nicht angezeigt
    
- Legendäre Bauwerke:
    - [#1305](https://github.com/dsiekiera/foe-helfer-extension/issues/1305) die Eingabe der FP Kosten verschwand in ein anderes Feld
    - [#1315](https://github.com/dsiekiera/foe-helfer-extension/issues/1315) Fehler wenn eines der FP produzierenden LG über lvl100 oder höher ist

##### 1.3.0.0
Interner Release, keine weiteren Feature von FoE Helfer übernommen

**Neu**
- Projekt in FoE Toolbox umbenannt

**Update**
- Eigenanteilsreichner
    - Die Buttons für die Förderschritte sind jetzt auch hier dynamisch
- Allgemein
    - Projekt etwas aufgeräumt und nicht verwendete Dateien entfernt
	- Kleiner Anpassungen und Namensänderungen

##### 1.2.1.0
Interner Release, keine weiteren Feature von FoE Helfer übernommen

**BugFixes**
- Kostenrechner
    - Behoben, dass der Knopf für Archebonus immer wieder hinzugefügt wird

##### 1.2.0.0
Interner Release, keine weiteren Feature von FoE Helfer übernommen

**Neu**
- Einstellungen:
    - Es können jetzt die angezeigten Förderschritte im Kostenrechner selbst bestimmt werden
	
**Update**
- Einstellungen
    - Standardwerte so geändert, dass FoE Helfer bei einer kompletten Neuinstallation nicht nach Hause telefoniert
	
**BugFixes**
- Weitere interne Anpassungen

##### 1.1.2.0
Interner Release, keine weiteren Feature von FoE Helfer übernommen

**Update**
- Mogliche Investments zeigt jetzt auch den Gildennamen an

**BugFixes**
- Weitere kleine Bugfixes
- Weitere interne Anpassungen


##### 1.1.1.0
Interner Release, keine weiteren Feature von FoE Helfer übernommen

**Update**
- Spenden-Popup entfernt
- Original-Logo des FoE Helfer entfernt

**BugFixes**
- Einige kleinere Migrationsprobleme gelöst
- Einige interne kleine Anpassungen


##### 1.1.0.0
Folgende Änderungen und Bugfixes aus FoE Helfer 2.5.0.0 migriert

**Neu**
- Boost-Box:
    - eine kleine Box die in der GEX, GG, GvG und bei den Nachbarn eingeblendet wird zeigt an, wie viele Versuche für Kriegsbeute oder Verändlungen verbleiben
    
- Legendäre Bauwerke:
    - diese Box errechnet welches FP produzierende Gebäude das nächste kostengünstigeste wäre
    
- Notizen:
    - Gruppiert und Sortiert Notizen aller Art ablegen. Diese Funktion arbeite mit dem Server und ist Geräteübergreifend

**Update**
- Hidden Rewards:
    - ein Zähler zeigt an wie viele Ereignisse noch irgend wo auf der Map liegen

- Produktionsübersicht:
    - [#1185](https://github.com/dsiekiera/foe-helfer-extension/issues/1185) Zeitalter wird mit ausgegeben
    - Gildenmacht als neuer Tab Verfügbar
    - [#1205](https://github.com/dsiekiera/foe-helfer-extension/issues/1205) Sortierfunktion für Güter
    
- Kostenrechner:
    - [#1168](https://github.com/dsiekiera/foe-helfer-extension/issues/1186) neue Checkbox "Alle", damit werden ohne Abhängkeiten alle Plätze 1-5 ausgegeben
    
- Enstellungen:
    - [#1169](https://github.com/dsiekiera/foe-helfer-extension/issues/1189) Firefox: Einstellungsmenü zeigt sporadisch keine übersetzten Texte

**BugFixes**
- Kostenrechner:
    - [#1153](https://github.com/dsiekiera/foe-helfer-extension/issues/1153) bereits eingzahlte FP wurden nicht korrekt erkannt

- Tavernenbadge:
    - [#1182](https://github.com/dsiekiera/foe-helfer-extension/issues/1182) Counter für 4. Versuch stimmt nicht, Zeiten werden ab sofort vom Spiel übernommen    

- CityMap (intern): 
    - [#1184](https://github.com/dsiekiera/foe-helfer-extension/issues/1184) Fehlerhafte Anzeige der freien Fläche
    - [#1204](https://github.com/dsiekiera/foe-helfer-extension/issues/1204) Übermittlungsbox wird nicht mehr bim Nachbarn angezeigt

- Produtkionsübersicht:
    - [#1201](https://github.com/dsiekiera/foe-helfer-extension/issues/1201) Straße mit "Zufriedenheit" werden nicht mehr mit Straßenbindung berechnet

---

##### 1.0.0.0
Initialer Fork des FoE Helfer 2.4.6.2
