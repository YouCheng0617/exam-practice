import type { Subject } from "../types";
import { buildKana, type KanaRow } from "./kana-gen";

// ============================================================
// 日文五十音的兩條支線（內建、公開）：STOP 01-1 濁音・半濁音、STOP 01-2 拗音・濁拗音。題目由 kana-gen.ts 產生。
// ============================================================

const row = (name: string, hira: string, kata: string, roma: string): KanaRow => ({
  name,
  hira: hira.split(" "),
  kata: kata.split(" "),
  roma: roma.split(" "),
});

const DAKUON: KanaRow[] = [
  // 濁音、半濁音
  row("が行", "が ぎ ぐ げ ご", "ガ ギ グ ゲ ゴ", "ga gi gu ge go"),
  row("ざ行", "ざ じ ず ぜ ぞ", "ザ ジ ズ ゼ ゾ", "za ji zu ze zo"),
  row("だ行", "だ ぢ づ で ど", "ダ ヂ ヅ デ ド", "da ji zu de do"),
  row("ば行", "ば び ぶ べ ぼ", "バ ビ ブ ベ ボ", "ba bi bu be bo"),
  row("ぱ行", "ぱ ぴ ぷ ぺ ぽ", "パ ピ プ ペ ポ", "pa pi pu pe po"),
];

const YOUON: KanaRow[] = [
  // 拗音
  row("きゃ行", "きゃ きゅ きょ", "キャ キュ キョ", "kya kyu kyo"),
  row("しゃ行", "しゃ しゅ しょ", "シャ シュ ショ", "sha shu sho"),
  row("ちゃ行", "ちゃ ちゅ ちょ", "チャ チュ チョ", "cha chu cho"),
  row("にゃ行", "にゃ にゅ にょ", "ニャ ニュ ニョ", "nya nyu nyo"),
  row("ひゃ行", "ひゃ ひゅ ひょ", "ヒャ ヒュ ヒョ", "hya hyu hyo"),
  row("みゃ行", "みゃ みゅ みょ", "ミャ ミュ ミョ", "mya myu myo"),
  row("りゃ行", "りゃ りゅ りょ", "リャ リュ リョ", "rya ryu ryo"),
  // 濁拗音、半濁拗音
  row("ぎゃ行", "ぎゃ ぎゅ ぎょ", "ギャ ギュ ギョ", "gya gyu gyo"),
  row("じゃ行", "じゃ じゅ じょ", "ジャ ジュ ジョ", "ja ju jo"),
  row("びゃ行", "びゃ びゅ びょ", "ビャ ビュ ビョ", "bya byu byo"),
  row("ぴゃ行", "ぴゃ ぴゅ ぴょ", "ピャ ピュ ピョ", "pya pyu pyo"),
];

// 打字時也接受的其他拼法
const ALT: Record<string, string[]> = {
  ji: ["zi", "di"], zu: ["du"],
  sha: ["sya"], shu: ["syu"], sho: ["syo"],
  cha: ["tya", "cya"], chu: ["tyu", "cyu"], cho: ["tyo", "cyo"],
  ja: ["zya", "jya"], ju: ["zyu", "jyu"], jo: ["zyo", "jyo"],
};

// 濁音和半濁音只差在兩點和圈圈，最容易看錯
const LOOKALIKE = [
  ["ば", "ぱ"], ["び", "ぴ"], ["ぶ", "ぷ"], ["べ", "ぺ"], ["ぼ", "ぽ"],
  ["バ", "パ"], ["ビ", "ピ"], ["ブ", "プ"], ["ベ", "ペ"], ["ボ", "ポ"],
  ["じ", "ぢ"], ["ず", "づ"], ["ジ", "ヂ", "ヅ"], ["ズ", "ヅ"], ["ゾ", "ン"], ["ぐ", "く"], ["グ", "ク"],
  ["きゃ", "ぎゃ"], ["しゃ", "じゃ"], ["ひゃ", "びゃ", "ぴゃ"], ["シャ", "ジャ"], ["ヒャ", "ビャ", "ピャ"],
];

// 拗音的小字寫成大字，就變成兩個音：きゃ → きや
const SMALL: Record<string, string> = { ゃ: "や", ゅ: "ゆ", ょ: "よ", ャ: "ヤ", ュ: "ユ", ョ: "ヨ" };
const bigVersion = (c: string) => {
  const last = c.slice(-1);
  return SMALL[last] ? [c.slice(0, -1) + SMALL[last]] : [];
};

const MODES = [
  { id: "hira", label: "平假名" },
  { id: "kata", label: "片假名" },
  { id: "mix", label: "混合" },
];

export const kanaDakuon: Subject = {
  id: "kana-50-dakuon",
  stop: "01-1",
  group: "日文五十音",
  name: "日文五十音-濁音",
  desc: "支線・濁音與半濁音（が ざ だ ば ぱ）",
  color: "#7a5af5",
  modes: MODES,
  roundSize: 20,
  highlights: [
    "濁音：在字的右上角加兩點「゛」，か→が、さ→ざ、た→だ、は→ば，聲音變得比較重。",
    "半濁音：只有は行能加圈圈「゜」：ぱ ぴ ぷ ぺ ぽ。ば（兩點）和 ぱ（圈圈）最容易看錯。",
    "じ和ぢ都念 ji、ず和づ都念 zu；平常寫字大多用 じ 和 ず。",
    "片假名一樣加兩點或圈圈：ガ、ザ、ダ、バ、パ。",
  ],
  topics: DAKUON.map((r) => ({ name: r.name })),
  exam: { name: "濁音小考", choiceCount: 20, choicePoint: 5, essayCount: 0, essayPoint: 0, note: "依你選的出題範圍出題" },
  questions: buildKana(DAKUON, { alt: ALT, lookalike: LOOKALIKE, nextAcrossRows: false }),
  essays: [],
};

export const kanaYouon: Subject = {
  id: "kana-50-youon",
  stop: "01-2",
  group: "日文五十音",
  name: "日文五十音-拗音",
  desc: "支線・拗音與濁拗音（きゃ しゅ ちょ…）",
  color: "#2f80ed",
  modes: MODES,
  roundSize: 20,
  highlights: [
    "拗音：い段的字後面接小字的 ゃ ゅ ょ，例如 き＋ゃ＝きゃ（kya），念成一個音。",
    "能接拗音的字：き し ち に ひ み り，加上濁音的 ぎ じ び 和半濁音的 ぴ。",
    "小字要寫小一點：きゃ 是一個音，寫成大字的 きや 就變成 ki-ya 兩個音。",
    "例外的拼法：しゃ＝sha、ちゃ＝cha、じゃ＝ja。",
    "片假名一樣：キャ、シュ、チョ。",
  ],
  topics: YOUON.map((r) => ({ name: r.name })),
  exam: { name: "拗音小考", choiceCount: 20, choicePoint: 5, essayCount: 0, essayPoint: 0, note: "依你選的出題範圍出題" },
  questions: buildKana(YOUON, { alt: ALT, lookalike: LOOKALIKE, nextAcrossRows: false, extraWrong: bigVersion }),
  essays: [],
};
