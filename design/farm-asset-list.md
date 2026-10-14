# Gårdsversionen: assetlista

Allt som behövs för att flytta in skissen (`design/mockups/farm-mockup.html`) i riktiga appen, med de versioner (lägen, animationsrutor, riktningar) varje sak behöver. Senast uppdaterad 2026-10-14.

**Status:** ✅ klar · 🟡 finns men behöver fler versioner eller bättre kvalitet · ⬜ saknas

**Källa:**
- **AI**: genererad med Codex (`scripts/farm-assets/`)
- **Kod**: ritas med kod (`farmground.js`, `farmprops.js`, skissen)
- **CP**: finns i Craftpix-paketet (se sista avsnittet)

## Regler för alla assets

- **Pixelkonst i 1:1.** En bildpunkt i filen är en världspixel. Ingen utjämning. Appen zoomar bara i hela steg.
- **Vinkel:** rakt framifrån, uppifrån snett (3/4), inte isometriskt. Ljuset kommer uppifrån vänster.
- **Kontur:** 1 px mörkbrun (#3a2414). Varm, mättad palett, högst cirka 32 färger per sprite.
- **Bakgrund:** genomskinlig PNG. Ingen inbakad skugga, eftersom motorn ritar skuggorna själv.
- **Rutnät:** motorns ruta är 12 världspixlar. Ett föremål på 2×1 rutor är alltså 24×12 px i golvyta, plus höjd uppåt.
- **Filnamn:** `frontend/assets/farm/<grupp>/<namn>[_<läge>][_<ruta>].png`, till exempel `props/pond_work_2.png`.
- **Lägen för förmågeföremål:**

  | Läge | Utseende |
  |---|---|
  | `idle` | i vila |
  | `work` | animation med 2 till 4 rutor |
  | `done` | en kort blink när ett verktyg körts |
  | `bad` | fel, grått eller vissnat |

  Motorn skickar redan alla fyra lägen (`o.work`, `o.fired`, `o.bad`).
- **Riktning:** varje föremål behöver bara en vy, söder. När ett föremål vrids ritar motorn samma bild. Fler vyer kan läggas till senare.

## A. Bybor (agenterna)

Motorns figurformat är 64 bilder per figur i mappen `assets/sprites/<set>/`. Dagens robotar har rutor på 144×144 px.

| Version | Antal rutor | Filnamn |
|---|---|---|
| Stå still, 8 riktningar | 8 | `rot_<riktning>` |
| Gå, 8 riktningar × 6 rutor | 48 | `walk_<riktning>_1..6` |
| Sitta, 4 riktningar | 4 | `sit_<riktning>_4` |
| Arbeta (vänd norrut) | 4 | `type_north_1..4` |

| Bybo | Roll | Status | Källa |
|---|---|---|---|
| Nova | forskare (webb) | ⬜ 0 av 64 | AI + kod |
| Bo | snickare (kod) | ⬜ 0 av 64 | AI + kod |
| Mira | skribent (text) | ⬜ 0 av 64 | AI + kod |
| Ivar | budbärare (mejl) | ⬜ 0 av 64 | AI + kod |
| Saga | minnesvårdare | ⬜ 0 av 64 | AI + kod |
| 3 extra gårdsdrängar | för nya agenter, omfärgningar | ⬜ | kod |

Totalt 320 rutor för de fem byborna. Bildgeneratorn klarar inte 48 gångrutor som ser likadana ut. Planen är därför att generera **en tydlig figur per riktning** (8 bilder per bybo) och bygga gång- och arbetsrutorna med kod. Repot har redan verktyg för det i `frontend/assets/sprites/_assembly/` (`bob_walk.py`, `assemble8.py`).

**Fas 2, sysslor:** egna arbetsanimationer i stället för `type_north`. Det är fiska, hugga, vattna, bära och mata, med 4 rutor vardera i en riktning, alltså 20 rutor per bybo. Det kräver en liten ändring i motorn.

**Porträtt**, 48×48 px:

| Version | Status | Källa |
|---|---|---|
| Neutral, 5 st | ✅ | AI |
| Glad (uppgift klar), 5 st | ⬜ | AI |
| Tänker (arbetar), 5 st | ⬜ | AI |
| Bekymrad (fel), 5 st | ⬜ | AI |

## B. Förmågeföremål (det agenterna jobbar vid)

Varje föremål behöver fyra lägen: vila, arbetar (2 till 4 rutor), klar och fel. Föremål med ✅ har alla fyra lägen ritade med kod.

| Motorns id | Ger agenten | Gårdsföremål | Rutor | Status | Källa |
|---|---|---|---|---|---|
| `desk` | dator (egen plats) | köksbord med oljelampa | 2×1 | ✅ | kod |
| `desk2`, `console`, `consoleL`, `pixelrig`, `bench` | dator | dubbelbord, skrivpulpet, verandabord, hantverksbord, långbord | 2×1 till 4×1 | ⬜ | AI |
| `workbench` | terminal (kod) | huggkubbe | 2×1 | ✅ | kod |
| `war_intelcab` | filer | byrå med låda som glider ut | 1×2 | ✅ | kod |
| `vault` | filer | lada | 3×2 | 🟡 bild finns, saknar lägen | AI |
| `safe` | filer | kista | 1×2 | ⬜ | AI |
| `rack`, `shelf` | filer | hylla med syltburkar, lång vedhylla | 2×1, 4×1 | ⬜ | CP / AI |
| `comms_dish` | webb | fiskedamm med brygga | 2×2 | ✅ | kod |
| `comms_uplink` | webb | brevduveslag | 2×2 | ⬜ | AI |
| `comms_beacon` | webb | väderflöjel | 1×2 | ⬜ | AI |
| `gigs_servercart` | minne | dagbokspulpet med ljus | 1×1 | ✅ | kod |
| `core`, `bridge_relaystack` | minne | rotkällardörr, bokhylla med dagböcker | 1×2 | ⬜ | CP / AI |
| `studio` | bilder | staffli | 2×2 | ✅ | kod |
| `connector_portal` | kopplingar (MCP) | vägskylt, en pil per tjänst | 1×2 | ⬜ | AI |
| `plugin_terminal` | tillägg | redskapsbod | 1×2 | ⬜ | AI |
| `jukebox` | Spotify | grammofon | 1×1 | ⬜ | AI |
| `missionboard` | uppdrag | anslagstavla | 3×1 | 🟡 bild finns, saknar lappar per uppdrag | AI |
| `trophycase` | prestationer | prisbord med rosetter | 2×2 | ⬜ | AI |
| `airlock` | spärr | grind | 1×1 | 🟡 staketet finns i marken | kod |

**Arbetsflödet**, alltså hur jobb kommer in, flyttas och skickas ut:

| Motorns id | Gårdsföremål | Rutor | Status | Källa |
|---|---|---|---|---|
| `intake` (INBOX) | brevlåda med postkorg | 2×2 | 🟡 brevlådan finns, behöver korg och lägen | AI |
| `outbox` | skördelåda | 2×2 | 🟡 bild finns, saknar lägen | AI |
| `bay` | odlingsbädd, där en agent tar ett steg | 2×2 | ⬜ | AI |
| `filter` | sorteringsbord | 1×1 | ⬜ | AI |
| `merger`, `splitter` | vägskäl | 1×1 | ⬜ | AI |
| `joiner` | väntande skördevagn | 1×1 | ⬜ | AI |
| `loop` | vattenhjul | 1×1 | ⬜ | AI |

Bältena blir kärrspår. Varje version behöver en rörelse i 4 rutor:
- raka spår åt 4 håll
- 4 kurvor
- en korsning

Status ⬜, källa AI eller kod.

**Prydnadsföremål:** motorn har 128 prydnadsföremål med rymdtema. De flesta göms i byggmenyn och ersätts av cirka 25 gårdsföremål:
- bänk och picknickbord
- blomlåda och krukväxt
- tunna, höbal och skottkärra
- lykta, hink och vattenkanna
- äppelkorg, mjölkkanna och stege
- matta, säng och bokhylla

Alla saknas (⬜). Flera av dem finns i CP.

## C. Byggnader

| Asset | Storlek | Status | Källa |
|---|---|---|---|
| Bondgård | 112 px bred | ✅ | AI |
| Lada | 96 | ✅ | AI |
| Hönshus | 52 | ✅ | AI |
| Brunn | 36 | ✅ | AI (även CP) |
| Fågelskrämma | 26 | ✅ | AI (även CP) |
| Vedtrave | 34 | ✅ | AI |
| Brevlåda | 12 | ✅ | AI |
| Skördelåda | 32 | ✅ | AI |
| Anslagstavla | 34 | ✅ | AI |
| Silo, växthus, bikupor | | ⬜ | AI |
| Upplysta fönster för natten, en per byggnad | | ⬜ | AI |
| Skorstensrök, 6 rutor | | ✅ | CP (även kod) |

## D. Mark och natur

| Asset | Versioner | Status | Källa |
|---|---|---|---|
| Ängsmark (gräs, klöver, blommor) | slumpad mönsterbit | ✅ | kod |
| Träd: lövträd, fruktträd, buskträd | 3 storlekar var, svajar i 13 rutor | ✅ | CP |
| Träd, gran och buskar | | ✅ | kod (CP:s är snyggare) |
| Svampar, stenar, stubbar, stockar, grästuvor, blommor | flera varianter | ✅ | CP |
| Stenstig | raka bitar, kurvor och kanter | ✅ | CP (även kod) |
| Staket | vågrätt, lodrätt och grind | ✅ | kod (CP har också) |
| Damm | kanter, hörn och glitter i vattnet, 4 rutor | 🟡 en damm finns som bild | kod |
| Åker: plöjd jord och vattnad jord | | ⬜ | AI |
| **Grödor: 5 sorter × 5 stadier** (frö, grodd, växer, mogen, vissen) | 25 bilder | ⬜ | AI |

Grödorna är viktiga: varje uppgift växer som en planta på åkern, och en vissen planta betyder att något gick fel.

## E. Djur

| Djur | Versioner | Status | Källa |
|---|---|---|---|
| Höna | gå åt 2 håll × 4 rutor, picka × 3, sova | 🟡 ritad med kod i skissen | AI |
| Kyckling | gå 2 × 4 | ⬜ | AI |
| Katt | tittar upp ur gräset, 17 rutor | ✅ | CP |
| Fåglar | flyga och hoppa | ✅ | CP |
| Ko, får, hund (valfritt) | gå och vila | ⬜ | AI |

## F. Effekter

| Effekt | Rutor | Status | Källa |
|---|---|---|---|
| Tankebubbla med ikon | 1 + ikon | 🟡 kod i skissen | kod |
| Vattendroppar (vattna) | 4 | ⬜ | kod |
| Träflisor (hugga) | 4 | ⬜ | kod |
| Plask och fiskhopp | 4 | ✅ | kod |
| Gnistor och stjärnor (klar) | 4 | ⬜ | kod |
| Litet regnmoln (fel) | 4 | ⬜ | AI |
| Zzz (vilar) | 3 | ⬜ | kod |
| Fjärilar och fallande löv | 4 | 🟡 löv finns i CP:s träd | CP / kod |

## G. Gränssnitt

| Asset | Versioner | Status | Källa |
|---|---|---|---|
| Ramar i 9 delar (pergament, valt pergament, trä, ruta, vald ruta, planka, mörk planka) | 7 | ✅ | kod |
| Knappar | normal, hover, nedtryckt, avstängd | ⬜ | kod |
| Flikar, rullningslist, kryssruta, reglage, skjutreglage | 2 till 3 lägen var | ⬜ | kod |
| Textfält, förloppsmätare, notisruta | | ✅ | kod |
| Verktygstips | | ⬜ | kod |
| Muspekare: hand, pekfinger, vänta | 3 | ⬜ | AI |
| Ikoner: hatt, rulle, hammare, låda, brev, kugghjul, mynt, sol, grodd | 9 | ✅ | AI |
| Ikoner för förmågor (dator, filer, webb, minne, terminal, bilder, kopplingar, tillägg, musik) | 9 | ⬜ | AI |
| Statusikoner (klar, arbetar, varning, fel) | 4 | ⬜ | AI |
| Åtgärdsikoner (lägg till, stäng, sök, skicka, mikrofon, spela, paus, ångra, inställningar, användare, pil, bocka) | 12 | ⬜ | AI |
| Typsnitt Pixelify Sans (öppen licens) | | 🟡 hämtas från Google Fonts i skissen, appen behöver en lokal kopia | lokal kopia |
| Logotyp "StarNet farm" | | ⬜ | AI |
| Appikon (Tauri: 32, 128, 256, 512, 1024 px samt .icns och .ico) | 7 | ⬜ | AI |

## H. Ljud (valfritt)

Allt nedan saknas (⬜):
- steg i gräs
- yxhugg
- plask
- höna
- dörr
- klick i gränssnittet (ett trä-tock)
- pling när något är klart

Motorn har redan en ljudmapp, `frontend/assets/sfx/`.

## I. Senare

- **Dag och natt:** palett för skymning och natt, och tända fönster.
- **Årstider:** höst och vinter, varianter av marken och träden.
- **Den lilla byn:** torg, marknadsstånd och fler hus.

## Sammanfattning

| Del | Klart | Kvar |
|---|---|---|
| Bybor | 5 porträtt | 320 figurrutor, 15 porträtt med uttryck |
| Förmågeföremål | 6 (kod) | cirka 20 föremål, med 4 lägen var |
| Arbetsflöde och kärrspår | 3 bilder utan lägen | 7 föremål och 9 spårbitar |
| Byggnader | 9 | 3 byggnader och nattfönster |
| Mark och natur | ängen samt det mesta i CP | åkern och 25 grödbilder |
| Djur | katt och fåglar (CP) | höna, kyckling och valfria djur |
| Gränssnitt | ramar och 9 ikoner | knappar, kontroller, 25 ikoner, typsnitt, logotyp och appikon |

## Craftpix-paketet

Det här är filen `main-characters-home-free-top-down-pixel-art-asset.zip` från craftpix.net.

**Innehåll:**
- ett utomhusark med hus, träd, buskar, stenar, svampar, brunn, fågelskrämma och stenstig
- ett ark med inredning: säng, bord, stolar, hyllor och mattor
- väggar och golv, husdetaljer, gräsdetaljer
- animationer: svajande träd, rök, katt, fåglar, dörrar och fönster

Allt är ritat på ett rutnät om 16 px. Paketet har inga figurer, trots namnet.

**Licens:** gratis att använda i appen, även kommersiellt. Det krävs inget omnämnande. Men PNG-filerna får inte spridas vidare som filer, och ett publikt GitHub-repo räknas som spridning. Därför:
- Filerna läggs i `frontend/assets/farm/vendor/`. Den mappen står i `.gitignore` och committas aldrig.
- Appen ska fungera utan mappen och falla tillbaka på våra egna bilder och kod.
- I en byggd app på din dator följer filerna med, och det tillåter licensen.

**Stil:** paketet är mer enhetligt och mer genomarbetat än våra AI-bilder. Det har kallare konturer och 16 px-rutor. Blandar vi rakt av kommer det att synas.

**Rekommendation:** gör paketet till stilförebild för världen, alltså mark, natur och husdetaljer. Generera resten med paketets ark som referensbild, så att de nya bilderna matchar. Codex kan ta emot en bild med `codex exec -i`. Byggnaderna vi redan gjort jämförs mot paketet i samma bild, och de som sticker ut genereras om.
