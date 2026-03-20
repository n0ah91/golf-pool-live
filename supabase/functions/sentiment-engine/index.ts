// supabase/functions/sentiment-engine/index.ts
//
// Aggregates golf sentiment data from multiple public sources:
//   1. Reddit (r/sportsbook, r/golf, r/dfs) — comment-level keyword sentiment
//   2. Prediction markets (Polymarket, Kalshi) — implied probability vs sportsbook odds
//   3. RSS/blog feeds (Action Network, RotoGrinders, FantasyNational, etc.) — expert sentiment
//
// Returns a lean composite score per player. Cached 15 minutes in-memory.
//
// Methodology:
//   - Reddit sentiment: keyword matching on comments mentioning a player name.
//     Bullish keywords ("lock", "love", "hammer", "fire", "smash", "value", "sneaky",
//     "like", "sharp", "core") score +1, bearish keywords ("fade", "avoid", "overrated",
//     "trap", "bust", "skip", "overhyped", "chalk", "toxic", "scared") score -1.
//     Per-player score = mean of per-comment keyword hits, clamped to [-1, 1].
//   - Prediction markets: pull current golf-related markets, extract implied probability
//     per player, compare to DG/sportsbook implied probability to find divergences.
//   - Expert RSS: fetch feeds, extract <item> titles + descriptions, detect player
//     mentions, apply same keyword sentiment as Reddit but with lower weight.
//   - Composite lean = 0.40 * reddit + 0.35 * prediction_market_divergence + 0.25 * expert
//     Confidence = HIGH if 3 sources agree on direction, MED if 2, LOW otherwise.

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  "https://n0ah91.github.io",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:8090",
  "http://127.0.0.1:5500",
];

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// In-memory cache (15-minute TTL)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  data: unknown;
  expires: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  if (entry) cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
  // Prune expired entries if map grows
  if (cache.size > 50) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expires) cache.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Sentiment keywords
// ---------------------------------------------------------------------------

const BULLISH_KEYWORDS = [
  "lock", "love", "hammer", "fire", "smash", "value", "sneaky",
  "like", "sharp", "core", "confident", "must-play", "must play",
  "undervalued", "bargain", "steal", "rolling", "dialed", "hot",
];

const BEARISH_KEYWORDS = [
  "fade", "avoid", "overrated", "trap", "bust", "skip", "overhyped",
  "chalk", "toxic", "scared", "cold", "struggling", "slumping",
  "overpriced", "stay away", "stayaway", "pass", "yuck", "no thanks",
];

/**
 * Score a block of text for sentiment.
 * Returns a value in [-1, 1]. 0 = neutral or no keywords found.
 */
function scoreSentiment(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  let hits = 0;
  for (const kw of BULLISH_KEYWORDS) {
    if (lower.includes(kw)) { score += 1; hits++; }
  }
  for (const kw of BEARISH_KEYWORDS) {
    if (lower.includes(kw)) { score -= 1; hits++; }
  }
  if (hits === 0) return 0;
  return Math.max(-1, Math.min(1, score / hits));
}

// ---------------------------------------------------------------------------
// Player name matching
// ---------------------------------------------------------------------------

// We'll get the current field from the query param or use a default top-100 list.
// The caller should pass ?players=Scheffler,McIlroy,... or we detect from DG proxy.

/**
 * Check if a text block mentions a player. Uses last-name matching
 * with word-boundary-ish logic. Returns true if found.
 */
function mentionsPlayer(text: string, playerName: string): boolean {
  const lower = text.toLowerCase();
  const nameParts = playerName.toLowerCase().split(/\s+/);

  // Match on last name (most common in Reddit/blogs)
  const lastName = nameParts[nameParts.length - 1];
  if (lastName.length < 3) {
    // Short last names (e.g., "Li") need full name match to avoid false positives
    return lower.includes(playerName.toLowerCase());
  }

  // Word-boundary check: last name surrounded by non-alpha or at string edges
  const regex = new RegExp(`\\b${escapeRegex(lastName)}\\b`, "i");
  return regex.test(text);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Data source: Reddit
// ---------------------------------------------------------------------------

// Reddit's public JSON API (no auth required, append .json to any listing)
// We search recent posts in golf-related subreddits for tournament/player discussion.

interface RedditComment {
  body: string;
  permalink: string;
  score: number;
}

interface RedditResult {
  score: number;        // -1 to 1
  mentions: number;
  threads: string[];    // permalink snippets
}

const REDDIT_SUBREDDITS = ["sportsbook", "golf", "dfs"];
const REDDIT_SEARCH_TERMS = ["golf", "pga", "masters", "us open", "open championship", "pga championship", "players championship"];

/**
 * Fetch recent posts + comments from a subreddit that mention golf.
 * Returns raw comment bodies for downstream player matching.
 */
async function fetchRedditComments(subreddit: string): Promise<{ body: string; permalink: string }[]> {
  const results: { body: string; permalink: string }[] = [];

  try {
    // Fetch hot posts from the subreddit (top 25)
    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`;
    const res = await fetch(url, {
      headers: { "User-Agent": "golf-sentiment-bot/1.0" },
    });

    if (!res.ok) return results;
    const data = await res.json();

    const posts = data?.data?.children || [];

    // Filter posts that are golf-related (by title)
    const golfPosts = posts.filter((p: any) => {
      const title = (p?.data?.title || "").toLowerCase();
      return REDDIT_SEARCH_TERMS.some(term => title.includes(term)) ||
             subreddit === "golf"; // r/golf is always relevant
    });

    // For each golf post, fetch its comments (limit to first 5 posts to stay fast)
    const postsToFetch = golfPosts.slice(0, 5);

    const commentFetches = postsToFetch.map(async (post: any) => {
      try {
        const permalink = post?.data?.permalink;
        if (!permalink) return;

        const commentsUrl = `https://www.reddit.com${permalink}.json?limit=50&sort=top`;
        const cRes = await fetch(commentsUrl, {
          headers: { "User-Agent": "golf-sentiment-bot/1.0" },
        });
        if (!cRes.ok) return;

        const cData = await cRes.json();

        // Reddit comment JSON: [post, comments_listing]
        const commentListing = cData?.[1]?.data?.children || [];
        for (const c of commentListing) {
          if (c?.kind === "t1" && c?.data?.body) {
            results.push({
              body: c.data.body,
              permalink: `https://reddit.com${c.data.permalink || permalink}`,
            });
          }
          // Also check first-level replies
          const replies = c?.data?.replies?.data?.children || [];
          for (const r of replies) {
            if (r?.kind === "t1" && r?.data?.body) {
              results.push({
                body: r.data.body,
                permalink: `https://reddit.com${r.data.permalink || permalink}`,
              });
            }
          }
        }
      } catch { /* skip individual post errors */ }
    });

    await Promise.all(commentFetches);
  } catch (e) {
    console.error(`Reddit fetch error for r/${subreddit}:`, e);
  }

  return results;
}

