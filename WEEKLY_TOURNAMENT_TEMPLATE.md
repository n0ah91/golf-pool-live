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

## Step 3B: Expert Sentiment Collection

Every week before the tournament:
1. Search for golf betting blogs, podcasts, and journalist commentary about the upcoming event
2. Key sources to check:
   - Golf betting Twitter/X accounts
   - The Ringer golf podcast
   - No Laying Up
   - Golf Digest betting previews
   - Action Network golf
   - RotoGrinders golf
   - Fantasy National golf
3. Collect: who experts are picking and WHY
4. Compare expert picks to DG model predictions
5. Note discrepancies: players experts love that DG doesn't rate highly (and vice versa)
6. Surface 3-5 "smart money" picks with reasoning
7. Add source attribution for every expert opinion

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

## Step 5B: Player Type Classification

For every player in the field preview, assign a type label based on DG skill ratings:
- **ALL-AROUND**: elite in multiple SG categories
- **IRON PLAYER**: approach game is primary weapon
- **SHOT-MAKER**: creative, varied shot selection
- **BALL-STRIKER**: tee-to-green excellence
- **BOMBER**: driving distance is primary weapon
- **ACCURATE**: driving accuracy + precision
- **SHORT GAME**: around-green + putting specialist
- **HOT FORM**: timing_adjustment significantly positive (recent surge)
- **RISING STAR**: young player with rapidly improving baseline

Show as small pill tags next to player names in field preview.

Classification logic:
- Pull sg_ott, sg_app, sg_arg, sg_putt from skill-ratings endpoint
- Pull timing_adjustment from decompositions endpoint
- Apply thresholds to assign primary type (player can have 1-2 labels max)

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

---

## Content Tiers (Basic vs Advanced)

### Basic View (default)
- Course Profile stat grid (always visible)
- 2-sentence course description from whatMakesItUnique
- Top 3 past winners
- Course DNA badge (Accuracy/Bomber/Balanced)
- Course Specialists + Hot Hands chips
- Field Preview table with Win %, Top 10, DK/FD odds, Course Fit rating
- Live Win Odds (top 20)

### Advanced View (toggled)
- Everything in Basic, plus:
- More Course Details expandable (all rankings, grass types, etc.)
- Full Course Notes (all 10+ bullet points with historical nuggets)
- Full Past Winners table (last 10 years with runner-ups, storylines — see Past Winners Enrichment)
- Betting Edge table (DG model vs books)
- Conditions / Live Weather
- Correlated Courses (shown in Course Fit Analysis section — see Correlated Courses Display)
- Historical Course Fit Trending (where data available)

---

## Correlated Courses Display

- Show correlated courses in the **Course Fit Analysis** section (not More Course Details)
- Each course tag should be clickable — opens a tooltip/popover explaining WHY it's similar
- Use navy blue (`#002855`) accent for correlated course tag backgrounds
- Similarity reasoning should reference shared traits: grass type, course length, SG emphasis, layout style, scoring profile

---

## Past Winners Enrichment (Advanced Mode)

For each past winner in the full Past Winners table, include an expandable storyline row:
- Who was the runner-up and margin of victory
- Key storyline from that year (comeback, playoff, weather delay, controversy, wire-to-wire, etc.)
- Whether the winner's profile matches the course DNA (accuracy type vs bomber type)
- Notable players who missed the cut or withdrew that year

All storyline facts must be verified against PGA Tour official records or reputable tournament archives. Never fabricate storylines.

---

## Historical Course Fit Trending

If available, show how the course's accuracy/bomber preference has shifted over years:
- Plot or table showing driving_accuracy_adjustment vs driving_distance_adjustment across recent editions
- Helps identify if a course is trending toward rewarding bombers vs accuracy
- Limited by API access — derive from available decomposition data where possible
- Note: historical raw data requires DG subscription upgrade; use current-year decomposition as baseline and note limitation

---

## Clickable Course Comparisons

Every stat tile in Course Profile should be clickable:
- Opens a 54-course comparison chart (bar or dot chart)
- Current course highlighted in **gold**
- Pool event courses (Players, Masters, PGA, US Open, Open) highlighted in **green**
- Most comparable courses highlighted in **blue**
- All other courses in muted gray
- Chart title must name the stat being compared
- MUST reference the correct course based on the selected tournament — never default to Augusta or any hardcoded course

---

## Bold Formatting in Course Notes

- Bold only key phrases that draw the reader's eye — selective emphasis only
- Use `<strong>` on: course records, famous player names, dramatic stats, notable years
- Don't over-bold — if more than ~20% of a bullet is bold, reduce it
- Example: "In 2019, **Justin Thomas** set the course record with a **61** in Round 3"
- Avoid bolding generic words like "the course" or "this tournament"

---

## Expert Sentiment Display

When expert sentiment data is collected (Step 3B), display it in the Advanced View:
- "Smart Money Picks" section with 3-5 expert-backed selections
- Each pick shows: player name, expert source, brief reasoning, DG model agreement (agree/disagree/neutral)
- Discrepancy callouts: flag players where expert consensus and DG model diverge significantly
- Source attribution required on every opinion (e.g., "via Action Network", "No Laying Up pod ep. 312")

---

## Player Type Display

When player types are classified (Step 5B), display as pill tags:
- Small colored pill next to each player name in the Field Preview table
- Color coding by type category (use muted, accessible colors that work on dark background)
- Hoverable — tooltip shows the SG ratings that drove the classification
- Players can have up to 2 type pills (e.g., BOMBER + HOT FORM)

---

## Historical Content Requirements

Every course MUST have 8-10 notesBullets that go beyond basic facts:
- Famous shots or moments at the venue
- Records (lowest score, most birdies, etc.)
- Course changes or renovations over time
- Notable collapses or comebacks
- Historical oddities or lesser-known facts
- Previous tournament names or sponsors
- Weather events that impacted the tournament
- Celebrity or notable amateur connections

All facts MUST be:
- 100% verified from PGA Tour records, course archives, or reputable sources
- Sourced — include source attribution on sections
- Never fabricated or guessed

---

## Data Accuracy Protocol

- Every number comes from a specific DG API endpoint or verified source
- Past winners cross-checked against PGA Tour official records
- Odds verified against DraftKings/FanDuel at time of data pull
- Win probabilities from DG pre-tournament model, not derived
- "Last refreshed" timestamp shown on live data sections

---

## Source Attribution

Each section should note its source:
- **Course Profile**: "Source: DataGolf Course Fit Model, PGA Tour Media Guide"
- **Field Preview**: "Source: DataGolf Pre-Tournament Model"
- **Odds**: "Source: DraftKings & FanDuel via DataGolf"
- **Weather**: "Source: Open-Meteo API"
- **Past Winners**: "Source: PGA Tour Official Records"
- **Course Notes**: "Sources: PGA Tour Archives, Course History, Tournament Records"

---

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
