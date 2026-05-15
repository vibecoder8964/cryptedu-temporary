// ─────────────────────────────────────────────────────────────────────────────
// CryptEdu — services/authService.js (Merged App)
// End-user authentication via backend JWT (/api/end-users/login)
// NO AWS Amplify — admin uses Cognito separately in App.tsx
// ─────────────────────────────────────────────────────────────────────────────

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
 */
export const loginUser = async (username, password) => {
  const res = await fetch('/api/end-users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
 * Logout — clear localStorage session.
 */
export const logoutUser = async () => {
  clearSession();
};

/**
 * Check if a student session exists (synchronous).
 */
export const isStudentLoggedIn = () => {
  return getSession() !== null;
};
