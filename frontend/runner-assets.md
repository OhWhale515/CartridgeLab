# Aqua_Xinobi Runner Asset Contract

Place the final flagship runner sprite sheet in the frontend public asset path:

- `frontend/public/assets/runner/aqua-xinobi-sheet.png`
- `frontend/public/assets/runner/aqua-xinobi.json`

Recommended sprite sheet layout:
- Frame size: `128x128`
- Transparent background
- Feet centered in each frame
- One row per animation state

Row order:
1. `idle` - 4 frames
2. `run` - 8 frames
3. `dash` - 4 frames
4. `attack` - 4 frames
5. `hurt` - 3 frames
6. `victory` - 4 frames

State mapping in CartridgeLab:
- `idle`: standby / no signal
- `run`: normal replay movement
- `dash`: buy
- `attack`: sell / pressure
- `hurt`: SL hit
- `victory`: TP hit

Visual direction:
- Base silhouette: near-black / navy
- Edge light: cyan
- Runtime tinting is applied in code for event states:
  - buy: green-yellow
  - sell: orange
  - tp: gold
  - sl: orange-red
