// ─────────────────────────────────────────────────────────────────────────────
// CryptEdu — services/userDataService.js
//
// Hydrates the End_User_App store on login and persists progress / quiz
// results / streak between sessions. As of spec task 2.20 the canonical
// store is the backend (per-end-user state and chat tables exposed via
// ``/api/end-users/state`` and ``/api/end-users/chat`` — Requirement 1.10).
// The legacy Cognito ``custom:app_data`` attribute path is kept as a
// fallback only so a still-Amplify-backed student session does not
// regress while the migration to backend cookies completes.
//
// ``localStorage`` is no longer the source of truth for progress /
// quizResults / streak. Zustand's ``persist`` middleware still mirrors
// the active store into ``localStorage`` for instant re-renders on
// reload, but ``loadUserData`` invalidates that mirror on every login
// so a freshly authenticated end user never inherits a previous
// account's data on the same browser (Requirement 1.8 isolation).
// ─────────────────────────────────────────────────────────────────────────────

import useAppStore from '../store/appStore';
import {
  loadEndUserState,
  saveEndUserState,
  invalidateLocalStateCache,
} from './endUserStateService';

// ── Public entry: load on login ──────────────────────────────────────────────

/**
 * Hydrate the store with the freshly authenticated user's profile and
 * persisted state. Intended to be called from the route guard right
 * after ``getCurrentUser()`` resolves.
 *
 * The flow is:
 *   1. Drop the persisted ``cryptedu-state`` entry from ``localStorage``
 *      so the previous user's mirror cannot bleed through (transient
 *      cache invalidation on login).
 *   2. Set the profile-shaped ``currentUser`` and ``userRole`` slices.
 *   3. Demo / teacher roles take their canned data and return early —
 *      the test fixture for ``Test_1`` was not part of the new server
 *      contract and is preserved verbatim.
 *   4. Real students attempt to load progress / quizResults / streak
 *      from ``/api/end-users/state``. On 200 the response replaces the
 *      store. On 401 (no session cookie) or any other failure, fall
 *      back to the legacy Cognito ``custom:app_data`` attribute so the
 *      old auto-login path keeps working.
 *
 * @param {{username?:string}} user
 * @param {Record<string, string|undefined>} attributes
 * @returns {Promise<void>}
 */
export const loadUserData = async (user, attributes) => {
  // Step 1 — invalidate the per-browser cache before touching the
  // store, so a re-render that fires while the server fetch is in
  // flight cannot quote stale data from another account.
  invalidateLocalStateCache();

  const store = useAppStore.getState();
  const username = user?.username || '';
  const role = attributes['custom:role'] || 'student';

  if (role === 'teacher') {
    store.setCurrentUser({
      username,
      email: attributes.email,
      name: attributes.name,
      role,
      school_node: attributes['custom:school_node'],
      subject: attributes['custom:subject'],
    });
    store.setUserRole(role);
    return;
  }

  if (username === 'Test_1' || attributes?.email?.toLowerCase().includes('test_1')) {
    // Demo user: deterministic seed data baked into the client. The
    // backend has no row for this account, so we never hit the server.
    store.setCurrentUser({
      username,
      email: attributes.email,
      name: 'Ahmad Firdaus',
      role,
      grade: 'Tingkatan 4',
      village: 'Kg. Baru',
      school_node: 'SK Kg. Baru Node',
    });
    store.setUserRole(role);
    store.setStreak(7);

    useAppStore.setState({
      progress: {
        '1': 65,
        '2': 30,
        '3': 90,
        '4': 10,
        '5': 45,
      },
      quizResults: [
        { lessonId: '1', score: 4, total: 5, date: '10/05/2026', subject: 'Science' },
        { lessonId: '2', score: 3, total: 5, date: '09/05/2026', subject: 'Mathematics' },
        { lessonId: '3', score: 5, total: 5, date: '08/05/2026', subject: 'Bahasa Malaysia' },
        { lessonId: '4', score: 2, total: 5, date: '07/05/2026', subject: 'History' },
        { lessonId: '5', score: 4, total: 5, date: '06/05/2026', subject: 'English' },
      ],
    });
    return;
  }

  // Real student account — set the profile slice from whatever the
  // session carrier (backend cookie path or Cognito attribute path)
  // surfaced, so the UI can render the header even before the state
  // payload arrives.
  store.setCurrentUser({
    username,
    email: attributes.email,
    name: attributes.name || 'Student',
    role,
    grade: attributes['custom:grade'] || '',
    village: attributes['custom:village'] || '',
    school_node: attributes['custom:school_node'] || '',
  });
  store.setUserRole(role);

  // Step 4 — try the backend first (canonical, multi-device
  // synchronisation per Requirement 1.10), then fall back to the
  // legacy Cognito attribute payload only if the backend is not
  // reachable or the user is not authenticated against it.
  const fetched = await _loadStateFromBackend();
  if (fetched) {
    _applyStateToStore(fetched);
    return;
  }

  _applyStateFromCognitoAttribute(attributes);
};

