import type { Question } from "../types";

// ============================================================
// 假名題目產生器：五十音、支線（濁音・拗音）共用。
// 題目 id 固定（同一題每次產生的選項也一樣），答題紀錄才對得上。
// 每題用 tags 標記出題範圍：hira（平假名）、kata（片假名）、mix（混合）。
// ============================================================

export type KanaRow = { name: string; hira: string[]; kata: string[]; roma: string[] };
export type KanaConfig = {
  alt?: Record<string, string[]>; // 打字時也接受的其他拼法
  lookalike?: string[][]; // 長得像、容易搞混的字
  nextAcrossRows?: boolean; // 「下一個是哪個」要不要跨行
  extraWrong?: (c: string) => string[]; // 額外的錯誤選項（例如拗音寫成大字的 きや）
};

type K = { h: string; k: string; r: string; row: string; ri: number; ci: number };

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function shuffled<T>(arr: T[], seed: string) {
  const r = rng(seedOf(seed));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const uniq = <T,>(a: T[]) => [...new Set(a)];

// 四個選項：正確答案＋一定要出現的 must（長得像的字、寫成大字的拗音），再補 prefer（同一行或同一段），最後補隨機；
// exclude 裡的不能出現（例如 じ／ぢ 同音，不能互當錯誤選項）
function options(correct: string, pool: string[], prefer: string[], seed: string, exclude: string[] = [], must: string[] = []) {
  const others = uniq([...shuffled(must, seed + "m"), ...shuffled(prefer, seed + "p"), ...shuffled(pool, seed + "r")])
    .filter((x) => x !== correct && !exclude.includes(x))
    .slice(0, 3);
  const opts = shuffled([correct, ...others], seed + "o");
  return { options: opts, answer: opts.indexOf(correct) };
}

export function buildKana(ROWS: KanaRow[], cfg: KanaConfig = {}): Question[] {
  const ALT = cfg.alt ?? {};
  const LOOK = (cfg.lookalike ?? []).filter((g) => g.length > 1);
  const ALL: K[] = ROWS.flatMap((row, ri) => row.hira.map((h, ci) => ({ h, k: row.kata[ci], r: row.roma[ci], row: row.name, ri, ci })));
  const lookalikes = (ch: string) => LOOK.find((g) => g.includes(ch))?.filter((x) => x !== ch) ?? [];
  const tip = (ch: string) => {
    const l = lookalikes(ch);
    return l.length ? `小心別跟 ${l.join("、")} 搞混。` : "";
  };
  const sameSound = (x: K) => ALL.filter((y) => y.r === x.r && y !== x); // じ／ぢ 這種同音的字
  const Q: Question[] = [];

  for (const script of ["hira", "kata"] as const) {
    const S = script === "hira" ? "平假名" : "片假名";
    const ch = (x: K) => (script === "hira" ? x.h : x.k);
    const pool = ALL.map(ch);
    const tags = [script, "mix"];

    ALL.forEach((x, i) => {
      const c = ch(x);
      const sameRow = ALL.filter((y) => y.ri === x.ri).map(ch);
      const sameCol = ALL.filter((y) => y.ci === x.ci).map(ch);
      const twins = sameSound(x);
      const extra = cfg.extraWrong?.(c) ?? [];

      // 看假名 → 選讀音
      const ro = options(x.r, ALL.map((y) => y.r), ALL.filter((y) => y.ri === x.ri || y.ci === x.ci).map((y) => y.r), `${script}-read-${x.r}-${x.row}`);
      Q.push({
        id: `${script}-read-${x.r}${twins.length ? `-${x.ri}` : ""}`, topic: x.row, tags, type: "choice",
        question: `「${c}」怎麼念？`, ...ro,
        explanation: `${c} 念 ${x.r}，是 ${x.row}的第 ${x.ci + 1} 個。${twins.length ? `（${twins.map(ch).join("、")} 也念 ${x.r}。）` : ""}`,
      });

      // 看讀音 → 選假名；同音的字（じ／ぢ）會在題目註明是哪一行，也不會出現在選項裡
      const wr = options(c, pool, [...sameRow, ...sameCol], `${script}-write-${x.r}-${x.row}`, twins.map(ch), [...extra, ...lookalikes(c)]);
      Q.push({
        id: `${script}-write-${x.r}${twins.length ? `-${x.ri}` : ""}`, topic: x.row, tags, type: "choice",
        question: `「${x.r}」${twins.length ? `（${x.row}）` : ""}的${S}是哪一個？`, ...wr,
        explanation: `${x.r}${twins.length ? `（${x.row}）` : ""} 寫成 ${c}。${tip(c)}${extra.length ? `注意是小字，寫成大字的 ${extra[0]} 就變成兩個音。` : ""}`,
      });

      // 打字填讀音
      Q.push({
        id: `${script}-fill-${x.r}${twins.length ? `-${x.ri}` : ""}`, topic: x.row, tags, type: "fill",
        question: `「${c}」的讀音是＿＿。（輸入羅馬拼音）`, answer: [x.r, ...(ALT[x.r] ?? [])],
        explanation: `${c} 念 ${x.r}${ALT[x.r] ? `（也可以寫成 ${ALT[x.r].join("、")}）` : ""}。`,
      });

      // 下一個是哪個
      const nx = ALL[i + 1];
      if (nx && (cfg.nextAcrossRows || nx.ri === x.ri)) {
        const nc = ch(nx);
        const near = ALL.slice(Math.max(0, i - 3), i + 5).map(ch).filter((y) => y !== c);
        const nq = options(nc, pool, near, `${script}-next-${x.r}-${x.row}`);
        Q.push({
          id: `${script}-next-${x.r}${twins.length ? `-${x.ri}` : ""}`, topic: x.row, tags, type: "choice",
          question: `${cfg.nextAcrossRows ? "五十音裡，" : `${x.row}裡，`}${S}「${c}」的下一個是？`, ...nq,
          explanation:
            nx.ri === x.ri
              ? `${x.row}的順序是 ${(script === "hira" ? ROWS[x.ri].hira : ROWS[x.ri].kata).join(" ")}，${c} 後面是 ${nc}。`
              : `${c} 是 ${x.row}的最後一個，接下來換 ${nx.row}，第一個是 ${nc}。`,
        });
      }
    });

    // 排序題：一整行的字打亂，拖動字卡排回正確順序
    ROWS.forEach((row) => {
      const items = script === "hira" ? row.hira : row.kata;
      Q.push({
        id: `${script}-order-${row.roma[0]}`, topic: row.name, tags, type: "order",
        question: `下面是${S}「${row.name}」的 ${items.length} 個字，順序被打亂了。請拖動字卡，排出正確的順序。`, answer: items,
        explanation: `${row.name}的順序是 ${items.join(" → ")}（${row.roma.join(" ")}）。`,
      });
    });
  }

  // 混合限定：平假名 ↔ 片假名
  ALL.forEach((x) => {
    const id = `${x.r}${sameSound(x).length ? `-${x.ri}` : ""}`;
    const toK = options(x.k, ALL.map((y) => y.k), ALL.filter((y) => y.ri === x.ri).map((y) => y.k), `h2k-${id}`, [], lookalikes(x.k));
    Q.push({
      id: `mix-h2k-${id}`, topic: x.row, tags: ["mix"], type: "choice",
      question: `平假名「${x.h}」的片假名是？`, ...toK,
      explanation: `${x.h}（${x.r}）的片假名是 ${x.k}。${tip(x.k)}`,
    });
    const toH = options(x.h, ALL.map((y) => y.h), ALL.filter((y) => y.ri === x.ri).map((y) => y.h), `k2h-${id}`, [], lookalikes(x.h));
    Q.push({
      id: `mix-k2h-${id}`, topic: x.row, tags: ["mix"], type: "choice",
      question: `片假名「${x.k}」的平假名是？`, ...toH,
      explanation: `${x.k}（${x.r}）的平假名是 ${x.h}。${tip(x.h)}`,
    });
  });

  return Q;
}
