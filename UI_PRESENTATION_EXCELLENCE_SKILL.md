# UI Presentation Excellence Skill
**golf-pool-live Dashboard — `index.html` (single-file, light theme · canonical)**

This skill guarantees every update, feature, or content generation keeps the dashboard **beautiful, consistent, data-true, scannable for live tournament use, and light on GitHub Pages**. It works *with* (never overrides) the other repo specs: `COURSE_DATA_SKILL.md`, `WEEKLY_TOURNAMENT_TEMPLATE.md`, `DATA_VERIFICATION_SKILL.md`, `COLOR_AUDIT_2026-03-17.md`, and project `CLAUDE.md`.

> **Source of truth = the live `index.html` light theme.** `index-augusta-noir.html` is a **deprecated March-2026 archive** of an older dark theme — do not copy its palette/patterns. The dark values still referenced in the original `COLOR_AUDIT_2026-03-17.md` rollback block are historical (see the dated update at the top of that file for the current palette).

## Before ANY change — mandatory review order
1. This skill (fully).
2. `CLAUDE.md` (live-data rules: odds via `preds/in-play`, leaderboard via `preds/live-tournament-stats`, all DG calls through the `dg-proxy` edge function, never show data >30 min stale).
3. `COURSE_DATA_SKILL.md`, `WEEKLY_TOURNAMENT_TEMPLATE.md`, `DATA_VERIFICATION_SKILL.md` (+ latest audits).
4. The relevant section of `index.html` (the patterns below).
5. Then plan and implement. **Extend existing functions/classes — do not reinvent.**

## Design System — Majors Light (use CSS variables exclusively)
Defined in `index.html` `:root`. **Never hard-code a color that has a variable.**

| Role | Var | Hex |
|---|---|---|
| Page bg | `--bd` | `#f5f4f0` |
| Nav/toolbar bg | `--bm` | `#ffffff` |
| Card bg | `--bc` | `#ffffff` |
| Elevated card | `--bca` | `#f0efeb` |
| Hover bg | `--bh` | `#e8e7e2` |
| Border / light border | `--br` `#d4d2ca` / `--brl` `#bfbdb5` |
| Masters green (buttons) | `--gn` | `#006747` |
| Positive / under-par | `--gl` | `#2a7d52` |
| Gold accent / wins | `--go` | `#9a7e28` |
| Heading text | `--tb` | `#1a1f3a` |
| Body text | `--tp` | `#2a3350` |
| Secondary text | `--ts` | `#586882` |
| Dim text | `--td` | `#8895a8` |
| Negative / over-par | `--rd` | `#8b2332` |
| Shinnecock claret (US Open accent) | `--uso` `#6e2a3e` / `--uso2` `#8a3a52` |
| Podium 1/2/3 | `--r1` `#c4a035` / `--r2` `#8895a8` / `--r3` `#6b4c2a` |

**Conditional-format palette (classy, muted — NOT bright HSL):** good→`--gl`, neutral→`--ts`, bad→`--rd`. For field-rank/percentile shading interpolate green `(42,125,82)` → slate `(88,104,130)` → claret `(139,35,50)` (see `_pctColor`). Par/Birdie/Bogey scoring: pars `--ts`, birdies+ `--gl`, bogeys+ `--rd`.

**Typography:** `--fb`/`--fd`/`--fh` = **DM Sans**; `--fm` = **DM Mono** (all numeric/stat cells). No other font families.

