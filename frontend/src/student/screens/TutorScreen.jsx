// CryptEdu — screens/TutorScreen.jsx
// AI Tutor chat — Layout B
// Ref: developer_skill.md §6 Screen 6, design_guidelines.md §6 Chat Bubbles

import { useState, useRef, useEffect } from 'react';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';
import useAppStore from '../store/appStore';
import { askTutor, gradeEssay } from '../services/aiService';
import { loadEndUserChat, appendEndUserChat } from '../services/endUserStateService';
import LoadingDots from '../components/LoadingDots';

const CHIPS = [
  'Assess My Essay',
  'Check My Answer',
  'Give Me a Hint',
  'Generate a Quiz Question',
  'Explain This Again',
  'Real-Life Example',
];

const WELCOME = {
  role: 'tutor',
  text: "Assalamualaikum! I'm your Local AI Tutor. I'm here to help you understand any topic, answer your questions, or assess your essays using the KPM rubric. What would you like to do today?",
};

export default function TutorScreen() {
  const { currentLesson, tutorHistory, addTutorMessage, clearTutorHistory } = useAppStore();
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // The chat is scoped per video (currentLesson.id doubles as the
  // ``video_key`` everywhere else in the End_User_App). When the
  // screen mounts (or the active lesson changes) the persisted chat
  // turns for ``(end_user_id, video_key)`` are loaded from
  // ``GET /api/end-users/chat``; on a fresh login this is the path
  // that brings in history written from another browser
  // (Requirement 1.10 cross-device sync).
  useEffect(() => {
    let cancelled = false;
    const videoKey = currentLesson?.id;
    if (!videoKey) return;
    (async () => {
      try {
        const messages = await loadEndUserChat(videoKey);
        if (cancelled) return;
        // Replace the in-memory history with the server's view rather
        // than appending — the server is the canonical record. The
        // map shape lines up with the existing tutorHistory entries
        // ({role, text, timestamp}) so the rest of the screen does
        // not need to know about the persistence layer.
        clearTutorHistory();
        for (const m of messages) {
          addTutorMessage({
            role: m.role,
            text: m.text,
          });
        }
      } catch (e) {
        // 401 just means the end user is on the legacy session path;
        // any other error is logged and the screen carries on with
        // the in-memory store.
        if (!e || (e.status !== 401 && e.status !== 403)) {
          console.warn('Tutor chat history load failed', e);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLesson?.id]);

  const messages = tutorHistory.length > 0 ? tutorHistory : [WELCOME];

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tutorHistory, loading]);

  const send = async (text) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput('');

    addTutorMessage({ role: 'student', text: msg });
    // Persist the student turn server-side. Fire-and-forget: if the
    // user is on the legacy session path (no backend cookie) the
    // 401 is swallowed; any other failure is logged but does not
    // block the chat — the in-memory store keeps the conversation
    // alive for the active session.
    const videoKey = currentLesson?.id;
    if (videoKey) {
      appendEndUserChat(videoKey, 'student', msg).catch((e) => {
        if (!e || (e.status !== 401 && e.status !== 403)) {
          console.warn('Tutor chat student-turn persist failed', e);
        }
      });
    }
    setLoading(true);

    let response = '';

    if (msg === 'Assess My Essay') {
      response = "I'd be happy to assess your essay! Please paste your karangan or English essay below, and I will grade it using the KPM rubric.";
    } else if (msg.length > 250) {
      // If the message is long, assume it's an essay to be graded
      try {
        const grade = await gradeEssay(msg, currentLesson?.subject || 'Bahasa Malaysia');
        response = `📝 **Essay Assessment Complete**\n\n` +
                   `**Overall Score**: ${grade.overall} / 100\n` +
                   `• Content: ${grade.content} / 40\n` +
                   `• Language: ${grade.language} / 40\n` +
                   `• Structure: ${grade.structure} / 20\n\n` +
                   `**Feedback**:\n${grade.feedback}`;
      } catch (e) {
        response = "I had trouble assessing your essay. Please try again later.";
      }
    } else {
      // Pass full conversation history for context (last 10 messages)
      const history = messages.slice(-10);
      const { success, text: aiText } = await askTutor(msg, history);
      response = aiText;
    }

    addTutorMessage({ role: 'tutor', text: response });
    if (videoKey) {
      appendEndUserChat(videoKey, 'tutor', response).catch((e) => {
        if (!e || (e.status !== 401 && e.status !== 403)) {
          console.warn('Tutor chat tutor-turn persist failed', e);
        }
      });
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleChip = (chip) => send(chip);
  const handleKey  = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } };

  return (
    <div className="screen" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)' }}>

      {/* Context panel */}
      <div style={{
        background: '#FFFFFF', borderBottom: '1px solid #E5E0D8',
        padding: '12px 32px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
              Current context
            </p>
            {!collapsed && (
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                {currentLesson ? `${currentLesson.subject} — ${currentLesson.chapter}` : 'No lesson selected — ask me anything!'}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn-ghost"
              onClick={() => { clearTutorHistory(); }}
              style={{ fontSize: 12 }}
            >
              Clear chat
            </button>
            <button
              onClick={() => setCollapsed(c => !c)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center' }}
            >
              {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div
        className="scroll-area"
        style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'student' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'tutor' && (
              <p className="bubble--tutor__label" style={{ marginLeft: 4 }}>Local AI Tutor</p>
            )}
            <div className={msg.role === 'student' ? 'bubble--student' : 'bubble--tutor'}>
              <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{msg.text}</p>
            </div>
            {msg.timestamp && (
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#9CA3AF', marginTop: 4, padding: '0 4px' }}>
                {new Date(msg.timestamp).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <p className="bubble--tutor__label" style={{ marginLeft: 4 }}>Local AI Tutor</p>
            <LoadingDots label="" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Action chips */}
      <div style={{ padding: '0 32px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {CHIPS.map(chip => (
            <button
              key={chip}
              className="chip"
              onClick={() => handleChip(chip)}
              disabled={loading}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div style={{
        padding: '12px 32px 20px',
        background: '#FFFFFF',
        borderTop: '1px solid #E5E0D8',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            className="input-field input-field--textarea"
            placeholder="Ask a question or paste your essay here..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            style={{ resize: 'none', minHeight: 48, maxHeight: 120, overflow: 'auto', lineHeight: 1.5 }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: input.trim() && !loading ? '#E8A838' : '#E5E0D8',
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 200ms ease',
              boxShadow: input.trim() && !loading ? '0 2px 8px rgba(232,168,56,0.3)' : 'none',
            }}
          >
            <Send size={18} color={input.trim() && !loading ? '#1A1A1A' : '#9CA3AF'} />
          </button>
        </div>
      </div>
    </div>
  );
}