// ── Public entry: save on every store mutation ───────────────────────────────
//
// ``App.tsx`` calls ``saveProgressToCloud`` from a ``useEffect`` that
// fires whenever ``progress``, ``quizResults`` or ``streak`` change.
// The 3-second debounce stays — bursty writes (e.g. a quiz that
// addQuizResult-s once per question) collapse into a single backend
// call.

let syncTimeout = null;

/**
 * Persist the current store's progress, quizResults and streak to the
 * backend. Debounced 3 seconds so a burst of writes (a quiz finishing,
 * five rapid progress ticks while watching a lesson) collapses into
 * one call. Idempotent — re-firing replaces whatever is on the server.
 *
 * Returns nothing; failures are logged to the console because the
 * caller is a fire-and-forget effect.
 */
export const saveProgressToCloud = () => {
  if (syncTimeout) clearTimeout(syncTimeout);

  syncTimeout = setTimeout(async () => {
    const store = useAppStore.getState();
    const username = store.currentUser?.username;

    // Skip when there is no active session or for the demo seed —
    // both branches produce no row on the server.
    if (!store.isAuthenticated || username === 'Test_1') return;

    // Try the backend first. The three slices are written under
    // separate keys so the End_User_App can read them back
    // independently, and so a write that races with another tab does
    // not clobber unrelated state. ``await Promise.all`` keeps the
    // round-trip count down to one batch.
    const writes = [
      ['progress', store.progress],
      ['quizResults', store.quizResults],
      ['streak', store.streak],
    ];
    try {
      await Promise.all(writes.map(([k, v]) => saveEndUserState(k, v)));
      return;
    } catch (e) {
      // 401 here means the End_User_App authenticated against the
      // legacy Cognito flow (no backend cookie), so the natural
      // fallback is the Cognito custom-attribute writer below. Any
      // other status is a real backend error worth logging.
      if (!_isAuthError(e)) {
        console.error('Failed to sync progress to backend', e);
      }
    }

    // Legacy fallback: write the same three slices into the Cognito
    // ``custom:app_data`` attribute. Preserved so a still-Amplify
    // session keeps round-tripping until backend cookies replace it
    // everywhere.
    try {
      const { updateUserAttributes } = await import('aws-amplify/auth');
      const appData = JSON.stringify({
        progress: store.progress,
        quizResults: store.quizResults,
        streak: store.streak,
      });
      await updateUserAttributes({
        userAttributes: { 'custom:app_data': appData },
      });
    } catch (e) {
      console.error('Failed to sync progress (legacy Cognito path)', e);
    }
  }, 3000);
};

// ── Internals ────────────────────────────────────────────────────────────────

/**
 * Load progress / quizResults / streak from
 * ``GET /api/end-users/state``. Returns ``null`` when the call fails
 * for any reason — the caller falls back to the Cognito attribute
 * path. Returning ``null`` rather than throwing keeps the call site
 * one branch.
 *
 * @returns {Promise<{progress:object, quizResults:any[], streak:number}|null>}
 */
const _loadStateFromBackend = async () => {
  try {
    const state = await loadEndUserState();
    return {
      progress: (state && state.progress) || {},
      quizResults: Array.isArray(state && state.quizResults) ? state.quizResults : [],
      streak: typeof (state && state.streak) === 'number' ? state.streak : 0,
    };
  } catch (e) {
    if (!_isAuthError(e)) {
      console.warn('End-user state backend load failed; falling back', e);
    }
    return null;
  }
};

/**
 * Apply a triple of (progress, quizResults, streak) to the store.
 * Lifted out of both load paths so a future addition (e.g. a fourth
 * persisted slice) only has to change one place.
 */
const _applyStateToStore = ({ progress, quizResults, streak }) => {
  useAppStore.getState().setStreak(streak || 0);
  useAppStore.setState({
    progress: progress || {},
    quizResults: quizResults || [],
  });
};

/**
 * Legacy fallback — parse the Cognito ``custom:app_data`` attribute
 * shape used before task 2.20. This is the exact code path that lived
 * in this file before the refactor; it is kept verbatim so any user
 * still authenticated through Amplify continues to see their data.
 */
const _applyStateFromCognitoAttribute = (attributes) => {
  let loadedProgress = {};
  let loadedQuizResults = [];
  let loadedStreak = 0;

  if (attributes && attributes['custom:app_data']) {
    try {
      const data = JSON.parse(attributes['custom:app_data']);
      loadedProgress = data.progress || {};
      loadedQuizResults = data.quizResults || [];
      loadedStreak = data.streak || 0;
    } catch (e) {
      console.error('Failed to parse app_data', e);
    }
  }

  _applyStateToStore({
    progress: loadedProgress,
    quizResults: loadedQuizResults,
    streak: loadedStreak,
  });
};

/**
 * Recognise the "no end-user session cookie" case so the caller can
 * silently fall back to the legacy path instead of logging noise.
 * 401 is what the backend's ``get_current_end_user_id`` raises for an
 * unauthenticated request; ``status`` is set by the helpers in
 * ``endUserStateService``.
 */
const _isAuthError = (e) => {
  if (!e || typeof e !== 'object') return false;
  return e.status === 401 || e.status === 403;
};
