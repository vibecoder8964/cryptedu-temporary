// ─────────────────────────────────────────────────────────────────────────────
// CryptEdu — data/mockData.js
// Real Malaysian mock data — KPM syllabus content
// Ref: developer_skill.md §7
// RULES: No Lorem ipsum. No "Test data". Real names, real subject content.
// ─────────────────────────────────────────────────────────────────────────────

// ── LESSONS ──────────────────────────────────────────────────────────────────
// 5 lessons across 5 subjects, real KPM chapter titles
export const lessons = [
  {
    id: '1',
    subject: 'Science',
    subjectCode: 'S',
    subjectColor: '#1A73E8',
    chapter: 'Chapter 3: Photosynthesis & Plant Nutrition',
    grade: 'Tingkatan 2',
    progress: 0,
    videoUrl: null,
    notes: `Photosynthesis is the process by which green plants manufacture their own food using sunlight, carbon dioxide, and water.

**The chemical equation:**
6CO₂ + 6H₂O + Light Energy → C₆H₁₂O₆ + 6O₂

**Key components required:**
• Chlorophyll — the green pigment in chloroplasts that absorbs light
• Carbon dioxide — absorbed through stomata on leaf surfaces  
• Water — absorbed by roots and transported through the xylem
• Sunlight — the energy source for the reaction

**Two stages of photosynthesis:**
1. Light-dependent stage — occurs in the thylakoid membrane; water is split, oxygen is released
2. Light-independent stage (Calvin Cycle) — occurs in the stroma; CO₂ is fixed into glucose

**Factors affecting the rate of photosynthesis:**
• Light intensity — higher intensity increases rate up to a saturation point
• Carbon dioxide concentration — more CO₂ speeds up the Calvin Cycle
• Temperature — enzyme activity peaks around 25–30°C; too high denatures enzymes

Plants store excess glucose as starch. This is why iodine solution turns blue-black when applied to a starch-containing leaf — a standard test in KPM practical assessments.`,
    isReady: true,
    lastSynced: '2 hours ago',
    duration: '18 min',
  },
  {
    id: '2',
    subject: 'Mathematics',
    subjectCode: 'M',
    subjectColor: '#EA4335',
    chapter: 'Chapter 5: Linear Equations in Two Variables',
    grade: 'Tingkatan 3',
    progress: 0,
    videoUrl: null,
    notes: `A linear equation in two variables has the general form: **ax + by = c**

**Solving simultaneous linear equations:**

Method 1 — Substitution:
1. Express one variable in terms of the other from equation (i)
2. Substitute into equation (ii)
3. Solve for the remaining variable
4. Back-substitute to find the first variable

**Example:**
2x + y = 7 ... (i)
x − y = 2  ... (ii)

From (ii): x = y + 2
Substitute into (i): 2(y + 2) + y = 7 → 3y = 3 → y = 1
Therefore x = 3. Solution: (3, 1)

Method 2 — Elimination:
Add or subtract equations to eliminate one variable.

**Graphical method:**
Each linear equation represents a straight line. The solution is the point where both lines intersect.

**Real-world application:**
If Ahmad buys 3 pens and 2 books for RM19, and Siti buys 1 pen and 4 books for RM23, find the price of each item. Set up two equations and solve simultaneously.`,
    isReady: true,
    lastSynced: '2 hours ago',
    duration: '22 min',
  },
  {
    id: '3',
    subject: 'Bahasa Malaysia',
    subjectCode: 'BM',
    subjectColor: '#34A853',
    chapter: 'Bab 2: Karangan Jenis Perbahasan',
    grade: 'Tingkatan 4',
    progress: 0,
    videoUrl: null,
    notes: `Karangan perbahasan ialah karangan yang membincangkan sesuatu isu daripada pelbagai sudut pandangan dengan hujah yang kukuh dan bernas.

**Ciri-ciri karangan perbahasan yang baik:**
• Pendirian yang jelas — penulis mesti memilih sama ada menyokong atau menentang kenyataan
• Hujah yang tersusun — setiap perenggan mengandungi satu idea utama
• Penggunaan fakta, statistik, dan contoh nyata untuk menyokong hujah
• Bahasa yang formal dan akademik

**Struktur karangan perbahasan:**
1. **Pendahuluan** — Perkenalkan isu, nyatakan pendirian anda
2. **Isi 1** — Hujah pertama menyokong pendirian + contoh
3. **Isi 2** — Hujah kedua + bukti kukuh
4. **Isi 3** — Tangkis hujah pihak yang bertentangan
5. **Penutup** — Rumuskan pendirian, cadangan, harapan

**Frasa berguna:**
• "Saya berpendapat bahawa..."
• "Hal ini demikian kerana..."
• "Berbeza pendapat dengan pandangan tersebut, saya tegaskan bahawa..."
• "Kesimpulannya, jelas terbukti bahawa..."

**Tajuk latihan:**
"Kemajuan teknologi lebih banyak mendatangkan keburukan daripada kebaikan kepada masyarakat." Bincangkan.`,
    isReady: true,
    lastSynced: '2 hours ago',
    duration: '15 min',
  },
  {
    id: '4',
    subject: 'History',
    subjectCode: 'Sej',
    subjectColor: '#FBBC04',
    chapter: 'Chapter 7: The Formation of Malaysia 1963',
    grade: 'Tingkatan 3',
    progress: 0,
    videoUrl: null,
    notes: `The Federation of Malaysia was officially formed on 16 September 1963, uniting Malaya, Singapore, North Borneo (Sabah), and Sarawak.

**Background — Why Malaysia was formed:**
• British colonial policy of merging territories for easier administration
• Economic benefits through combined resources and markets
• Defence — a united federation was stronger against communist threats
• Tunku Abdul Rahman's vision for a united, multi-racial nation

**The Cobbold Commission (1962):**
Tasked with gauging public opinion in Sabah and Sarawak about joining the federation. Found approximately one-third in favour, one-third with conditions, and one-third opposed.

**The Manila Accord and Macapagal Proposal:**
The Philippines and Indonesia raised objections. Indonesia launched Konfrontasi (Confrontation) against Malaysia under President Sukarno.

**20-Point Agreement (Sabah) & 18-Point Agreement (Sarawak):**
Special conditions negotiated to protect the rights and autonomy of Sabah and Sarawak before joining.

**Key dates:**
• 31 August 1957 — Malayan Independence
• 1 February 1962 — Cobbold Commission formed
• 9 July 1963 — Malaysia Agreement signed in London
• 16 September 1963 — Malaysia Day

Singapore separated from Malaysia on 9 August 1965 due to political and economic disagreements.`,
    isReady: true,
    lastSynced: '2 hours ago',
    duration: '20 min',
  },
  {
    id: '5',
    subject: 'English',
    subjectCode: 'Eng',
    subjectColor: '#9334E8',
    chapter: 'Chapter 4: Report Writing & Formal Letters',
    grade: 'Tingkatan 5',
    progress: 0,
    videoUrl: null,
    notes: `Report writing and formal letters are essential skills for SPM Paper 2 (Section B).

**FORMAL LETTER FORMAT:**
[Your address — top right]
[Date]
[Recipient's name and address]

Dear [Title + Surname],
Re: [Subject of the letter — underlined]

[Opening paragraph — state your purpose clearly]
[Body paragraphs — supporting details, numbered points if listing]
[Closing paragraph — action required, thank the reader]

Yours sincerely / Yours faithfully,
[Signature]
[Your printed name]

**Use "Yours sincerely"** when you know the recipient's name.
**Use "Yours faithfully"** when you begin with "Dear Sir/Madam."

**REPORT FORMAT:**
Title: [Report on ...]
Prepared by: [Name, Position]
Date: [DD/MM/YYYY]

1.0 Introduction
2.0 Findings
   2.1 [Subheading]
   2.2 [Subheading]
3.0 Recommendations
4.0 Conclusion

**Common SPM question types:**
• Letter of complaint to a local council about poor facilities
• Report to a school principal about a club activity
• Letter to a newspaper editor about environmental issues

**Key vocabulary for formal writing:**
• "I am writing with regard to..."
• "It has come to my attention that..."
• "I would appreciate it if you could..."
• "I look forward to your prompt response."`,
    isReady: true,
    lastSynced: '2 hours ago',
    duration: '16 min',
  },
];

