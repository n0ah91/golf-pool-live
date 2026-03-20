# Deploying sentiment-engine

## Prerequisites
- Supabase CLI installed (`npm i -g supabase`)
- Logged in: `supabase login`
- Project linked: `supabase link --project-ref jeopsojkamcruannkoqf`

## Deploy (public, no auth required)

```bash
cd /c/tmp/golf-pool-live-repo
supabase functions deploy sentiment-engine --no-verify-jwt
```

The `--no-verify-jwt` flag makes the endpoint publicly accessible (same as dg-proxy).

## Test

```bash
# No players (auto-detects from DG current field):
curl "https://jeopsojkamcruannkoqf.supabase.co/functions/v1/sentiment-engine"

# Specific players:
curl "https://jeopsojkamcruannkoqf.supabase.co/functions/v1/sentiment-engine?players=Scottie+Scheffler,Rory+McIlroy,Xander+Schauffele"

# Force refresh (bypass cache):
curl "https://jeopsojkamcruannkoqf.supabase.co/functions/v1/sentiment-engine?refresh=true"
```

## Local dev

```bash
supabase functions serve sentiment-engine --no-verify-jwt
# Then: curl http://localhost:54321/functions/v1/sentiment-engine
```

## Notes
- No secrets needed — all data sources are public APIs
- Reddit JSON API has rate limits (~60 req/min without auth). The 15-min cache keeps us well under.
- Polymarket and Kalshi may not always have active golf markets. The function handles this gracefully.
- RSS feeds may 404 or change URLs over time. Each feed failure is isolated and logged.
