import type { EssayQ, Question, Subject } from "@/data/types";

// ============================================================
// 上傳檔案 → 題庫
// PDF 直接交給後端；PowerPoint、Word 先在瀏覽器取出文字再送（所以檔案大也沒關係）。
// 後端在 app/api/analyze/route.ts，金鑰只存在伺服器。
// ============================================================

export const ACCEPT = ".pdf,.pptx,.docx,.json";
export const MAX_PDF_MB = 4;
const MAX_TEXT_CHARS = 120_000;

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

// 從 pptx / docx（其實是 zip 裡的 XML）取出文字
async function extractText(file: File, ext: "pptx" | "docx"): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const wanted = ext === "pptx" ? /^ppt\/slides\/slide(\d+)\.xml$/ : /^word\/document\.xml$/;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (f) => wanted.test(f.name) });
  } catch {
    throw new Error("這個檔案打不開，可能已經損壞。");
  }
  const names = Object.keys(files).sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0));
  const pages = names.map((name, i) => {
    const xml = strFromU8(files[name]);
    const lines = xml.split(/<\/(?:a|w):p>/).map((para) =>
      [...para.matchAll(/<(?:a|w):t(?:\s[^>]*)?>([^<]*)<\/(?:a|w):t>/g)].map((m) => decode(m[1])).join(""),
    );
    const text = lines.filter((l) => l.trim()).join("\n");
    return ext === "pptx" ? `【第 ${i + 1} 頁】\n${text}` : text;
  });
  return pages.join("\n\n").trim();
}

export async function analyzeFile(file: File): Promise<Subject> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  let init: RequestInit;

  if (ext === "pdf") {
    if (file.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`PDF 超過 ${MAX_PDF_MB} MB，請壓縮或拆成較小的檔案。`);
    const body = new FormData();
    body.append("file", file);
    init = { method: "POST", body };
  } else if (ext === "pptx" || ext === "docx") {
    const text = await extractText(file, ext);
    if (text.replace(/【第 \d+ 頁】/g, "").trim().length < 30)
      throw new Error("這個檔案裡幾乎沒有文字（可能都是圖片），請另存成 PDF 再上傳。");
    init = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, text: text.slice(0, MAX_TEXT_CHARS) }),
    };
  } else {
    throw new Error("目前支援 PDF、PowerPoint（.pptx）與 Word（.docx）。舊版的 .ppt、.doc 請先另存新檔。");
  }

  let res: Response;
  try {
    res = await fetch("/api/analyze", init);
  } catch {
    throw new Error("連不上伺服器，請檢查網路後再試一次。");
  }
  const json = (await res.json().catch(() => null)) as { set?: unknown; error?: string } | null;
  if (!res.ok || !json?.set) throw new Error(json?.error ?? "規劃路線時出了點問題，請再試一次。");

  const set = parseSet(JSON.stringify(json.set), { lenient: true });
  return { ...set, ai: true, desc: set.desc === "我加入的題庫" ? `從「${file.name}」規劃的路線` : set.desc };
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

