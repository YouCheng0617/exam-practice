"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SUBJECTS } from "@/data/subjects";
import type { Subject } from "@/data/types";
import { ACCEPT, MAX_PDF_MB, analyzeFile, parseSet } from "@/lib/analyze";
import { decodeSet, readShareHash, shareKeyOf, shareUrl } from "@/lib/share";
import { sfx } from "@/lib/sound";
import { DailyChart, SubjectChart, TrendChart } from "./Charts";
import { Journal } from "./Journal";
import { Compass, InkDefs, Mascot, PlaneTrail, Scenery, Stamp, VisaStamp } from "./Travel";
import {
  EMPTY,
  KIND_LABEL,
  accuracy,
  allQuestions,
  colorOf,
  tripOf,
  nextColor,
  streak,
  keyOf,
  kindOf,
  loadData,
  recordAnswer,
  saveData,
  toggleMark,
  topicStats,
  typeLabel,
  type AnyQ,
  type Attempt,
  type Data,
  type JournalCard,
  type Kind,
  type TopicStat,
} from "@/lib/store";

type Session = { set: Subject; items: AnyQ[]; mode: "practice" | "exam"; label: string };
type Outcome = { q: AnyQ; ok: boolean; given: string };
type View =
  | { name: "library" }
  | { name: "set"; id: string }
  | { name: "practice"; session: Session; run: number }
  | { name: "result"; session: Session; outcomes: Outcome[] }
  | { name: "history" }
  | { name: "journal" };

const MAX_FILE_MB = 20;

const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const GOOD_LINES = ["順利抵達！", "路標看得懂！", "漂亮，繼續前進", "太會找路了！", "穩穩走到下一站"];
const BAD_LINES = ["迷路了？看看路標再走一次", "差一點點，下一站會更好", "這條路也是學習的一部分", "再試一次，路就會熟了", "記下來，下次就認得了"];
const tint = (c: string) => ({ "--c": c }) as React.CSSProperties;

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));
const norm = (s: string) =>
  s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "")
    .toLowerCase();
const letter = (i: number) => "ABCDEFGH"[i] ?? "";

// 選項打亂順序，避免背位置。選項裡有「以上皆是」「A 與 B」這類依位置描述的，打亂會變成錯的，所以那題保持原順序。
const POSITIONAL = /以上(?:皆|均|都|全|各項|所述|選項)|以下皆|皆(?:是|非|正確|錯誤|對|錯)|都(?:對|錯)|[A-HＡ-Ｈ]\s*[和與及、,，]\s*[A-HＡ-Ｈ]|選項|前述|上述/;
function shuffleOptions(q: AnyQ): AnyQ {
  if (q.type !== "choice" && q.type !== "multi") return q;
  if (q.options.some((o) => POSITIONAL.test(o))) return q;
  const order = shuffle(q.options.map((_, i) => i)); // order[新位置] = 原本的位置
  const options = order.map((i) => q.options[i]);
  if (q.type === "choice") return { ...q, options, answer: order.indexOf(q.answer) };
  return { ...q, options, answer: q.answer.map((a) => order.indexOf(a)) };
}
// 簡答題：用「兩個字一組」比對，粗略判斷使用者的答案有沒有提到某個重點
const grams = (t: string) => {
  const c = norm(t).replace(/[^\p{L}\p{N}]/gu, "");
  const g = new Set<string>();
  for (let i = 0; i < c.length - 1; i++) g.add(c.slice(i, i + 2));
  return g;
};
function covers(answer: string, point: string) {
  const a = grams(answer);
  const p = grams(point);
  if (!a.size || !p.size) return false;
  let hit = 0;
  for (const x of p) if (a.has(x)) hit++;
  return hit >= 3 || hit / p.size >= 0.25;
}

// 給手帳用：只寫答案內容，不寫 A/B/C（每次打亂後字母都不一樣）
function answerPlain(q: AnyQ): string {
  if (q.type === "choice") return q.options[q.answer];
  if (q.type === "multi") return [...q.answer].sort((a, b) => a - b).map((i) => q.options[i]).join("、");
  return answerText(q);
}

function answerText(q: AnyQ): string {
  if (q.type === "choice") return `${letter(q.answer)}. ${q.options[q.answer]}`;
  if (q.type === "multi") return [...q.answer].sort((a, b) => a - b).map((i) => `${letter(i)}. ${q.options[i]}`).join("、");
  if (q.type === "tf") return q.answer ? "對" : "錯";
  if (q.type === "fill") return q.answer.join(" 或 ");
  return q.answer.join(" ");
}

// ---------- 小圖示 ----------
const Check = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
    <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Cross = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);
const Bookmark = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
    <path d="M5.5 3.5h9v13l-4.5-3.2-4.5 3.2z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
