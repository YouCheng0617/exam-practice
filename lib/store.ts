import type { EssayQ, Question, Subject } from "@/data/types";

// ============================================================
// 題目統一格式＋作答紀錄（存在使用者自己瀏覽器的 localStorage）
// ============================================================

export type ShortQ = EssayQ & { type: "short" };
export type AnyQ = Question | ShortQ;
export type Kind = "choice" | "fill" | "short" | "order";

export const KIND_LABEL: Record<Kind, string> = { choice: "選擇題", fill: "填空題", short: "簡答題", order: "排序題" };

export const kindOf = (q: AnyQ): Kind => (q.type === "fill" ? "fill" : q.type === "short" ? "short" : q.type === "order" ? "order" : "choice");
export const typeLabel = (q: AnyQ) =>
  q.type === "choice" ? "單選題" : q.type === "multi" ? "複選題" : q.type === "tf" ? "是非題" : q.type === "fill" ? "填空題" : q.type === "order" ? "排序題" : "簡答題";

export const allQuestions = (s: Subject): AnyQ[] => [...s.questions, ...s.essays.map((e) => ({ ...e, type: "short" as const }))];
export const keyOf = (s: Subject, q: AnyQ) => `${s.id}/${q.id}`;

export type QStat = { seen: number; right: number; last: boolean };
export type Attempt = {
  id: string;
  setId: string;
  setName: string;
  at: number;
  mode: "practice" | "exam";
  total: number;
  right: number;
  score?: number; // 模擬考得分
  max?: number;
};
// 旅行手帳的一張卡片：每一題答過就留下，同一題只留第一次的
export type JournalCard = {
  key: string; // 題庫 id/題目 id
  setId: string;
  setName: string;
  topic?: string;
  question: string;
  answer: string; // 正確答案（簡答題沒有）
  note: string; // 學到的：解析或參考答案
  at: number;
};

export type Data = {
  stats: Record<string, QStat>; // 每一題的作答統計，key = 題庫 id/題目 id
  marks: string[]; // 標記「不熟」的題目
  attempts: Attempt[]; // 歷次作答紀錄（新的在前）
  custom: Subject[]; // 使用者加入的題庫
  journal: JournalCard[]; // 旅行手帳（新的在前）
  prefs: Record<string, string>; // 每份題庫選的出題範圍
  focus: Record<string, number>; // 旅行鐘：每天探險（專心）的分鐘數，key 是 YYYY-MM-DD
  days: string[]; // 有練習的日期（YYYY-MM-DD），用來算連續天數
  sound: boolean; // 音效開關
};

const KEY = "kaoguti:v1";
export const EMPTY: Data = { stats: {}, marks: [], attempts: [], custom: [], journal: [], prefs: {}, focus: {}, days: [], sound: true };

export const dayStr = (t: number) => new Date(t).toLocaleDateString("sv"); // YYYY-MM-DD（當地時間）

// 連續練習天數：今天或昨天有練才算還在連續
export function streak(d: Data): number {
  const set = new Set(d.days);
  let t = Date.now();
  if (!set.has(dayStr(t))) t -= 86400000;
  let n = 0;
  while (set.has(dayStr(t))) {
    n++;
    t -= 86400000;
  }
  return n;
}