// ── VILLAGE LEADERBOARD ───────────────────────────────────────────────────────
// Top 5 students from the same Child Hub node — real Malaysian names
export const leaderboard = [
  { rank: 1, name: 'Ahmad Firdaus bin Razali',  score: 98, streak: 14, badge: '🥇', grade: 'Tingkatan 4' },
  { rank: 2, name: 'Nur Aisyah binti Zainal',   score: 91, streak: 10, badge: '🥈', grade: 'Tingkatan 5' },
  { rank: 3, name: 'Muhammad Haziq bin Ismail',  score: 87, streak: 8,  badge: '🥉', grade: 'Tingkatan 3' },
  { rank: 4, name: 'Siti Rahmah binti Hamid',   score: 74, streak: 5,  badge: '',   grade: 'Tingkatan 4' },
  { rank: 5, name: 'Amir Syafiq bin Abdullah',  score: 68, streak: 3,  badge: '',   grade: 'Tingkatan 2' },
];



// ── QUIZ QUESTIONS ────────────────────────────────────────────────────────────
// 5 MCQ per lesson — real KPM syllabus content
export const quizQuestions = {
  // Science — Photosynthesis
  '1': [
    {
      id: 'q1-1',
      question: 'Which pigment in plant cells is responsible for absorbing light energy during photosynthesis?',
      options: ['Carotene', 'Xanthophyll', 'Chlorophyll', 'Anthocyanin'],
      correct: 2,
    },
    {
      id: 'q1-2',
      question: 'What is the primary raw material absorbed through the stomata of a leaf for photosynthesis?',
      options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Water vapour'],
      correct: 2,
    },
    {
      id: 'q1-3',
      question: 'In which part of the plant cell does the light-independent stage (Calvin Cycle) occur?',
      options: ['Thylakoid membrane', 'Cell wall', 'Stroma', 'Vacuole'],
      correct: 2,
    },
    {
      id: 'q1-4',
      question: 'A student places a green leaf in iodine solution and it turns blue-black. What does this confirm?',
      options: [
        'The leaf has been exposed to sunlight',
        'Starch is present in the leaf',
        'The leaf contains chlorophyll',
        'Oxygen has been produced',
      ],
      correct: 1,
    },
    {
      id: 'q1-5',
      question: 'Which factor does NOT directly affect the rate of photosynthesis?',
      options: [
        'Light intensity',
        'Carbon dioxide concentration',
        'Soil pH',
        'Temperature',
      ],
      correct: 2,
    },
  ],

  // Mathematics — Simultaneous Linear Equations
  '2': [
    {
      id: 'q2-1',
      question: 'Solve: x + y = 10 and x − y = 4. What is the value of x?',
      options: ['3', '5', '7', '9'],
      correct: 2,
    },
    {
      id: 'q2-2',
      question: 'What is the general form of a linear equation in two variables?',
      options: ['ax² + bx + c = 0', 'ax + by = c', 'y = mx²', 'ax + b = 0'],
      correct: 1,
    },
    {
      id: 'q2-3',
      question: 'Two lines represented by simultaneous equations intersect at point (2, 5). This means x = 2 and y = 5 is the:',
      options: [
        'Gradient of both lines',
        'y-intercept',
        'Solution to both equations',
        'Midpoint of both lines',
      ],
      correct: 2,
    },
    {
      id: 'q2-4',
      question: 'Using elimination: 3x + 2y = 16 and x + 2y = 8. What is the value of x?',
      options: ['2', '3', '4', '5'],
      correct: 2,
    },
    {
      id: 'q2-5',
      question: 'Ahmad buys 2 pens and 1 book for RM9. Siti buys 1 pen and 2 books for RM12. What is the price of one book?',
      options: ['RM2', 'RM3', 'RM4', 'RM5'],
      correct: 3,
    },
  ],

  // Bahasa Malaysia — Karangan Perbahasan
  '3': [
    {
      id: 'q3-1',
      question: 'Apakah ciri utama karangan jenis perbahasan?',
      options: [
        'Menceritakan pengalaman peribadi penulis',
        'Membincangkan isu dari pelbagai sudut dengan hujah yang kukuh',
        'Menggambarkan keindahan alam semulajadi',
        'Menyenaraikan fakta saintifik semata-mata',
      ],
      correct: 1,
    },
    {
      id: 'q3-2',
      question: 'Frasa manakah yang PALING sesuai digunakan untuk menolak hujah pihak lawan dalam karangan perbahasan?',
      options: [
        '"Pada pendapat saya..."',
        '"Sungguhpun demikian, hujah ini tidak tepat kerana..."',
        '"Saya suka apabila..."',
        '"Kesimpulannya..."',
      ],
      correct: 1,
    },
    {
      id: 'q3-3',
      question: 'Berapa bilangan isi utama yang disarankan dalam karangan perbahasan SPM 350 patah perkataan?',
      options: ['2', '3', '4', '5'],
      correct: 1,
    },
    {
      id: 'q3-4',
      question: '"Hal ini demikian kerana..." digunakan untuk:',
      options: [
        'Membuat kesimpulan',
        'Memperkenalkan isu',
        'Memberikan penjelasan atau sebab',
        'Menyenaraikan fakta',
      ],
      correct: 2,
    },
    {
      id: 'q3-5',
      question: 'Bahagian manakah dalam karangan perbahasan yang harus mengandungi pendirian penulis secara jelas?',
      options: ['Isi 2 sahaja', 'Penutup sahaja', 'Pendahuluan dan penutup', 'Isi 1 sahaja'],
      correct: 2,
    },
  ],

  // History — Formation of Malaysia
  '4': [
    {
      id: 'q4-1',
      question: 'On which date was the Federation of Malaysia officially formed?',
      options: [
        '31 August 1957',
        '9 July 1963',
        '16 September 1963',
        '9 August 1965',
      ],
      correct: 2,
    },
    {
      id: 'q4-2',
      question: 'What was the primary purpose of the Cobbold Commission in 1962?',
      options: [
        'To negotiate independence from Britain',
        'To gauge public opinion in Sabah and Sarawak about joining Malaysia',
        'To resolve the Konfrontasi with Indonesia',
        'To draft the Malaysian Constitution',
      ],
      correct: 1,
    },
    {
      id: 'q4-3',
      question: 'Indonesia\'s armed opposition to the formation of Malaysia under President Sukarno is known as:',
      options: ['Ganyang Malaysia', 'Konfrontasi', 'Manila Accord', 'Cobbold Report'],
      correct: 1,
    },
    {
      id: 'q4-4',
      question: 'Singapore separated from Malaysia in:',
      options: ['1963', '1964', '1965', '1966'],
      correct: 2,
    },
    {
      id: 'q4-5',
      question: 'The 20-Point Agreement protected the special conditions of which state joining Malaysia?',
      options: ['Sarawak', 'Sabah', 'Singapore', 'Penang'],
      correct: 1,
    },
  ],

  // English — Formal Writing
  '5': [
    {
      id: 'q5-1',
      question: 'Which closing salutation is correct when you begin a formal letter with "Dear Sir/Madam"?',
      options: [
        'Yours sincerely',
        'Best regards',
        'Yours faithfully',
        'With compliments',
      ],
      correct: 2,
    },
    {
      id: 'q5-2',
      question: 'In a formal report, section numbering such as "2.1" and "2.2" refers to:',
      options: ['Page numbers', 'Subheadings under a main section', 'Appendices', 'Paragraph numbers'],
      correct: 1,
    },
    {
      id: 'q5-3',
      question: 'Which phrase is MOST appropriate for stating the purpose in a formal letter?',
      options: [
        '"Hey, I am writing about..."',
        '"I am writing with regard to..."',
        '"Just wanted to let you know..."',
        '"FYI, the problem is..."',
      ],
      correct: 1,
    },
    {
      id: 'q5-4',
      question: 'Which closing phrase correctly expresses anticipation of a reply in a formal letter?',
      options: [
        '"See you later."',
        '"Please reply as soon as you can."',
        '"I look forward to your prompt response."',
        '"Waiting for your message."',
      ],
      correct: 2,
    },
    {
      id: 'q5-5',
      question: 'A school report is addressed to the principal. The report should use:',
      options: [
        'Informal, conversational language',
        'Formal language with numbered sections and clear headings',
        'Bullet points only, no paragraphs',
        'First person casual tone',
      ],
      correct: 1,
    },
  ],
};

