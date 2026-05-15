// CryptEdu — screens/CommunityScreen.jsx
// Community Q&A — simulation only (useState, resets on refresh)
// TODO: Replace mockQuestions state with PocketBase collection 'questions' via hubClient.getList('questions')
// TODO: Replace answer submission with hubClient.create('answers', { questionId, text, authorId })

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';

// ── Colours ───────────────────────────────────────────────────────────────────
const SUBJ = {
  Science:          { bg:'#E6F4ED', color:'#2D7A4F' },
  Mathematics:      { bg:'#FDF3DC', color:'#D4942A' },
  'Bahasa Malaysia':{ bg:'#EEF2FF', color:'#4F46E5' },
  History:          { bg:'#FEF2F2', color:'#DC2626' },
  English:          { bg:'#F0FDF4', color:'#16A34A' },
  General:          { bg:'#F3F4F6', color:'#6B7280' },
};

// ── Mock data ─────────────────────────────────────────────────────────────────
const INITIAL_QUESTIONS = [
  {
    id:1, subject:'Science',
    title:'How do I remember the difference between mitosis and meiosis?',
    body:'I keep confusing the two processes in my SPM revision. Can someone explain the key differences in a simple way?',
    author:'Ahmad Firdaus', grade:'Form 4', timePosted:'2 hours ago',
    solved:true,
    answers:[
      { id:1, author:'Cikgu Rosmah', role:'Teacher', text:'Great question! Mitosis produces 2 identical daughter cells (for growth/repair), while meiosis produces 4 genetically unique cells (for reproduction). Remember: Mitosis = Maintenance, Meiosis = Making gametes.', helpful:8 },
      { id:2, author:'Nur Aisyah Binti Ali', role:'Student', text:'I use the mnemonic: MiTOsis = TWO cells. MeiOSis = One-Sixteenth the chromosomes (haploid). Helped me a lot!', helpful:5 },
      { id:3, author:'Muhammad Haziq', role:'Student', text:'Also, meiosis has TWO rounds of division (Meiosis I and II). That\'s the key difference in process.', helpful:3 },
    ],
    views:24,
  },
  {
    id:2, subject:'Mathematics',
    title:'How to solve simultaneous equations using substitution method?',
    body:'I understand elimination but substitution always confuses me. Can someone show step by step?',
    author:'Nur Aisyah Binti Ali', grade:'Form 3', timePosted:'4 hours ago',
    solved:false,
    answers:[
      { id:1, author:'Cikgu Ahmad Zaki', role:'Teacher', text:'Step 1: From equation (i), express x in terms of y. Step 2: Substitute into equation (ii). Step 3: Solve for y. Step 4: Back-substitute. Always check your answer in BOTH original equations!', helpful:6 },
    ],
    views:18,
  },
  {
    id:3, subject:'Bahasa Malaysia',
    title:'Apa perbezaan antara karangan argumentatif dan karangan perbincangan?',
    body:'Saya selalu tersalah jenis karangan dalam peperiksaan. Boleh terangkan perbezaannya?',
    author:'Muhammad Haziq', grade:'Form 5', timePosted:'1 day ago',
    solved:true,
    answers:[
      { id:1, author:'Cikgu Rosmah', role:'Teacher', text:'Karangan argumentatif: penulis memilih SATU pendirian dan mempertahankannya sepanjang karangan. Karangan perbincangan: penulis membentangkan pandangan KEDUA-DUA pihak secara seimbang sebelum membuat rumusan.', helpful:9 },
      { id:2, author:'Siti Rahmah', role:'Student', text:'Cara mudah ingat: Argumentatif = Argue untuk satu pihak sahaja. Perbincangan = Discuss dua pihak.', helpful:4 },
    ],
    views:31,
  },
  {
    id:4, subject:'History',
    title:'What were the main causes of World War 2?',
    body:'My textbook lists many causes but I need to know which ones are most important for SPM.',
    author:'Siti Rahmah', grade:'Form 4', timePosted:'2 days ago',
    solved:false,
    answers:[],
    views:12,
  },
  {
    id:5, subject:'Science',
    title:'Why does a plant wilt when there is too much salt in the soil?',
    body:'Related to osmosis chapter. I understand osmosis but cannot apply it to this situation.',
    author:'Amir Syafiq', grade:'Form 3', timePosted:'3 days ago',
    solved:true,
    answers:[
      { id:1, author:'Cikgu Ahmad Zaki', role:'Teacher', text:'High salt concentration in soil creates a hypertonic solution outside the root cells. By osmosis, water moves OUT of the root cells into the soil (from low solute → high solute concentration). The plant loses turgor pressure and wilts.', helpful:12 },
      { id:2, author:'Ahmad Firdaus', role:'Student', text:'Think of it this way: the salt "pulls" water out of the plant. Same reason you should not drink seawater!', helpful:7 },
      { id:3, author:'Nur Aisyah Binti Ali', role:'Student', text:'Key term for SPM: plasmolysis — when the cell membrane pulls away from the cell wall due to water loss.', helpful:5 },
      { id:4, author:'Muhammad Haziq', role:'Student', text:'Draw a diagram showing the concentration gradient. It really helps visualise the direction of osmosis.', helpful:3 },
    ],
    views:45,
  },
];