// 每科一個顏色：題庫有指定就用指定的，沒有就依 id 固定配一個
// 這個順序用色盲模擬檢查過，相鄰的顏色都分得出來，不要隨意調換
export const PALETTE = ["#f0603c", "#17a08c", "#e58a00", "#7a5af5", "#d9457a", "#2f80ed"];
// 新加入的題庫：挑一個還沒被用掉的顏色
export function nextColor(sets: Subject[]): string {
  const used = new Set(sets.map(colorOf));
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[sets.length % PALETTE.length];
}
export function colorOf(s: Subject): string {
  if (s.color) return s.color;
  let h = 0;
  for (const c of s.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function loadData(): Data {
  try {
    const v = localStorage.getItem(KEY);
    return v ? { ...EMPTY, ...(JSON.parse(v) as Partial<Data>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}
export function saveData(d: Data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {}
}

export function recordAnswer(d: Data, key: string, ok: boolean): Data {
  const s = d.stats[key] ?? { seen: 0, right: 0, last: false };
  const today = dayStr(Date.now());
  const days = d.days.includes(today) ? d.days : [...d.days, today].slice(-400);
  return { ...d, days, stats: { ...d.stats, [key]: { seen: s.seen + 1, right: s.right + (ok ? 1 : 0), last: ok } } };
}
export function toggleMark(d: Data, key: string): Data {
  return { ...d, marks: d.marks.includes(key) ? d.marks.filter((k) => k !== key) : [...d.marks, key] };
}

// 一組題目的整體正確率（沒作答過回傳 null）
export function accuracy(d: Data, keys: string[]): { seen: number; right: number; pct: number | null } {
  let seen = 0;
  let right = 0;
  for (const k of keys) {
    const s = d.stats[k];
    if (s) {
      seen += s.seen;
      right += s.right;
    }
  }
  return { seen, right, pct: seen ? Math.round((right / seen) * 100) : null };
}

// 各主題的掌握度，正確率低的排前面
export type TopicStat = { set: Subject; topic: string; seen: number; right: number; pct: number; total: number };
export function topicStats(d: Data, sets: Subject[]): TopicStat[] {
  const out: TopicStat[] = [];
  for (const set of sets) {
    const groups = new Map<string, AnyQ[]>();
    for (const q of allQuestions(set)) {
      const t = q.topic ?? (q.type === "short" ? "簡答題" : "其他");
      groups.set(t, [...(groups.get(t) ?? []), q]);
    }
    for (const [topic, qs] of groups) {
      const a = accuracy(d, qs.map((q) => keyOf(set, q)));
      if (a.pct !== null) out.push({ set, topic, seen: a.seen, right: a.right, pct: a.pct, total: qs.length });
    }
  }
  return out.sort((a, b) => a.pct - b.pct);
}

// ---------- 旅程：每個主題是一站，站內的題目上次都答對就算「抵達」 ----------
export const topicOf = (q: AnyQ) => q.topic ?? (q.type === "short" ? "簡答題" : "其他");
export type Station = { topic: string; items: AnyQ[]; total: number; seen: number; cleared: number; done: boolean };

// 出題範圍：題目沒有 tags 就每個範圍都算
export const inMode = (q: AnyQ, mode?: string) => !mode || !("tags" in q) || !q.tags || q.tags.includes(mode);
export const modeOf = (d: Data, s: Subject) =>
  s.modes?.length ? (s.modes.some((m) => m.id === d.prefs?.[s.id]) ? d.prefs[s.id] : s.modes[0].id) : undefined;

export function stations(d: Data, set: Subject, mode = modeOf(d, set)): Station[] {
  const order = (set.topics ?? []).map((t) => t.name);
  const groups = new Map<string, AnyQ[]>(order.map((t) => [t, []]));
  for (const q of allQuestions(set)) if (inMode(q, mode)) groups.set(topicOf(q), [...(groups.get(topicOf(q)) ?? []), q]);
  return [...groups]
    .filter(([, items]) => items.length > 0)
    .map(([topic, items]) => {
      const st = items.map((q) => d.stats[keyOf(set, q)]);
      const seen = st.filter(Boolean).length;
      const cleared = st.filter((x) => x?.last).length;
      return { topic, items, total: items.length, seen, cleared, done: cleared === items.length };
    });
}

export function tripOf(d: Data, set: Subject) {
  const st = stations(d, set);
  const arrived = st.filter((x) => x.done).length;
  return { stations: st, arrived, started: st.some((x) => x.seen > 0), done: st.length > 0 && arrived === st.length };
}
