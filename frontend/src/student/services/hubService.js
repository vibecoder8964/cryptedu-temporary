// ─────────────────────────────────────────────────────────────────────────────
// CryptEdu — services/hubService.js
// Child Hub detection + PocketBase client
// Ref: developer_skill.md §3 Hub Detection Logic, §3 Local Backend
// ─────────────────────────────────────────────────────────────────────────────

import useAppStore from '../store/appStore';

// ── Child Hub config ──────────────────────────────────────────────────────────
const HUB_BASE_URL    = 'http://192.168.1.1:8090';
const HUB_HEALTH_URL  = `${HUB_BASE_URL}/api/health`;
const DETECT_TIMEOUT  = 3000; // 3 seconds — as per developer_skill.md §3
const RECHECK_INTERVAL = 30_000; // re-ping every 30 seconds while app is open

// ── Hub detection ─────────────────────────────────────────────────────────────
/**
 * Pings the Child Hub health endpoint with a 3-second timeout.
 * Updates Zustand hubStatus to 'connected' or 'disconnected'.
 * Returns the status string.
 */
export const detectHub = async () => {
  const { setHubStatus, setLastSync } = useAppStore.getState();

  try {
    const res = await fetch(HUB_HEALTH_URL, {
      signal: AbortSignal.timeout(DETECT_TIMEOUT),
    });

    if (res.ok) {
      setHubStatus('connected');
      setLastSync(new Date().toLocaleTimeString('en-MY', {
        hour: '2-digit',
        minute: '2-digit',
      }));
      return 'connected';
    } else {
      setHubStatus('disconnected');
      return 'disconnected';
    }
  } catch {
    // Timeout or network error — hub not reachable
    setHubStatus('disconnected');
    return 'disconnected';
  }
};

// ── Auto-detect on app load ───────────────────────────────────────────────────
/**
 * Starts hub detection immediately, then re-checks every 30 seconds.
 * Call this once from App.jsx useEffect on mount.
 * Returns a cleanup function to stop the interval on unmount.
 */
export const startHubDetection = () => {
  // Set status to 'checking' immediately so UI can show a loading state
  useAppStore.getState().setHubStatus('checking');

  // Initial ping
  detectHub();

  // Periodic re-check
  const interval = setInterval(detectHub, RECHECK_INTERVAL);

  // Return cleanup fn
  return () => clearInterval(interval);
};

// ── Minimal PocketBase-compatible client ──────────────────────────────────────
// PocketBase exposes a REST API — we call it directly without the SDK
// to keep the bundle size minimal. The SDK can be added later if needed.
/**
 * hubClient — lightweight wrapper around the PocketBase REST API on the Child Hub.
 * Only used when hubStatus === 'connected'.
 */
export const hubClient = {
  baseUrl: HUB_BASE_URL,

  /**
   * GET records from a PocketBase collection.
   * @param {string} collection — e.g. 'lessons', 'progress', 'leaderboard'
   * @param {Object} params — optional query params { filter, sort, perPage }
   */
  async getList(collection, params = {}) {
    const query = new URLSearchParams({
      perPage: params.perPage ?? 50,
      ...(params.filter && { filter: params.filter }),
      ...(params.sort   && { sort:   params.sort }),
    });

    const res = await fetch(
      `${HUB_BASE_URL}/api/collections/${collection}/records?${query}`,
      { signal: AbortSignal.timeout(DETECT_TIMEOUT) }
    );

    if (!res.ok) throw new Error(`Hub error: ${res.status}`);
    return res.json();
  },

  /**
   * GET a single record by ID.
   */
  async getOne(collection, id) {
    const res = await fetch(
      `${HUB_BASE_URL}/api/collections/${collection}/records/${id}`,
      { signal: AbortSignal.timeout(DETECT_TIMEOUT) }
    );
    if (!res.ok) throw new Error(`Hub error: ${res.status}`);
    return res.json();
  },

  /**
   * POST a new record.
   */
  async create(collection, data) {
    const res = await fetch(
      `${HUB_BASE_URL}/api/collections/${collection}/records`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
        signal:  AbortSignal.timeout(DETECT_TIMEOUT),
      }
    );
    if (!res.ok) throw new Error(`Hub error: ${res.status}`);
    return res.json();
  },

  /**
   * PATCH an existing record.
   */
  async update(collection, id, data) {
    const res = await fetch(
      `${HUB_BASE_URL}/api/collections/${collection}/records/${id}`,
      {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
        signal:  AbortSignal.timeout(DETECT_TIMEOUT),
      }
    );
    if (!res.ok) throw new Error(`Hub error: ${res.status}`);
    return res.json();
  },
};

export default hubClient;
