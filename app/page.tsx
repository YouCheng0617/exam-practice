"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SUBJECTS } from "@/data/subjects";
import type { EssayQ, ExamInfo, Question, Subject } from "@/data/types";
import { sfx, sfx2 } from "@/lib/sound";

type Mode = "challenge" | "practice" | "review" | "exam" | "essay";
type Phase = "home" | "play" | "essay" | "end";
type Result = { q: Question; picked: number | boolean | null; correct: boolean };
type EssayResult = { q: EssayQ; score: number; text: string };

const ROUND_SIZE = 10;
const LIVES = 3;
const TIME_LIMIT = 20;

const CORRECT_LINES = ["答對了！", "太神啦！", "完全正確 ✨", "這題難不倒你", "讚啦！", "穩穩的 👍"];
const WRONG_LINES = ["答錯了…", "差一點點！", "再想想 😵", "下次一定會！", "沒關係，記起來就好"];
const TIMEOUT_LINES = ["時間到了！⌛", "太慢囉～"];

const COMBO_MSG: Record<number, string> = {
  3: "🔥 三連對！",
  5: "⚡ 五連對！",
  7: "🌟 七連對・停不下來！",
  10: "👑 十連對・學神降臨！",
};

function rank(acc: number) {
  if (acc >= 0.95) return { title: "學神", emoji: "👑", line: "這科你根本可以去當助教了。" };
  if (acc >= 0.8) return { title: "學霸", emoji: "🏆", line: "很穩！考試就照這樣寫。" };
  if (acc >= 0.6) return { title: "穩穩過關", emoji: "💪", line: "大方向都對，錯的再看一下就好。" };
  if (acc >= 0.4) return { title: "漸入佳境", emoji: "📚", line: "有概念了，多玩幾輪就會進步！" };
  return { title: "剛起步", emoji: "🌱", line: "沒關係，錯題本會幫你記住的！" };
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

type Particle = { id: number; x: number; y: number; r: number; c: string; d: number };
type Floater = { id: number; text: string };

const examTotal = (e: ExamInfo) => e.choiceCount * e.choicePoint + e.essayCount * e.essayPoint;

// 舊版（只有民法時）的紀錄搬到新的 key
function migrate() {
  try {
    if (localStorage.getItem("clg_best") !== null && localStorage.getItem("civil-law:best") === null) {
      localStorage.setItem("civil-law:best", localStorage.getItem("clg_best")!);
      localStorage.setItem("civil-law:bestExam", localStorage.getItem("clg_best_exam") ?? "0");
      localStorage.setItem("civil-law:wrong", localStorage.getItem("clg_wrong") ?? "[]");
    }
    if (localStorage.getItem("clg_sound") !== null && localStorage.getItem("sound") === null)
      localStorage.setItem("sound", localStorage.getItem("clg_sound")!);
  } catch {}
}

export default function Home() {
  const [subject, setSubject] = useState<Subject | null>(null);
  const [sound, setSound] = useState(true);
  const [stats, setStats] = useState<Record<string, { best: number; wrong: number }>>({});

  useEffect(() => {
    migrate();
    setSound(load("sound", true));
  }, []);

  useEffect(() => {
    if (subject) return;
    const m: Record<string, { best: number; wrong: number }> = {};
    SUBJECTS.forEach((s) => {
      m[s.id] = { best: load(`${s.id}:bestExam`, 0), wrong: load<string[]>(`${s.id}:wrong`, []).length };
    });
    setStats(m);
  }, [subject]);

  function toggleSound() {
    setSound((s) => {
      save("sound", !s);
      return !s;
    });
  }

  function choose(s: Subject) {
    if (sound) sfx.click();
    setSubject(s);
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      <button className="sound-btn" onClick={toggleSound} aria-label="音效開關" title="音效開關">
        {sound ? "🔊" : "🔇"}
      </button>
      {subject ? (
        <Game key={subject.id} subject={subject} sound={sound} onBack={() => setSubject(null)} />
      ) : (
        <main className="app">
          <section className="card home">
            <div className="logo">📚</div>
            <h1>考試題庫訓練</h1>
            <p className="sub">選一個科目開始練習</p>
            <div className="subjects">
              {SUBJECTS.map((s) => (
                <button key={s.id} className="subject" onClick={() => choose(s)}>
                  <span className="s-icon">{s.icon}</span>
                  <span className="s-body">
                    <span className="s-name">{s.name}</span>
                    <span className="s-desc">{s.desc}</span>
                    <span className="s-meta">
                      選擇 {s.questions.length} 題・問答 {s.essays.length} 題
                      {stats[s.id]?.best ? `・模擬考最高 ${stats[s.id].best} 分` : ""}
                      {stats[s.id]?.wrong ? `・錯題 ${stats[s.id].wrong}` : ""}
                    </span>
                  </span>
                  <span className="s-go">›</span>
                </button>
              ))}
              <div className="subject soon">＋ 更多科目準備中</div>
            </div>
          </section>
        </main>
      )}
    </>
  );
}

// ============================================================
// 單一科目的遊戲
// ============================================================
function Game({ subject, sound, onBack }: { subject: Subject; sound: boolean; onBack: () => void }) {
  const QUESTIONS = subject.questions;
  const ESSAYS = subject.essays;
  const EXAM = subject.exam;
  const f = subject.flavor ?? {};
  const correctLines = f.correctLines ?? CORRECT_LINES;
  const wrongLines = f.wrongLines ?? WRONG_LINES;
  const K = (k: string) => `${subject.id}:${k}`;

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
  const [best, setBest] = useState(0);
  const [bestExam, setBestExam] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [newRecord, setNewRecord] = useState(false);
  const uid = useRef(0);

  useEffect(() => {
    setBest(load(K("best"), 0));
    setBestExam(load(K("bestExam"), 0));
    setWrongIds(load(K("wrong"), []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    else if (m === "exam" && EXAM) {
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
        if (mode === "exam" && EXAM) {
          gain = EXAM.choicePoint;
          floatText(`+${gain} 分`);
        } else {
          const mult = 1 + Math.min(c - 1, 5) * 0.2;
          gain = Math.round((100 + (timed ? time * 5 : 0)) * mult);
          floatText(`+${gain}${c >= 2 ? ` ×${mult.toFixed(1)}` : ""}`);
        }
        setScore((s) => s + gain);
        setLine(pick(correctLines));
        if (COMBO_MSG[c]) {
          setComboBanner(COMBO_MSG[c]);
          setTimeout(() => setComboBanner(""), 1600);
        }
        burst();
        flashScreen("good");
        play(() => sfx.correct(c));
        const w = wrongIds.filter((id) => id !== q.id);
        setWrongIds(w);
        save(K("wrong"), w);
      } else {
        setCombo(0);
        if (mode === "challenge") setLives((l) => l - 1);
        setLine(choice === null ? pick(TIMEOUT_LINES) : pick(wrongLines));
        setShake(true);
        setTimeout(() => setShake(false), 500);
        flashScreen("bad");
        play(sfx.wrong);
        if (!wrongIds.includes(q.id)) {
          const w = [...wrongIds, q.id];
          setWrongIds(w);
          save(K("wrong"), w);
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
      const key = mode === "exam" ? K("bestExam") : mode === "challenge" ? K("best") : null;
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

  const pool = QUESTIONS.length;
  const totalSteps = deck.length + essayDeck.length;

  // ============================================================
  return (
    <main className={`app ${flash ? `flash-${flash}` : ""}`}>
      {phase === "home" && (
        <section className="card home">
          <button className="back" onClick={onBack}>
            ‹ 換科目
          </button>
          <div className="logo">{subject.icon}</div>
          <h1>{subject.name}</h1>
          <p className="sub">{subject.desc}</p>

          {EXAM && (
            <div className="exam-box">
              <div>
                <b>📝 {EXAM.name}怎麼考</b>
                <p>
                  {EXAM.choiceCount > 0 && `選擇 ${EXAM.choiceCount} 題 × ${EXAM.choicePoint} 分`}
                  {EXAM.choiceCount > 0 && EXAM.essayCount > 0 && "＋"}
                  {EXAM.essayCount > 0 && `問答 ${EXAM.essayCount} 題 × ${EXAM.essayPoint} 分`}
                  {(EXAM.weight || EXAM.note) && <br />}
                  {EXAM.weight ? `占學期成績 ${Math.round(EXAM.weight * 100)}%` : ""}
                  {EXAM.weight && EXAM.note ? "，" : ""}
                  {EXAM.note && <b className="warn">{EXAM.note}</b>}
                </p>
              </div>
              <button className="btn primary" onClick={() => start("exam")}>
                📝 模擬考
                <small>
                  跟考試一樣的題數・滿分 {examTotal(EXAM)}
                  {bestExam ? `・最高 ${bestExam} 分` : ""}
                </small>
              </button>
            </div>
          )}

          <div className="modes">
            {pool > 0 && (
              <button className="btn" onClick={() => start("challenge")}>
                🏛️ 闖關模式
                <small>
                  {Math.min(ROUND_SIZE, pool)} 題・{LIVES} 條命・限時作答
                </small>
              </button>
            )}
            <div className={pool > 0 && ESSAYS.length > 0 ? "modes row" : "modes"}>
              {pool > 0 && (
                <button className="btn" onClick={() => start("practice")}>
                  📖 選擇題練習
                  <small>慢慢來・{pool} 題</small>
                </button>
              )}
              {ESSAYS.length > 0 && (
                <button className="btn" onClick={() => start("essay")}>
                  ✍️ 問答題練習
                  <small>{ESSAYS.length} 題・想一想再看答案</small>
                </button>
              )}
            </div>
            {pool > 0 && (
              <button className="btn" disabled={wrongIds.length === 0} onClick={() => start("review")}>
                📕 錯題本
                <small>{wrongIds.length ? `${wrongIds.length} 題等你復仇` : "目前沒有錯題 🎉"}</small>
              </button>
            )}
          </div>

          {pool > 0 && <p className="best">🏆 闖關最高分：{best}</p>}
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
              {subject.topics?.find((t) => t.name === q.topic)?.icon ?? subject.icon} {q.topic ?? subject.name}
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
                💡 提示（刪去兩個）
              </button>
              <button onClick={skip} disabled={usedSkip}>
                ⏭️ 跳過這題
              </button>
            </div>
          )}

          {answered && (
            <div className={`feedback ${isCorrect(q, picked) ? "good" : "bad"}`}>
              <div className="verdict">
                <span className="stamp">{isCorrect(q, picked) ? f.stampRight ?? "正確" : f.stampWrong ?? "錯誤"}</span>
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
                    : "看結果 →"
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
          point={mode === "exam" && EXAM ? EXAM.essayPoint : 10}
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
          subject={subject}
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
  point: number;
  onDone: (r: EssayResult) => void;
}) {
  const { q, n, total, exam, score, progress, last, play, burst, flash, point, onDone } = props;
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
  const gain = r ? Math.round((r.score / 10) * point) : 0;

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
      {q.plain && <p className="plain">💬 簡單說：{q.plain}</p>}

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
                  {r.emoji} +{gain}
                </span>
                <span className="essay-verdict">{r.line}</span>
              </div>
              <button className="btn primary next" onClick={() => onDone({ q, score: gain, text: "" })}>
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
  subject: Subject;
  onRetry: () => void;
  onHome: () => void;
}) {
  const { results, essayResults, score, maxCombo, mode, lives, newRecord, subject, onRetry, onHome } = props;
  const EXAM = subject.exam;
  const total = EXAM ? examTotal(EXAM) : 100;
  const right = results.filter((r) => r.correct).length;
  const choiceScore = right * (EXAM?.choicePoint ?? 0);
  const essayScore = essayResults.reduce((s, r) => s + r.score, 0);

  let acc: number;
  if (mode === "exam") acc = score / total;
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
        <p className="doc-title">{subject.flavor?.resultTitle ?? "成 績 單"}</p>
        <p className="doc-no">
          {subject.name}・{mode === "exam" ? `${EXAM?.name ?? ""}模擬考` : mode === "essay" ? "問答練習" : mode === "challenge" ? "闖關" : "練習"}
        </p>
        <p className="main-text">
          {mode === "challenge" && lives <= 0
            ? "三條命用完了，休息一下再來挑戰！"
            : mode === "exam"
              ? `模擬考得 ${score} 分${score >= total * 0.6 ? "，及格！🎉" : "，還差一點，再考一次！"}` +
                (EXAM?.weight ? `換算學期成績 ${((score / total) * EXAM.weight * 100).toFixed(1)} / ${Math.round(EXAM.weight * 100)} 分。` : "")
              : acc >= 0.6
                ? "表現不錯，繼續保持！"
                : "多練幾次就會進步，錯的題目都收進錯題本了！"}
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
              <small>總分 / {total}</small>
            </div>
            <div>
              <b>{choiceScore}</b>
              <small>選擇 / {(EXAM?.choiceCount ?? 0) * (EXAM?.choicePoint ?? 0)}</small>
            </div>
            <div>
              <b>{essayScore}</b>
              <small>問答 / {(EXAM?.essayCount ?? 0) * (EXAM?.essayPoint ?? 0)}</small>
            </div>
            <div>
              <b>
                {right}/{results.length}
              </b>
              <small>選擇答對</small>
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
          <h3>📕 錯題回顧</h3>
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
          🏠 回科目首頁
        </button>
      </div>
    </section>
  );
}
