// ============================================================
// 題庫格式（每個科目一個檔案，放在 data/subjects/）
// ============================================================

type QBase = { id: string; topic?: string; question: string; explanation: string };
export type ChoiceQ = QBase & { type: "choice"; options: string[]; answer: number }; // answer：正確選項索引，從 0 開始
export type TfQ = QBase & { type: "tf"; answer: boolean }; // 是非題
export type Question = ChoiceQ | TfQ;

export type EssayQ = {
  id: string;
  title: string; // 短標題
  question: string; // 原題
  plain?: string; // 白話版題目（選填）
  answer: string[]; // 答案重點，一句一點
};

export type ExamInfo = {
  name: string; // 例如「期中考」
  choiceCount: number;
  choicePoint: number;
  essayCount: number;
  essayPoint: number;
  weight?: number; // 占學期成績比例，例如 0.3
  note?: string; // 首頁提醒，例如「未到考 0 分！」
};

// 選填：讓某科有自己的風格（不填就用通用的）
export type Flavor = {
  correctLines?: string[];
  wrongLines?: string[];
  stampRight?: string; // 答對印章上的字（2 個字最好看）
  stampWrong?: string;
  resultTitle?: string; // 結算頁標題
};

export type Subject = {
  id: string; // 英文代號，存紀錄用，定了就不要改
  name: string;
  icon: string; // 一個 emoji
  desc: string; // 一句話介紹
  topics?: { name: string; icon: string }[];
  questions: Question[];
  essays: EssayQ[];
  exam?: ExamInfo;
  flavor?: Flavor;
};
