// ============================================================
// 題庫格式（每份題庫一個檔案，放在 data/subjects/；使用者匯入的 JSON 也是同一個格式）
// ============================================================

type QBase = { id: string; topic?: string; question: string; explanation: string; tags?: string[] }; // tags：屬於哪個出題範圍
export type ChoiceQ = QBase & { type: "choice"; options: string[]; answer: number }; // answer：正確選項索引，從 0 開始
export type MultiQ = QBase & { type: "multi"; options: string[]; answer: number[] }; // 複選題，全對才算對
export type TfQ = QBase & { type: "tf"; answer: boolean }; // 是非題
export type FillQ = QBase & { type: "fill"; answer: string[] }; // 填空題；answer 列出所有可接受的答案
export type OrderQ = QBase & { type: "order"; answer: string[] }; // 排序題：answer 是正確的順序，畫面上會打亂
export type Question = ChoiceQ | MultiQ | TfQ | FillQ | OrderQ;

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
  group?: string; // 分類：首頁「依科目篩選」用，同一類的題庫會一起出現（例如五十音的主線和支線）
  stop?: string; // 車票上的站號，例如 01、01-1（支線）；沒填就自動編號
  name: string; // 科目名稱
  desc: string; // 一句話介紹
  year?: string; // 年份，例如「113」；用來篩選
  color?: string; // 這一科的代表色（不填會自動配一個）
  highlights?: string[]; // 重點整理
  topics?: { name: string }[];
  questions: Question[];
  essays: EssayQ[];
  exam?: ExamInfo;
  modes?: { id: string; label: string }[]; // 出題範圍（例如平假名／片假名／混合），用 tags 篩題
  roundSize?: number; // 每次出發隨機抽幾題（題庫很大時用）
  custom?: boolean; // 使用者自己加入的題庫
  shareKey?: string; // 從分享連結匯入的：同一個連結只留一份
  ai?: boolean; // AI 從上傳的檔案整理出來的
};