/**
 * Aggregate Reddit sentiment for a list of players.
 */
async function getRedditSentiment(
  players: string[],
): Promise<Record<string, RedditResult>> {
  const cacheKey = "reddit_comments";
  let allComments = getCached(cacheKey) as { body: string; permalink: string }[] | null;

  if (!allComments) {
    // Fetch from all subreddits in parallel
    const fetches = REDDIT_SUBREDDITS.map(sub => fetchRedditComments(sub));
    const results = await Promise.all(fetches);
    allComments = results.flat();
    setCache(cacheKey, allComments);
  }

  const out: Record<string, RedditResult> = {};

  for (const player of players) {
    const matching = allComments.filter(c => mentionsPlayer(c.body, player));
    if (matching.length === 0) {
      out[player] = { score: 0, mentions: 0, threads: [] };
      continue;
    }

    const scores = matching.map(c => scoreSentiment(c.body));
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Deduplicate thread links
    const uniqueThreads = [...new Set(matching.map(c => c.permalink))].slice(0, 5);

    out[player] = {
      score: Math.round(avgScore * 1000) / 1000, // 3 decimal places
      mentions: matching.length,
      threads: uniqueThreads,
    };
  }

  return out;
}

// ---------------------------------------------------------------------------
// Data source: Prediction Markets
// ---------------------------------------------------------------------------

interface PredictionMarketResult {
  polymarket_prob: number | null;
  kalshi_prob: number | null;
  manifold_prob: number | null;
  consensus_prob: number | null;  // weighted average across available markets
  vs_vegas: number | null;        // divergence from sportsbook implied prob
  vs_model: number | null;        // divergence from DG model prob
  market_sources: string[];       // which markets had data for this player
}

// ---------------------------------------------------------------------------
// Polymarket — Gamma API
// ---------------------------------------------------------------------------
// Polymarket uses the Gamma API for market discovery at gamma-api.polymarket.com.
// Golf markets are sporadic on Polymarket. When they exist, they're typically
// binary yes/no markets per player (e.g., "Will Scottie Scheffler win the Masters?")
// with outcomePrices as JSON arrays of [yesPrice, noPrice] summing to ~1.0.
//
// SEARCH STRATEGY:
//   1. Try tag-based: GET /markets?tag=Golf&active=true
//   2. Try tag_slug: GET /markets?tag_slug=golf&active=true
//   3. Fallback to event search: GET /events?tag=Golf&active=true
//   4. Last resort: GET /public-search with golf keywords
//
// NOTE: As of March 2026, Polymarket does NOT consistently host golf winner
// markets. The platform is stronger on politics, crypto, and cultural events.
// We implement full support so data flows automatically when markets appear.

async function fetchPolymarketGolf(): Promise<{ probs: Record<string, number>; source: string; marketCount: number }> {
  const playerProbs: Record<string, number> = {};
  let source = "none";
  let marketCount = 0;

  try {
    // Strategy 1: Tag-based market search (most reliable when golf tag exists)
    let markets: any[] = [];

    const tagUrls = [
      "https://gamma-api.polymarket.com/markets?tag=Golf&active=true&closed=false&limit=100",
      "https://gamma-api.polymarket.com/markets?tag_slug=golf&active=true&closed=false&limit=100",
    ];

    for (const url of tagUrls) {
      try {
        const res = await fetch(url, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            markets = data;
            source = "polymarket-tag";
            break;
          }
        }
      } catch { /* try next URL */ }
    }

    // Strategy 2: Events-based search (Polymarket groups markets under events)
    if (markets.length === 0) {
      try {
        const res = await fetch(
          "https://gamma-api.polymarket.com/events?tag=Golf&active=true&closed=false&limit=50",
          { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(5000) },
        );
        if (res.ok) {
          const events = await res.json();
          for (const ev of (Array.isArray(events) ? events : [])) {
            // Each event may embed markets
            if (ev.markets && Array.isArray(ev.markets)) {
              markets.push(...ev.markets);
            }
          }
          if (markets.length > 0) source = "polymarket-events";
        }
      } catch { /* continue */ }
    }

    // Strategy 3: Keyword search via public-search endpoint
    if (markets.length === 0) {
      const searchTerms = ["golf winner", "masters golf", "PGA championship golf", "golf tournament"];
      for (const term of searchTerms) {
        try {
          const res = await fetch(
            `https://gamma-api.polymarket.com/public-search?query=${encodeURIComponent(term)}&limit=20`,
            { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(5000) },
          );
          if (res.ok) {
            const data = await res.json();
            // public-search returns { markets: [...], events: [...], profiles: [...] }
            const searchMarkets = data?.markets || [];
            if (searchMarkets.length > 0) {
              markets.push(...searchMarkets);
              source = "polymarket-search";
            }
          }
        } catch { /* try next term */ }
      }
    }

    // Parse all discovered markets
    marketCount = markets.length;
    parsePolymarketData(markets, playerProbs);

  } catch (e) {
    console.error("Polymarket fetch error:", e);
  }

  return { probs: playerProbs, source, marketCount };
}

