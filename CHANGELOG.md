# Changelog

Releases are dated: YYYY.MM.DD, with .2 and .3 for later releases the same day. Each entry is generated
from the data by `tools/release_notes.py` and compares the release with the one before it. Newest first.

## 2026.11.27

Compared with `5523c5e`. Totals: 389 schemes (366 drawn) from 206 airlines. 1490 tagged airframes. 83 shapes.

### Schemes

- Adds 16 schemes:
  - `BTI/estonian-flag` Estonian flag
  - `BWA/standard` I Am Caribbean (2020)
  - `DLH/standard-1988` 1988 livery (pre-2018)
  - `DWI/dominican-flag` Dominican flag (Los Haitises)
  - `DWI/standard` Arajet
  - `FDX/federal-express-retro` Federal Express retro (1970s-1994 colors)
  - `GXA/brush-x` Brushed X
  - `GXA/brush-x-blue` Brushed X, blue
  - `JBU/prism` Blue/Blue Belly (2014 refresh), Prism tail
  - `SAM/vc-25a` Air Force One (VC-25A)
  - `SCX/blue-2001` Blue (2001)
  - `SCX/blue-2016` Blue, simplified (2016)
  - `TPA/red-2013` Avianca Cargo red livery (2013)
  - `TVS/standard` smartwings.com livery
  - `VKG/standard` Sunclass (2019)
  - `WJA/classic` Teal 'tail' livery (2000s)
- Changes 64 schemes (the fields that differ):
  - `AAL/aircal-heritage` AirCal heritage: description, fin, titles, notes
  - `AAL/allegheny-heritage` Allegheny heritage (VistaJet): description, palette, fuselage, notes
  - `AAL/america-west-heritage` America West heritage: fuselage, notes
  - `AAL/american-100-america250-commemorative` America250 decal: drawnOn, logos, notes
  - `AAL/flagship` Flagship (centennial retro): fuselage, logos, notes
  - `AAL/piedmont-heritage` Piedmont heritage: sources, palette, fuselage, logos, titles, notes
  - `AAL/psa-heritage` PSA heritage: fuselage, notes
  - `AAL/reno-air-heritage` Reno Air heritage: notes, fuselage
  - `AAL/twa-heritage` TWA heritage: fuselage, notes
  - `AAY/standard` Sunseeker (2017 livery): sources, palette, fin, logos, notes
  - `AEE/standard` A320neo-era livery: sources, palette, fuselage, fin, logos, notes
  - `AFR/cargo` Air France Cargo (2009 livery): logos
  - `AFR/standard` 2009 livery: logos
  - `AJT/standard` Amerijet (star A): sources, logos
  - `ANZ/standard` 2012 livery (black fern): sources, logos
  - `ASA/horizon-retro` Horizon Air 'meatball' retro: sources, notes, fuselage
  - `ASA/oneworld` oneworld (member of oneworld): sources, palette, fin
  - `ASA/our-commitment` Our Commitment (UNCF): sources, notes, titles
  - `ASA/regional-horizon` Alaska regional, Horizon (2016 livery): sources, palette, fin
  - `ASA/regional` Alaska regional, SkyWest (2016 livery): sources, palette, fin
  - `ASA/seattle-kraken` Seattle Kraken (2024): sources, palette, fin
  - `ASA/seattle-mariners` Seattle Mariners: sources, palette, fin
  - `ASA/standard` 2016 livery: sources, palette, fin, logos
  - `CJT/standard` Cargojet (maple leaf globe): logos, notes
  - `CLX/standard` Cargolux (cube tail): logos
  - `CMP/standard` Globe livery: fin
  - `DAL/bcrf-pink` BCRF pink ribbon: fin, logos, notes
  - `DAL/connection` Delta Connection (2007 livery): fin, logos, notes
  - `DAL/standard` 2007 livery: fin, logos, notes
  - `DAL/team-usa-milano-cortina-2026` Team USA Milano Cortina 2026: sources, notes, logos, titles
  - `DAL/team-usa` Team USA (A330-900): fin, notes
  - `EIN/standard` 2019 livery: sources, logos, notes, types
  - `EWG/standard` 2015 livery: sources, fin, notes
  - `FFT/americas-green-airline` America's Green Airline (Powered by Pratt & Whitney): description
  - `GTI/standard` Atlas Air (globe tail): fin, logos, notes
  - `ITY/standard` Blue livery: logos, notes
  - `JBU/blue-bravest` Blue Bravest (FDNY): description, sources, palette, fuselage, fin, logos, notes
  - `JBU/blue-finest` Blue Finest (NYPD): sources, notes, fuselage, logos
  - `JBU/standard` Blue/Blue Belly (2014 refresh): description, sources, palette, fin, logos, notes
  - `POE/standard` E195-E2 era livery: sources, fin, logos
  - `QFA/standard` 2016 livery: sources, logos
  - `QTR/standard` Oryx livery (2006): sources, fin, logos
  - `RC1979/herman` Herman (1979–84): sources, notes, types
  - `ROU/standard` Air Canada Rouge (2017 refresh): sources, fin, logos
  - `SAM/standard` U.S. Air Force executive scheme (Special Air Mission): description, notes
  - `SCX/retro-1994` 1994 retro (Jim Olsen): notes, fuselage
  - `SCX/standard` 2018 livery: sources, notes
  - `SIA/standard` 1987 livery (2005 update): fin, notes
  - `SWA/maryland-one` Maryland One (Maryland flag): fuselage, titles, notes
  - `SWA/nevada-one` Nevada One (Nevada flag): logos
  - `SWA/the-herbert-d-kelleher` The Herbert D. Kelleher (Desert Gold retro): fuselage, notes
  - `TPA/standard` Avianca Cargo green livery (2025): notes
  - `UAE/cargo-1999` Emirates SkyCargo (1999 flag tail): logos
  - `UAE/cargo` Emirates SkyCargo: logos
  - `UAE/nba` NBA (Official Airline Partner of the NBA): logos
  - `UAE/standard-1999` 1999 livery (flag tail): sources, logos, types
  - `UAE/standard` 2023 livery: logos
  - `UAE/uae-flag` UAE flag (This Flag Will Always Fly): logos
  - `UAE/wimbledon` Wimbledon (Official Partner): logos
  - `UAL/standard` 2019 livery (Evo Blue): sources, logos, notes
  - `VIR/standard` 2019 livery: logos
  - `VOI/standard` 2018 livery (pixel tail): description, sources, palette, fin, logos, notes
  - `WJA/standard` 2018 livery: description, sources, palette, fuselage, fin, logos, notes
  - `WZZ/standard` 2015 livery: sources, logos, titles, notes

