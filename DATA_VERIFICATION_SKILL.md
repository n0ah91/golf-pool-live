# Data Verification Skill

## Purpose
Ensure 100% accuracy of all data displayed on The Majors Pool dashboard. Every number, name, and fact must be traceable to a verified source.

## Verification Categories

### 1. Pool Data Verification
- Entry counts match between POOL_RESULTS, pool standings display, and history tab
- Payout math: season payouts sum to season total, event payouts sum to event total, season + events + house = gross pot
- Each entry's total = roster + bonus (verify for top 10 entries)
- Tiebreak values are valid integers
- Rank sparklines match actual round-by-round rank movement
- Winnings format consistent (all in same units)

### 2. Past Winners Verification
Sources: PGA Tour official results (pgatour.com/tournaments/[event]/past-results)

For each tournament in PAST_WINNERS:
- Winner name spelled correctly
- Winning score accurate (including playoff notation)
- Runner-up name(s) accurate
- Year correct
- Cross-reference at least 3 entries per tournament against PGA Tour records

### 3. Course Data Verification
Sources: DataGolf Course Fit Model, PGA Tour Media Guide, course official websites

For each course in COURSES_DATA:
- Yardage matches current tournament setup
- Par value correct
- Bunker count verified
- Water holes count verified
- Designer/architect attribution correct
- Stimpmeter reading from most recent tournament
- All notesBullets are factual (cross-reference each claim)
- correlatedCourses make sense (similar SG profiles)
- Signature holes descriptions are accurate

### 4. DG API Data Verification
For embedded prediction data (like VALSPAR_PREVIEW):
- Win probabilities match DG pre-tournament endpoint at time of pull
- Player names match DG exactly (watch for diacritics: Højgaard, Åberg)
- Decimal odds match DraftKings/FanDuel at time of pull
- Course fit values (final_pred, baseline_pred) match decompositions endpoint
- Player type labels are reasonable given their skill profile

### 5. History Database Verification
- Each participant's career.total_seasons matches actual season count
- Season totals are consistent (sum of event scores where available)
- Rank values are sequential (no gaps or duplicates for same year)
- joined_year is accurate for each participant
- all_entry_names contains all known aliases

### 6. Live Data Verification (during tournaments)
- Odds panel shows current event (not stale data from previous event)
- "Last refreshed" timestamp is within expected range
- Weather data matches actual conditions (spot-check against weather.com)
- Live stats (when running) match PGA Tour leaderboard

## Verification Frequency
- **Before each tournament**: verify course data, field preview, past winners
- **After each tournament**: verify results entered correctly, standings updated
- **Monthly**: full database audit (all participants, all seasons)
- **On any data change**: re-verify affected sections

## Red Flags to Watch For
- Any number that seems "too round" (might be estimated, not actual)
- Player names that don't match DG's exact spelling
- Winning scores that don't match the sign convention (negative = under par)
- Course stats that haven't been updated for recent renovations
- Past winners from COVID-cancelled years (2020 for some events)

## Verification Tools
- PGA Tour official website for results and records
- DataGolf API endpoints for current predictions
- Course official websites for physical specifications
- Weather services for conditions verification
- ESPN/Golf Channel for cross-referencing storylines

## Sign-Off Protocol
After verification, note:
- Date of verification
- Who/what verified
- Any issues found and resolved
- Data sources consulted