## Established components — match these, don't fork
- **Live Pool Leaderboard** (`#uso-live-pool`, `renderUsoLivePool`/`_usoLpRow`): compact `.tc` table; best-4-of-6 to par minus leaderboard position bonus (1st=10…10th=1); dark-horse + payout strip (`.usolp-strip/.usolp-dh/.usolp-pay`); **YTD** column via `_ytdTag` — projected rank de-emphasized, movement arrow is the prominent element (▲ `--gl` / ▼ `--rd`).
- **Live Field** (`#pred-market-panel`, `renderUsoField`): **Simple** (default) and **Advanced** tabs. Simple = Player · Score · Pos · `P·B⁺·Bog⁺` · DG win-odds (rounded to 5, light-green probability bar) · SG shown as **rank vs field** (`_pctColor` muted) · DIST/ACC/GIR color-graded. Advanced = sportsbook comparison with toggle chips. Sportsbook selection lives **only** on Advanced.
- **Player card** (`#player-card-modal`, `.pc-*`, `openPlayerCard`): click any `.pc-link`. Headshot + facts (ESPN), prose bio (Wikipedia), OWGR + DG rank & skill, OWGR sparkline (localStorage, accumulates weekly), season SG bars (DataGolf skill-ratings), course fit (player-decompositions), live line when in-event. Graceful "–" when a source is missing.
- **Per-section text size** (`.ts-toggle`, `setSecSize`): A/A/A on Live Pool, Live Field, Pool Picks.
- **Pool Picks** (`#uso-picks`): lead with live **Value** (conditional bar), then Score, Pos, Salary; pick count as a badge by the golfer name.

## Data integrity (triple-check)
- Live golf data flows through `dgF()` → `dg-proxy` (5-min cache). Odds = DataGolf model; never stale >30 min.
- Per-player **score / pars / birdies / bogeys** are cross-checked **DataGolf ↔ ESPN** (`fetchEspnScoring`, `_fullNameNorm` accent-folded matching). Keep the to-par cross-check (✓/⚠ in the scoring cell tooltip). SG has no second public source — validate internal consistency only and label it DataGolf.
- Robust name matching: always go through `_fullNameNorm` (NFD accent-fold + ø/æ/etc. + full-name concat) so players like Åberg, Højgaard, Dumont de Chassart resolve. Never silently drop a player.
- Missing data → `–` placeholder. **Never fabricate.** Attribute every non-obvious number.

## Performance (GitHub Pages reality)
- No build step, no framework. Keep it that way unless we deliberately add Vite + Vercel/Netlify.
- Avoid mass `innerHTML` churn on full fields (~156 players); cache fetched datasets (DG datasets 10 min, ESPN scoring 4.5 min, bios per-player) and concurrency-limit external calls (ESPN ≤8).
- Long lists: "top N + expand all," not everything rendered.
- Externalize bulky static data to `.json`/`.js` when it reduces HTML bloat.
- Respect `prefers-reduced-motion`. Keep animations subtle.

## Analytics
- Click instrumentation via `gcEvent(name)` (GoatCounter, site `n0ah9`). When adding a meaningful interaction, add a matching `gcEvent('category/detail')` call. Pageviews are automatic.

## Anti-patterns (avoid)
- Hard-coded colors / the deprecated dark Augusta-Noir palette.
- New card/table layouts that don't reuse `.tc`, `.pc-*`, `.usolp-*`.
- Bright/garish conditional colors (use the muted `--gl`/`--ts`/`--rd` scale).
- Skipping verification, attribution, or the cross-source score check.
- Fabricating/assuming missing data.
- Breaking coherence across tournament tabs (US Open, Masters, PGA, Open, Players, YTD/History).
- Perf-heavy additions (many Chart instances, unbounded fetch fan-out) without measurement.

## Prompt prefix (paste into project prompts)
> "Senior maintainer of golf-pool-live. The canonical file is the light-theme `index.html`. Strictly follow `UI_PRESENTATION_EXCELLENCE_SKILL.md`, `COURSE_DATA_SKILL.md`, `WEEKLY_TOURNAMENT_TEMPLATE.md`, `DATA_VERIFICATION_SKILL.md`, `CLAUDE.md`, and existing code patterns — review them before any code. Use CSS variables only (Majors Light palette), extend existing components (`.tc`, `.pc-*`, `.usolp-*`), keep data cross-checked and attributed, stay performant on GitHub Pages. Do not reinvent or re-theme without strong justification and a matching update to the relevant skill file. `index-augusta-noir.html` is a deprecated archive — ignore its palette."