function parsePolymarketData(data: any[], playerProbs: Record<string, number>) {
  const GOLF_KEYWORDS = [
    "golf", "masters", "pga", "open championship", "us open", "u.s. open",
    "players championship", "major", "ryder cup",
  ];

  for (const market of data) {
    try {
      const question = (market.question || "").toLowerCase();

      // Filter: must mention golf or a golf event
      const isGolf = GOLF_KEYWORDS.some(kw => question.includes(kw));
      if (!isGolf) continue;

      let prices: number[] = [];
      let outcomes: string[] = [];

      // outcomePrices and outcomes can be JSON strings or arrays
      if (market.outcomePrices) {
        prices = typeof market.outcomePrices === "string"
          ? JSON.parse(market.outcomePrices)
          : market.outcomePrices;
      }
      if (market.outcomes) {
        outcomes = typeof market.outcomes === "string"
          ? JSON.parse(market.outcomes)
          : market.outcomes;
      }

      // Binary yes/no markets about a specific player winning
      if (outcomes.length === 2 && prices.length === 2) {
        const match = question.match(/will\s+(.+?)\s+(win|make|finish|claim)/i);
        if (match) {
          const playerName = match[1].trim();
          const yesPrice = typeof prices[0] === "string" ? parseFloat(prices[0]) : prices[0];
          if (yesPrice > 0 && yesPrice < 1) {
            playerProbs[playerName] = yesPrice;
          }
        }
      }

      // Multi-outcome winner markets — each outcome is a player
      if (outcomes.length > 2 && prices.length === outcomes.length) {
        for (let i = 0; i < outcomes.length; i++) {
          const name = outcomes[i];
          const prob = typeof prices[i] === "string" ? parseFloat(prices[i]) : prices[i];
          if (name && typeof prob === "number" && prob > 0 && name.toLowerCase() !== "other") {
            playerProbs[name] = prob;
          }
        }
      }
    } catch { /* skip parse errors for individual markets */ }
  }
}

// ---------------------------------------------------------------------------
// Kalshi — CFTC-regulated prediction market
// ---------------------------------------------------------------------------
// Kalshi API v2: GET https://api.elections.kalshi.com/trade-api/v2
// NO AUTH required for reading market data (security: [] on GET /markets).
//
// Golf markets use series_ticker "KXPGATOUR". Each event (e.g., Masters 2026)
// has event_ticker like "KXPGATOUR-MAST26". Under each event are 60+ binary
// markets, one per player, with tickers like "KXPGATOUR-MAST26-SSCH".
//
// Key fields on each market:
//   - yes_bid_dollars / yes_ask_dollars: current bid/ask in dollars (0-1)
//   - last_price_dollars: last trade price (0-1 implied probability)
//   - yes_sub_title: player name (e.g., "Scottie Scheffler")
//   - volume_fp: total volume traded
//
// We fetch via events endpoint with nested markets for efficiency.

// Known Kalshi golf event tickers for 2026 season.
// These follow the pattern KXPGATOUR-{EVENT_CODE}{YEAR_SUFFIX}.
const KALSHI_GOLF_EVENT_PATTERNS = [
  "KXPGATOUR-MAST",   // Masters Tournament
  "KXPGATOUR-PGAC",   // PGA Championship
  "KXPGATOUR-USO",    // U.S. Open
  "KXPGATOUR-OPEN",   // The Open Championship
  "KXPGATOUR-THPC",   // The Players Championship
  "KXPGATOUR-VALS",   // Valspar Championship
  "KXPGATOUR-TXO",    // Texas Open
  "KXPGATOUR-HOU",    // Houston Open
];

