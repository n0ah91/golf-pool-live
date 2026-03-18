# COLOR AUDIT — The Majors Pool Dashboard
**Date:** 2026-03-17 | **File:** index.html (single-file dashboard)

## CSS Custom Properties (Rollback Block)

```css
:root {
  --bd: #060e1c;   /* Page background */
  --bm: #0a1628;   /* Nav/toolbar background */
  --bc: #111d33;   /* Card background */
  --bca: #15233d;  /* Elevated card background */
  --bh: #1a2b47;   /* Hover background */
  --br: #1e3352;   /* Border color */
  --brl: #27405f;  /* Light border / scrollbar */
  --gn: #1a7a6d;   /* Green primary (buttons) */
  --gl: #2db5a0;   /* Green light / under par */
  --gm: #0e4f47;   /* Green muted (unused) */
  --go: #f4c542;   /* Gold primary accent */
  --gol: #ffd966;  /* Gold light (unused) */
  --god: #b8922e;  /* Gold dark (unused) */
  --tb: #f0ece4;   /* Bright text / headings */
  --tp: #c8c0b4;   /* Body text */
  --ts: #7a8da0;   /* Secondary text */
  --td: #4e6178;   /* Dim text */
  --rd: #e09478;   /* Coral / over par */
  --r1: #ffd700;   /* 1st place gold */
  --r2: #c0c0c0;   /* 2nd place silver */
  --r3: #cd7f32;   /* 3rd place bronze */
}
```

## Hardcoded Colors (not using CSS variables)

| Hex | Use | Instances |
|---|---|---|
| `#e8983e` | Orange-coral (footer, source links, chart accents) | ~6 |
| `#c9a227` | Dark gold (legends, radar, course comparison) | ~8 |
| `#52b788` | Medium green (legends, progression chart) | ~4 |
| `#4a5a50` | Dark gray-green (legend "other") | 1 |
| `#2d6a4f` | Dark green (growth chart border) | 1 |
| `#3a86a8` | Teal-blue (comparable courses) | ~5 |
| `#d94040` | Red (gauge end, legend) | 2 |
| `#ef4444` | Vivid red (toughest holes bars) | 1 |
| `#7bade8` | Light blue (fade/lean tab) | 2 |
| `#8a9a8f` | Sage gray (chart axis ticks) | ~11 |
| `#8a9db5` | Blue-gray (toughest holes axis) | 3 |
| `#5ec4b6` | Seafoam teal (SG putt) | 1 |
| `#9b72cf` | Purple (6th chart bar) | 1 |
| `#d4ccbc` | Warm off-white (radar labels) | 1 |
| `#e0e8f0` | Light blue-white (tooltip body) | 1 |

## Chart Palette
`["#2db5a0", "#f4c542", "#e8983e", "#5ec4b6", "#3a86a8", "#9b72cf"]`

## Score Colors
- Under par: `#2db5a0` (--gl) or `#e09478` (--rd) depending on context (coral = good in pool standings)
- Over par: `#2db5a0` (--gl) in pool standings (green = bad), `#e09478` (--rd) in general
- Even: `var(--tp)` or `var(--td)`

## Heatmap (sgColor function) — 5-tier continuous
- Top 15%: `rgba(20-35, 160-190, 70-90, .65-.80)` deep teal-green
- Above avg: `rgba(35-65, 120-160, 55-70, .30-.55)` lighter green
- Dead zone: `rgba(60, 70, 80, .06)` near-transparent gray
- Below avg: `rgba(195-215, 75-130, 45-60, .20-.45)` amber-coral
- Bottom 25%: `rgba(215-235, 35-65, 30-40, .50-.80)` coral-red

## Fonts
- Display/Body/Heading: DM Sans
- Mono: DM Mono

## Visual Identity
"Augusta Noir" — deep navy-black base (#060e1c → #27405f), warm championship gold (#f4c542) accent, teal-green (#2db5a0) for positive, coral (#e09478) for negative. Cream text hierarchy (#f0ece4 → #4e6178). DM Sans + DM Mono typography. Premium sports analytics aesthetic.

## Inconsistencies
1. `#e8983e` vs `--rd` (#e09478) — two corals
2. `#c9a227` vs `--go` (#f4c542) — two golds
3. `#52b788` vs `--gl` (#2db5a0) — two greens
4. `#8a9a8f` (11 uses) has no CSS variable
5. `--gm`, `--gol`, `--god` defined but never used
6. `#d94040` vs `#ef4444` — two reds
7. Two different heatmap legend color sets (live vs TPC)

## JSON Export

```json
{
  "cssVariables": {
    "--bd":"#060e1c","--bm":"#0a1628","--bc":"#111d33","--bca":"#15233d",
    "--bh":"#1a2b47","--br":"#1e3352","--brl":"#27405f","--gn":"#1a7a6d",
    "--gl":"#2db5a0","--gm":"#0e4f47","--go":"#f4c542","--gol":"#ffd966",
    "--god":"#b8922e","--tb":"#f0ece4","--tp":"#c8c0b4","--ts":"#7a8da0",
    "--td":"#4e6178","--rd":"#e09478","--r1":"#ffd700","--r2":"#c0c0c0","--r3":"#cd7f32"
  },
  "hardcoded": {
    "#e8983e":"orange-coral","#c9a227":"dark gold","#52b788":"medium green",
    "#3a86a8":"teal-blue","#d94040":"red","#8a9a8f":"sage gray (chart axes)",
    "#5ec4b6":"seafoam","#9b72cf":"purple","#7bade8":"light blue"
  },
  "chartPalette":["#2db5a0","#f4c542","#e8983e","#5ec4b6","#3a86a8","#9b72cf"],
  "rankPodium":{"1st":"#ffd700","2nd":"#c0c0c0","3rd":"#cd7f32"},
  "fonts":{"display":"DM Sans","mono":"DM Mono"},
  "unusedVars":["--gm","--gol","--god"]
}
```
