import type { Subject } from "../types";
import { buildKana } from "./kana-gen";

// ============================================================
// 日文五十音（內建、公開，STOP 01）：題目由 kana-gen.ts 產生。
// ============================================================

const ROWS: { name: string; hira: string[]; kata: string[]; roma: string[] }[] = [
  { name: "あ行", hira: ["あ", "い", "う", "え", "お"], kata: ["ア", "イ", "ウ", "エ", "オ"], roma: ["a", "i", "u", "e", "o"] },
  { name: "か行", hira: ["か", "き", "く", "け", "こ"], kata: ["カ", "キ", "ク", "ケ", "コ"], roma: ["ka", "ki", "ku", "ke", "ko"] },
  { name: "さ行", hira: ["さ", "し", "す", "せ", "そ"], kata: ["サ", "シ", "ス", "セ", "ソ"], roma: ["sa", "shi", "su", "se", "so"] },
  { name: "た行", hira: ["た", "ち", "つ", "て", "と"], kata: ["タ", "チ", "ツ", "テ", "ト"], roma: ["ta", "chi", "tsu", "te", "to"] },
  { name: "な行", hira: ["な", "に", "ぬ", "ね", "の"], kata: ["ナ", "ニ", "ヌ", "ネ", "ノ"], roma: ["na", "ni", "nu", "ne", "no"] },
  { name: "は行", hira: ["は", "ひ", "ふ", "へ", "ほ"], kata: ["ハ", "ヒ", "フ", "ヘ", "ホ"], roma: ["ha", "hi", "fu", "he", "ho"] },
  { name: "ま行", hira: ["ま", "み", "む", "め", "も"], kata: ["マ", "ミ", "ム", "メ", "モ"], roma: ["ma", "mi", "mu", "me", "mo"] },
  { name: "や行", hira: ["や", "ゆ", "よ"], kata: ["ヤ", "ユ", "ヨ"], roma: ["ya", "yu", "yo"] },
  { name: "ら行", hira: ["ら", "り", "る", "れ", "ろ"], kata: ["ラ", "リ", "ル", "レ", "ロ"], roma: ["ra", "ri", "ru", "re", "ro"] },
  { name: "わ行・ん", hira: ["わ", "を", "ん"], kata: ["ワ", "ヲ", "ン"], roma: ["wa", "wo", "n"] },
];

// 打字時也接受的其他拼法
const ALT: Record<string, string[]> = { shi: ["si"], chi: ["ti"], tsu: ["tu"], fu: ["hu"], wo: ["o"], n: ["nn"] };

// 長得像、容易搞混的字：當錯誤選項用，也寫進解析提醒
const LOOKALIKE = [
  ["ぬ", "め"], ["ね", "れ", "わ"], ["は", "ほ"], ["る", "ろ"], ["き", "さ", "ち"], ["い", "こ", "り"], ["あ", "お"], ["う", "ら"], ["シ", "ツ"],
  ["ソ", "ン"], ["ク", "ケ", "タ"], ["ウ", "ワ", "フ"], ["コ", "ユ"], ["ス", "ヌ"], ["チ", "テ"], ["ノ", "メ"], ["マ", "ム"],
].filter((g) => g.length > 1);

const kana: Subject = {
  id: "kana-50",
  stop: "01",
  group: "日文五十音",
  name: "日文五十音",
  desc: "平假名・片假名・讀音與順序",
  color: "#d9457a",
  modes: [
    { id: "hira", label: "平假名" },
    { id: "kata", label: "片假名" },
    { id: "mix", label: "混合" },
  ],
  roundSize: 20,
  highlights: [
    "五十音按「あかさたな、はまやらわ」的行順序排，每一行都是 a、i、u、e、o 的順序。",
    "例外的拼法：し＝shi、ち＝chi、つ＝tsu、ふ＝fu、を＝wo（念起來跟 お 一樣）。",
    "や行只有 や ゆ よ，わ行只有 わ を，最後一個是 ん。",
    "平假名用在一般的字，片假名多用在外來語，例如 コーヒー（咖啡）。",
    "長得像的字要特別小心：ぬ／め、ね／れ／わ、は／ほ、シ／ツ、ソ／ン。",
  ],
  topics: ROWS.map((r) => ({ name: r.name })),
  exam: { name: "五十音小考", choiceCount: 20, choicePoint: 5, essayCount: 0, essayPoint: 0, note: "依你選的出題範圍出題" },
  questions: buildKana(ROWS, { alt: ALT, lookalike: LOOKALIKE, nextAcrossRows: true }),
  essays: [],
};

export default kana;
