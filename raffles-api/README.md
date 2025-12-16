# Micros Raffles API (Vercel + Supabase + Helius)

This folder is intended to be deployed as a **separate Vercel project** (Root Directory = `raffles-api/`).

## Environment variables (Vercel Project Settings → Environment Variables)

- `SUPABASE_URL`: `https://olzrecbpyoqbthuffmuj.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase **service_role** key (keep secret; Vercel-only)
- `HELIUS_WEBHOOK_AUTH`: the exact value you set as `authHeader` when creating the Helius webhook (e.g. `Bearer my-secret-token`)
- `RAFFLE_PROGRAM_ID`: your raffle Anchor program id (devnet)
- `CHAIN`: `devnet` (default)

## Endpoints

- `POST /api/helius-webhook` — receives Helius webhook POSTs and writes to Supabase (`audit_logs`, `entries`, `raffles` updates).

## Notes

- Helius may send duplicate events. This webhook uses **(event_type, signature)** uniqueness to be idempotent.
- The static site (Hostinger) should only ever use **Supabase anon/publishable keys** for reads.


