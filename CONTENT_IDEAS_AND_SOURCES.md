# Content Ideas & Data Sources for The Majors Pool Dashboard

## Vision

The go-to spot for golf tournament previews, analysis, and pool management. Combines data from multiple sources into one clean, accurate, interesting experience. Serves both casual fans (Basic view) and golf junkies (Advanced view).

---

## Data Sources to Integrate

### Already Using
- **DataGolf API**: predictions, odds, field updates, player decompositions, skill ratings
- **Open-Meteo**: live weather conditions
- **PGA Tour**: past results, course info

### Should Add
- **Action Network Golf**: Expert picks, betting analysis, sharp money movement
- **No Laying Up**: Course previews, player interviews, insider knowledge
- **RotoGrinders Golf**: DFS ownership projections, slate breakdowns
- **Fantasy National Golf**: Strokes gained deep dives, player trends
- **Golf Digest**: Course architecture features, renovation details
- **PGA Tour ShotLink**: Shot-level data for signature holes analysis
- **OWGR (Official World Golf Rankings)**: Ranking movement trends
- **European Tour / DP World Tour**: For players competing across tours

---

## New Dashboard Features (Priority Order)

### High Priority (Next 2 weeks)

1. **Tournament Storylines Generator** — Before each event, generate 3-5 compelling storylines:
   - "Defending champion's form this season"
   - "Best course fit who's never won here"
   - "Hottest player in the field right now"
   - "Sleeper pick: low-owned, high-fit"
   - "Revenge tour: players who collapsed here last year"

2. **Post-Tournament Recap** — Auto-generated after each event:
   - Winner's path to victory (round-by-round)
   - Pool impact: who moved up/down in standings
   - Biggest pool winners and busts
   - "Play of the tournament" highlight

3. **Head-to-Head Comparison Tool** — Pick any 2 golfers, see:
   - SG splits side by side
   - Course fit comparison for current event
   - Head-to-head record at this venue
   - DG model probability comparison

4. **DFS Ownership Projections** — Show likely ownership percentages for each player:
   - Helps pool participants identify contrarian picks
   - "If everyone picks Schauffele, and he finishes T15, you gain nothing"

### Medium Priority (Next month)

5. **"Tale of the Tape"** — Visual player comparison cards
6. **Round-by-Round Trends** — Who starts fast? Who closes strong? Historical data by round.
7. **Cut Predictor** — "X% chance to make the cut based on course fit + current form"
8. **Weather Impact Model** — How does wind/rain historically affect scoring here?
9. **Salary Value Calculator** — For the pool's salary cap format, identify underpriced players

### Future Ideas

10. **Live Tournament Feed** — During events, show real-time pool standings updates
11. **"What If" Simulator** — "If Schauffele finishes T5 and Hovland wins, here's what happens to your pool standing"
12. **Season-Long Strategy Advisor** — For one-and-done format, optimize when to use top players across remaining events
13. **Player Similarity Engine** — "If you liked picking X, consider Y for next week" based on SG profile matching
14. **Historical Course Scoring Heatmap** — Hole-by-hole average scoring at this venue over last 10 years
15. **Expert Consensus Board** — Aggregate picks from 10+ expert sources, show where they agree/disagree

---

## Content Calendar (Weekly Rhythm)

### Monday
- Identify this week's event
- Pull DG field updates and pre-tournament predictions
- Research expert picks from blogs/podcasts
- Draft tournament storylines

### Tuesday
- Finalize course data (verify/update COURSES_DATA)
- Build field preview with predictions + odds
- Generate betting edge analysis
- Pull expert sentiment

### Wednesday
- Final field confirmation
- Weather forecast integration
- Publish preview to dashboard
- Share with pool participants

### Thursday-Sunday (Tournament Days)
- Live odds auto-refresh
- Monitor for withdrawals/weather delays
- Track pool standings movement
- Capture notable moments for recap

### Monday (Post-Tournament)
- Enter final results
- Update pool standings
- Generate post-tournament recap
- Update season leaderboard
- Archive tournament data

---

## Blog/Podcast Sources to Monitor

### Betting & Analytics
- **Action Network Golf** (actionnetwork.com/golf) — sharp betting analysis
- **DataGolf Blog** (datagolf.com/blog) — model insights
- **The Golf Betting Show** podcast — expert picks with reasoning
- **Chirp Golf** — data-driven picks

### Golf Media
- **No Laying Up** (nolayingup.com) — player profiles, course previews
- **The Fried Egg** (thefriedegg.com) — course architecture deep dives
- **Golf Digest** — mainstream analysis
- **Golfweek** — field previews, insider reporting

### DFS & Fantasy
- **RotoGrinders Golf** — ownership projections
- **Fantasy National Golf** — SG-based analysis
- **Establish the Run Golf** — DFS strategy

### Social / Community
- **Golf Twitter/X** — real-time sentiment
- **r/golf and r/sportsbook** — community picks and contrarian views
- **GolfWRX forums** — equipment and course condition insider info

---

## Accuracy & Trust

The number one differentiator of this dashboard is TRUST. Every data point is verified.

- Source attribution on every section
- "Last updated" timestamps on live data
- No guessing, no fabricating, no rounding without noting it
- If data is unavailable, say so — never fill gaps with estimates
