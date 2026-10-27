# Finanzcode Loom-Ads

6 Ads × Anfang A/B × 4:5/9:16 = 24 Dateien nach `briefing/Briefing_v2.pdf`, gebaut mit HyperFrames
(HTML/GSAP → Video). Das Loom-Rohmaterial (`Trading wie beim Roulette denken.mp4`) wird geschnitten,
der Ton bearbeitet, die „Bildschirmaufnahmen“ sind gerenderte Folien mit Cursor.

## Ablauf

```
data/cache/              Insel-Transkription der Aufnahme (Grundlage für die Schnittauswahl)
data/edit/ranges.json    redaktioneller Schnitt: Zeitbereiche der Aufnahme + gesprochener Text pro Segment (18 Segmente)
tools/cut/ranges.py      → data/edl/<seg>.edl.json   Schnittlisten (Schnitte in Pausen, lange Pausen auf 0,22 s)
tools/cut/render_seg.py  → assets/media/<seg>.voice.wav / .cam.mp4, data/media
                           (Tempo 1,05× / Ad 3 1,1×, Entrauschen, Kompressor 3:1, −14 LUFS, ≤ −1 dBTP, Kreis-Ausschnitt)
tools/cut/voice_words.py → data/timing/<seg>.words.json  Untertitel-Zeiten aus dem geschnittenen Ton
tools/cut/verify.py      prüft jeden geschnittenen Ton gegen den geplanten Text
src/scenes/<seg>.html    Folien (Motiv-Zone 1080×710) + <seg>.cues.json (Stichwörter → Zeitpunkte)
tools/build.mjs          → build/<Variante>/       24 HyperFrames-Projekte (Layout, Kreis, Hook, Untertitel, Ton)
tools/render.py          → out/FC_Loom_*.mp4       H.264 High, 30 fps konstant, 15 Mbit/s, AAC 48 kHz 320 kbit/s
tools/mix.py             Stimme −14 LUFS, Musik ~20 dB darunter, Effekte ~12 dB darunter
```

## Lokal auf dem Mac weitermachen

1. Repo holen: `git clone https://github.com/kaankayafidan/test.git && cd test`
2. Sitzung holen: `claude --teleport` (Sitzung auswählen) — Claude Code ≥ 2.1.223, gleicher claude.ai-Account.
3. Einmalig: `finanzcode/tools/setup_mac.sh` (Homebrew: ffmpeg, Node 22+, Python-Pakete, HyperFrames-Chrome, Musik)
4. Videos nach Google Drive (Ordner „FC Loom Ads“, braucht Google Drive für Desktop):
   - Schnell: die ZIPs bzw. MP4s aus dem Chat in `~/Downloads` laden, dann `finanzcode/tools/to_drive.sh`
     (entpackt die ZIPs und kopiert alle 24 Videos in den Drive-Ordner).
   - Oder neu bauen: `finanzcode/tools/run_all.sh ~/Downloads/"Trading wie beim Roulette denken.mp4"`
     → 24 Dateien in `finanzcode/out/`, am Ende automatisch in den Drive-Ordner kopiert.

Nicht im Repo (zu groß / reproduzierbar): `data/raw/` (Loom-Video), `assets/media/`, `assets/music/bed.wav`,
`build/`, `out/`.

## Redaktionelle Entscheidungen

Kilian hat stark vom Skript abweichend eingesprochen. Geschnitten wird so nah am Skript wie möglich.
Gestrichen wurden Gewinn-/Erfolgsversprechen („profitabel werden“, „reich“, „Profite generieren“,
„1:1 kopieren“) und künstliche Verknappung („100 Personen“, „sei schnell“, „danach kostet es Geld“),
weil sie bei Meta ein Ablehnungsrisiko sind und nicht im Briefing stehen. Nicht eingesprochene Skript-Sätze
(z. B. Ad 1 „…wer am Tisch wirklich gewinnt“) fehlen; die Folien folgen dem tatsächlich gesprochenen Text.

## Lizenzen

Musik: „Close Up“ von Michael Ramir C., Mixkit Stock Music Free License (Werbung auf Social Media erlaubt).
Soundeffekte: Pixabay Content License. Schrift: Poppins (SIL OFL). Keine Stock-Fotos: alle Motive sind
eigene Illustrationen (Platzhalter für Fotos sind als `photo-slot` markiert).
