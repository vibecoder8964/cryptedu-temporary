// ─────────────────────────────────────────────────────────────────────────────
// CryptEdu — services/authService.js (Merged App)
// End-user authentication via backend JWT (/api/end-users/login)
// NO AWS Amplify — admin uses Cognito separately in App.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { invalidateLocalStateCache } from './endUserStateService';

const SESSION_KEY = 'cryptedu_student_session';

// ── Session helpers ─────────────────────────────────────────────────────────
const getSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
};

const setSession = (data) => localStorage.setItem(SESSION_KEY, JSON.stringify(data));
const clearSession = () => localStorage.removeItem(SESSION_KEY);

// ── Auth Methods ────────────────────────────────────────────────────────────

/**
 * Login end-user via backend endpoint.
 * Default seeded user: roshi / 012345
 *
 * On a successful login the persisted ``cryptedu-state`` localStorage
 * cache is invalidated so a freshly authenticated end user does not
 * inherit the previously-signed-in account's progress / quiz results
 * / chat history from the same browser (Requirement 1.8 isolation).
 * The canonical record lives server-side; ``loadUserData`` rehydrates
 * the store from the backend right after this resolves.
 */
export const loginUser = async (username, password) => {
  const res = await fetch('/api/end-users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Incorrect username or password.');
  }

  const data = await res.json();
  const session = {
    username: data.user.username,
    full_name: data.user.full_name || username,
    role: data.user.role || 'student',
  };
  setSession(session);

  // Drop the persisted store mirror left over from any previous
  // session on this browser before the route guard rehydrates from
  // the backend.
  invalidateLocalStateCache();

  return { isSignedIn: true, user: session };
};

/**
 * Get current logged-in student from localStorage session.
 */
export const getCurrentUser = async () => {
  const session = getSession();
  if (!session) {
    throw new Error('User is not authenticated');
  }
  return {
    user: { username: session.username, userId: 'local-' + session.username },
    attributes: {
      name: session.full_name || session.username,
      'custom:role': session.role || 'student',
      'custom:grade': session.grade || 'Tingkatan 3',
      'custom:village': session.village || '',
      'custom:school_node': session.school_node || '',
      'custom:parent_phone': '',
      'custom:subject': '',
    }
  };
};

/**
 * Logout — clear localStorage session and the persisted store mirror
 * so the next user signing in on this browser starts fresh.
 */
export const logoutUser = async () => {
  clearSession();
  invalidateLocalStateCache();
};

/**
 * Check if a student session exists (synchronous).
 */
export const isStudentLoggedIn = () => {
  return getSession() !== null;
};
