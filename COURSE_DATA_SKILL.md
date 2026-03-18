# Course Data Loading Skill

## Rule: All course previews MUST use the unified renderPreview() system

When adding or updating course data for any tournament on the dashboard:

### 1. Add to COURSES_DATA (the rich course database)

Every course MUST have ALL of these fields — no shortcuts:

```javascript
"Course Name": {
  // Weather defaults
  wxTemp, wxSky, wxIcon, wxWind, wxRain, wxHumid, wxUV, wxSunrise, wxSunset, wxDew,
  // Core identity
  courseRating, slopeRating, venue, yardage, yardageDisplay, par,
  designer, established,
  // Grass & surface
  grassFairways, grassGreens, avgStimpmeter, avgRoughHeight,
  // Hole breakdown
  par3Count, par4Count, par5Count, avgFairwayWidth,
  // Character
  signatureHoles, whatMakesItUnique,
  // Location
  weatherSlug, latitude, longitude, courseType, windExposure, distanceVsAccuracy,
  // SG emphasis (must sum to 1.0)
  sgEmphasis: { ott, app, arg, putt },
  // Notes
  notes, avgGreenSize, prevailingWind, bunkerCount, elevationChange, waterHoles,
  // Rankings (relative to 54 PGA Tour venues)
  waterHolesRank, scoreRTP, difficultyRank, courseLengthCategory, courseLengthRank,
  bunkersRank, avgFairwayWidthFeet, avgFairwayWidthRank, greensSizeRank,
  greensSpeed, roughLength, roughType, eventType, season, region, redesign,
  // Related courses
  correlatedCourses: [],
  // Display values
  greensStimpmeter, elevation, elevationRank,
  // Key notes as bullet points
  notesBullets: []
}
```

### 2. Add to courseMap in selectUpcoming()

Map the UPCOMING_EVENTS course name to the COURSES_DATA key:
```javascript
const courseMap = {
  'Innisbrook Resort (Copperhead Course)': 'Innisbrook Resort (Copperhead Course)',
  'Augusta National Golf Club': 'Augusta National Golf Club',
  // ... etc
};
```

### 3. Rendering

NEVER build custom course rendering. Always use:
```javascript
renderPreview(targetElement, courseName, eventTitle);
```

This gives every course the same features:
- Clickable stat comparison charts (56 PGA Tour venues)
- More Course Details expandable dropdown
- Correlated Courses section
- Live weather from Open-Meteo
- SG Emphasis bars with tap-to-compare
- Course Notes with formatted bullets
- Past Winners table (if available)

### 4. Field Preview Data (for "this week" events)

When adding field predictions for an upcoming tournament, create a `PREVIEW` object:
```javascript
const EVENTNAME_PREVIEW = {
  field: [
    { nm: 'Player Name', wr: worldRank, win: dgWinProb, t10: dgTop10Prob, dk: dkDecimalOdds, fd: fdDecimalOdds, skill: dgSkillRating },
    // ... top 20 players
  ]
};
```

Then render it with `renderValsparField()` pattern (or a generalized version).

### 5. Data Sources

- Course stats: DataGolf Course Fit Model, PGA Tour Media Guide, USGA/R&A Records
- Field predictions: DataGolf `/preds/pre-tournament` endpoint
- Odds: DataGolf `/betting-tools/outrights` endpoint
- Weather: Open-Meteo API (auto-fetched by renderPreview)

### 6. Never Guess

- All stats must come from verified sources
- If a field is unknown, use `null` or `'-'` — never fabricate
- SG emphasis values must be based on DataGolf course fit decomposition
- Rankings (e.g., "12th toughest/54") must reference the actual Tour venue database
