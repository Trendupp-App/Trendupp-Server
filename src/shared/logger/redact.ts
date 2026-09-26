/**
 * Strips secrets and Platform Data out of log records before any transport
 * sees them.
 *
 * Several integrations used to log a whole upstream payload when it failed to
 * match the expected shape — InstagramAuthService serialised the *token*
 * response, which carries `access_token` and `user_id`. In production every log
 * line is shipped to Logtail (Better Stack), so an unexpected payload shape was
 * enough to hand a live Meta user access token to a third-party log sink. Those
 * call sites now log only the key names.
 *
 * Redaction lives here rather than at each call site because the call sites are
 * the part nobody audits: a new integration that logs a payload is safe by
 * default, and the fix cannot be forgotten in review.
 */

/**
 * Keys whose values must never be logged.
 *
 * Ordered longest-first so that alternation prefers `access_token` over the
 * shorter `token` — the anchors make this unnecessary for well-formed input,
 * but it keeps the match predictable for malformed input too.
 */
const SENSITIVE_KEYS = [
  'refresh_token',
  'code_verifier',
  'client_secret',
  'authorization',
  'access_token',
  'app_secret',
  'id_token',
  'password',
  'secret',
  'token',
  'code',
] as const;

const SENSITIVE_KEY_SET = new Set<string>(SENSITIVE_KEYS);

/** camelCase spellings of the same fields, as used on our own entities. */
const SENSITIVE_CAMEL_KEYS = new Set([
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'clientsecret',
  'appsecret',
  'codeverifier',
]);

const KEY_ALTERNATION = SENSITIVE_KEYS.join('|');

/** `"access_token": "IGAA…"` inside a JSON.stringify'd payload. */
const JSON_PAIR = new RegExp(`("(?:${KEY_ALTERNATION})"\\s*:\\s*)"[^"]*"`, 'gi');

/** `access_token=IGAA…` in a query string or form body. */
const QUERY_PAIR = new RegExp(`\\b(${KEY_ALTERNATION})=([^&\\s"']+)`, 'gi');

/** `Bearer IGAA…` in a header dump. */
const BEARER = /\b(Bearer)\s+[\w.\-]+/gi;

/** Redacts secret-looking values inside an already-serialised string. */
export function redactSecrets(value: string): string {
  return value
    .replace(JSON_PAIR, '$1"[REDACTED]"')
    .replace(QUERY_PAIR, '$1=[REDACTED]')
    .replace(BEARER, '$1 [REDACTED]');
}

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_SET.has(lower) || SENSITIVE_CAMEL_KEYS.has(lower);
}

/**
 * Redacts a winston `info` record **in place**.
 *
 * In place, because winston carries `Symbol.for('level')` and
 * `Symbol.for('message')` on the record and rebuilding the object with
 * `Object.entries` would silently drop them — which breaks level routing
 * downstream. Depth is bounded so a deep or hostile object cannot stall the
 * logger.
 */
export function redactInPlace(value: unknown, depth = 0): void {
  if (depth > 6 || value === null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const item: unknown = value[i];
      if (typeof item === 'string') value[i] = redactSecrets(item);
      else redactInPlace(item, depth + 1);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (isSensitiveKey(key)) {
      record[key] = '[REDACTED]';
      continue;
    }
    const child: unknown = record[key];
    if (typeof child === 'string') record[key] = redactSecrets(child);
    else redactInPlace(child, depth + 1);
  }
}
