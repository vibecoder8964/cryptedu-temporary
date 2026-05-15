// ─────────────────────────────────────────────────────────────────────────────
// CryptEdu — services/aiService.js
// AI Tutor + Essay Grading + Quiz Generation
// All requests go through the backend proxy (/api/ai/*)
// ─────────────────────────────────────────────────────────────────────────────

import useAppStore from '../store/appStore';

// ── Endpoints ─────────────────────────────────────────────────────────────────
const OLLAMA_MODEL = 'cryptedu-ai';
const TIMEOUT_MS   = 300_000; // 5 mins

const AI_BUSY_MSG  = "I am still being fine-tuned, so I will need more time to answer your question :)";

// ─────────────────────────────────────────────────────────────────────────────
// TUTOR — askTutor()
// ─────────────────────────────────────────────────────────────────────────────
export const askTutor = async (message, conversationHistory = []) => {
const systemPrompt =
`You are an educational assistant designed strictly for school and academic use.

## Allowed subjects
You may ONLY answer questions related to these school subjects:
- Mathematics (Arithmetic, Algebra, Geometry, Calculus, Statistics)
- Science (Physics, Chemistry, Biology, Environmental Science)
- English Language (Grammar, Comprehension, Essay writing, Literature)
- History and Geography
- Economics and Accounting
- Computer Science and ICT
- Bahasa Malaysia / Malay Language
- Moral Education and Civic Studies

## Declining non-educational requests
CRITICAL RULE: If the user asks ANY question that is NOT related to the school subjects above (for example, sports, World Cup, entertainment, or general knowledge), you MUST NOT answer the question. You MUST respond with exactly:
"This is not under my expertise."

Do NOT engage with:
- Entertainment (anime, games, movies, music, sports, World Cup)
- Social media or internet culture
- Personal opinions or debates
- Fictional character comparisons or fights
- Any topic not directly tied to a school curriculum

## When answering educational questions
1. Read the full question before answering.
2. State which subject and topic the question falls under.
3. Show all working steps clearly for math and science.
4. Verify results before presenting them.
5. If a problem is ill-posed or contains an error, flag it clearly.
6. When forming equations, use neutral variables (t, k) to avoid confusion with previously solved variables.
7. Always respond in the same language the user writes in.
8. For mathematical expressions involving exponents, ALWAYS use actual Unicode superscript characters (e.g. x², y³, 2ˣ) instead of the ^ symbol (e.g. DO NOT use x^2 or 2^x).`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10).map(msg => ({
      role:    msg.role === 'student' ? 'user' : 'assistant',
      content: msg.text,
    })),
    { role: 'user', content: message },
  ];

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: { temperature: 0.1, min_p: 0.1 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) throw new Error(`AI error: ${response.status}`);

    const data = await response.json();
    const text = data.message?.content || data.response || AI_BUSY_MSG;
    return { success: true, text: text.trim() };

  } catch (error) {
    console.error('[CryptEdu Tutor] Error:', error?.name, error?.message);
    return { success: false, text: AI_BUSY_MSG };
  }
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

  throw new Error(AI_BUSY_MSG);
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
export const generateQuizQuestions = async (userPrompt) => {
  try {
    const res = await fetch('/api/ai/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: userPrompt }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error('[CryptEdu Quiz] Backend HTTP error:', res.status, res.statusText);
    } else {
      const data    = await res.json();
      const content = data.message?.content || '';
      console.log('[CryptEdu Quiz] Raw AI response:', content.slice(0, 300));
      const cleaned = content
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('[CryptEdu Quiz] Successfully parsed', parsed.length, 'questions');
            return parsed.map(q => ({ ...q, type: 'mcq' }));
          }
        } catch (parseErr) {
          console.error('[CryptEdu Quiz] JSON parse failed:', parseErr.message);
        }
      } else {
        console.warn('[CryptEdu Quiz] No JSON array found in response.');
      }
    }
  } catch (err) {
    console.error('[CryptEdu Quiz] AI call failed:', err?.name, err?.message);
  }

  throw new Error(AI_BUSY_MSG);
};
