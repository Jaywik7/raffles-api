const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HELIUS_WEBHOOK_AUTH = process.env.HELIUS_WEBHOOK_AUTH;
const RAFFLE_PROGRAM_ID = process.env.RAFFLE_PROGRAM_ID || '';
const CHAIN = process.env.CHAIN || 'devnet';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getSupabaseAdmin() {
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function safeString(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

function normalizeAuthHeader(v) {
  return safeString(v).trim();
}

function stripBearer(v) {
  const s = normalizeAuthHeader(v);
  return s.toLowerCase().startsWith('bearer ') ? s.slice(7).trim() : s;
}

function fingerprintAuthToken(v) {
  // Produce a short, non-reversible fingerprint for debugging auth mismatches without leaking secrets.
  const token = stripBearer(v);
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 12);
}

function extractSignature(evt) {
  return safeString(evt?.signature || evt?.transactionSignature || evt?.id);
}

function extractEventType(evt) {
  return safeString(evt?.type || evt?.description || 'UNKNOWN');
}

async function readJsonBody(req) {
  // Vercel usually provides req.body, but depending on runtime/config it can be undefined or a string.
  if (req?.body && typeof req.body === 'object') return req.body;
  if (typeof req?.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return null; }
  }
  // Fallback: read raw stream
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function looksLikeRaffleProgramEvent(evt) {
  if (!RAFFLE_PROGRAM_ID) return true; // allow all if not configured yet
  try {
    // Enhanced webhooks sometimes include accountData[] entries.
    const accData = Array.isArray(evt?.accountData) ? evt.accountData : [];
    const anyMatches = accData.some((a) => safeString(a?.account) === RAFFLE_PROGRAM_ID);
    if (anyMatches) return true;
  } catch (_) {}
  // We still accept and log; filtering is mainly done in the Helius webhook config.
  return true;
}

/**
 * Vercel Serverless Function: /api/helius-webhook
 *
 * Security model (Helius docs):
 * - Set `authHeader` when creating the webhook; Helius echoes it in `Authorization`.
 * - We verify `req.headers.authorization` === `HELIUS_WEBHOOK_AUTH`.
 *
 * Idempotency:
 * - Helius may retry/deliver duplicates.
 * - `audit_logs` has UNIQUE(event_type, signature) so inserts are safe to retry.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    if (!HELIUS_WEBHOOK_AUTH) {
      return json(res, 500, { error: 'Server misconfigured: missing HELIUS_WEBHOOK_AUTH' });
    }
    const auth = normalizeAuthHeader(req.headers?.authorization);
    const expected = normalizeAuthHeader(HELIUS_WEBHOOK_AUTH);
    // Accept either exact match OR token match (allows env var to be set with or without "Bearer " prefix)
    if (auth !== expected && stripBearer(auth) !== stripBearer(expected)) {
      return json(res, 401, {
        error: 'Unauthorized',
        hint: 'Authorization header does not match HELIUS_WEBHOOK_AUTH (Production). Ensure env var is set without quotes and redeployed.',
        expectedFingerprint: fingerprintAuthToken(expected),
        receivedFingerprint: fingerprintAuthToken(auth),
      });
    }

    const body = await readJsonBody(req);
    if (!body) return json(res, 400, { error: 'Invalid JSON body' });
    const events = Array.isArray(body) ? body : [body];
    const supabase = getSupabaseAdmin();

    let insertedAudit = 0;
    let skippedAudit = 0;

    for (const evt of events) {
      if (!evt || !looksLikeRaffleProgramEvent(evt)) continue;

      const signature = extractSignature(evt);
      const eventType = extractEventType(evt);
      if (!signature) continue;

      // Always store the raw event payload for now. We'll map specific event types to
      // raffles/entries updates once your Anchor program IDL + event names are final.
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          chain: CHAIN,
          event_type: eventType,
          signature,
          payload: evt,
        });

      if (error) {
        // Unique constraint violations are expected on retries (idempotency).
        const msg = safeString(error.message);
        if (msg.toLowerCase().includes('duplicate') || safeString(error.code) === '23505') {
          skippedAudit++;
          continue;
        }
        throw error;
      }
      insertedAudit++;
    }

    return json(res, 200, { ok: true, insertedAudit, skippedAudit });
  } catch (e) {
    return json(res, 500, { error: e?.message || 'Unknown error' });
  }
};


