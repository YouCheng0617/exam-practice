"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ESSAYS, EXAM, QUESTIONS, TOPICS, type EssayQ, type Question } from "@/data/questions";
import { sfx, sfx2 } from "@/lib/sound";

type Mode = "challenge" | "practice" | "review" | "exam" | "essay";
type Phase = "home" | "play" | "essay" | "end";
type Result = { q: Question; picked: number | boolean | null; correct: boolean };
type EssayResult = { q: EssayQ; score: number; text: string };

const ROUND_SIZE = 10;
const LIVES = 3;
const TIME_LIMIT = 20;

const CORRECT_LINES = ["勝訴！", "異議成立！", "判決確定，你贏了！", "法官點頭了 👨‍⚖️", "這題你是專家證人", "完美辯護！"];
const WRONG_LINES = ["敗訴…", "異議駁回！", "被告請再想想 😵", "法官皺眉了…", "上訴還來得及！", "差一點點！"];
const TIMEOUT_LINES = ["逾期未答，視為放棄！", "時效消滅了 ⌛"];

const COMBO_MSG: Record<number, string> = {
  3: "🔥 三連勝！",
  5: "⚡ 五連勝・法庭霸主！",
  7: "🌟 七連勝・你是大法官嗎？",
  10: "👑 十連勝・判例級表現！",
};

function rank(acc: number) {
  if (acc >= 0.95) return { title: "大法官", emoji: "👑", line: "民法在你手上就是說明書。" };
  if (acc >= 0.8) return { title: "資深法官", emoji: "⚖️", line: "條文熟到可以直接開庭了。" };
  if (acc >= 0.6) return { title: "執業律師", emoji: "💼", line: "大方向都對，細節再補一下就無敵。" };
  if (acc >= 0.4) return { title: "法律系實習生", emoji: "📚", line: "有概念了，多玩幾輪就會進步！" };
  return { title: "路過的民眾", emoji: "🙋", line: "沒關係，錯題本會幫你記住的！" };
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}
const isCorrect = (q: Question, p: number | boolean | null) => p !== null && p === q.answer;
const answerText = (q: Question) => (q.type === "tf" ? (q.answer ? "⭕ 對" : "❌ 錯") : `${"ABCD"[q.answer]}. ${q.options[q.answer]}`);
const norm = (s: string) => s.replace(/\s+/g, "").replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));

type Particle = { id: number; x: number; y: number; r: number; c: string; d: number };
type Floater = { id: number; text: string };