### Airframes

- Tags 32 airframes. Moves 3 airframes to another scheme. Updates the records of 2 airframes. By airline:
  - `BTI` airBaltic: tags 1 airframe (YL-CSJ).
  - `DLH` Lufthansa: tags 1 airframe (D-ABYK).
  - `DWI` Arajet: tags 1 airframe (HI1101).
  - `FDX` FedEx Express: tags 1 airframe (N884FD).
  - `FFT` Frontier Airlines: moves 2 airframes to another scheme (N604FR to `FFT/americas-green-airline`, N605FR to `FFT/americas-green-airline`). Updates the records of 2 airframes.
  - `GXA` GlobalX: tags 4 airframes (N276GX, N278GX, N284GX, N630VA).
  - `ISR` Israir: tags 1 airframe (HA-TSO).
  - `JBU` JetBlue: tags 3 airframes (N977JE, N989JT, N999JQ).
  - `SAM` U.S. Air Force (Special Air Mission): tags 2 airframes (82-8000, 92-9000).
  - `SCX` Sun Country Airlines: tags 10 airframes (N805SY, N808SY, N816SY, N821SY, N822SY, N823SY, N824SY, N827SY, N828SY, N829SY).
  - `TNO` Avianca Cargo México: tags 1 airframe (N338QT). Moves 1 airframe to another scheme (N337QT to `TPA/red-2013`).
  - `TPA` Avianca Cargo: tags 5 airframes (N330QT, N331QT, N332QT, N334QT, N336QT).
  - `UAL` United Airlines: tags 1 airframe (N79521).
  - `WJA` WestJet: tags 1 airframe (C-FGWJ).

### Airlines and operators

- Adds 4 airlines: `BWA` Caribbean Airlines, `DWI` Arajet, `TVS` Smartwings, `VKG` Sunclass Airlines.
- Moves 1 operator to another scheme: `TNO` to `TPA/red-2013`.

### Format

- Adds to `schema/livery.schema.json`: `$defs/area/gradient`, `$defs/gradient`, `$defs/gradient/from`, `$defs/gradient/stops`, `$defs/gradient/to`.
- Changes the renderer (`renderer/src`): `below.ts`, `geometry.ts`, `labels.ts`, `landmarks.ts`, `measured.ts`, `paint.ts`, `scheme.ts`, `side-labels.ts`, `side-parts.ts`, `side.ts`, `svg.ts`, `texture.ts`.

### Docs and tools

- Changes `README.md`, `docs/COORDINATES.md`, `docs/TUTORIAL.md`, `leads.tsv`, `tools/common.py`, `tools/edge_straightness.py`, `tools/export_compact.py`, `tools/preview.py`, `tools/release_notes.py`, `tools/shapes.py`, `tools/validate.py`.