async function fetchKalshiGolf(): Promise<{ probs: Record<string, number>; source: string; marketCount: number; eventName: string }> {
  const playerProbs: Record<string, number> = {};
  let source = "none";
  let marketCount = 0;
  let eventName = "";

  try {
    // Strategy 1: Fetch events under the KXPGATOUR series (most efficient)
    const eventsUrl = "https://api.elections.kalshi.com/trade-api/v2/events?status=open&series_ticker=KXPGATOUR&with_nested_markets=true&limit=50";
    const res = await fetch(eventsUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      const events = data?.events || [];

      // Find the most relevant event (prefer active/open, highest volume)
      let bestEvent: any = null;
      let bestVolume = 0;

      for (const ev of events) {
        const markets = ev.markets || [];
        const totalVol = markets.reduce((s: number, m: any) =>
          s + (parseFloat(m.volume_fp || "0") || 0), 0);
        // Prefer events with open markets and highest volume
        const hasOpen = markets.some((m: any) => m.status === "open");
        if (hasOpen && totalVol >= bestVolume) {
          bestVolume = totalVol;
          bestEvent = ev;
        }
      }

      if (bestEvent) {
        eventName = bestEvent.title || bestEvent.event_ticker || "";
        source = "kalshi-events";

        for (const market of (bestEvent.markets || [])) {
          if (market.status !== "open") continue;
          marketCount++;

          // Player name is in yes_sub_title (e.g., "Scottie Scheffler")
          const playerName = market.yes_sub_title || "";
          if (!playerName) continue;

          // Use midpoint of bid/ask for best probability estimate.
          // Kalshi prices are in dollars (0-1), not cents.
          const bid = parseFloat(market.yes_bid_dollars || "0") || 0;
          const ask = parseFloat(market.yes_ask_dollars || "0") || 0;
          const lastPrice = parseFloat(market.last_price_dollars || "0") || 0;

          // Best estimate: midpoint if both sides exist, else last trade
          let prob = 0;
          if (bid > 0 && ask > 0) {
            prob = (bid + ask) / 2;
          } else if (lastPrice > 0) {
            prob = lastPrice;
          } else if (ask > 0) {
            prob = ask;
          }

          if (prob > 0 && prob < 1) {
            playerProbs[playerName] = prob;
          }
        }
      }
    }

    // Strategy 2: Fallback — direct market search if events endpoint fails
    if (Object.keys(playerProbs).length === 0) {
      const marketsUrl = "https://api.elections.kalshi.com/trade-api/v2/markets?status=open&series_ticker=KXPGATOUR&limit=200";
      const mRes = await fetch(marketsUrl, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(8000),
      });

      if (mRes.ok) {
        const mData = await mRes.json();
        const markets = mData?.markets || [];
        source = "kalshi-markets";

        for (const market of markets) {
          marketCount++;
          const playerName = market.yes_sub_title || "";
          if (!playerName) continue;

          const bid = parseFloat(market.yes_bid_dollars || "0") || 0;
          const ask = parseFloat(market.yes_ask_dollars || "0") || 0;
          const lastPrice = parseFloat(market.last_price_dollars || "0") || 0;

          let prob = 0;
          if (bid > 0 && ask > 0) prob = (bid + ask) / 2;
          else if (lastPrice > 0) prob = lastPrice;
          else if (ask > 0) prob = ask;

          if (prob > 0 && prob < 1) {
            playerProbs[playerName] = prob;
          }
        }
      }
    }

  } catch (e) {
    console.error("Kalshi fetch error:", e);
  }

  return { probs: playerProbs, source, marketCount, eventName };
}

// ---------------------------------------------------------------------------
// Manifold Markets — community prediction market (play money, but informative)
// ---------------------------------------------------------------------------
// Manifold API: GET https://api.manifold.markets/v0
// NO AUTH required for reading. Rate limit: 500 req/min.
//
// Golf winner markets are MULTIPLE_CHOICE type with answers[] containing
// player names and probability fields. We search with the /v0/search-markets
// endpoint using golf tournament keywords.
//
// Key fields on MULTIPLE_CHOICE markets:
//   - answers[]: array of { text, probability, ... }
//   - probability: overall market probability (less useful for multi-outcome)
//   - volume: total mana traded (higher = more reliable signal)
//
// Manifold uses play money (mana) but research shows prediction markets with
// play money still produce reasonably calibrated probabilities, especially
// for well-traded markets.

const MANIFOLD_GOLF_SEARCHES = [
  "golf winner Masters 2026",
  "golf winner PGA Championship 2026",
  "golf winner US Open 2026",
  "golf winner Open Championship 2026",
  "golf winner Players Championship 2026",
  "PGA Tour winner",
];