// 驗證並整理一份題庫 JSON（格式見 data/types.ts 的 Subject）。格式不對會丟出中文錯誤訊息。
// lenient：遇到格式不對的題目就跳過（給 AI 產生的內容用），不整份失敗。
export function parseSet(text: string, opts: { lenient?: boolean } = {}): Subject {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("這個檔案不是正確的 JSON 格式。");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("題庫格式不正確。");
  const name = str(raw.name) || (opts.lenient ? "我的練習題" : "");
  if (!name) throw new Error("題庫缺少科目名稱（name）。");

  const questions: Question[] = [];
  const essays: EssayQ[] = [];
  const list = [...(Array.isArray(raw.questions) ? raw.questions : []), ...(Array.isArray(raw.essays) ? raw.essays : [])];

  function add(item: Record<string, unknown>, n: number) {
    let question = str(item?.question);
    // AI 有時會把「(A)… (B)…」選項也留在題幹裡：選項已經另外列出時，把題幹後面那段拿掉
    if (opts.lenient && Array.isArray(item?.options) && item.options.length > 1) {
      const cut = question.replace(/\s*[(（]\s*A\s*[)）][\s\S]*$/, "").trim();
      if (cut.length >= 4) question = cut;
    }
    if (!question) throw new Error(`第 ${n} 題沒有題目內容。`);
    const id = opts.lenient ? `q${n}` : str(item.id) || `q${n}`;
    const topic = str(item.topic) || undefined;
    const explanation = str(item.explanation);
    const options = strs(item.options);
    const type = str(item.type) || (item.title ? "short" : "");
    const tg = strs(item.tags);
    const extra = tg.length ? { tags: tg } : {};

    if (type === "choice") {
      const answer = Number(item.answer);
      if (options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length)
        throw new Error(`第 ${n} 題（單選）的選項或答案不正確。`);
      questions.push({ id, topic, question, explanation, ...extra, type, options, answer });
    } else if (type === "multi") {
      const answer = Array.isArray(item.answer) ? [...new Set(item.answer.map(Number))] : [];
      if (options.length < 2 || !answer.length || answer.some((a) => !Number.isInteger(a) || a < 0 || a >= options.length))
        throw new Error(`第 ${n} 題（複選）的選項或答案不正確。`);
      questions.push({ id, topic, question, explanation, ...extra, type, options, answer });
    } else if (type === "tf") {
      if (typeof item.answer !== "boolean") throw new Error(`第 ${n} 題（是非）的答案要是 true 或 false。`);
      questions.push({ id, topic, question, explanation, ...extra, type, answer: item.answer });
    } else if (type === "fill") {
      const answer = typeof item.answer === "string" ? [item.answer.trim()].filter(Boolean) : strs(item.answer);
      if (!answer.length) throw new Error(`第 ${n} 題（填空）沒有答案。`);
      questions.push({ id, topic, question, explanation, ...extra, type, answer });
    } else if (type === "order") {
      const answer = strs(item.answer);
      if (answer.length < 2) throw new Error(`第 ${n} 題（排序）至少要有兩個項目。`);
      questions.push({ id, topic, question, explanation, ...extra, type, answer });
    } else if (type === "short") {
      const answer = typeof item.answer === "string" ? [item.answer.trim()].filter(Boolean) : strs(item.answer);
      if (!answer.length) throw new Error(`第 ${n} 題（簡答）沒有參考答案。`);
      essays.push({ id, topic, question, answer, title: str(item.title) || `簡答題 ${essays.length + 1}`, plain: str(item.plain) || undefined });
    } else {
      throw new Error(`第 ${n} 題的題型（type）要是 choice、multi、tf、fill、order 或 short。`);
    }
  }

  list.forEach((item: Record<string, unknown>, i: number) => {
    try {
      add(item, i + 1);
    } catch (e) {
      if (!opts.lenient) throw e;
    }
  });

  if (!questions.length && !essays.length) throw new Error(opts.lenient ? "AI 沒有從這份檔案整理出題目，請換一個檔案試試。" : "這份題庫裡沒有題目。");

  // AI 偶爾會分太多主題：只留題數最多的 5 個，其餘併成「其他」，路線圖才不會太長
  if (opts.lenient) {
    const all = [...questions, ...essays];
    const count = new Map<string, number>();
    for (const q of all) if (q.topic) count.set(q.topic, (count.get(q.topic) ?? 0) + 1);
    if (count.size > 6) {
      const keep = new Set([...count].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t));
      for (const q of all) if (!q.topic || !keep.has(q.topic)) q.topic = "其他";
    }
  }
  const topics = [...new Set([...questions, ...essays].map((q) => q.topic).filter((t): t is string => !!t))];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  const ex = raw.exam && typeof raw.exam === "object" ? (raw.exam as Record<string, unknown>) : null;
  const ec = ex && [num(ex.choiceCount), num(ex.choicePoint), num(ex.essayCount), num(ex.essayPoint)];
  const exam =
    ec && ec.every((n) => n !== null) && (ec[0]! + ec[2]!) > 0
      ? { name: str(ex!.name) || "模擬考", choiceCount: ec[0]!, choicePoint: ec[1]!, essayCount: ec[2]!, essayPoint: ec[3]!, note: str(ex!.note) || undefined }
      : undefined;
  const color = /^#[0-9a-f]{6}$/i.test(str(raw.color)) ? str(raw.color) : undefined;
  const modes = Array.isArray(raw.modes)
    ? (raw.modes as Record<string, unknown>[]).map((m) => ({ id: str(m?.id), label: str(m?.label) })).filter((m) => m.id && m.label)
    : [];
  const roundSize = num(raw.roundSize) || undefined;
  return {
    id: `custom-${Date.now().toString(36)}`,
    name,
    desc: str(raw.desc) || "我加入的題庫",
    year: raw.year != null && String(raw.year).trim() ? String(raw.year).trim() : undefined,
    highlights: strs(raw.highlights),
    topics: topics.map((t) => ({ name: t })),
    questions,
    essays,
    custom: true,
    exam,
    color,
    modes: modes.length ? modes : undefined,
    roundSize,
  };
}