const UploadIcon = () => (
  <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden>
    <path d="M16 21V7m0 0l-5.5 5.5M16 7l5.5 5.5M6 21v3.5h20V21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ============================================================
export default function Home() {
  const [data, setData] = useState<Data>(EMPTY);
  const [view, setView] = useState<View>({ name: "library" });

  const [incoming, setIncoming] = useState<{ set: Subject; key: string } | { error: string } | null>(null);

  useEffect(() => setData(loadData()), []);

  // 打開別人分享的連結：#s=… 解開後先問要不要加入
  useEffect(() => {
    const code = readShareHash();
    if (!code) return;
    history.replaceState(null, "", location.pathname + location.search);
    try {
      setIncoming({ set: decodeSet(code), key: shareKeyOf(code) });
    } catch (e) {
      setIncoming({ error: e instanceof Error ? e.message : "這個分享連結打不開。" });
    }
  }, []);

  const update = useCallback((fn: (d: Data) => Data) => {
    setData((d) => {
      const n = fn(d);
      saveData(n);
      return n;
    });
  }, []);

  const sets = useMemo(() => [...data.custom, ...SUBJECTS], [data.custom]);

  function go(v: View) {
    setView(v);
    window.scrollTo({ top: 0 });
  }
  // 每次出發都重新打亂選項（「回頭再走一次」也會再打亂一次）
  const start = (session: Session) => go({ name: "practice", session: { ...session, items: session.items.map(shuffleOptions) }, run: Date.now() });

  function finish(session: Session, outcomes: Outcome[]) {
    if (!outcomes.length) return go({ name: "set", id: session.set.id });
    const right = outcomes.filter((o) => o.ok).length;
    const a: Attempt = {
      id: Date.now().toString(36),
      setId: session.set.id,
      setName: session.set.name,
      at: Date.now(),
      mode: session.mode,
      total: outcomes.length,
      right,
    };
    const e = session.set.exam;
    if (session.mode === "exam" && e) {
      const pt = (q: AnyQ) => (q.type === "short" ? e.essayPoint : e.choicePoint);
      a.score = outcomes.reduce((s, o) => s + (o.ok ? pt(o.q) : 0), 0);
      a.max = session.items.reduce((s, q) => s + pt(q), 0);
    }
    update((d) => ({ ...d, attempts: [a, ...d.attempts].slice(0, 200) }));
    go({ name: "result", session, outcomes });
  }

  function acceptIncoming() {
    if (!incoming || "error" in incoming) return;
    const same = data.custom.find((s) => s.shareKey === incoming.key);
    if (same) {
      setIncoming(null);
      return go({ name: "set", id: same.id });
    }
    const s = { ...incoming.set, shareKey: incoming.key, color: incoming.set.color ?? nextColor(sets) };
    update((d) => ({ ...d, custom: [s, ...d.custom] }));
    setIncoming(null);
    go({ name: "set", id: s.id });
  }

  const current = view.name === "set" ? sets.find((s) => s.id === view.id) : undefined;
  const tab = view.name === "history" || view.name === "journal" ? view.name : "library";
  const days = streak(data);
  // 進到某一科時，整頁換成那一科的顏色
  const themed = view.name === "practice" || view.name === "result" ? view.session.set : current;

  return (
    <>
      <InkDefs />
      <header className="nav">
        <div className="nav-in">
          <button className="brand" onClick={() => go({ name: "library" })}>
            <Compass />
            <span className="brand-name">沿途</span>
            <span className="brand-tag">過程本身，就是風景</span>
          </button>
          <nav>
            <button className={tab === "library" ? "on" : ""} onClick={() => go({ name: "library" })}>
              車站
            </button>
            <button className={tab === "journal" ? "on" : ""} onClick={() => go({ name: "journal" })}>
              手帳
            </button>
            <button className={tab === "history" ? "on" : ""} onClick={() => go({ name: "history" })}>
              足跡
            </button>
            {days > 0 && (
              <span className="streak" title={`已經連續出發 ${days} 天`}>
                🔥 {days} 天
              </span>
            )}
            <button
              className="sound"
              onClick={() => update((d) => ({ ...d, sound: !d.sound }))}
              aria-label={data.sound ? "關閉音效" : "開啟音效"}
              title={data.sound ? "關閉音效" : "開啟音效"}
            >
              {data.sound ? "🔊" : "🔇"}
            </button>
          </nav>
        </div>
      </header>

      <main
        className="page"
        style={themed ? tint(colorOf(themed)) : undefined}
        key={view.name + (view.name === "set" ? view.id : "") + (view.name === "practice" ? view.run : "")}
      >
        {view.name === "library" && (
          <Library
            sets={sets}
            data={data}
            onOpen={(id) => go({ name: "set", id })}
            onAdd={(added) => {
              const s = { ...added, color: added.color ?? nextColor(sets) };
              update((d) => ({ ...d, custom: [s, ...d.custom] }));
              go({ name: "set", id: s.id });
            }}
          />
        )}
        {view.name === "set" &&
          (current ? (
            <SetPage
              set={current}
              data={data}
              onBack={() => go({ name: "library" })}
              onStart={start}
              onDelete={() => {
                update((d) => ({ ...d, custom: d.custom.filter((s) => s.id !== current.id) }));
                go({ name: "library" });
              }}
            />
          ) : (
            <Library sets={sets} data={data} onOpen={(id) => go({ name: "set", id })} onAdd={() => {}} />
          ))}
        {view.name === "practice" && (
          <Practice
            session={view.session}
            marks={data.marks}
            sound={data.sound}
            onAnswer={(key, ok, card) =>
              update((d) => {
                const n = recordAnswer(d, key, ok);
                return n.journal.some((c) => c.key === key) ? n : { ...n, journal: [card, ...n.journal].slice(0, 2000) };
              })
            }
            onMark={(key) => update((d) => toggleMark(d, key))}
            onFinish={(o) => finish(view.session, o)}
          />
        )}
        {view.name === "result" && (
          <Result
            session={view.session}
            outcomes={view.outcomes}
            sound={data.sound}
            complete={tripOf(data, view.session.set).done}
            onRetry={(items) => start({ ...view.session, items, mode: "practice", label: "回頭再走一次" })}
            onBack={() => go({ name: "set", id: view.session.set.id })}
          />
        )}
        {view.name === "journal" && <Journal sets={sets} data={data} onOpen={(id) => go({ name: "set", id })} />}
        {view.name === "history" && <History sets={sets} data={data} onStart={start} onClear={() => update((d) => ({ ...d, stats: {}, attempts: [] }))} />}
      </main>
      {view.name !== "practice" && <Scenery />}
      {incoming && (
        <div className="share-in" role="dialog" aria-label="匯入分享的路線">
          <Mascot mood={"error" in incoming ? "comfort" : "wow"} className="share-in-pic" />
          {"error" in incoming ? (
            <div>
              <p>{incoming.error}</p>
              <div className="actions">
                <button className="btn" onClick={() => setIncoming(null)}>
                  關閉
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p>
                <b>有人分享了一條路線給你</b>
                <br />「{incoming.set.name}」・{allQuestions(incoming.set).length} 個路標
              </p>
              <div className="actions">
                <button className="btn primary" onClick={acceptIncoming}>
                  加入我的車站
                </button>
                <button className="btn" onClick={() => setIncoming(null)}>
                  不用了
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ============================================================
// 題庫首頁
// ============================================================
function Library(props: { sets: Subject[]; data: Data; onOpen: (id: string) => void; onAdd: (s: Subject) => void }) {
  const { sets, data, onOpen, onAdd } = props;
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState("");

  const names = [...new Set(sets.map((s) => s.name))];
  const years = [...new Set(sets.map((s) => s.year).filter((y): y is string => !!y))].sort().reverse();
  const shown = sets.filter((s) => (!subject || s.name === subject) && (!year || s.year === year));

  return (
    <>
      <section className="hero">
        <PlaneTrail />
        <div className="hero-text">
          <h1>
            在不同的風景裡走一圈，
            <br />
            找到<mark>自己的答案</mark>。
          </h1>
          <p className="lead">每一科都是一個有自己風景和人文的地方。挑一張車票上車，重點不是分數，是沿途看懂了什麼——下一站也許就派得上用場。</p>
        </div>
        <Upload onAdd={onAdd} />
      </section>

      <section className="block">
        <h2>今天想去哪一站？</h2>
        {(names.length > 1 || years.length > 0) && (
          <div className="filters">
            {names.length > 1 && (
              <div className="chips" role="group" aria-label="科目">
                <button className={`chip ${subject === "" ? "on" : ""}`} onClick={() => setSubject("")}>
                  全部路線
                </button>
                {names.map((n) => (
                  <button key={n} className={`chip ${subject === n ? "on" : ""}`} onClick={() => setSubject(n)}>
                    {n}
                  </button>
                ))}
              </div>
            )}
            {years.length > 0 && (
              <div className="chips" role="group" aria-label="年份">
                <button className={`chip ${year === "" ? "on" : ""}`} onClick={() => setYear("")}>
                  全部年份
                </button>
                {years.map((y) => (
                  <button key={y} className={`chip ${year === y ? "on" : ""}`} onClick={() => setYear(y)}>
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="tickets">
          {shown.map((s, i) => {
            const qs = allQuestions(s);
            const acc = accuracy(data, qs.map((q) => keyOf(s, q)));
            const trip = tripOf(data, s);
            return (
              <button key={s.id} className={`ticket ${trip.done ? "done" : ""}`} style={tint(colorOf(s))} onClick={() => onOpen(s.id)}>
                <span className="tk-main">
                  <span className="tk-line">{["沿途鐵道", s.ai ? "AI 規劃" : s.custom ? "自由行" : "精選路線", s.year].filter(Boolean).join("・")}</span>
                  <span className="tk-route">
                    <small>出發</small>
                    <i aria-hidden />
                    <b>{s.name}</b>
                  </span>
                  <span className="tk-desc">{s.desc}</span>
                  <span className="tk-info">
                    <span>
                      <small>路標</small>
                      {qs.length} 題
                    </span>
                    <span>
                      <small>抵達</small>
                      {trip.arrived} / {trip.stations.length} 站
                    </span>
                    <span>
                      <small>看懂</small>
                      {acc.pct === null ? "—" : `${acc.pct}%`}
                    </span>
                  </span>
                </span>
                <span className="tk-stub">
                  <small>STOP</small>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  <span className="tk-bar" aria-hidden />
                  <span className="tk-go">{trip.done ? "再走一次" : trip.started ? "繼續旅程" : "上車"} ›</span>
                </span>
                {trip.done && <Stamp text="全線走完" sub="COMPLETED" className="tk-stamp red" />}
              </button>
            );
          })}
        </div>
        {shown.length === 0 && <p className="empty"><Mascot mood="wow" className="m-empty" />{sets.length === 0 ? "還沒有車票。上傳一份考古題，或打開朋友分享給你的連結，就能出發。" : "這條路線還沒有車票，換一個試試。"}</p>}
      </section>

      <section className="block buddy">
        <Mascot mood="normal" className="buddy-pic" />
        <div>
          <p className="eyebrow">你的旅伴</p>
          <h2>
            雪丸 <small>Yukimaru</small>
          </h2>
          <p>
            一隻充滿好奇心、愛探險的小鳥，來自很冷很冷的地方，所以超級怕熱。為了學會各地的知識，牠跟家人道別，圍上領巾、背起小背包，踏上自己的旅程。
          </p>
          <p className="fine">每一科都是雪丸還沒去過的地方。陪牠走一圈，你們都會找到自己的答案。</p>
        </div>
      </section>
    </>
  );
}

// ---------- 上傳 ----------
function Upload({ onAdd }: { onAdd: (s: Subject) => void }) {
  const [drag, setDrag] = useState(false);
  const [state, setState] = useState<{ kind: "idle" | "busy" | "pending" | "error"; file?: string; msg?: string }>({ kind: "idle" });
  const input = useRef<HTMLInputElement>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const info = `${file.name}・${(file.size / 1024 / 1024).toFixed(1)} MB`;
    try {
      if (!ACCEPT.split(",").includes(`.${ext}`)) throw new Error("目前支援 PDF、PowerPoint（.pptx）與 Word（.docx）。舊版的 .ppt、.doc 請先另存新檔。");
      if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`檔案超過 ${MAX_FILE_MB} MB，請先拆成較小的檔案。`);
      if (ext === "json") return onAdd(parseSet(await file.text()));
      setState({ kind: "busy", file: info });
      onAdd(await analyzeFile(file));
    } catch (e) {
      setState({ kind: "error", file: info, msg: e instanceof Error ? e.message : "處理檔案時發生問題，請再試一次。" });
    }
  }

  return (
    <section className="upload-wrap">
      <Mascot mood={state.kind === "busy" ? "wait" : "wave"} className="m-upload" />
      <p className="m-bubble hand">{state.kind === "busy" ? "雪丸正在規劃路線…" : "我是雪丸！帶一份考古題來，我們一起出發。"}</p>
      <div
        className={`upload ${drag ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files[0]);
        }}
      >
        <span className="upload-icon">
          <UploadIcon />
        </span>
        <p className="upload-title">帶一份考古題上車</p>
        <p className="upload-sub">
          PDF（{MAX_PDF_MB} MB 內）、PowerPoint、Word 都可以
        </p>
        <button className="btn primary" onClick={() => input.current?.click()} disabled={state.kind === "busy"}>
          選擇檔案
        </button>
        <p className="upload-note">檔案會交給 Google 的 AI 整理，請不要上傳有個人資料的文件。</p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            handle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {state.kind !== "idle" && (
        <div className={`notice ${state.kind}`} role="status">
          <div>
            <p className="notice-file">{state.file}</p>
            {state.kind === "busy" && <p className="busy"><Mascot mood="wait" className="m-inline" />雪丸正在規劃路線：讀檔、整理重點、立路標…大約半分鐘，先別離開這一頁。</p>}
            {state.kind === "error" && <p>{state.msg}</p>}
          </div>
          {state.kind !== "busy" && (
            <button className="link" onClick={() => setState({ kind: "idle" })}>
              關閉
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ============================================================
// 單一題庫
// ============================================================
function SetPage(props: { set: Subject; data: Data; onBack: () => void; onStart: (s: Session) => void; onDelete: () => void }) {
  const { set, data, onBack, onStart, onDelete } = props;
  const all = useMemo(() => allQuestions(set), [set]);
  const kindsAvail = (["choice", "fill", "short"] as Kind[]).filter((k) => all.some((q) => kindOf(q) === k));
  const [scope, setScope] = useState<"all" | "marked" | "wrong">("all");
  const [kinds, setKinds] = useState<Kind[]>(kindsAvail);
  const [confirmDel, setConfirmDel] = useState(false);

  const marked = all.filter((q) => data.marks.includes(keyOf(set, q)));
  const wrong = all.filter((q) => {
    const s = data.stats[keyOf(set, q)];
    return s && !s.last;
  });
  const base = scope === "marked" ? marked : scope === "wrong" ? wrong : all;
  const items = base.filter((q) => kinds.includes(kindOf(q)));
  const acc = accuracy(data, all.map((q) => keyOf(set, q)));
  const trip = tripOf(data, set);
  const e = set.exam;

  function startExam() {
    if (!e) return;
    const c = shuffle(all.filter((q) => kindOf(q) === "choice")).slice(0, e.choiceCount);
    const s = shuffle(all.filter((q) => q.type === "short")).slice(0, e.essayCount);
    onStart({ set, items: [...c, ...s], mode: "exam", label: "模擬考" });
  }
  const examMax = e ? e.choiceCount * e.choicePoint + e.essayCount * e.essayPoint : 0;

  return (
    <>
      <button className="back" onClick={onBack}>
        ‹ 回車站
      </button>
      <section className="passport">
        <div className="pp-page pp-id">
          <span className="pp-label">PASSPORT・學習護照</span>
          <h1>{set.name}</h1>
          <p className="pp-desc">{set.desc}</p>
          <dl className="pp-fields">
            <div>
              <dt>路標 Questions</dt>
              <dd>{all.length}</dd>
            </div>
            <div>
              <dt>看懂 Accuracy</dt>
              <dd className={acc.pct === null ? "muted" : "accent"}>{acc.pct === null ? "—" : `${acc.pct}%`}</dd>
            </div>
            <div>
              <dt>還不熟 Marked</dt>
              <dd>{marked.length}</dd>
            </div>
            <div>
              <dt>路線 Type</dt>
              <dd className="small">{[set.ai ? "AI 規劃" : set.custom ? "自由行" : "精選路線", set.year].filter(Boolean).join("・")}</dd>
            </div>
          </dl>
          <p className="pp-mrz" aria-hidden>
            {`P<KAOGUTI<<${set.id.toUpperCase().replace(/[^A-Z0-9]/g, "<")}`.padEnd(34, "<")}
          </p>
        </div>
        <div className="pp-page pp-visa">
          <span className="pp-label">
            VISAS・入境章 {trip.arrived} / {trip.stations.length}
          </span>
          <div className="pp-stamps">
            {trip.stations.map((x, i) => (
              <VisaStamp key={x.topic} topic={x.topic} index={i} done={x.done} progress={`${x.cleared} / ${x.total}`} />
            ))}
          </div>
          {trip.done ? (
            <Stamp text="全線走完" sub="COMPLETED" className="pp-done red" />
          ) : (
            <p className="fine">一站裡的路標都看懂，就會蓋上那一站的入境章。</p>
          )}
        </div>
      </section>

      <ShareButton set={set} />

      {set.ai && <p className="ai-note">這條路線是 AI 依你上傳的檔案規劃的，答案偶爾會出錯。覺得怪怪的，請對照原本的考古題。</p>}

      <section className="panel">
        <h2>這趟想怎麼走？</h2>
        <div className="seg" role="group" aria-label="範圍">
          {(
            [
              ["all", "全線", all.length],
              ["marked", "還不熟", marked.length],
              ["wrong", "上次迷路", wrong.length],
            ] as const
          ).map(([k, label, n]) => (
            <button key={k} className={scope === k ? "on" : ""} onClick={() => setScope(k)}>
              {label}
              <small>{n}</small>
            </button>
          ))}
        </div>
        {kindsAvail.length > 1 && (
          <div className="chips" role="group" aria-label="題型">
            {kindsAvail.map((k) => (
              <button
                key={k}
                className={`chip ${kinds.includes(k) ? "on" : ""}`}
                aria-pressed={kinds.includes(k)}
                onClick={() => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))}
              >
                {KIND_LABEL[k]}・{base.filter((q) => kindOf(q) === k).length}
              </button>
            ))}
          </div>
        )}
        <div className="actions">
          <button
            className="btn primary large"
            disabled={items.length === 0}
            onClick={() => onStart({ set, items: shuffle(items), mode: "practice", label: scope === "all" ? "練習" : scope === "marked" ? "還不熟的路標" : "上次迷路的路標" })}
          >
            {items.length ? `出發！${items.length} 題` : "這裡沒有路標"}
          </button>
          {e && (
            <button className="btn large" onClick={startExam}>
              模擬考・滿分 {examMax}
            </button>
          )}
        </div>
        {e && (
          <p className="fine">
            模擬考：
            {e.choiceCount > 0 && `選擇 ${e.choiceCount} 題 × ${e.choicePoint} 分`}
            {e.choiceCount > 0 && e.essayCount > 0 && "＋"}
            {e.essayCount > 0 && `簡答 ${e.essayCount} 題 × ${e.essayPoint} 分`}
            {e.note ? `。${e.note}` : ""}
          </p>
        )}
      </section>

      {set.highlights && set.highlights.length > 0 && (
        <section className="block">
          <h2>行前須知</h2>
          <ol className="highlights">
            {set.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        </section>
      )}

      <section className="block">
        <h2>路線圖</h2>
        <p className="fine route-hint">想從哪一站上車都可以，點一站就出發。</p>
        <ol className="route">
          {trip.stations.map((x) => (
            <li key={x.topic} className={x.done ? "done" : x.seen ? "going" : ""}>
              <button onClick={() => onStart({ set, items: shuffle(x.items), mode: "practice", label: `${x.topic}站` })}>
                <span className="rt-dot" aria-hidden>
                  {x.done && <Check />}
                </span>
                <span className="rt-name">
                  {x.topic}
                  <small>{x.done ? "已抵達，蓋章了" : x.seen ? `走到一半・看懂 ${x.cleared} / ${x.total}` : `還沒出發・${x.total} 個路標`}</small>
                </span>
                <span className="rt-go">{x.done ? "再走一次" : "出發"} ›</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      {set.custom && (
        <p className="fine center">
          {confirmDel ? (
            <>
              確定要丟掉這本護照嗎？紀錄不會留下。
              <button className="link danger" onClick={onDelete}>
                刪除
              </button>
              <button className="link" onClick={() => setConfirmDel(false)}>
                取消
              </button>
            </>
          ) : (
            <button className="link" onClick={() => setConfirmDel(true)}>
              丟掉這本護照
            </button>
          )}
        </p>
      )}
    </>
  );
}

// 分享這條路線：手機用系統的分享選單，電腦直接複製連結
function ShareButton({ set }: { set: Subject }) {
  const [msg, setMsg] = useState("");
  async function share() {
    const url = shareUrl(set);
    if (navigator.share) {
      try {
        await navigator.share({ title: `沿途｜${set.name}`, text: `跟我一起走「${set.name}」這條路線`, url });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setMsg("已複製分享連結，貼給朋友就能一起走這條路線。");
    } catch {
      setMsg("沒辦法自動複製，請稍後再試一次。");
    }
  }
  return (
    <div className="share-row">
      <button className="btn" onClick={share}>
        分享這條路線
      </button>
      <span className="fine">{msg || "連結裡就是整份題庫，拿到連結的人都能匯入；題庫不會存在我們的伺服器。"}</span>
    </div>
  );
}

// 主題掌握度列表：點一列就練習那個主題
function TopicList({ rows, showSet, onStart }: { rows: TopicStat[]; showSet: boolean; onStart: (s: Session) => void }) {
  return (
    <ul className="topics">
      {rows.map((r) => (
        <li key={r.set.id + r.topic} style={tint(colorOf(r.set))}>
          <button
            onClick={() => {
              const items = allQuestions(r.set).filter((q) => (q.topic ?? (q.type === "short" ? "簡答題" : "其他")) === r.topic);
              onStart({ set: r.set, items: shuffle(items), mode: "practice", label: r.topic });
            }}
          >
            <span className="topic-name">
              {r.topic}
              {showSet && <small>{r.set.name}</small>}
            </span>
            <span className="bar" aria-hidden>
              <i style={{ width: `${r.pct}%` }} />
            </span>
            <span className="topic-pct">{r.pct}%</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ============================================================
// 作答
// ============================================================
function Practice(props: {
  session: Session;
  marks: string[];
  sound: boolean;
  onAnswer: (key: string, ok: boolean, card: JournalCard) => void;
  onMark: (key: string) => void;
  onFinish: (o: Outcome[]) => void;
}) {
  const { session, marks, sound, onAnswer, onMark, onFinish } = props;
  const { set, items } = session;
  const [idx, setIdx] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const [combo, setCombo] = useState(0);
  const [line, setLine] = useState("");

  const q = items[idx];
  const key = keyOf(set, q);
  const last = idx + 1 >= items.length;
  const done = idx + (result ? 1 : 0);

  const answer = useCallback(
    (ok: boolean, given: string) => {
      if (result) return;
      const o = { q, ok, given };
      setResult(o);
      setOutcomes((cur) => [...cur, o]);
      const card: JournalCard = {
        key,
        setId: set.id,
        setName: set.name,
        topic: q.topic,
        question: q.question,
        answer: q.type === "short" ? "" : answerPlain(q),
        note: q.type === "short" ? q.answer.join("；") : q.explanation || answerPlain(q),
        at: Date.now(),
      };
      onAnswer(key, ok, card);
      const c = ok ? combo + 1 : 0;
      setCombo(c);
      setLine(ok ? (c >= 3 ? `連對 ${c} 題，手感正熱！` : pickOne(GOOD_LINES)) : pickOne(BAD_LINES));
      if (sound) (ok ? sfx.right(c) : sfx.wrong());
    },
    [result, q, key, onAnswer, combo, sound, set],
  );

  const next = useCallback(() => {
    if (last) return onFinish(outcomes);
    setIdx((i) => i + 1);
    setSel([]);
    setText("");
    setRevealed(false);
    setResult(null);
    window.scrollTo({ top: 0 });
  }, [last, outcomes, onFinish]);

  const pick = useCallback(
    (i: number) => {
      if (result) return;
      if (q.type === "choice") answer(i === q.answer, `${letter(i)}. ${q.options[i]}`);
      if (q.type === "multi") setSel((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
    },
    [result, q, answer],
  );
  const submitMulti = useCallback(() => {
    if (q.type !== "multi" || !sel.length) return;
    const given = [...sel].sort((a, b) => a - b).map((i) => `${letter(i)}. ${q.options[i]}`).join("、");
    answer(sameSet(sel, q.answer), given);
  }, [q, sel, answer]);
  function submitFill() {
    if (q.type !== "fill" || !text.trim()) return;
    answer(q.answer.some((a) => norm(a) === norm(text)), text.trim());
  }

  // 鍵盤：1–4 / A–D 選答，Enter 送出或下一題
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "Enter" && result) {
        e.preventDefault();
        return next();
      }
      if (typing || result) return;
      if (q.type === "choice" || q.type === "multi") {
        const n = "1234".indexOf(e.key) >= 0 ? "1234".indexOf(e.key) : "abcd".indexOf(e.key.toLowerCase());
        if (n >= 0 && n < q.options.length) pick(n);
        else if (e.key === "Enter" && q.type === "multi") {
          e.preventDefault(); // 避免同時觸發焦點所在的選項
          submitMulti();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, result, next, pick, submitMulti]);

  const isMarked = marks.includes(key);

  return (
    <div className="practice">
      <div className="p-top">
        <button className="link" onClick={() => onFinish(outcomes)}>
          先下車
        </button>
        <span className="p-count">
          <b>{idx + 1}</b> / {items.length}
          {combo >= 2 && (
            <span className="combo" key={combo}>
              🔥 連對 {combo}
            </span>
          )}
        </span>
        <button className={`mark ${isMarked ? "on" : ""}`} onClick={() => onMark(key)} aria-pressed={isMarked}>
          <Bookmark on={isMarked} />
          {isMarked ? "已標記" : "還不熟"}
        </button>
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done}>
        <i style={{ width: `${(done / items.length) * 100}%` }} />
      </div>

      <article className={`q ${result && !result.ok ? "shake" : ""}`} key={q.id}>
        <p className="eyebrow">
          {[set.name, session.label !== "練習" ? session.label : "", q.topic, typeLabel(q)].filter(Boolean).join("・")}
        </p>
        <h1 className="q-text">{q.question}</h1>

        {(q.type === "choice" || q.type === "multi") && (
          <>
            {q.type === "multi" && !result && <p className="fine">這題可以選很多個，全部選對才算過關。</p>}
            <div className="options">
              {q.options.map((o, i) => {
                const chosen = q.type === "multi" ? sel.includes(i) : result?.given.startsWith(`${letter(i)}.`);
                const right = q.type === "multi" ? q.answer.includes(i) : q.answer === i;
                let cls = "opt";
                if (chosen) cls += " sel";
                if (result) cls += right ? " right" : chosen ? " wrong" : " dim";
                return (
                  <button key={i} className={cls} disabled={!!result} onClick={() => pick(i)} aria-pressed={!!chosen}>
                    <span className="opt-key">{result && right ? <Check /> : result && chosen ? <Cross /> : letter(i)}</span>
                    <span>{o}</span>
                  </button>
                );
              })}
            </div>
            {q.type === "multi" && !result && (
              <button className="btn primary large" disabled={!sel.length} onClick={submitMulti}>
                送出答案
              </button>
            )}
          </>
        )}

        {q.type === "tf" && (
          <div className="options two">
            {[true, false].map((v) => {
              const chosen = result?.given === (v ? "對" : "錯");
              let cls = "opt center";
              if (result) cls += v === q.answer ? " right" : chosen ? " wrong" : " dim";
              return (
                <button key={String(v)} className={cls} disabled={!!result} onClick={() => answer(v === q.answer, v ? "對" : "錯")}>
                  {v ? "對" : "錯"}
                </button>
              );
            })}
          </div>
        )}

        {q.type === "fill" && (
          <form
            className="fill"
            onSubmit={(e) => {
              e.preventDefault();
              submitFill();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="輸入答案"
              disabled={!!result}
              autoFocus
              aria-label="答案"
              className={result ? (result.ok ? "right" : "wrong") : ""}
            />
            {!result && (
              <button className="btn primary large" disabled={!text.trim()}>
                送出答案
              </button>
            )}
          </form>
        )}

        {q.type === "short" && (
          <>
            {q.plain && <p className="plain">{q.plain}</p>}
            <textarea
              className="answer-box"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="寫下你的答案，只寫重點也可以…"
              disabled={revealed}
              rows={5}
              aria-label="你的答案"
            />
            {!revealed ? (
              <button className="btn primary large" onClick={() => setRevealed(true)}>
                {text.trim() ? "寫好了，翻開答案" : "我不會，直接翻開答案"}
              </button>
            ) : (
              <div className="feedback neutral">
                <p className="fb-title">參考答案</p>
                <ul className="points">
                  {q.answer.map((a, i) => {
                    const hit = covers(text, a);
                    return (
                      <li key={i} className={hit ? "hit" : ""}>
                        {a}
                        {hit && <small className="hit-tag">你有寫到</small>}
                      </li>
                    );
                  })}
                </ul>
                {!result && (
                  <div className="rate">
                    <span>
                      {text.trim()
                        ? `你寫的提到了 ${q.answer.filter((a) => covers(text, a)).length} / ${q.answer.length} 個重點（電腦比對，僅供參考）。跟參考答案差不多嗎？`
                        : "看完參考答案，下次遇到會寫了嗎？"}
                    </span>
                    <button className="btn primary" onClick={() => answer(true, text.trim())}>
                      有想到 👍
                    </button>
                    <button className="btn" onClick={() => answer(false, text.trim())}>
                      還不熟
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {result && q.type !== "short" && (
          <div className={`feedback ${result.ok ? "good" : "bad"}`}>
            <Mascot mood={result.ok ? "happy" : "comfort"} className="m-fb" />
            <p className="fb-title">
              <span className="fb-icon">{result.ok ? <Check /> : <Cross />}</span>
              {line}
            </p>
            {!result.ok && (
              <p className="fb-answer">
                正確答案：<b>{answerText(q)}</b>
              </p>
            )}
            {q.explanation && <p className="fb-exp">{q.explanation}</p>}
          </div>
        )}

        {result && q.type === "short" && <p className={`cheer ${result.ok ? "good" : "bad"}`}><Mascot mood={result.ok ? "happy" : "comfort"} className="m-inline" />{result.ok ? line : "沒關係，已經幫你記下來，之後再練。"}</p>}

        {result && (
          <button className="btn primary large next" onClick={next} autoFocus>
            {last ? "抵達終點" : "下一站"}
          </button>
        )}
      </article>
    </div>
  );
}

// ============================================================
// 結果
// ============================================================
function Result(props: { session: Session; outcomes: Outcome[]; sound: boolean; complete: boolean; onRetry: (items: AnyQ[]) => void; onBack: () => void }) {
  const { session, outcomes, sound, complete, onRetry, onBack } = props;
  useEffect(() => {
    if (sound) sfx.done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const right = outcomes.filter((o) => o.ok).length;
  const pct = Math.round((right / outcomes.length) * 100);
  const wrong = outcomes.filter((o) => !o.ok);
  const e = session.set.exam;
  const exam = session.mode === "exam" && e;
  const pt = (q: AnyQ) => (e ? (q.type === "short" ? e.essayPoint : e.choicePoint) : 0);
  const score = outcomes.reduce((s, o) => s + (o.ok ? pt(o.q) : 0), 0);
  const max = session.items.reduce((s, q) => s + pt(q), 0);
  const stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct > 0 ? 1 : 0;
  const cheer = complete
    ? "這條路線的每一站都抵達了，護照蓋滿章 🎉"
    : pct === 100
      ? "這一段的路標全都看懂了 🎉"
      : pct >= 80
        ? "走得很順，只有幾個路標要再看一眼"
        : pct >= 60
          ? "走了一大段路，迷路的地方最會記得"
          : "這趟有點崎嶇，但走過就認得路了";

  return (
    <>
      <section className="result">
        {pct === 100 && (
          <div className="confetti" aria-hidden>
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 6) * 0.12}s`, background: ["#f0603c", "#ffb020", "#17a08c", "#d9457a"][i % 4] }} />
            ))}
          </div>
        )}
        <p className="eyebrow">
          {session.set.name}・{session.label}
        </p>
        <Stamp text={complete ? "全線走完" : "抵達"} sub={session.set.name.slice(0, 8)} className={`result-stamp ${complete ? "red" : ""}`} />
        <p className="stars" aria-label={`${stars} 顆星`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < stars ? "on" : ""} style={{ animationDelay: `${0.25 + i * 0.18}s` }}>
              ★
            </span>
          ))}
        </p>
        <Mascot mood={pct >= 60 ? "happy" : "comfort"} className="m-result" />
        <p className="big">
          {exam ? score : pct}
          <small>{exam ? ` / ${max}` : "%"}</small>
        </p>
        <p className="lead">
          {cheer}
          <br />
          看懂 {right} / {outcomes.length} 個路標
          {outcomes.length < session.items.length ? `（這段路共 ${session.items.length} 題，先在這裡下車）` : ""}
        </p>
        <p className="fine journal-note">✉️ 這一段的 {outcomes.length} 個路標，都寫成明信片收進手帳了。</p>
        <div className="actions center">
          {wrong.length > 0 && (
            <button className="btn primary large" onClick={() => onRetry(wrong.map((o) => o.q))}>
              回頭再走這 {wrong.length} 題
            </button>
          )}
          <button className={`btn large ${wrong.length ? "" : "primary"}`} onClick={onBack}>
            回到護照
          </button>
        </div>
      </section>

      {wrong.length > 0 && (
        <section className="block">
          <h2>這幾個路標再看一眼</h2>
          <ul className="review">
            {wrong.map(({ q, given }) => (
              <li key={q.id}>
                <p className="eyebrow">{[q.topic, typeLabel(q)].filter(Boolean).join("・")}</p>
                <p className="r-q">{q.question}</p>
                {given && <p className="r-given">你的答案：{given}</p>}
                <p className="r-ans">
                  正確答案：<b>{answerText(q)}</b>
                </p>
                {q.type !== "short" && q.explanation && <p className="r-exp">{q.explanation}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// ============================================================
// 紀錄與弱點分析
// ============================================================
function History(props: { sets: Subject[]; data: Data; onStart: (s: Session) => void; onClear: () => void }) {
  const { sets, data, onStart, onClear } = props;
  const [confirm, setConfirm] = useState(false);
  const all = Object.values(data.stats);
  const seen = all.reduce((s, x) => s + x.seen, 0);
  const right = all.reduce((s, x) => s + x.right, 0);
  const topics = topicStats(data, sets);
  const weak = topics.filter((t) => t.pct < 80).slice(0, 6);
  const fmt = (t: number) => new Date(t).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <section className="set-head has-deco">
        <h1>我的足跡</h1>
        <p className="lead">{streak(data) > 0 ? `已經連續出發 ${streak(data)} 天，慢慢走也沒關係。` : "走過的每一段路，都會記在這台裝置上。"}</p>
      </section>

      <section className="figures">
        <div>
          <b>{data.attempts.length}</b>
          <span>出發次數</span>
        </div>
        <div>
          <b>{seen}</b>
          <span>走過的路標</span>
        </div>
        <div>
          <b className={seen ? "accent" : "muted"}>{seen ? `${Math.round((right / seen) * 100)}%` : "—"}</b>
          <span>答對率</span>
        </div>
      </section>

      {seen === 0 ? (
        <p className="empty"><Mascot mood="wave" className="m-empty" />還沒有足跡，挑一張車票跟雪丸一起出發吧！</p>
      ) : (
        <>
          <section className="block charts">
            <DailyChart attempts={data.attempts} />
            <TrendChart attempts={data.attempts} />
            <SubjectChart sets={sets} data={data} />
          </section>

          <section className="block">
            <h2>這幾站值得再去一次</h2>
            {weak.length > 0 ? (
              <>
                <p className="fine">答對率還沒到 80% 的主題，點一下就能直接練。</p>
                <TopicList rows={weak} showSet onStart={onStart} />
              </>
            ) : (
              <p className="fine">練過的主題答對率都有 80% 以上，太強了。</p>
            )}
          </section>

          {data.attempts.length > 0 && (
            <section className="block">
              <h2>旅程紀錄</h2>
              <ul className="attempts">
                {data.attempts.map((a) => (
                  <li key={a.id}>
                    <span className="a-main">
                      {a.setName}
                      <small>
                        {a.mode === "exam" ? "模擬考" : "練習"}・{fmt(a.at)}
                      </small>
                    </span>
                    <span className="a-num">
                      {a.score !== undefined ? `${a.score} / ${a.max} 分` : `${Math.round((a.right / a.total) * 100)}%`}
                      <small>
                        答對 {a.right} / {a.total}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="fine center">
            {confirm ? (
              <>
                確定要清除所有作答紀錄嗎？
                <button
                  className="link danger"
                  onClick={() => {
                    onClear();
                    setConfirm(false);
                  }}
                >
                  清除
                </button>
                <button className="link" onClick={() => setConfirm(false)}>
                  取消
                </button>
              </>
            ) : (
              <button className="link" onClick={() => setConfirm(true)}>
                清除作答紀錄
              </button>
            )}
          </p>
        </>
      )}
    </>
  );
}