const CONTRIBUTORS = [
  { name:'Cikgu Rosmah',       role:'Teacher', answers:23, medal:'🥇' },
  { name:'Ahmad Firdaus',      role:'Student', answers:15, medal:'🥈' },
  { name:'Cikgu Ahmad Zaki',   role:'Teacher', answers:12, medal:'🥉' },
  { name:'Nur Aisyah Binti Ali',role:'Student',answers:9,  medal:''   },
  { name:'Muhammad Haziq',     role:'Student', answers:6,  medal:''   },
];

const TOPICS = ['Photosynthesis','Linear Equations','Karangan','World War 2','Fractions','Osmosis','Meiosis'];

const FILTERS = ['All Questions','Unanswered','My Questions','My Answers'];

// ── Helper: SubjectBadge ──────────────────────────────────────────────────────
function SubjectBadge({ subject }) {
  const s = SUBJ[subject] ?? SUBJ.General;
  return (
    <span style={{ fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:600, color:s.color, background:s.bg, padding:'3px 10px', borderRadius:9999 }}>
      {subject}
    </span>
  );
}

// ── Answer card ───────────────────────────────────────────────────────────────
function AnswerCard({ answer, isBest }) {
  const [helpful, setHelpful] = useState(answer.helpful);
  const [voted,   setVoted]   = useState(false);
  const isTeacher = answer.role === 'Teacher';
  return (
    <div style={{
      background:'#FFFFFF', border:'1px solid #E5E0D8', borderRadius:12, padding:'14px 16px',
      borderLeft:`3px solid ${isBest ? '#E8A838' : isTeacher ? '#2D7A4F' : 'transparent'}`,
      marginBottom:8,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ width:30, height:30, borderRadius:'50%', background: isTeacher ? '#E6F4ED' : '#FDF3DC', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color: isTeacher ? '#2D7A4F' : '#E8A838', flexShrink:0 }}>
          {answer.author[0]}
        </div>
        <span style={{ fontFamily:'Inter,sans-serif', fontSize:13, fontWeight:600, color:'#1A1A1A' }}>{answer.author}</span>
        {isTeacher && (
          <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:600, color:'#2D7A4F', background:'#E6F4ED', padding:'2px 8px', borderRadius:9999 }}>Teacher</span>
        )}
        {isBest && (
          <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:600, color:'#92650A', background:'#FDF3DC', padding:'2px 8px', borderRadius:9999 }}>✓ Best Answer</span>
        )}
      </div>
      <p style={{ fontFamily:'Inter,sans-serif', fontSize:14, color:'#1A1A1A', lineHeight:1.7, marginBottom:10 }}>{answer.text}</p>
      <button
        onClick={() => { if (!voted) { setHelpful(h => h+1); setVoted(true); } }}
        style={{ background:'none', border:`1px solid ${voted ? '#2D7A4F' : '#E5E0D8'}`, borderRadius:9999, padding:'4px 12px', fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:500, color: voted ? '#2D7A4F' : '#6B7280', cursor: voted ? 'default' : 'pointer', transition:'all 200ms ease' }}
      >
        👍 Helpful · {helpful}
      </button>
    </div>
  );
}

