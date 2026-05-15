// TODO: Replace mockQuizBank with API call to fine-tuned Gemma 2B endpoint when teammate completes AI training

export const mockQuizBank = {
  Science: {
    mcq: [
      { question:'What is the primary product of photosynthesis?', options:['Oxygen','Glucose','Carbon Dioxide','Water'], correct:1, explanation:'Glucose is the main energy product produced during photosynthesis.' },
      { question:'Which organelle is responsible for photosynthesis?', options:['Mitochondria','Nucleus','Chloroplast','Vacuole'], correct:2, explanation:'Chloroplasts contain chlorophyll which captures sunlight for photosynthesis.' },
      { question:'What type of cell division produces gametes?', options:['Mitosis','Meiosis','Binary fission','Budding'], correct:1, explanation:'Meiosis produces 4 genetically different cells used for reproduction.' },
    ],
    shortAnswer: [
      { question:'State TWO differences between mitosis and meiosis.', modelAnswer:'Mitosis produces 2 identical daughter cells while meiosis produces 4 genetically different cells. Mitosis is for growth and repair while meiosis is for reproduction.' },
    ],
    essay: [
      { question:'Explain the process of photosynthesis and its importance to living organisms.', modelAnswer:'Photosynthesis is the process by which green plants convert carbon dioxide and water into glucose using sunlight energy. The equation is: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂. It is important because it produces oxygen for respiration and glucose as food for plants and animals.', markingCriteria:{ content:35, language:38, structure:18 } },
    ],
  },
  Mathematics: {
    mcq: [
      { question:'Solve for x: 2x + 6 = 14', options:['x = 3','x = 4','x = 5','x = 10'], correct:1, explanation:'Subtract 6 from both sides: 2x = 8, then divide by 2: x = 4.' },
      { question:'What is the gradient of the line y = 3x + 5?', options:['5','3','8','15'], correct:1, explanation:'In the form y = mx + c, m is the gradient. Here m = 3.' },
      { question:'What is 15% of 200?', options:['25','30','35','40'], correct:1, explanation:'15/100 × 200 = 30.' },
    ],
    shortAnswer: [
      { question:'Factorise the expression: x² + 5x + 6', modelAnswer:'(x + 2)(x + 3). Find two numbers that multiply to 6 and add to 5, which are 2 and 3.' },
    ],
    essay: [
      { question:'Explain how to solve simultaneous equations using the substitution method. Show a worked example.', modelAnswer:'In substitution: isolate one variable in one equation, substitute into the other, then solve. Example: x + y = 5 and 2x - y = 1. From first: y = 5 - x. Substitute: 2x - (5-x) = 1, 3x = 6, x = 2, y = 3.', markingCriteria:{ content:36, language:37, structure:19 } },
    ],
  },
  History: {
    mcq: [
      { question:'What year did World War 2 end?', options:['1943','1944','1945','1946'], correct:2, explanation:'World War 2 ended in 1945 with Germany in May and Japan in September.' },
      { question:'Which country invaded Poland in 1939 to start WW2?', options:['USA','Germany','Britain','France'], correct:1, explanation:'Germany invaded Poland on 1 September 1939, triggering the war.' },
      { question:'On what date was Malaysia formed?', options:['31 Aug 1957','16 Sep 1963','9 Aug 1965','9 Jul 1963'], correct:1, explanation:'Malaysia was officially formed on 16 September 1963.' },
    ],
    shortAnswer: [
      { question:'State TWO causes of World War 2.', modelAnswer:'The rise of Nazi Germany under Hitler and the policy of appeasement. Also, the Great Depression caused economic instability that led to extreme nationalism.' },
    ],
    essay: [
      { question:'Discuss the main causes of World War 2 and their impact on the world.', modelAnswer:'WW2 was caused by the harsh Treaty of Versailles, the rise of fascism, the Great Depression, and the failure of appeasement. The impact included over 70 million deaths, the Holocaust, use of atomic bombs, and the rise of USA and USSR as superpowers.', markingCriteria:{ content:34, language:36, structure:17 } },
    ],
  },
};

// Fallback for Bahasa Malaysia, English — use Science bank
export function getQuizBank(subject) {
  return mockQuizBank[subject] ?? mockQuizBank['Science'];
}

export const SUGGESTED_TOPICS = ['Photosynthesis','Linear Equations','Karangan Argumentatif','World War 2','Osmosis','Quadratic Equations'];

export const MOCK_HISTORY = [
  { topic:'Photosynthesis',    subject:'Science',     score:85, date:'8 May 2025' },
  { topic:'Linear Equations',  subject:'Mathematics', score:72, date:'7 May 2025' },
  { topic:'World War 2',       subject:'History',     score:60, date:'6 May 2025' },
  { topic:'Osmosis',           subject:'Science',     score:90, date:'5 May 2025' },
  { topic:'Quadratic Equations',subject:'Mathematics',score:45, date:'4 May 2025' },
];