export default function Home() {
  const [phase, setPhase] = useState<Phase>("home");
  const [mode, setMode] = useState<Mode>("challenge");
  const [deck, setDeck] = useState<Question[]>([]);
  const [essayDeck, setEssayDeck] = useState<EssayQ[]>([]);
  const [idx, setIdx] = useState(0);
  const [eIdx, setEIdx] = useState(0);
  const [picked, setPicked] = useState<number | boolean | null>(null);
  const [answered, setAnswered] = useState(false);
  const [line, setLine] = useState("");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [time, setTime] = useState(TIME_LIMIT);
  const [results, setResults] = useState<Result[]>([]);
  const [essayResults, setEssayResults] = useState<EssayResult[]>([]);
  const [hidden, setHidden] = useState<number[]>([]);
  const [used5050, setUsed5050] = useState(false);
  const [usedSkip, setUsedSkip] = useState(false);
  const [comboBanner, setComboBanner] = useState("");
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [sound, setSound] = useState(true);
  const [best, setBest] = useState(0);
  const [bestExam, setBestExam] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [newRecord, setNewRecord] = useState(false);
  const uid = useRef(0);

  useEffect(() => {
    setBest(load("clg_best", 0));
    setBestExam(load("clg_best_exam", 0));
    setWrongIds(load("clg_wrong", []));
    setSound(load("clg_sound", true));
  }, []);

  const play = useCallback((fn: () => void) => sound && fn(), [sound]);

  const q = deck[idx];
  const timed = mode === "challenge";
  const lifelines = mode === "challenge" || mode === "practice";

  // ---------- 開始 ----------
  function start(m: Mode) {
    let d: Question[] = [];
    let e: EssayQ[] = [];
    if (m === "review") d = shuffle(QUESTIONS.filter((x) => wrongIds.includes(x.id)));
    else if (m === "exam") {
      d = shuffle(QUESTIONS).slice(0, EXAM.choiceCount);
      e = shuffle(ESSAYS).slice(0, EXAM.essayCount);
    } else if (m === "essay") e = shuffle(ESSAYS);
    else {
      const pool = shuffle(QUESTIONS);
      d = m === "challenge" ? pool.slice(0, ROUND_SIZE) : pool;
    }
    if (d.length === 0 && e.length === 0) return;
    setDeck(d);
    setEssayDeck(e);
    setMode(m);
    setIdx(0);
    setEIdx(0);
    setPicked(null);
    setAnswered(false);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setLives(LIVES);
    setTime(TIME_LIMIT);
    setResults([]);
    setEssayResults([]);
    setHidden([]);
    setUsed5050(false);
    setUsedSkip(false);
    setNewRecord(false);
    setPhase(d.length ? "play" : "essay");
    play(d.length ? sfx.gavel : sfx2.bell);
    window.scrollTo({ top: 0 });
  }

  // ---------- 特效 ----------
  const burst = useCallback((n = 28) => {
    const colors = ["#f5c542", "#4ade80", "#60a5fa", "#f472b6", "#fb923c", "#a78bfa"];
    setParticles(
      Array.from({ length: n }, () => ({
        id: uid.current++,
        x: (Math.random() - 0.5) * 560,
        y: -Math.random() * 340 - 60,
        r: Math.random() * 720 - 360,
        c: pick(colors),
        d: Math.random() * 0.3,
      })),
    );
    setTimeout(() => setParticles([]), 1400);
  }, []);
  function floatText(text: string) {
    const id = uid.current++;
    setFloaters((f) => [...f, { id, text }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1100);
  }
  const flashScreen = useCallback((kind: "good" | "bad") => {
    setFlash(kind);
    setTimeout(() => setFlash(""), 450);
  }, []);

  // ---------- 選擇題作答 ----------
  const submit = useCallback(
    (choice: number | boolean | null) => {
      if (!q || answered) return;
      const ok = isCorrect(q, choice);
      setPicked(choice);
      setAnswered(true);
      setResults((r) => [...r, { q, picked: choice, correct: ok }]);

      if (ok) {
        const c = combo + 1;
        setCombo(c);
        setMaxCombo((m) => Math.max(m, c));
        let gain: number;
        if (mode === "exam") {
          gain = EXAM.choicePoint;
          floatText(`+${gain} 分`);
        } else {
          const mult = 1 + Math.min(c - 1, 5) * 0.2;
          gain = Math.round((100 + (timed ? time * 5 : 0)) * mult);
          floatText(`+${gain}${c >= 2 ? ` ×${mult.toFixed(1)}` : ""}`);
        }
        setScore((s) => s + gain);
        setLine(pick(CORRECT_LINES));
        if (COMBO_MSG[c]) {
          setComboBanner(COMBO_MSG[c]);
          setTimeout(() => setComboBanner(""), 1600);
        }
        burst();
        flashScreen("good");
        play(() => sfx.correct(c));
        const w = wrongIds.filter((id) => id !== q.id);
        setWrongIds(w);
        save("clg_wrong", w);
      } else {
        setCombo(0);
        if (mode === "challenge") setLives((l) => l - 1);
        setLine(choice === null ? pick(TIMEOUT_LINES) : pick(WRONG_LINES));
        setShake(true);
        setTimeout(() => setShake(false), 500);
        flashScreen("bad");
        play(sfx.wrong);
        if (!wrongIds.includes(q.id)) {
          const w = [...wrongIds, q.id];
          setWrongIds(w);
          save("clg_wrong", w);
        }
      }
    },
    [q, answered, combo, timed, time, mode, wrongIds, play, burst, flashScreen],
  );

  // ---------- 結束 ----------
  const finish = useCallback(
    (finalScore: number) => {
      setPhase("end");
      window.scrollTo({ top: 0 });
      const key = mode === "exam" ? "clg_best_exam" : mode === "challenge" ? "clg_best" : null;
      const prev = mode === "exam" ? bestExam : best;
      if (key && finalScore > prev) {
        if (mode === "exam") setBestExam(finalScore);
        else setBest(finalScore);
        save(key, finalScore);
        setNewRecord(true);
        burst(60);
        play(sfx.fanfare);
      } else {
        play(finalScore > 0 ? sfx.fanfare : sfx.sad);
      }
    },
    [mode, best, bestExam, play, burst],
  );

  const goNext = useCallback(() => {
    if ((mode === "challenge" && lives <= 0) || idx + 1 >= deck.length) {
      if (essayDeck.length) {
        setPhase("essay");
        play(sfx2.bell);
        window.scrollTo({ top: 0 });
      } else finish(score);
      return;
    }
    setIdx((i) => i + 1);
    setPicked(null);
    setAnswered(false);
    setHidden([]);
    setTime(TIME_LIMIT);
    play(sfx.click);
  }, [mode, lives, idx, deck.length, essayDeck.length, finish, score, play]);

  const next = useCallback(() => answered && goNext(), [answered, goNext]);

  function skip() {
    if (usedSkip || answered || !q) return;
    setUsedSkip(true);
    goNext();
  }
  function fiftyFifty() {
    if (used5050 || answered || !q || q.type !== "choice") return;
    const wrong = q.options.map((_, i) => i).filter((i) => i !== q.answer);
    setHidden(shuffle(wrong).slice(0, Math.max(0, q.options.length - 2)));
    setUsed5050(true);
    play(sfx.click);
  }

  // ---------- 問答題完成一題 ----------
  function essayDone(r: EssayResult) {
    const all = [...essayResults, r];
    setEssayResults(all);
    const total = score + r.score;
    setScore(total);
    if (eIdx + 1 >= essayDeck.length) finish(total);
    else {
      setEIdx((i) => i + 1);
      play(sfx2.bell);
      window.scrollTo({ top: 0 });
    }
  }

  // ---------- 計時 ----------
  useEffect(() => {
    if (phase !== "play" || !timed || answered) return;
    if (time <= 0) {
      submit(null);
      return;
    }
    const t = setTimeout(() => {
      setTime((x) => x - 1);
      if (time <= 6) play(sfx.tick);
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, timed, answered, time, submit, play]);

  // ---------- 鍵盤 ----------
  useEffect(() => {
    if (phase !== "play" || !q) return;
    const onKey = (e: KeyboardEvent) => {
      if (answered) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          next();
        }
        return;
      }
      if (q.type === "choice") {
        const map: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };
        const n = map[e.key.toLowerCase()];
        if (n !== undefined && n < q.options.length && !hidden.includes(n)) submit(n);
      } else {
        if (e.key.toLowerCase() === "o" || e.key === "1") submit(true);
        if (e.key.toLowerCase() === "x" || e.key === "2") submit(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, q, answered, hidden, next, submit]);

  function toggleSound() {
    setSound((s) => {
      save("clg_sound", !s);
      return !s;
    });
  }

  const pool = QUESTIONS.length;
  const totalSteps = deck.length + essayDeck.length;

  // ============================================================
  return (
    <main className={`app ${flash ? `flash-${flash}` : ""}`}>
      <button className="sound-btn" onClick={toggleSound} aria-label="音效開關" title="音效開關">
        {sound ? "🔊" : "🔇"}
      </button>

      {phase === "home" && (
        <section className="card home">
          <div className="logo">⚖️</div>
          <h1>民法大闖關</h1>
          <p className="sub">民法概要・總則篇　期中考複習</p>

          <div className="exam-box">
            <div>
              <b>📝 期中考怎麼考</b>
              <p>
                選擇 {EXAM.choiceCount} 題 × {EXAM.choicePoint} 分＋問答 {EXAM.essayCount} 題 × {EXAM.essayPoint} 分
                <br />
                占學期成績 30%，<b className="warn">未到考 0 分！</b>
              </p>
            </div>
            <button className="btn primary" onClick={() => start("exam")}>
              📝 模擬考
              <small>跟考試一樣的題數・滿分 100{bestExam ? `・最高 ${bestExam} 分` : ""}</small>
            </button>
          </div>

          <div className="modes">
            <button className="btn" disabled={pool === 0} onClick={() => start("challenge")}>
              🏛️ 闖關模式
              <small>
                {ROUND_SIZE} 題・{LIVES} 條命・限時作答
              </small>
            </button>
            <div className="modes row">
              <button className="btn" disabled={pool === 0} onClick={() => start("practice")}>
                📖 選擇題練習
                <small>慢慢來・{pool} 題</small>
              </button>
              <button className="btn" onClick={() => start("essay")}>
                ✍️ 問答題練習
                <small>{ESSAYS.length} 題・想一想再看答案</small>
              </button>
            </div>
            <button className="btn" disabled={wrongIds.length === 0} onClick={() => start("review")}>
              📕 錯題本
              <small>{wrongIds.length ? `${wrongIds.length} 題等你復仇` : "目前沒有錯題 🎉"}</small>
            </button>
          </div>

          <p className="best">🏆 闖關最高分：{best}</p>
          
        </section>
      )}

      {phase === "play" && q && (
        <section className={`card play ${shake ? "shake" : ""}`}>
          <header className="hud">
            {mode === "challenge" ? (
              <span className="lives">
                {Array.from({ length: LIVES }, (_, i) => (
                  <span key={i} className={i < lives ? "heart" : "heart lost"}>
                    ❤️
                  </span>
                ))}
              </span>
            ) : (
              <span className="mode-tag">
                {mode === "practice" ? "📖 練習" : mode === "review" ? "📕 錯題本" : "📝 模擬考・選擇題"}
              </span>
            )}
            <span className="score">
              {score}
              <small> 分</small>
            </span>
            <span className={`combo ${combo >= 3 ? "hot" : ""}`}>{combo > 0 ? `🔥×${combo}` : ""}</span>
          </header>

          <div className="progress">
            <div style={{ width: `${(idx / (totalSteps || 1)) * 100}%` }} />
          </div>
          <div className="meta">
            <span className="tag">
              {TOPICS.find((t) => t.name === q.topic)?.icon} {q.topic}
            </span>
            <span>
              第 {idx + 1} / {deck.length} 題
            </span>
          </div>

          {timed && (
            <div className={`timer ${time <= 5 && !answered ? "danger" : ""}`}>
              <div style={{ width: `${(time / TIME_LIMIT) * 100}%` }} />
              <span>{time}s</span>
            </div>
          )}

          <h3 className="question">{q.question}</h3>

          {q.type === "choice" ? (
            <div className="options">
              {q.options.map((o, i) => {
                let cls = "opt";
                if (hidden.includes(i)) cls += " gone";
                if (answered) cls += i === q.answer ? " right" : i === picked ? " wrong" : " dim";
                return (
                  <button key={i} className={cls} disabled={answered || hidden.includes(i)} onClick={() => submit(i)}>
                    <span className="key">{"ABCD"[i]}</span>
                    {o}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="options tf">
              {[true, false].map((v) => {
                let cls = "opt big";
                if (answered) cls += v === q.answer ? " right" : v === picked ? " wrong" : " dim";
                return (
                  <button key={String(v)} className={cls} disabled={answered} onClick={() => submit(v)}>
                    {v ? "⭕ 對" : "❌ 錯"}
                  </button>
                );
              })}
            </div>
          )}

          {!answered && lifelines && (
            <div className="lifelines">
              <button onClick={fiftyFifty} disabled={used5050 || q.type !== "choice"}>
                🧑‍⚖️ 請教學長（刪去兩個）
              </button>
              <button onClick={skip} disabled={usedSkip}>
                ⏭️ 聲請延期（跳過）
              </button>
            </div>
          )}

          {answered && (
            <div className={`feedback ${isCorrect(q, picked) ? "good" : "bad"}`}>
              <div className="verdict">
                <span className="stamp">{isCorrect(q, picked) ? "勝訴" : "敗訴"}</span>
                <span>{line}</span>
              </div>
              {!isCorrect(q, picked) && (
                <p className="ans">
                  正確答案：<b>{answerText(q)}</b>
                </p>
              )}
              <p className="exp">💡 {q.explanation}</p>
              <button className="btn primary next" onClick={next}>
                {(mode === "challenge" && lives <= 0) || idx + 1 >= deck.length
                  ? essayDeck.length
                    ? "進入問答題 →"
                    : "看判決結果 →"
                  : "下一題 →"}
              </button>
            </div>
          )}

          {floaters.map((f) => (
            <span key={f.id} className="floater">
              {f.text}
            </span>
          ))}
          {comboBanner && <div className="combo-banner">{comboBanner}</div>}
        </section>
      )}

      {phase === "essay" && essayDeck[eIdx] && (
        <EssayCard
          key={essayDeck[eIdx].id}
          q={essayDeck[eIdx]}
          n={eIdx + 1}
          total={essayDeck.length}
          exam={mode === "exam"}
          score={score}
          progress={(deck.length + eIdx) / (totalSteps || 1)}
          last={eIdx + 1 >= essayDeck.length}
          play={play}
          burst={burst}
          flash={flashScreen}
          onDone={essayDone}
        />
      )}

      {phase === "end" && (
        <EndScreen
          results={results}
          essayResults={essayResults}
          score={score}
          maxCombo={maxCombo}
          mode={mode}
          lives={lives}
          newRecord={newRecord}
          onRetry={() => start(mode === "review" && wrongIds.length === 0 ? "challenge" : mode)}
          onHome={() => setPhase("home")}
        />
      )}

      <div className="confetti" aria-hidden>
        {particles.map((p) => (
          <i
            key={p.id}
            style={
              { "--x": `${p.x}px`, "--y": `${p.y}px`, "--r": `${p.r}deg`, background: p.c, animationDelay: `${p.d}s` } as React.CSSProperties
            }
          />
        ))}
      </div>
    </main>
  );
}

// ============================================================
// 問答題卡：想一想 → 看答案 → 自己評分
// ============================================================
const RATINGS = [
  { score: 10, emoji: "😎", label: "都想到了", line: "太強了，這題穩拿！" },
  { score: 6, emoji: "🤔", label: "想到一部分", line: "不錯喔，再看一次重點就記住了" },
  { score: 2, emoji: "😵", label: "沒想到", line: "沒關係，現在看過就會了！" },
];

function EssayCard(props: {
  q: EssayQ;
  n: number;
  total: number;
  exam: boolean;
  score: number;
  progress: number;
  last: boolean;
  play: (fn: () => void) => void;
  burst: (n?: number) => void;
  flash: (k: "good" | "bad") => void;
  onDone: (r: EssayResult) => void;
}) {
  const { q, n, total, exam, score, progress, last, play, burst, flash, onDone } = props;
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  function reveal() {
    setRevealed(true);
    play(sfx2.paper);
  }

  function rate(i: number) {
    if (rating !== null) return;
    setRating(i);
    const s = RATINGS[i].score;
    if (s === 10) {
      burst();
      flash("good");
      play(sfx.fanfare);
    } else if (s >= 6) {
      flash("good");
      play(() => sfx.correct(1));
    } else {
      play(sfx.sad);
    }
  }

  const r = rating !== null ? RATINGS[rating] : null;

  return (
    <section className="card essay">
      <header className="hud">
        <span className="mode-tag">{exam ? "📝 模擬考・問答題" : "✍️ 問答題"}</span>
        <span className="score">
          {score}
          <small> 分</small>
        </span>
        <span className="mode-tag">
          第 {n} / {total} 題
        </span>
      </header>
      <div className="progress">
        <div style={{ width: `${progress * 100}%` }} />
      </div>

      <span className="tag">✍️ {q.title}</span>
      <h3 className="question pre">{q.question}</h3>
      <p className="plain">💬 簡單說：{q.plain}</p>

      {!revealed && (
        <>
          <p className="think">先在心裡想一想答案，想好了再打開 👇</p>
          <button className="btn primary next" onClick={reveal}>
            💡 看答案
          </button>
        </>
      )}

      {revealed && (
        <div className="essay-result">
          <ul className="model">
            {q.answer.map((a, i) => (
              <li key={i} style={{ animationDelay: `${i * 0.15}s` }}>
                {a}
              </li>
            ))}
          </ul>

          {r === null ? (
            <>
              <p className="ask">你剛剛想的跟答案差不多嗎？</p>
              <div className="rate">
                {RATINGS.map((x, i) => (
                  <button key={i} onClick={() => rate(i)}>
                    <span className="rate-emoji">{x.emoji}</span>
                    {x.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className={`essay-score ${r.score >= 10 ? "good" : r.score >= 6 ? "mid" : "bad"}`}>
                <span className="big-num">
                  {r.emoji} +{r.score}
                </span>
                <span className="essay-verdict">{r.line}</span>
              </div>
              <button className="btn primary next" onClick={() => onDone({ q, score: r.score, text: "" })}>
                {last ? "看結果 →" : "下一題 →"}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ============================================================
// 結算
// ============================================================
function EndScreen(props: {
  results: Result[];
  essayResults: EssayResult[];
  score: number;
  maxCombo: number;
  mode: Mode;
  lives: number;
  newRecord: boolean;
  onRetry: () => void;
  onHome: () => void;
}) {
  const { results, essayResults, score, maxCombo, mode, lives, newRecord, onRetry, onHome } = props;
  const right = results.filter((r) => r.correct).length;
  const choiceScore = right * EXAM.choicePoint;
  const essayScore = essayResults.reduce((s, r) => s + r.score, 0);

  let acc: number;
  if (mode === "exam") acc = score / 100;
  else if (mode === "essay") acc = essayResults.length ? essayScore / (essayResults.length * 10) : 0;
  else acc = results.length ? right / results.length : 0;

  const r = rank(acc);
  const wrong = results.filter((x) => !x.correct);
  const weakEssays = essayResults.filter((x) => x.score < 10);
  const stars = acc >= 0.9 ? 3 : acc >= 0.6 ? 2 : acc > 0 ? 1 : 0;

  return (
    <section className="card end">
      {newRecord && <div className="record">🎉 新紀錄！</div>}
      <div className="doc">
        <p className="doc-title">民 事 判 決</p>
        <p className="doc-no">
          {new Date().getFullYear() - 1911} 年度{mode === "exam" ? "期中模擬" : "複"}字第 {String(score).padStart(4, "0")} 號
        </p>
        <p>
          <b>主　文</b>
        </p>
        <p className="main-text">
          {mode === "challenge" && lives <= 0
            ? "原告三命用盡，本庭宣判：請回去再讀一下書，擇日再審。"
            : mode === "exam"
              ? score >= 60
                ? `原告期中考模擬得 ${score} 分，及格勝訴！換算學期成績可拿 ${(score * 0.3).toFixed(1)} 分（滿分 30）。考試當天務必到考。`
                : `原告期中考模擬得 ${score} 分，尚未及格，准予再考一次。換算學期成績 ${(score * 0.3).toFixed(1)} / 30 分。`
              : acc >= 0.6
                ? "原告之請求有理由，判決勝訴，訴訟費用由題庫負擔。"
                : "原告之請求一部有理由，其餘駁回，准予上訴（再玩一次）。"}
        </p>
        <div className="rank">
          <span className="rank-emoji">{r.emoji}</span>
          <div>
            <div className="rank-title">{r.title}</div>
            <div className="rank-line">{r.line}</div>
          </div>
        </div>
        <div className="stars">
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < stars ? "star on" : "star"} style={{ animationDelay: `${i * 0.25}s` }}>
              ★
            </span>
          ))}
        </div>

        {mode === "exam" ? (
          <div className="stats">
            <div>
              <b>{score}</b>
              <small>總分 / 100</small>
            </div>
            <div>
              <b>{choiceScore}</b>
              <small>選擇 / {EXAM.choiceCount * EXAM.choicePoint}</small>
            </div>
            <div>
              <b>{essayScore}</b>
              <small>問答 / {EXAM.essayCount * EXAM.essayPoint}</small>
            </div>
            <div>
              <b>{(score * 0.3).toFixed(1)}</b>
              <small>學期成績 / 30</small>
            </div>
          </div>
        ) : mode === "essay" ? (
          <div className="stats three">
            <div>
              <b>{essayScore}</b>
              <small>總分 / {essayResults.length * 10}</small>
            </div>
            <div>
              <b>{essayResults.length ? (essayScore / essayResults.length).toFixed(1) : 0}</b>
              <small>平均每題</small>
            </div>
            <div>
              <b>{essayResults.filter((x) => x.score >= 10).length}</b>
              <small>都想到的題數</small>
            </div>
          </div>
        ) : (
          <div className="stats">
            <div>
              <b>{score}</b>
              <small>總分</small>
            </div>
            <div>
              <b>
                {right}/{results.length}
              </b>
              <small>答對</small>
            </div>
            <div>
              <b>{Math.round(acc * 100)}%</b>
              <small>正確率</small>
            </div>
            <div>
              <b>{maxCombo}</b>
              <small>最高連勝</small>
            </div>
          </div>
        )}
      </div>

      {(wrong.length > 0 || weakEssays.length > 0) && (
        <div className="review">
          <h3>📕 理由（錯題回顧）</h3>
          {wrong.map(({ q, picked }) => (
            <details key={q.id}>
              <summary>{q.question}</summary>
              <p>
                你的答案：
                {picked === null ? "（逾時未答）" : q.type === "tf" ? (picked ? "⭕ 對" : "❌ 錯") : `${"ABCD"[picked as number]}. ${q.options[picked as number]}`}
              </p>
              <p>
                正確答案：<b>{answerText(q)}</b>
              </p>
              <p className="exp">💡 {q.explanation}</p>
            </details>
          ))}
          {weakEssays.map(({ q, score: s }) => (
            <details key={q.id}>
              <summary>
                ✍️ {q.title}（{s} / 10 分）
              </summary>
              <ul className="model">
                {q.answer.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}

      <div className="modes row">
        <button className="btn primary" onClick={onRetry}>
          🔁 再來一局
        </button>
        <button className="btn" onClick={onHome}>
          🏠 回首頁
        </button>
      </div>
    </section>
  );
}
