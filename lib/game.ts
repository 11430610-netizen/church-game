export type Question = {
  id: number;
  category: string;
  question: string;
};

export type ReviewItem = {
  questionId: number;
  initiatorAnswer: string;
  participantAnswer: string;
  correct: boolean;
  similarity: number;
};

export type Participant = {
  id: string;
  name: string;
  answers: string[];
  completed: boolean;
  guessesByQuestion?: Record<number, Record<string, string>>;
  guessSubmittedByQuestion?: Record<number, boolean>;
};

export type Session = {
  sessionId: string;
  initiatorName: string;
  initiatorAnswers: string[];
  participants: Participant[];
  currentQuestionIndex: number;
  hasStarted?: boolean;
  isAnswerRevealOpen?: boolean;
};

export const questions: Question[] = [
  { id: 1, category: "飲食類", question: "飲料都點幾分糖？" },
  { id: 2, category: "飲食類", question: "飲料要喝有料還是沒料？" },
  { id: 3, category: "飲食類", question: "咖哩飯拌嗎？" },
  { id: 4, category: "飲食類", question: "吃辣嗎？" },
  { id: 5, category: "生活習慣類", question: "訊息多久回一次？" },
  { id: 6, category: "生活習慣類", question: "十二點前或後睡" },
  { id: 7, category: "生活習慣類", question: "現在有的興趣或是想養成的？" },
  { id: 8, category: "生活習慣類", question: "在家讀書或在外面讀？" },
  { id: 9, category: "學校生活類", question: "現在跟國中最大的不同是什麼？" },
  { id: 10, category: "學校生活類", question: "遇到的困難？" },
  { id: 11, category: "未來類", question: "想學的技能是什麼？" },
  { id: 12, category: "未來類", question: "大學想讀的科系/想從事的行業？" },
  { id: 13, category: "未來類", question: "成年後想做的第一件事？" },
  { id: 14, category: "社交類", question: "哪些特質會讓你不想跟對方成為朋友？" },
  { id: 15, category: "社交類", question: "絕對不能觸碰到的底線是什麼？" },
  { id: 16, category: "社交類", question: "為什麼目前為止持續來教會？" },
  { id: 17, category: "社交類", question: "你的mbti是？" },
  { id: 18, category: "自我類", question: "名字的由來？" },
  { id: 19, category: "自我類", question: "很廢的小技能？" },
  { id: 20, category: "自我類", question: "最近喜歡聽的一首歌或一個歌手/團體？" },
  { id: 21, category: "屬靈類", question: "最喜歡的一段經文或是人物？" },
  { id: 22, category: "屬靈類", question: "印象最深刻的經文或人物？" },
  { id: 23, category: "互相作答", question: "對×××的第一印象？" },
  { id: 24, category: "互相作答", question: "對×××現在的印象？" },
  { id: 25, category: "互相作答", question: "×××的三個性格形容詞？" },
  { id: 26, category: "互相作答", question: "××的一個優點？" },
];

export function normalizeText(value: string): string[] {
  const cleaned = value
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  const tokens = cleaned.match(/[\p{L}\p{N}]+/gu) ?? [];
  return tokens.filter(Boolean);
}

export function calculateJaccardSimilarity(answerA: string, answerB: string) {
  const left = new Set(normalizeText(answerA));
  const right = new Set(normalizeText(answerB));

  if (left.size === 0 && right.size === 0) {
    return 100;
  }

  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;

  if (union === 0) return 0;
  return Math.round((intersection / union) * 100);
}

export function buildReview(initiatorAnswers: string[], participantAnswers: string[]): ReviewItem[] {
  return initiatorAnswers.map((initiatorAnswer, index) => {
    const participantAnswer = participantAnswers[index] ?? "";
    const similarity = calculateJaccardSimilarity(initiatorAnswer, participantAnswer);
    const correct = similarity >= 60;

    return {
      questionId: index + 1,
      initiatorAnswer,
      participantAnswer,
      correct,
      similarity,
    };
  });
}

export function createEmptyAnswers() {
  return Array.from({ length: questions.length }, () => "");
}
