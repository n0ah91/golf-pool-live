# Data Integrity Audit Report

**Generated:** 2026-03-17
**File:** `index.html` — `const DB` object (line 638) + `POOL_RESULTS` (line 2457) + 2026 patch IIFE (line 2683)

---

## 1. Participant Count Verification

| Check | Value |
|-------|-------|
| `DB.participants.length` | **195** |
| `metadata.total_participants` | **195** |
| **Status** | **PASS** |

---

## 2. Years Covered Verification

- `years_covered` (after patch): **[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]**
- Total years: **8**
- Includes 2026: **YES** (added by patch IIFE)
- Year range is contiguous: **PASS**
- Note: The raw DB object does NOT include 2026; it is injected at runtime by the IIFE at line 2684.

---

## 3. Per-Participant Data Integrity

### 3a. Season Key Anomalies (season data before joined_year)

**14 issues found.** These participants have season entries for years before their `joined_year`:

| Participant | ID | Season(s) Before joined_year | joined_year |
|------------|-----|------------------------------|-------------|
| Cameron Bosson | P029 | 2020 | 2022 |
| Charles Kurz | P032 | 2020, 2021 | 2022 |
| Clayton Maris | P038 | 2019 | 2022 |
| CJ Murray | P027 | 2019 | 2022 |
| Emma Ritzmann | P056 | 2020 | 2021 |
| Jimmy OReilly | P079 | 2020, 2021 | 2022 |
| Kevin Bluhm | P096 | 2021 | 2022 |
| Matthew Williams | P116 | 2021 | 2022 |
| Packy Jones | P138 | 2019 | 2021 |
| Ryan Hourihan | P146 | 2019 | 2022 |
| Scott Davis | P152 | 2020 | 2022 |
| Zach Lewis | P177 | 2019 | 2022 |

**Likely cause:** `joined_year` reflects when the participant joined the *current* pool/league, but earlier season data may come from a predecessor league or alternate entry. This is a data modeling ambiguity, not necessarily a bug.

### 3b. total_seasons Mismatches

**None found: PASS**

All 195 participants have `career.total_seasons` matching their actual number of season entries (including 2026 where applicable).

### 3c. Null/Undefined Numeric Values in Historical Seasons

**16 issues found** across 4 participants in pre-2026 seasons:

| Participant | Season | Issue |
|------------|--------|-------|
| Daniel Firth | 2025 | `total` is undefined, `rank` is undefined |
| Dom Vero | 2023 | `total` is undefined, `rank` is undefined |
| Jerry Warner | 2024 | `total` is undefined, `rank` is undefined |
| Jerry Warner | 2025 | `total` is undefined, `rank` is undefined |
| Ryan Smith | 2023 | `total` is undefined, `rank` is undefined |
| Zach Lewis | 2023 | `total` is undefined, `rank` is undefined |
| Zach Lewis | 2024 | `total` is undefined, `rank` is undefined |
| Zach Lewis | 2025 | `total` is undefined, `rank` is undefined |

**Impact:** These undefined values may cause NaN in calculations, sorting errors, or display bugs in the dashboard for historical season views. They likely represent seasons where the participant registered but did not complete (dropped out, no roster submitted, etc.).

---

## 4. 2026 Patch (IIFE) Verification

The IIFE at lines 2683-2698 performs:
1. Pushes 2026 into `metadata.years_covered` if absent
2. Iterates `POOL_RESULTS[11].entries`
3. Matches each entry name to a participant via `all_entry_names` (case-insensitive)
4. Injects a 2026 season object: `{entry_used, rank, total, winnings, players, masters/pga/uso/open}`
5. Increments `career.total_seasons`

### Findings

- **Idempotency:** PASS — guards against duplicate `years_covered` push and skips if `seasons["2026"]` already exists.
- **Pre-existing 2026 data:** The DB already contains 2026 season data for **106 participants** baked directly into the JSON. The IIFE patch is therefore a no-op for these entries (the guard at line 2692 skips them). This is correct behavior but means the IIFE is redundant for the current build.
- **Winnings not carried over:** The patch hardcodes `winnings: 0`, but `POOL_RESULTS[11]` has actual `win` values for all 107 entries (e.g., 1st place has `win: 7881250`). These pool winnings are discarded. However, the pre-baked 2026 data also has `winnings: 0`, so this is consistent across both paths.
- **Total field semantics:** The patch uses `total: e.tp` which represents the cumulative pool total (raw + bonus), not raw strokes alone. This is consistent with how other seasons store `total`.

---

## 5. 2026 Data Cross-Reference

| Metric | Value |
|--------|-------|
| POOL_RESULTS[11] total entries | **107** |
| Matched to DB participants | **107** (all matched) |
| Unmatched | **0** |
| Participants with 2026 season data | **106** |

### Why 107 matched but only 106 seasons?

**Jerry Warner** (id: P079-equivalent) has **two entries** in POOL_RESULTS[11]:
- "JWIII" (rk: 76, tp: -17)
- "JWIII #2" (rk: 104, tp: 12)

