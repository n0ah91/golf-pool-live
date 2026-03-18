# Weekly Tournament Preview Template

## Trigger
Run this template every Monday/Tuesday before a new PGA Tour event begins (typically Thursday).

## Step 1: Identify This Week's Event
- Check UPCOMING_EVENTS array for the current week's tournament
- Confirm event name, course, dates, dgId

## Step 2: Fetch DG API Data (5 endpoints, 1.5s between calls)

### 2A: Field Updates
```
GET /field-updates?tour=pga&file_format=json
```
Extract: top 30 by DG rank with names, dg_ids, OWGR rank

### 2B: Pre-Tournament Predictions
```
GET /preds/pre-tournament?tour=pga&file_format=json
```
Extract: top 20 by win probability with win%, top_5, top_10, top_20, make_cut

### 2C: Outright Odds
```
GET /betting-tools/outrights?tour=pga&market=win&odds_format=decimal&file_format=json
```
Extract: top 15 with DG win prob + DraftKings/FanDuel decimal odds

### 2D: Player Decompositions
```
GET /preds/player-decompositions?tour=pga&file_format=json
```
Extract: top 20 by final_pred with:
- baseline_pred, final_pred
- driving_distance_adjustment (positive = distance rewarded)
- driving_accuracy_adjustment (negative = accuracy rewarded)
- strokes_gained_category_adjustment
- course_history_adjustment, course_experience_adjustment
- timing_adjustment (recent form)
- cf_approach_comp, cf_short_comp

### 2E: Skill Ratings
```
GET /preds/skill-ratings?tour=pga&file_format=json
```
Extract: top 20 with sg_total, sg_ott, sg_app, sg_arg, sg_putt

## Step 3: Ensure Course Data Exists in COURSES_DATA

Check if the course exists in the COURSES_DATA object in index.html. If not, add it with ALL required fields per COURSE_DATA_SKILL.md:
- All weather defaults, core stats, grass types, hole breakdown
- signatureHoles, whatMakesItUnique, notesBullets
- sgEmphasis (must sum to 1.0), correlatedCourses
- All ranking fields relative to 54 PGA Tour venues
- latitude/longitude for live weather

Also ensure the courseMap in selectUpcoming() maps the UPCOMING_EVENTS course name to the COURSES_DATA key.

## Step 4: Build Preview Data Object

Create a preview data constant (like VALSPAR_PREVIEW):

```javascript
const EVENTNAME_PREVIEW = {
  field: [
    { nm:'Player Name', wr:worldRank, win:dgWinProb, t10:dgTop10Prob, dk:dkDecimalOdds, fd:fdDecimalOdds, skill:finalPred },
    // ... top 20 players sorted by win probability
  ]
};
```

## Step 5: Add Course-Fit Insights

From the decompositions data, determine:
- **Accuracy vs Distance**: Is driving_accuracy_adjustment predominantly negative (accuracy course) or driving_distance_adjustment predominantly positive (bomber course)?
- **Course specialists**: Players with positive course_history_adjustment
- **Hot hands**: Players with large negative timing_adjustment (playing well above baseline)
- **Best course fit**: Players with largest positive total_fit_adjustment

## Step 6: Verify Rendering

1. Reload the page
2. Navigate to Upcoming tab
3. Click the tournament card
4. Verify: Course Profile with clickable stats, More Course Details, Correlated Courses, Live Weather, SG Emphasis, Course Notes, Field Preview table, Betting Edge table
5. All data must match DG API values exactly — no rounding errors, no guessed values

## Step 7: Commit & Push

```
git add index.html
git commit -m "feat: [tournament name] week preview — field predictions + course data"
git push origin master
```

## Data Accuracy Rules
- NEVER guess player names, scores, odds, or probabilities
- Player names must match DG API exactly (watch for diacritics)
- All decimal odds and probabilities transferred verbatim from API
- Cross-reference: if a player appears in multiple endpoints, values must be consistent
- When in doubt, show "—" rather than fabricate

## Available DG Endpoints (Current Subscription)
- Field Updates ✓
- Pre-Tournament Predictions ✓
- Outrights ✓
- Player Decompositions ✓
- Skill Ratings ✓
- Approach Skill ✓
- In-Play (during tournaments) ✓
- Live Tournament Stats (during tournaments) ✓
- Historical Round Data ✗ (requires upgrade)
- Historical Event Data ✗ (requires upgrade)
