// ─────────────────────────────────────────────────────────────────────────────
// CryptEdu — services/aiService.js
// AI Tutor + Essay Grading + Quiz Generation
// All requests go through the backend proxy (/api/ai/*)
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ─────────────────────────────────────────────────────────────────
const LOCAL_AI_TUTOR_MODEL = 'cryptedu-ai';
const TIMEOUT_MS           = 300_000; // 5 mins

// ─────────────────────────────────────────────────────────────────────────────
// TUTOR — askTutor()
// ─────────────────────────────────────────────────────────────────────────────
export const askTutor = async (message, conversationHistory = [], topicScope) => {
  const messages = [
    ...conversationHistory.slice(-10).map(msg => ({
      role:    msg.role === 'student' ? 'user' : 'assistant',
      content: msg.text,
    })),
    { role: 'user', content: message },
  ];

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      topic_scope: topicScope,
      options: { temperature: 0.1, min_p: 0.1 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || data.code || 'AI error');
  }

  const data = await response.json();
  return { success: true, text: data.message?.content };
};

// ─────────────────────────────────────────────────────────────────────────────
// ESSAY GRADING — gradeEssay()
// ─────────────────────────────────────────────────────────────────────────────
export const gradeEssay = async (essayText, subject = 'Bahasa Malaysia') => {
  try {
    const res = await fetch('/api/ai/grade-essay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ essay_text: essayText, subject }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.ok) {
      const data = await res.json();
      const parsed = _parseGradeJson(data.message?.content || data.response || '');
      if (parsed) return parsed;
    }
  } catch (err) {
    console.error('[CryptEdu Tutor] Grade Essay Error:', err?.name, err?.message);
  }

  throw new Error('Essay grading failed');
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────
const _parseGradeJson = (rawText) => {
  try {
    const cleaned = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const parsed = JSON.parse(cleaned);

    if (
      typeof parsed.overall   === 'number' &&
      typeof parsed.content   === 'number' &&
      typeof parsed.language  === 'number' &&
      typeof parsed.structure === 'number' &&
      typeof parsed.feedback  === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ GENERATOR — generateQuizQuestions()
// ─────────────────────────────────────────────────────────────────────────────
export const generateQuizQuestions = async (prompt, topicScope, format) => {
  const res = await fetch('/api/ai/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, topic_scope: topicScope, format }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || data.code || 'Quiz generation error');
  }

  const data = await res.json();
  return data.questions;
};