Both names are in his `all_entry_names` array, so both match the same participant. The 2026 season stores only one entry (the first match wins, via `if(matched.seasons['2026'])return;`). His 2026 season uses "JWIII" as the entry. The second entry "JWIII #2" is silently dropped.

**This is a design limitation:** The data model supports only one season record per participant per year, but the pool allows multiple entries per person. The second entry's results are lost.

---

## 6. Duplicate Entry Names Check

**1 duplicate found (within the same participant):**

- **Jennifer West** (id: P075) has `all_entry_names`: `["Jennifer West", "We've got balls", "We've Got Balls"]`

"We've got balls" and "We've Got Balls" differ only in capitalization. Since the matching logic uses `.toLowerCase()`, this is functionally harmless but is redundant data.

**No cross-participant duplicates found.** Every entry name maps to at most one participant.

---

## 7. POOL_RESULTS[11] Entry Field Completeness

| Metric | Value |
|--------|-------|
| Total entries | **107** |
| Required fields | `rk, nm, tp, rp, bn, r, win, fed, td` |

### Missing Fields

**21 entries are missing the `bn` (bonus) field:**

| Index | Entry Name |
|-------|-----------|
| 70 | wbetts |
| 73 | TBrown |
| 75 | JWIII |
| 76 | Commish |
| 80 | Chris Edwards |
| 81 | TheGunners |
| 83 | Dude, Where's My Par |
| 85 | SOStancamp |
| 86 | Ollie Janzen |
| 87 | Fluffyhead |
| 88 | Modesti |
| 89 | smak |
| 90 | dan_firth |
| 91 | ryankozack |
| 92 | Crying Koepkas |
| 93 | THE-SUPERB-OWL-142 |
| 94 | mtown10 |
| 96 | Jordman8 |
| 100 | Team Lowe |
| 103 | EddieZdo |
| 104 | JWIII #2 |

**Impact:** These entries have `bn` as `undefined`. Since `tp = rp + bn`, the bonus can be derived as `tp - rp`, but any code directly reading `bn` will get `undefined`. These 21 entries are all ranked 70+ (bottom half), which may indicate late additions or entries with no bonus-eligible finishes.

### r[] Array Completeness

- All 107 entries have `r` as a 4-element array: **PASS**
- No null/undefined values within any `r[]` array: **PASS**

### Other Required Fields

- `rk`, `nm`, `tp`, `rp`, `win`, `fed`, `td`: All present in all 107 entries: **PASS**

---

## Summary

| # | Check | Status | Issues |
|---|-------|--------|--------|
| 1 | Participant count vs metadata | PASS | 0 |
| 2 | years_covered correctness | PASS | 0 |
| 3a | Season keys vs joined_year | WARN | 14 anomalies |
| 3b | total_seasons accuracy | PASS | 0 |
| 3c | Null/undefined numerics | FAIL | 16 issues (4 participants) |
| 4 | 2026 patch correctness | PASS | Functionally correct, redundant |
| 5 | 2026 cross-reference matching | WARN | 107 entries, 106 seasons (1 multi-entry participant) |
| 6 | Duplicate entry names | WARN | 1 case-variant duplicate |
| 7 | POOL_RESULTS field completeness | WARN | 21 entries missing `bn` field |

**Total issue categories: 4 (1 FAIL, 3 WARN)**

---

## Recommendations

1. **Fix undefined total/rank values (Priority: High).** Four participants (Daniel Firth, Dom Vero, Jerry Warner, Ryan Smith, Zach Lewis) have historical seasons with `undefined` for `total` and `rank`. Either populate with actual data, set to `0`/`null` with a sentinel, or remove these empty season stubs to prevent NaN propagation in calculations.

2. **Handle multi-entry participants (Priority: Medium).** Jerry Warner has two entries in POOL_RESULTS but the data model stores only one season per year. Consider either: (a) splitting into separate participant records for each entry, (b) adding an `entries` array within the season object, or (c) documenting that only the best/first entry is tracked.

3. **Add missing `bn` field to 21 POOL_RESULTS entries (Priority: Low).** These can be derived as `tp - rp` since `tp = rp + bn`. A simple fixup: `if(e.bn===undefined) e.bn = e.tp - e.rp;`

4. **Deduplicate Jennifer West's entry names (Priority: Low).** Remove the redundant "We've got balls" (lowercase variant) from `all_entry_names` — only one casing is needed since matching is case-insensitive.

5. **Clarify `joined_year` semantics (Priority: Low).** 14 participants have season data before their `joined_year`. Either update `joined_year` to reflect their actual first season, or document that `joined_year` refers to something other than first participation.

6. **Consider removing redundant IIFE patch (Priority: Low).** Since all 106 participants already have 2026 data baked into the DB JSON, the IIFE is a no-op. It can be kept for safety (idempotent) but adds ~15 lines of dead code at runtime.