// ── Question card ─────────────────────────────────────────────────────────────
function QuestionCard({ q, onAnswerSubmit }) {
  const [expanded,    setExpanded]    = useState(false);
  const [showAnswer,  setShowAnswer]  = useState(false);
  const [answerText,  setAnswerText]  = useState('');

  const handleSubmit = () => {
    if (!answerText.trim()) return;
    onAnswerSubmit(q.id, answerText.trim());
    setAnswerText('');
    setShowAnswer(false);
    setExpanded(true);
  };

  const best = q.answers.reduce((a,b) => (a && a.helpful >= b.helpful ? a : b), null);

  return (
    <div style={{ marginBottom:16 }}>
      <div
        className="card"
        style={{ cursor:'pointer', padding:'16px 20px' }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Top row */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
          <SubjectBadge subject={q.subject} />
          <span style={{ fontFamily:'Inter,sans-serif', fontSize:12, color:'#6B7280' }}>by {q.author}</span>
          <span style={{ fontFamily:'Inter,sans-serif', fontSize:12, color:'#9CA3AF' }}>· {q.timePosted}</span>
          <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:600, color:'#6B7280', background:'#F3F4F6', padding:'2px 8px', borderRadius:9999 }}>{q.grade}</span>
        </div>

        {/* Title */}
        <h3 style={{ fontFamily:'Inter,sans-serif', fontSize:16, fontWeight:600, color:'#1A1A1A', marginBottom:4, lineHeight:1.4 }}>{q.title}</h3>

        {/* Body preview */}
        <p style={{ fontFamily:'Inter,sans-serif', fontSize:14, color:'#6B7280', lineHeight:1.6, marginBottom:12, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {q.body}
        </p>

        {/* Bottom row */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }} onClick={e => e.stopPropagation()}>
          {q.answers.length === 0 ? (
            <span style={{ fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:600, color:'#92650A', background:'rgba(232,168,56,0.15)', padding:'4px 10px', borderRadius:9999 }}>Unanswered</span>
          ) : (
            <span style={{ fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:500, color:'#6B7280', background:'#F3F4F6', padding:'4px 10px', borderRadius:9999 }}>{q.answers.length} Answer{q.answers.length !== 1 ? 's' : ''}</span>
          )}
          <span style={{ fontFamily:'Inter,sans-serif', fontSize:12, color:'#9CA3AF' }}>{q.views} views</span>
          {q.solved && <span style={{ fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:600, color:'#2D7A4F', background:'#E6F4ED', padding:'4px 10px', borderRadius:9999 }}>Solved ✓</span>}
          <button
            className="btn-secondary"
            style={{ padding:'5px 14px', fontSize:12, marginLeft:'auto' }}
            onClick={e => { e.stopPropagation(); setShowAnswer(v => !v); setExpanded(true); }}
          >
            {showAnswer ? 'Cancel' : 'Answer'}
          </button>
        </div>
      </div>

      {/* Inline answer form */}
      {showAnswer && (
        <div style={{ background:'#FFFFFF', border:'1px solid #E5E0D8', borderRadius:'0 0 16px 16px', borderTop:'none', padding:'16px 20px' }}>
          <textarea
            className="input-field input-field--textarea"
            placeholder="Write your answer here..."
            value={answerText}
            onChange={e => setAnswerText(e.target.value)}
            style={{ minHeight:100, marginBottom:8 }}
          />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontFamily:'Inter,sans-serif', fontSize:12, color:'#6B7280' }}>{answerText.trim().split(/\s+/).filter(Boolean).length} words</span>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn-ghost" onClick={() => setShowAnswer(false)}>Cancel</button>
              <button className="btn-primary btn-primary--sm" onClick={handleSubmit} disabled={!answerText.trim()}>Submit Answer</button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded answers */}
      {expanded && q.answers.length > 0 && (
        <div style={{ padding:'12px 8px 0', borderLeft:'2px solid #E5E0D8', marginLeft:12 }}>
          {q.answers
            .slice()
            .sort((a,b) => b.helpful - a.helpful)
            .map((ans, i) => (
              <AnswerCard key={ans.id} answer={ans} isBest={i === 0 && ans.helpful >= 5} />
            ))}
        </div>
      )}
    </div>
  );
}