// ── AI TUTOR SAMPLE RESPONSES ─────────────────────────────────────────────────
// 5 rich, context-aware responses — used as fallback when Ollama is unreachable
export const tutorResponses = [
  `Great question! Photosynthesis can be remembered using this simple equation:

**6CO₂ + 6H₂O + Light → C₆H₁₂O₆ + 6O₂**

Think of it like a plant's kitchen — it takes in raw ingredients (carbon dioxide from the air, water from the soil) and uses sunlight as the energy source to cook up glucose for food. The oxygen is released as a by-product — which is exactly what we breathe!

For your KPM exam, focus on the **two stages**: the light-dependent stage in the thylakoid, and the Calvin Cycle in the stroma. You've got this, Ahmad!`,

  `Let me break down simultaneous equations step by step.

Take: 2x + y = 7 and x − y = 2

**Using substitution:**
From the second equation: x = y + 2
Substitute into the first: 2(y + 2) + y = 7 → 3y = 3 → **y = 1**
Then x = 1 + 2 = **x = 3**

Check your answer by substituting back: 2(3) + 1 = 7 ✓ and 3 − 1 = 2 ✓

The key is to always check your solution in BOTH original equations. Keep practising — you're doing brilliantly!`,

  `For karangan perbahasan, the structure is everything. Here is how to plan it:

**Pendahuluan** — Define the issue and clearly state your pendirian (stance) in 2–3 sentences.

**Isi-isi** — Each paragraph = one strong hujah (argument). Use the PEEL method:
• **P**oint — your argument
• **E**xplanation — why it is true  
• **E**vidence — statistic, example, or fact
• **L**ink — connect back to the main stance

**Penutup** — Summarise your pendirian, propose a solution, and end with a harapan (hope).

Avoid starting sentences with "Saya" more than twice. Vary your sentence openers — examiners reward linguistic variety!`,

  `The formation of Malaysia on 16 September 1963 is a landmark event in our history. Here is a memory trick:

**"CSML" — Cobbold, Singapore (excluded later), Malaya, London**

- **C**obbold Commission (1962) — assessed Sabah & Sarawak readiness
- **S**ingapore — joined in 1963, left in 1965
- **M**alaya — the core federation since 1957
- **L**ondon — where the Malaysia Agreement was signed (9 July 1963)

For SPM, you must know the reasons FOR formation (defence, economy, colonial policy) AND the opposition (Konfrontasi, Philippines claim on Sabah). Examiners love balanced answers that cover both sides!`,

  `For SPM English formal writing, here is the golden rule:

**"Dear Sir/Madam" → Yours faithfully**
**"Dear Mr. Ahmad" → Yours sincerely**

This is one of the most commonly tested grammar points and students lose marks by mixing them up.

For report writing, always use numbered sections (1.0, 2.0, 2.1) and keep your language objective — avoid "I think" and "I feel." Use instead: "It is recommended that..." or "The findings indicate that..."

One more tip: in the introduction of your letter or report, always state **who you are, why you are writing, and what you want** — all in the first paragraph. Never make the reader guess your purpose!`,
];

// ── SUBJECT METADATA ──────────────────────────────────────────────────────────
// Used by the Subject Browser screen (LessonsScreen)
export const subjects = [
  {
    id: 'science',
    name: 'Science',
    emoji: '🔬',
    color: '#1A73E8',
    lessonCount: 12,
    readyCount: 12,
    grade: 'Tingkatan 2',
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    emoji: '📐',
    color: '#EA4335',
    lessonCount: 15,
    readyCount: 15,
    grade: 'Tingkatan 3',
  },
  {
    id: 'bm',
    name: 'Bahasa Malaysia',
    emoji: '📖',
    color: '#34A853',
    lessonCount: 10,
    readyCount: 10,
    grade: 'Tingkatan 4',
  },
  {
    id: 'history',
    name: 'History',
    emoji: '🏛️',
    color: '#FBBC04',
    lessonCount: 8,
    readyCount: 8,
    grade: 'Tingkatan 3',
  },
  {
    id: 'english',
    name: 'English',
    emoji: '✍️',
    color: '#9334E8',
    lessonCount: 11,
    readyCount: 11,
    grade: 'Tingkatan 5',
  },
];
