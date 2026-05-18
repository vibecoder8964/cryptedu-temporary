// ─────────────────────────────────────────────────────────────────────────────
// CryptEdu — services/endUserStateService.js
//
// Per-end-user state and chat persistence over the new backend routes
// added in spec task 2.14:
//
//   GET  /api/end-users/state                   → { state: {[key]: value_json} }
//   POST /api/end-users/state                   ← { key, value_json }
//   GET  /api/end-users/chat?video_key=...      → { messages: [...] }
//   POST /api/end-users/chat                    ← { video_key, role, text }
//
// Implements Requirement 1.10 (per-end-user cache, storage, and history
// MUST live server-side, scoped to ``end_user_accounts.id`` resolved
// from the session cookie). The frontend treats ``localStorage`` only as
// a transient cache: ``zustand``'s ``persist`` middleware still mirrors
// the active store into ``localStorage`` for instant re-renders on
// reload, but the canonical record is what the server returns next.
//
// All requests use ``credentials: 'include'`` so the
// ``session_token`` cookie issued by ``POST /api/end-users/login``
// (task 2.10) is sent on every call. The cookie carries the only
// caller identity the backend trusts — no body field of these requests
// names ``end_user_id``.
//
// Errors: every helper throws on a non-2xx response with the backend's
// ``detail`` string preserved verbatim, so the UI can surface the
// actual reason instead of a polished placeholder (Requirement 2.2's
// no-AI_BUSY_MSG rule applied to the persistence layer too).
// ─────────────────────────────────────────────────────────────────────────────

// Vite injects ``import.meta.env.VITE_API_URL`` from .env.* at build time.
// In dev it is empty (the Vite server proxies /api to the backend); in
// production the API Gateway URL is supplied. Falling back to the empty
// string keeps relative-path requests working in both modes.
const API_BASE = (import.meta.env && import.meta.env.VITE_API_URL) || '';

const COMMON_FETCH_OPTS = {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
};

// Pull the backend ``detail`` (or any sensible fallback) off a non-2xx
// response so the caller receives a real reason. Wrapped in a helper
// because every route uses the same shape.
const _extractDetail = async (res, fallback) => {
  try {
    const body = await res.json();
    if (body && typeof body.detail === 'string') return body.detail;
  } catch {
    // Body was not JSON — fall through to the fallback string.
  }
  return fallback;
};

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch every persisted state row for the authenticated end user and
 * return them as a ``Record<string, any>`` keyed by ``state_key``.
 *
 * The backend stores values verbatim as JSON-encoded strings (see
 * ``EndUserStateUpdateRequest`` and the ``end_user_state`` table
 * schema). This helper deserialises each value before handing it back,
 * so callers receive native JS objects/arrays/primitives. If a single
 * value is not valid JSON it is returned as-is — defensive against
 * historical rows written by older code paths.
 *
 * @returns {Promise<Record<string, any>>}
 * @throws {Error} when the request is rejected (401 typically means the
 *   user is not authenticated as an end user; the caller may treat that
 *   as a signal to fall back to the legacy Cognito attribute path).
 */
export const loadEndUserState = async () => {
  const res = await fetch(`${API_BASE}/api/end-users/state`, {
    method: 'GET',
    ...COMMON_FETCH_OPTS,
  });
  if (!res.ok) {
    const detail = await _extractDetail(res, `state load failed (HTTP ${res.status})`);
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const raw = (data && data.state) || {};
  const out = {};
  for (const [key, valueJson] of Object.entries(raw)) {
    if (typeof valueJson !== 'string') {
      out[key] = valueJson;
      continue;
    }
    try {
      out[key] = JSON.parse(valueJson);
    } catch {
      out[key] = valueJson;
    }
  }
  return out;
};

/**
 * Upsert a single state row for the authenticated end user.
 *
 * The backend uses ``ON CONFLICT(end_user_id, state_key) DO UPDATE`` so
 * re-posting the same key replaces the value. The value is JSON-encoded
 * here (rather than at the call site) to keep the wire contract
 * uniform: ``value_json`` is always a string.
 *
 * @param {string} key  - non-empty state key (e.g. ``"progress"``).
 * @param {*}      value - any JSON-serialisable JS value.
 * @returns {Promise<void>}
 * @throws {Error} on a non-2xx response. ``error.status`` carries the
 *   HTTP status so the caller can branch on 401.
 */
export const saveEndUserState = async (key, value) => {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('saveEndUserState: key must be a non-empty string');
  }
  const res = await fetch(`${API_BASE}/api/end-users/state`, {
    method: 'POST',
    ...COMMON_FETCH_OPTS,
    body: JSON.stringify({ key, value_json: JSON.stringify(value) }),
  });
  if (!res.ok) {
    const detail = await _extractDetail(res, `state save failed (HTTP ${res.status})`);
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Chat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the most recent 50 chat turns for ``(current_end_user, video_key)``
 * in chronological (oldest-first) order — exactly the page size the
 * backend returns by default.
 *
 * @param {string} videoKey - the S3 video key the chat is scoped to.
 * @returns {Promise<Array<{id:number, video_key:string, role:'student'|'tutor',
 *                          text:string, created_at:string}>>}
 * @throws {Error} on a non-2xx response.
 */
export const loadEndUserChat = async (videoKey) => {
  if (typeof videoKey !== 'string' || videoKey.length === 0) {
    throw new Error('loadEndUserChat: videoKey must be a non-empty string');
  }
  const url = `${API_BASE}/api/end-users/chat?video_key=${encodeURIComponent(videoKey)}`;
  const res = await fetch(url, { method: 'GET', ...COMMON_FETCH_OPTS });
  if (!res.ok) {
    const detail = await _extractDetail(res, `chat load failed (HTTP ${res.status})`);
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return Array.isArray(data?.messages) ? data.messages : [];
};

/**
 * Append a single chat turn for ``(current_end_user, video_key)``.
 *
 * @param {string} videoKey - the S3 video key the chat is scoped to.
 * @param {'student'|'tutor'} role - author of the turn.
 * @param {string} text - the turn body, accepted as-is by the backend.
 * @returns {Promise<void>}
 * @throws {Error} on a non-2xx response. The backend rejects ``role``
 *   values outside the allow-list with HTTP 400 and a short detail.
 */
export const appendEndUserChat = async (videoKey, role, text) => {
  if (typeof videoKey !== 'string' || videoKey.length === 0) {
    throw new Error('appendEndUserChat: videoKey must be a non-empty string');
  }
  if (role !== 'student' && role !== 'tutor') {
    throw new Error("appendEndUserChat: role must be 'student' or 'tutor'");
  }
  const res = await fetch(`${API_BASE}/api/end-users/chat`, {
    method: 'POST',
    ...COMMON_FETCH_OPTS,
    body: JSON.stringify({ video_key: videoKey, role, text: String(text ?? '') }),
  });
  if (!res.ok) {
    const detail = await _extractDetail(res, `chat append failed (HTTP ${res.status})`);
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// localStorage transient-cache hygiene
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drop the ``cryptedu-state`` ``localStorage`` entry written by
 * ``zustand/middleware``'s ``persist``. Called on login so a freshly
 * authenticated end user never inherits the previous account's
 * progress / quiz results / chat history from the same browser
 * (Requirement 1.8 — per-account isolation extends to client-side
 * caches).
 *
 * Safe to call when the key is absent or when ``localStorage`` is
 * unavailable (e.g. a test environment without ``window``).
 */
export const invalidateLocalStateCache = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('cryptedu-state');
    }
  } catch {
    // Ignore — localStorage may be blocked (private mode, SSR test).
  }
};