// ── CommunityScreen ───────────────────────────────────────────────────────────
export default function CommunityScreen() {
  const [questions,   setQuestions]   = useState(INITIAL_QUESTIONS);
  const [filter,      setFilter]      = useState('All Questions');
  const [topicFilter, setTopicFilter] = useState(null);
  const [showAskForm, setShowAskForm] = useState(false);
  const [askTitle,    setAskTitle]    = useState('');
  const [askBody,     setAskBody]     = useState('');
  const [askSubject,  setAskSubject]  = useState('General');
  const [askGrade,    setAskGrade]    = useState('All Grades');

  const handleAnswerSubmit = (qId, text) => {
    setQuestions(qs => qs.map(q => q.id !== qId ? q : {
      ...q,
      answers: [...q.answers, { id: q.answers.length + 1, author:'You', role:'Student', text, helpful:0 }],
    }));
  };

  const handlePostQuestion = () => {
    if (!askTitle.trim()) return;
    const newQ = {
      id: questions.length + 1,
      subject: askSubject, title: askTitle, body: askBody,
      author:'You', grade: askGrade, timePosted:'Just now',
      solved:false, answers:[], views:1,
    };
    setQuestions(qs => [newQ, ...qs]);
    setAskTitle(''); setAskBody(''); setShowAskForm(false);
  };

  const displayed = questions.filter(q => {
    if (topicFilter && !q.title.toLowerCase().includes(topicFilter.toLowerCase()) && !q.body.toLowerCase().includes(topicFilter.toLowerCase())) return false;
    if (filter === 'Unanswered') return q.answers.length === 0;
    if (filter === 'My Questions') return q.author === 'You';
    if (filter === 'My Answers')  return q.answers.some(a => a.author === 'You');
    return true;
  });

  return (
    <div className="screen">
      {/* Header */}
      <h1 style={{ fontFamily:'Inter,sans-serif', fontSize:28, fontWeight:800, color:'#1A1A1A', letterSpacing:'-0.02em', marginBottom:4 }}>
        Community Q&amp;A
      </h1>
      <p style={{ fontFamily:'Inter,sans-serif', fontSize:15, color:'#6B7280', marginBottom:28 }}>
        Ask questions. Share knowledge. Learn together.
      </p>

      {/* Two-column layout */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:24, alignItems:'start' }}>

        {/* ── LEFT: Feed ────────────────────────────────────────────────────── */}
        <div>
          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16, flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {FILTERS.map(f => (
                <button key={f} className={`chip${filter === f ? ' chip--active':''}`} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
            <button className="btn-primary btn-primary--sm" onClick={() => setShowAskForm(v => !v)}>
              {showAskForm ? '✕ Cancel' : '+ Ask a Question'}
            </button>
          </div>

          {/* Inline ask form */}
          {showAskForm && (
            <div className="card" style={{ marginBottom:20, animation:'screen-enter 300ms ease both' }}>
              <h3 style={{ fontFamily:'Inter,sans-serif', fontSize:16, fontWeight:700, color:'#1A1A1A', marginBottom:16 }}>Ask a Question</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input
                  className="input-field"
                  placeholder="Question title..."
                  value={askTitle}
                  onChange={e => setAskTitle(e.target.value)}
                  style={{ fontSize:16 }}
                />
                <textarea
                  className="input-field input-field--textarea"
                  placeholder="Describe your question in detail..."
                  value={askBody}
                  onChange={e => setAskBody(e.target.value)}
                  style={{ minHeight:120 }}
                />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <select className="input-field" value={askSubject} onChange={e => setAskSubject(e.target.value)} style={{ cursor:'pointer' }}>
                    {['Science','Mathematics','Bahasa Malaysia','History','English','General'].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <select className="input-field" value={askGrade} onChange={e => setAskGrade(e.target.value)} style={{ cursor:'pointer' }}>
                    {['All Grades','Year 1','Year 2','Year 3','Year 4','Year 5','Year 6','Form 1','Form 2','Form 3','Form 4','Form 5'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn-primary btn-primary--sm" onClick={handlePostQuestion} disabled={!askTitle.trim()}>Post Question</button>
                  <button className="btn-ghost" onClick={() => setShowAskForm(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Topic filter notice */}
          {topicFilter && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span style={{ fontFamily:'Inter,sans-serif', fontSize:13, color:'#6B7280' }}>Filtered by topic: <strong style={{ color:'#1A1A1A' }}>{topicFilter}</strong></span>
              <button className="btn-ghost" style={{ fontSize:12 }} onClick={() => setTopicFilter(null)}>Clear ✕</button>
            </div>
          )}

          {/* Questions */}
          {displayed.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:'48px 24px' }}>
              <p style={{ fontFamily:'Inter,sans-serif', fontSize:14, color:'#6B7280' }}>No questions match this filter.</p>
            </div>
          ) : (
            displayed.map(q => (
              <QuestionCard key={q.id} q={q} onAnswerSubmit={handleAnswerSubmit} />
            ))
          )}
        </div>

        {/* ── RIGHT: Sidebar widgets ─────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          
          <div style={{
            background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
            borderRadius: 24,
            padding: '24px',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.7), 0 4px 20px rgba(0,0,0,0.04)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Background mesh blobs */}
            <div style={{ position: 'absolute', top: -100, left: -100, width: 300, height: 300, background: 'radial-gradient(circle, rgba(219,234,254,0.6) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Stats */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ fontFamily:'Inter,sans-serif', fontSize:18, fontWeight:700, color:'#0F172A', letterSpacing:'-0.01em', marginBottom:16 }}>Community Stats</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[
                  { label:'Total Questions', value: questions.length, icon:'❓', accent:'#94A3B8' },
                  { label:'Answered', value:`${questions.filter(q => q.answers.length > 0).length} (${Math.round(questions.filter(q=>q.answers.length>0).length/questions.length*100)}%)`, icon:'✅', accent:'#2D7A4F' },
                  { label:'Active Members', value:47, icon:'👥', accent:'#4F46E5' },
                  { label:'Teachers Online', value:'3', icon:'🟢', accent:'#2D7A4F' },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: 16,
                    padding: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.9)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }}>
                        {s.icon}
                      </div>
                      <span style={{ fontFamily:'Inter,sans-serif', fontSize:14, fontWeight:600, color:'#0F172A' }}>{s.label}</span>
                    </div>
                    <span style={{ fontFamily:'Inter,sans-serif', fontSize:16, fontWeight:700, color: s.accent }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Contributors */}
          <div style={{
            background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
            borderRadius: 24,
            padding: '24px',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.7), 0 4px 20px rgba(0,0,0,0.04)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, background: 'radial-gradient(circle, rgba(226,232,240,0.8) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ fontFamily:'Inter,sans-serif', fontSize:18, fontWeight:700, color:'#0F172A', letterSpacing:'-0.01em', marginBottom:16 }}>Top Contributors</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {CONTRIBUTORS.map((c, i) => {
                  const isFirst = i === 0;
                  const isSecond = i === 1;
                  const isThird = i === 2;
                  
                  let bg = 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)';
                  let border = '1px solid rgba(255, 255, 255, 0.9)';
                  let accent = '#94A3B8';
                  
                  if (isFirst) {
                    bg = 'linear-gradient(145deg, rgba(253,246,227,0.95) 0%, rgba(255,255,255,0.85) 100%)';
                    border = '1px solid rgba(232,168,56,0.3)';
                    accent = '#E8A838';
                  } else if (isSecond) {
                    bg = 'linear-gradient(145deg, rgba(248,250,252,0.95) 0%, rgba(255,255,255,0.85) 100%)';
                    border = '1px solid rgba(148,163,184,0.3)';
                    accent = '#94A3B8';
                  } else if (isThird) {
                    bg = 'linear-gradient(145deg, rgba(255,247,242,0.95) 0%, rgba(255,255,255,0.85) 100%)';
                    border = '1px solid rgba(217,119,6,0.2)';
                    accent = '#D97706';
                  }

                  return (
                    <div key={i} style={{
                      background: bg,
                      backdropFilter: 'blur(12px)',
                      borderRadius: 16,
                      padding: isFirst ? '18px 16px' : '16px',
                      border: border,
                      boxShadow: isFirst ? '0 8px 24px rgba(232,168,56,0.12)' : '0 2px 10px rgba(0,0,0,0.02)',
                      display: 'flex', alignItems: 'center', gap: 14,
                      transform: isFirst ? 'scale(1.02)' : 'none',
                      transformOrigin: 'left center'
                    }}>
                      <div style={{
                        width: isFirst ? 32 : 26,
                        height: isFirst ? 32 : 26,
                        borderRadius: isFirst ? 10 : 8,
                        transform: 'rotate(45deg)',
                        background: isFirst || isSecond || isThird ? accent : '#F1F5F9',
                        color: isFirst || isSecond || isThird ? '#FFF' : '#64748B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: (isFirst || isSecond || isThird) ? `0 4px 12px ${accent}40` : 'inset 0 0 0 1px rgba(0,0,0,0.05)',
                        marginLeft: 4, flexShrink: 0
                      }}>
                        <span style={{ transform: 'rotate(-45deg)', fontSize: isFirst ? 14 : 12, fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>
                          {i+1}
                        </span>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontFamily:'Inter,sans-serif', fontSize:isFirst ? 15 : 14, fontWeight:600, color:'#0F172A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom: 4 }}>{c.name}</p>
                        <span style={{ fontFamily:'Inter,sans-serif', fontSize:11, fontWeight:600, color: c.role==='Teacher' ? '#2D7A4F' : '#64748B', background: c.role==='Teacher' ? '#E6F4ED' : 'rgba(0,0,0,0.04)', padding:'2px 8px', borderRadius:9999 }}>{c.role}</span>
                      </div>
                      <span style={{ fontFamily:'Inter,sans-serif', fontSize:isFirst ? 18 : 16, fontWeight:700, color: accent }}>{c.answers}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Popular Topics */}
          <div style={{
            background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
            borderRadius: 24,
            padding: '24px',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.7), 0 4px 20px rgba(0,0,0,0.04)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', bottom: -100, left: -100, width: 300, height: 300, background: 'radial-gradient(circle, rgba(219,234,254,0.4) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ fontFamily:'Inter,sans-serif', fontSize:18, fontWeight:700, color:'#0F172A', letterSpacing:'-0.01em', marginBottom:16 }}>Popular Topics</h3>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {TOPICS.map(t => (
                  <button
                    key={t}
                    style={{
                      background: topicFilter === t ? '#E8A838' : '#FFFFFF',
                      color: topicFilter === t ? '#FFFFFF' : '#0F172A',
                      border: topicFilter === t ? '1px solid #E8A838' : '1px solid rgba(0,0,0,0.1)',
                      borderRadius: 9999,
                      padding: '8px 16px',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 200ms ease',
                      boxShadow: topicFilter === t ? '0 4px 12px rgba(232,168,56,0.3)' : '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                    onClick={() => setTopicFilter(topicFilter === t ? null : t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Node Info */}
          <div className="card" style={{ background:'#1B3A2D', border:'none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <span className="status-dot status-dot--green" />
              <p style={{ fontFamily:'Inter,sans-serif', fontSize:14, fontWeight:700, color:'#FFFFFF' }}>SK Kg. Baru Node</p>
            </div>
            <p style={{ fontFamily:'Inter,sans-serif', fontSize:13, color:'#8BAF98', marginBottom:6 }}>47 active students this week</p>
            <p style={{ fontFamily:'Inter,sans-serif', fontSize:13, color:'#8BAF98' }}>Questions answered within 2 hours on average</p>
          </div>
        </div>
      </div>
    </div>
  );
}
