// ============================================================
// 題庫格式（每份題庫一個檔案，放在 data/subjects/；使用者匯入的 JSON 也是同一個格式）
// ============================================================

type QBase = { id: string; topic?: string; question: string; explanation: string };
export type ChoiceQ = QBase & { type: "choice"; options: string[]; answer: number }; // answer：正確選項索引，從 0 開始
export type MultiQ = QBase & { type: "multi"; options: string[]; answer: number[] }; // 複選題，全對才算對
export type TfQ = QBase & { type: "tf"; answer: boolean }; // 是非題
export type FillQ = QBase & { type: "fill"; answer: string[] }; // 填空題；answer 列出所有可接受的答案
export type Question = ChoiceQ | MultiQ | TfQ | FillQ;

// 簡答題：看完參考答案後自己判斷有沒有答對
export type EssayQ = {
  id: string;
  title: string; // 短標題
  topic?: string;
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
  note?: string; // 提醒，例如「未到考 0 分！」
};

export type Subject = {
  id: string; // 英文代號，存紀錄用，定了就不要改
  name: string; // 科目名稱
  desc: string; // 一句話介紹
  year?: string; // 年份，例如「113」；用來篩選
  color?: string; // 這一科的代表色（不填會自動配一個）
  highlights?: string[]; // 重點整理
  topics?: { name: string }[];
  questions: Question[];
  essays: EssayQ[];
  exam?: ExamInfo;
  custom?: boolean; // 使用者自己加入的題庫
  ai?: boolean; // AI 從上傳的檔案整理出來的
};