async function fetchManifoldGolf(): Promise<{ probs: Record<string, number>; source: string; marketCount: number; marketTitles: string[] }> {
  const playerProbs: Record<string, number> = {};
  let source = "none";
  let marketCount = 0;
  const marketTitles: string[] = [];

  try {
    // Search for golf winner markets
    const seenIds = new Set<string>();

    for (const term of MANIFOLD_GOLF_SEARCHES) {
      try {
        const url = `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(term)}&sort=liquidity&filter=open&contractType=MULTIPLE_CHOICE&limit=5`;
        const res = await fetch(url, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) continue;
        const markets = await res.json();
        if (!Array.isArray(markets)) continue;

        for (const market of markets) {
          if (seenIds.has(market.id)) continue;
          seenIds.add(market.id);

          const q = (market.question || "").toLowerCase();
          // Must be golf-related
          if (!q.includes("golf") && !q.includes("masters") && !q.includes("pga") &&
              !q.includes("open") && !q.includes("us open")) continue;

          // For MULTIPLE_CHOICE, fetch full market to get answers with probabilities
          try {
            const fullRes = await fetch(
              `https://api.manifold.markets/v0/market/${market.id}`,
              { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(5000) },
            );
            if (!fullRes.ok) continue;
            const full = await fullRes.json();

            const answers = full.answers || [];
            if (answers.length === 0) continue;

            marketCount++;
            marketTitles.push(full.question || "Unknown");
            source = "manifold";

            for (const ans of answers) {
              const name = ans.text || "";
              const prob = ans.probability || ans.prob || 0;
              // Skip generic "Other" answers
              if (!name || name.toLowerCase() === "other" || prob <= 0) continue;
              // Store probability (Manifold uses play money but probs are still informative)
              // If we already have a prob for this player from another market, keep the one
              // from the higher-volume market (we process by liquidity order)
              if (!playerProbs[name]) {
                playerProbs[name] = prob;
              }
            }
          } catch { /* skip individual market fetch errors */ }
        }
      } catch { /* skip search term errors */ }
    }

    // Also try binary markets about specific top players
    try {
      const binaryRes = await fetch(
        `https://api.manifold.markets/v0/search-markets?term=golf+win+2026&sort=liquidity&filter=open&contractType=BINARY&limit=10`,
        { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(5000) },
      );
      if (binaryRes.ok) {
        const binaryMarkets = await binaryRes.json();
        for (const m of (Array.isArray(binaryMarkets) ? binaryMarkets : [])) {
          const q = (m.question || "").toLowerCase();
          if (!q.includes("golf") && !q.includes("masters") && !q.includes("pga")) continue;

          // Extract player name from question like "Will Scottie Scheffler win the Masters?"
          const match = q.match(/will\s+(.+?)\s+(win|make|claim)/i);
          if (match && m.probability) {
            const name = match[1].trim();
            // Capitalize properly
            const capName = name.split(/\s+/).map((w: string) =>
              w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
            if (!playerProbs[capName]) {
              playerProbs[capName] = m.probability;
              marketCount++;
            }
          }
        }
      }
    } catch { /* skip binary search */ }

  } catch (e) {
    console.error("Manifold fetch error:", e);
  }

  return { probs: playerProbs, source, marketCount, marketTitles };
}

// ---------------------------------------------------------------------------
// Prediction market aggregation + three-way comparison
// ---------------------------------------------------------------------------

/**
 * Get prediction market data for all players and compute three-way divergences:
 *   1. Prediction market consensus vs sportsbook (vegas) implied prob
 *   2. Prediction market consensus vs DG model prob
 *   3. Overall: where all three disagree is the strongest signal
 *
 * vegasProbs: player -> sportsbook implied probability
 * modelProbs: player -> DG model probability (from in-play win_prob or datagolf odds)
 */
async function getPredictionMarkets(
  players: string[],
  vegasProbs: Record<string, number>,
  modelProbs: Record<string, number>,
): Promise<{ results: Record<string, PredictionMarketResult>; meta: PredictionMarketMeta }> {
  const cacheKey = "prediction_markets_v2";
  let cached = getCached(cacheKey) as {
    poly: { probs: Record<string, number>; source: string; marketCount: number };
    kalshi: { probs: Record<string, number>; source: string; marketCount: number; eventName: string };
    manifold: { probs: Record<string, number>; source: string; marketCount: number; marketTitles: string[] };
  } | null;

  if (!cached) {
    const [poly, kalshi, manifold] = await Promise.all([
      fetchPolymarketGolf(),
      fetchKalshiGolf(),
      fetchManifoldGolf(),
    ]);
    cached = { poly, kalshi, manifold };
    setCache(cacheKey, cached);
  }

  const meta: PredictionMarketMeta = {
    polymarket: { available: Object.keys(cached.poly.probs).length > 0, source: cached.poly.source, playerCount: Object.keys(cached.poly.probs).length, marketCount: cached.poly.marketCount },
    kalshi: { available: Object.keys(cached.kalshi.probs).length > 0, source: cached.kalshi.source, playerCount: Object.keys(cached.kalshi.probs).length, marketCount: cached.kalshi.marketCount, eventName: cached.kalshi.eventName },
    manifold: { available: Object.keys(cached.manifold.probs).length > 0, source: cached.manifold.source, playerCount: Object.keys(cached.manifold.probs).length, marketCount: cached.manifold.marketCount, marketTitles: cached.manifold.marketTitles },
  };

  const out: Record<string, PredictionMarketResult> = {};

  for (const player of players) {
    const lastName = player.split(/\s+/).pop()?.toLowerCase() || "";
    const polyProb = findPlayerProb(cached.poly.probs, player, lastName);
    const kalshiProb = findPlayerProb(cached.kalshi.probs, player, lastName);
    const manifoldProb = findPlayerProb(cached.manifold.probs, player, lastName);

    const sources: string[] = [];
    if (polyProb !== null) sources.push("Polymarket");
    if (kalshiProb !== null) sources.push("Kalshi");
    if (manifoldProb !== null) sources.push("Manifold");

    // Weighted consensus: Kalshi (regulated, real money) > Polymarket (real money) > Manifold (play money)
    const WEIGHT_KALSHI = 0.50;
    const WEIGHT_POLY = 0.35;
    const WEIGHT_MANIFOLD = 0.15;

    let consensusProb: number | null = null;
    if (sources.length > 0) {
      let weightedSum = 0;
      let weightSum = 0;
      if (kalshiProb !== null) { weightedSum += kalshiProb * WEIGHT_KALSHI; weightSum += WEIGHT_KALSHI; }
      if (polyProb !== null) { weightedSum += polyProb * WEIGHT_POLY; weightSum += WEIGHT_POLY; }
      if (manifoldProb !== null) { weightedSum += manifoldProb * WEIGHT_MANIFOLD; weightSum += WEIGHT_MANIFOLD; }
      consensusProb = weightSum > 0 ? weightedSum / weightSum : null;
    }

    const vegasProb = vegasProbs[player] ?? null;
    const modelProb = modelProbs[player] ?? null;

    // Divergence: prediction market vs vegas
    let vsVegas: number | null = null;
    if (consensusProb !== null && vegasProb !== null) {
      vsVegas = Math.round((consensusProb - vegasProb) * 10000) / 10000;
    }

    // Divergence: prediction market vs DG model
    let vsModel: number | null = null;
    if (consensusProb !== null && modelProb !== null) {
      vsModel = Math.round((consensusProb - modelProb) * 10000) / 10000;
    }

    out[player] = {
      polymarket_prob: polyProb !== null ? Math.round(polyProb * 10000) / 10000 : null,
      kalshi_prob: kalshiProb !== null ? Math.round(kalshiProb * 10000) / 10000 : null,
      manifold_prob: manifoldProb !== null ? Math.round(manifoldProb * 10000) / 10000 : null,
      consensus_prob: consensusProb !== null ? Math.round(consensusProb * 10000) / 10000 : null,
      vs_vegas: vsVegas,
      vs_model: vsModel,
      market_sources: sources,
    };
  }

  return { results: out, meta };
}

interface PredictionMarketMeta {
  polymarket: { available: boolean; source: string; playerCount: number; marketCount: number };
  kalshi: { available: boolean; source: string; playerCount: number; marketCount: number; eventName: string };
  manifold: { available: boolean; source: string; playerCount: number; marketCount: number; marketTitles: string[] };
}

/**
 * Fuzzy-match a player name against a prediction market player map.
 */
function findPlayerProb(
  probs: Record<string, number>,
  fullName: string,
  lastName: string,
): number | null {
  // Exact match first
  if (probs[fullName] !== undefined) return probs[fullName];

  // Case-insensitive full name
  const lowerFull = fullName.toLowerCase();
  for (const [k, v] of Object.entries(probs)) {
    if (k.toLowerCase() === lowerFull) return v;
  }

  // Last-name match (only if last name is 4+ chars to avoid false positives)
  if (lastName.length >= 4) {
    for (const [k, v] of Object.entries(probs)) {
      if (k.toLowerCase().includes(lastName)) return v;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Data source: RSS / Blog feeds
// ---------------------------------------------------------------------------

interface ExpertResult {
  score: number;      // -1 to 1
  sources: string[];  // feed names that mentioned the player
}

// RSS feeds for golf expert content.
// Note: some feeds may use Atom or non-standard RSS. We do a best-effort XML parse.
const RSS_FEEDS: { name: string; url: string }[] = [
  { name: "Action Network Golf", url: "https://www.actionnetwork.com/rss/golf" },
  { name: "RotoGrinders Golf", url: "https://rotogrinders.com/golf/rss" },
  { name: "FantasyNational", url: "https://www.fantasynational.com/rss" },
  { name: "The Fried Egg", url: "https://thefriedegg.com/feed/" },
  { name: "No Laying Up", url: "https://nolayingup.com/feed/" },
];

interface FeedItem {
  title: string;
  description: string;
  feedName: string;
}

/**
 * Fetch and parse an RSS feed. Extracts item titles + descriptions.
 * Uses regex-based XML parsing since Deno edge functions don't have DOMParser.
 */
async function fetchRSSFeed(feed: { name: string; url: string }): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  try {
    const res = await fetch(feed.url, {
      headers: {
        "User-Agent": "golf-sentiment-bot/1.0",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!res.ok) return items;

    const xml = await res.text();

    // Extract <item> blocks (RSS 2.0) or <entry> blocks (Atom)
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;

    const blocks: string[] = [];
    let match;
    while ((match = itemRegex.exec(xml)) !== null) blocks.push(match[1]);
    while ((match = entryRegex.exec(xml)) !== null) blocks.push(match[1]);

    for (const block of blocks.slice(0, 20)) { // limit to 20 most recent items
      const title = extractTag(block, "title");
      const desc = extractTag(block, "description") ||
                   extractTag(block, "summary") ||
                   extractTag(block, "content");

      items.push({
        title: stripHtml(title),
        description: stripHtml(desc).slice(0, 500), // truncate long descriptions
        feedName: feed.name,
      });
    }
  } catch (e) {
    console.error(`RSS fetch error for ${feed.name}:`, e);
  }

  return items;
}

/** Extract text content of an XML tag. Handles CDATA. */
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`, "i");
  const match = regex.exec(xml);
  return match ? match[1].trim() : "";
}

/** Strip HTML tags from a string. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

/**
 * Aggregate expert/blog sentiment for a list of players.
 */
async function getExpertSentiment(
  players: string[],
): Promise<Record<string, ExpertResult>> {
  const cacheKey = "rss_items";
  let allItems = getCached(cacheKey) as FeedItem[] | null;

  if (!allItems) {
    const fetches = RSS_FEEDS.map(f => fetchRSSFeed(f));
    const results = await Promise.all(fetches);
    allItems = results.flat();
    setCache(cacheKey, allItems);
  }

  const out: Record<string, ExpertResult> = {};

  for (const player of players) {
    const matching = allItems.filter(item =>
      mentionsPlayer(item.title, player) || mentionsPlayer(item.description, player)
    );

    if (matching.length === 0) {
      out[player] = { score: 0, sources: [] };
      continue;
    }

    const scores = matching.map(item =>
      scoreSentiment(item.title + " " + item.description)
    );
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Unique source names
    const uniqueSources = [...new Set(matching.map(item => item.feedName))];

    out[player] = {
      score: Math.round(avgScore * 1000) / 1000,
      sources: uniqueSources,
    };
  }

  return out;
}

// ---------------------------------------------------------------------------
// DG proxy: fetch sportsbook implied probabilities for divergence calc
// ---------------------------------------------------------------------------

const DG_PROXY_URL = "https://jeopsojkamcruannkoqf.supabase.co/functions/v1/dg-proxy";

/**
 * Fetch sportsbook implied probabilities AND DG model probabilities.
 *
 * Uses two endpoints via dg-proxy:
 *   1. betting-tools/outrights — per-book decimal odds + DG model odds
 *   2. preds/in-play — live model win probabilities (during active events)
 *
 * Returns separate maps for vegas (sportsbook) and model (DG) probabilities.
 * The three-way comparison (prediction market vs model vs sportsbook) requires both.
 */
async function fetchVegasAndModelProbs(): Promise<{
  vegasProbs: Record<string, number>;
  modelProbs: Record<string, number>;
  eventName: string;
}> {
  const vegasProbs: Record<string, number> = {};
  const modelProbs: Record<string, number> = {};
  let eventName = "Unknown";

  const BOOKS = ["draftkings", "fanduel", "betmgm", "caesars", "pointsbet", "bet365"];

  try {
    // Fetch outrights and in-play in parallel
    const [outrightsRes, inPlayRes] = await Promise.all([
      fetch(`${DG_PROXY_URL}?endpoint=betting-tools/outrights&market=win&odds_format=decimal`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${DG_PROXY_URL}?endpoint=preds/in-play&tour=pga`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    // Parse outrights for sportsbook odds
    if (outrightsRes) {
      eventName = outrightsRes?.event_name || outrightsRes?.tournament || eventName;
      const oddsData = outrightsRes?.odds || outrightsRes?.data || [];

      // Calculate vig sum for fair probability conversion
      let rawVegasSum = 0;
      const rawEntries: { name: string; rawProb: number; dgOdds: number | null }[] = [];

      for (const row of oddsData) {
        const name = row?.player_name || row?.name || "";
        if (!name) continue;

        // DG model odds (separate from sportsbook)
        const dgOdds = row?.datagolf || row?.dg || row?.datagolf_base_history_fit || null;
        if (dgOdds && dgOdds > 0) {
          modelProbs[name] = 1 / dgOdds;
        }

        // Best sportsbook odds (lowest = most favorable for bettor)
        let bestOdds = Infinity;
        for (const bk of BOOKS) {
          const o = typeof row[bk] === "number" ? row[bk] : (row[bk]?.odds || null);
          if (o && o > 1 && o < bestOdds) bestOdds = o;
        }
        // Fallback to consensus
        if (bestOdds === Infinity) {
          const consensus = row?.consensus || row?.market_average || null;
          if (consensus && consensus > 0) bestOdds = consensus;
        }

        if (bestOdds < Infinity) {
          const rawProb = 1 / bestOdds;
          rawVegasSum += rawProb;
          rawEntries.push({ name, rawProb, dgOdds });
        }
      }

      // Remove vig for fair vegas probabilities
      for (const entry of rawEntries) {
        vegasProbs[entry.name] = rawVegasSum > 0 ? entry.rawProb / rawVegasSum : entry.rawProb;
      }
    }

    // Parse in-play for live model probabilities (overrides outright DG model during live events)
    if (inPlayRes?.data && Array.isArray(inPlayRes.data)) {
      eventName = inPlayRes?.info?.event_name || eventName;
      for (const p of inPlayRes.data) {
        const name = p.player_name || "";
        const winProb = p.win ?? p.win_prob ?? null;
        if (name && winProb != null && winProb > 0) {
          modelProbs[name] = winProb; // override outright model with live model
        }
      }
    }
  } catch (e) {
    console.error("DG proxy fetch error:", e);
  }

  return { vegasProbs, modelProbs, eventName };
}

// ---------------------------------------------------------------------------
// Composite scoring
// ---------------------------------------------------------------------------

// Weights for the composite lean score
const WEIGHT_REDDIT = 0.40;
const WEIGHT_PREDICTION = 0.35;
const WEIGHT_EXPERT = 0.25;

interface PlayerSentiment {
  reddit_sentiment: RedditResult;
  prediction_market: PredictionMarketResult;
  expert_sentiment: ExpertResult;
  composite_lean: number;
  confidence: "HIGH" | "MED" | "LOW";
  signals: string[];
  // Enhanced three-way comparison data for the dashboard panel
  three_way: {
    model_prob: number | null;
    vegas_prob: number | null;
    market_prob: number | null;  // prediction market consensus
    max_divergence: number | null; // largest pairwise disagreement
    alignment: "ALIGNED" | "SPLIT" | "DIVERGENT"; // how much the 3 agree
  };
}

function computeComposite(
  reddit: RedditResult,
  market: PredictionMarketResult,
  expert: ExpertResult,
  modelProb: number | null,
  vegasProb: number | null,
): {
  composite_lean: number;
  confidence: "HIGH" | "MED" | "LOW";
  signals: string[];
  three_way: PlayerSentiment["three_way"];
} {
  const signals: string[] = [];

  // Reddit signal
  const redditDir = reddit.score > 0.1 ? "bullish" : reddit.score < -0.1 ? "bearish" : "neutral";
  if (reddit.mentions > 0) {
    signals.push(`reddit ${redditDir} (${reddit.mentions} mentions)`);
  }

  // Prediction market signal — now uses three-way comparison
  let marketSignal = 0;

  // vs Vegas divergence
  if (market.vs_vegas !== null) {
    const pct = (market.vs_vegas * 100).toFixed(1);
    if (market.vs_vegas > 0.005) {
      signals.push(`pred markets ${pct}% above vegas (${market.market_sources.join("+")})`);
      marketSignal = 1;
    } else if (market.vs_vegas < -0.005) {
      signals.push(`pred markets ${pct}% below vegas (${market.market_sources.join("+")})`);
      marketSignal = -1;
    } else {
      signals.push(`pred markets agree with vegas (${market.market_sources.join("+")})`);
    }
  }

  // vs Model divergence (additional signal)
  if (market.vs_model !== null && Math.abs(market.vs_model) > 0.005) {
    const pct = (market.vs_model * 100).toFixed(1);
    signals.push(`pred markets ${market.vs_model > 0 ? "+" : ""}${pct}% vs DG model`);
  }

  // Expert signal
  const expertDir = expert.score > 0.1 ? "bullish" : expert.score < -0.1 ? "bearish" : "neutral";
  if (expert.sources.length > 0) {
    signals.push(`experts ${expertDir} (${expert.sources.join(", ")})`);
  }

  // Composite: weighted blend of normalized signals
  const marketScore = market.vs_vegas !== null
    ? Math.max(-1, Math.min(1, market.vs_vegas / 0.05))
    : 0;

  const composite = (
    WEIGHT_REDDIT * reddit.score +
    WEIGHT_PREDICTION * marketScore +
    WEIGHT_EXPERT * expert.score
  );

  // Confidence: based on agreement between sources
  const directions = [
    reddit.score > 0.1 ? 1 : reddit.score < -0.1 ? -1 : 0,
    marketSignal,
    expert.score > 0.1 ? 1 : expert.score < -0.1 ? -1 : 0,
  ];
  const nonZero = directions.filter(d => d !== 0);
  let confidence: "HIGH" | "MED" | "LOW" = "LOW";
  if (nonZero.length >= 3 && nonZero.every(d => d === nonZero[0])) {
    confidence = "HIGH";
  } else if (nonZero.length >= 2 && nonZero.filter(d => d === nonZero[0]).length >= 2) {
    confidence = "MED";
  }

  // Three-way comparison analysis
  const mp = market.consensus_prob;
  const vp = vegasProb;
  const dp = modelProb;

  // Calculate max divergence among the three probability sources
  let maxDiv: number | null = null;
  const availableProbs = [mp, vp, dp].filter((p): p is number => p !== null);
  if (availableProbs.length >= 2) {
    const pairs: number[] = [];
    for (let i = 0; i < availableProbs.length; i++) {
      for (let j = i + 1; j < availableProbs.length; j++) {
        pairs.push(Math.abs(availableProbs[i] - availableProbs[j]));
      }
    }
    maxDiv = Math.max(...pairs);
  }

  // Alignment classification
  let alignment: "ALIGNED" | "SPLIT" | "DIVERGENT" = "ALIGNED";
  if (maxDiv !== null) {
    if (maxDiv > 0.03) alignment = "DIVERGENT";
    else if (maxDiv > 0.01) alignment = "SPLIT";
  }

  return {
    composite_lean: Math.round(composite * 10000) / 10000,
    confidence,
    signals,
    three_way: {
      model_prob: dp !== null ? Math.round(dp * 10000) / 10000 : null,
      vegas_prob: vp !== null ? Math.round(vp * 10000) / 10000 : null,
      market_prob: mp !== null ? Math.round(mp * 10000) / 10000 : null,
      max_divergence: maxDiv !== null ? Math.round(maxDiv * 10000) / 10000 : null,
      alignment,
    },
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const headers = corsHeaders(origin);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    // Parse request: accept GET query params or POST JSON body
    let players: string[] = [];
    let forceRefresh = false;

    if (req.method === "GET") {
      const url = new URL(req.url);
      const playersParam = url.searchParams.get("players");
      if (playersParam) {
        players = playersParam.split(",").map(p => p.trim()).filter(Boolean);
      }
      forceRefresh = url.searchParams.get("refresh") === "true";
    } else {
      const body = await req.json().catch(() => ({}));
      players = body.players || [];
      forceRefresh = body.refresh === true;
    }

    // Check full-response cache (keyed by sorted player list)
    const responseCacheKey = `response:${players.slice().sort().join(",")}`;
    if (!forceRefresh) {
      const cached = getCached(responseCacheKey);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...headers, "X-Cache": "HIT" },
        });
      }
    }

    // Fetch sportsbook + model probabilities from DG
    const { vegasProbs, modelProbs, eventName } = await fetchVegasAndModelProbs();

    if (players.length === 0) {
      // Use the top 50 players from DG odds (by implied probability)
      // Prefer model probs (more players), fall back to vegas
      const allProbs = Object.keys(modelProbs).length > 0 ? modelProbs : vegasProbs;
      const sorted = Object.entries(allProbs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50);
      players = sorted.map(([name]) => name);
    }

    if (players.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No players found. Pass ?players=Name1,Name2 or ensure DG proxy returns current field.",
        }),
        { status: 400, headers },
      );
    }

    // Fetch all data sources in parallel
    const [redditData, marketResult, expertData] = await Promise.all([
      getRedditSentiment(players),
      getPredictionMarkets(players, vegasProbs, modelProbs),
      getExpertSentiment(players),
    ]);

    const { results: marketData, meta: marketMeta } = marketResult;

    // Build per-player composite
    const playersOutput: Record<string, PlayerSentiment> = {};

    for (const player of players) {
      const reddit = redditData[player] || { score: 0, mentions: 0, threads: [] };
      const market = marketData[player] || {
        polymarket_prob: null, kalshi_prob: null, manifold_prob: null,
        consensus_prob: null, vs_vegas: null, vs_model: null, market_sources: [],
      };
      const expert = expertData[player] || { score: 0, sources: [] };

      const { composite_lean, confidence, signals, three_way } = computeComposite(
        reddit, market, expert, modelProbs[player] ?? null, vegasProbs[player] ?? null,
      );

      playersOutput[player] = {
        reddit_sentiment: reddit,
        prediction_market: market,
        expert_sentiment: expert,
        composite_lean,
        confidence,
        signals,
        three_way,
      };
    }

    const response = {
      timestamp: new Date().toISOString(),
      event: eventName,
      player_count: players.length,
      sources: {
        reddit: REDDIT_SUBREDDITS.map(s => `r/${s}`),
        prediction_markets: ["Polymarket", "Kalshi", "Manifold"],
        expert_feeds: RSS_FEEDS.map(f => f.name),
      },
      prediction_market_meta: marketMeta,
      players: playersOutput,
    };

    // Cache the full response
    setCache(responseCacheKey, response);

    return new Response(JSON.stringify(response), {
      headers: { ...headers, "X-Cache": "MISS" },
    });
  } catch (e) {
    console.error("Sentiment engine error:", e);
    return new Response(
      JSON.stringify({ error: "Sentiment engine error", detail: String(e) }),
      { status: 500, headers },
    );
  }
});
