"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { Mascot } from "./Travel";

// ============================================================
// 雪丸的旅行鐘：番茄鐘的旅行版。
// 一趟旅行（總時間）＝ 探險（專心做事）和休息輪流；最後一段休息會省略。
// 計時用「結束的時間點」記錄，切換頁面、重新整理都不會停；狀態存在 localStorage。
// ============================================================

export type Seg = { kind: "explore" | "rest"; min: number };
export type Plan = { total: number; work: number; rest: number };
export type TimerState = {
  segs: Seg[];
  idx: number;
  endsAt: number | null; // 這一段結束的時間點（暫停時是 null）
  left: number; // 暫停時剩下的毫秒數
  paused: boolean;
  done: boolean;
  explored: number; // 這趟已經探險的分鐘數
};

const KEY = "yukimaru-timer";
const PLAN_KEY = "yukimaru-plan";
export const DEFAULT_PLAN: Plan = { total: 60, work: 25, rest: 5 };

export function buildSegs(p: Plan): Seg[] {
  const segs: Seg[] = [];
  let left = p.total;
  while (left > 0) {
    const w = Math.min(p.work, left);
    segs.push({ kind: "explore", min: w });
    left -= w;
    if (left <= p.rest) break; // 剩下的時間不夠再探險一段，就不排最後的休息
    segs.push({ kind: "rest", min: p.rest });
    left -= p.rest;
  }
  return segs;
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const load = <T,>(k: string, fb: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fb;
  } catch {
    return fb;
  }
};
const save = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

// 放在最外層：不管在哪一頁，時間到了都會提醒
export function useTravelTimer(opts: { sound: boolean; onFocus: (min: number) => void }) {
  const [st, setSt] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // 先讀出上次的狀態，讀完才開始存；不然一開始的「沒有在計時」會把存著的紀錄蓋掉
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setSt(load<TimerState | null>(KEY, null));
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) save(KEY, st);
  }, [st, ready]);
  useEffect(() => {
    if (!st || st.paused || st.done) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [st]);

  // 時間到：進入下一段（離開太久回來，會一次補上錯過的段落）
  useEffect(() => {
    if (!st || st.paused || st.done || st.endsAt === null || now < st.endsAt) return;
    let idx = st.idx;
    let endsAt: number | null = st.endsAt;
    let credited = 0;
    let ended: Seg | null = null;
    while (endsAt !== null && now >= endsAt) {
      ended = st.segs[idx];
      if (ended.kind === "explore") credited += ended.min;
      idx++;
      endsAt = idx < st.segs.length ? endsAt + st.segs[idx].min * 60000 : null;
    }
    const done = idx >= st.segs.length;
    if (credited) optsRef.current.onFocus(credited);
    setSt({ ...st, idx: Math.min(idx, st.segs.length - 1), endsAt, done, explored: st.explored + credited });
    if (optsRef.current.sound) {
      if (done || ended?.kind === "explore") sfx.done();
      else sfx.right(1);
    }
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {}
  }, [now, st]);

  const seg = st ? st.segs[st.idx] : null;
  const remaining = !st || st.done ? 0 : st.paused ? st.left : Math.max(0, (st.endsAt ?? now) - now);
  const segMs = seg ? seg.min * 60000 : 1;
  const totalMs = st ? st.segs.reduce((a, s) => a + s.min * 60000, 0) : 1;
  const doneMs = st ? st.segs.slice(0, st.idx).reduce((a, s) => a + s.min * 60000, 0) + (st.done ? segMs : segMs - remaining) : 0;

  // 分頁標題顯示剩下的時間
  useEffect(() => {
    const base = "沿途｜過程本身，就是風景";
    if (!st || st.done || !seg) {
      document.title = base;
      return;
    }
    document.title = `${st.paused ? "⏸" : seg.kind === "explore" ? "🧭" : "☕"} ${fmt(remaining)} ${seg.kind === "explore" ? "探險中" : "休息中"}｜沿途`;
  }, [st, seg, remaining]);

  const start = useCallback((plan: Plan) => {
    save(PLAN_KEY, plan);
    const segs = buildSegs(plan);
    setSt({ segs, idx: 0, endsAt: Date.now() + segs[0].min * 60000, left: 0, paused: false, done: false, explored: 0 });
    setNow(Date.now());
  }, []);
  const pause = useCallback(() => setSt((s) => (s && !s.paused && s.endsAt ? { ...s, paused: true, left: Math.max(0, s.endsAt - Date.now()), endsAt: null } : s)), []);
  const resume = useCallback(() => {
    setSt((s) => (s && s.paused ? { ...s, paused: false, endsAt: Date.now() + s.left, left: 0 } : s));
    setNow(Date.now());
  }, []);
  // 把這一段已經走過的探險時間記下來（跳過或提前結束時用）
  const creditPartial = useCallback((s: TimerState) => {
    const cur = s.segs[s.idx];
    if (cur.kind !== "explore") return 0;
    const left = s.paused ? s.left : Math.max(0, (s.endsAt ?? Date.now()) - Date.now());
    const min = Math.floor((cur.min * 60000 - left) / 60000);
    if (min > 0) optsRef.current.onFocus(min);
    return Math.max(0, min);
  }, []);
  const skip = useCallback(() => {
    setSt((s) => {
      if (!s || s.done) return s;
      const got = creditPartial(s);
      const idx = s.idx + 1;
      if (idx >= s.segs.length) return { ...s, done: true, endsAt: null, explored: s.explored + got };
      const ms = s.segs[idx].min * 60000;
      return { ...s, idx, explored: s.explored + got, ...(s.paused ? { left: ms } : { endsAt: Date.now() + ms }) };
    });
    setNow(Date.now());
  }, [creditPartial]);
  const stop = useCallback(() => {
    setSt((s) => {
      if (!s) return s;
      const got = s.done ? 0 : creditPartial(s);
      return { ...s, done: true, endsAt: null, paused: false, explored: s.explored + got };
    });
  }, [creditPartial]);
  const reset = useCallback(() => setSt(null), []);

  return { st, seg, remaining, segMs, totalMs, doneMs, start, pause, resume, skip, stop, reset };
}
export type TravelTimer = ReturnType<typeof useTravelTimer>;

// 導覽列上的小計時（不在旅行鐘頁面時顯示）
export function TimerBadge({ t, onOpen }: { t: TravelTimer; onOpen: () => void }) {
  if (!t.st || t.st.done || !t.seg) return null;
  return (
    <button className={`timer-badge ${t.seg.kind}`} onClick={onOpen} title="回到旅行鐘">
      {t.st.paused ? "⏸" : t.seg.kind === "explore" ? "🧭" : "☕"} {fmt(t.remaining)}
    </button>
  );
}

// ---------- 地球時鐘 ----------
const LANDS = [
  "M40 92 C60 60 112 62 122 94 C132 120 100 142 80 134 C58 128 28 122 40 92Z",
  "M152 152 C172 130 212 138 216 168 C220 198 186 216 168 202 C152 190 136 172 152 152Z",
  "M252 82 C282 66 332 74 336 106 C340 132 302 144 284 130 C264 120 238 102 252 82Z",
  "M302 184 C322 170 362 178 364 202 C366 224 332 236 314 222 C300 212 292 194 302 184Z",
  "M64 194 C80 182 108 190 108 210 C108 230 84 238 70 226 C58 216 54 204 64 194Z",
  "M200 60 C214 50 236 56 234 72 C232 86 212 90 204 82 C196 76 192 66 200 60Z",
];

function Globe({ kind, progress, moving }: { kind: "explore" | "rest" | "idle"; progress: number; moving: boolean }) {
  const R = 128;
  const C = 2 * Math.PI * R;
  const color = kind === "rest" ? "#17a08c" : "#f08a70";
  return (
    <div className="globe-wrap">
      <svg viewBox="0 0 300 300" className="globe" aria-hidden>
        <defs>
          <clipPath id="g-clip">
            <circle cx="150" cy="150" r="102" />
          </clipPath>
          <radialGradient id="g-sea" cx=".36" cy=".3" r=".85">
            <stop offset="0" stopColor="#dff3fc" />
            <stop offset="1" stopColor="#86c2e2" />
          </radialGradient>
        </defs>
        {/* 外圈：雪丸走的路線，走過的地方會上色 */}
        <circle cx="150" cy="150" r={R} fill="none" stroke="#e2cdb2" strokeWidth="5" strokeDasharray="2 11" strokeLinecap="round" />
        <circle cx="150" cy="150" r={R} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${C * progress} ${C}`} transform="rotate(-90 150 150)" className="g-track" />
        {/* 路線走到哪裡：一個跑動的小圓點 */}
        {kind === "rest" && progress > 0 && (
          <circle
            cx={150 + R * Math.sin(progress * 2 * Math.PI)}
            cy={150 - R * Math.cos(progress * 2 * Math.PI)}
            r="8"
            fill={color}
            stroke="#fffdf7"
            strokeWidth="3"
            className="g-head"
          />
        )}
        {[0, 90, 180, 270].map((a) => (
          <circle key={a} cx={150 + R * Math.sin((a * Math.PI) / 180)} cy={150 - R * Math.cos((a * Math.PI) / 180)} r="4.5" fill="#fffdf7" stroke="#2b2320" strokeWidth="2.4" />
        ))}
        {/* 地球 */}
        <g clipPath="url(#g-clip)">
          <circle cx="150" cy="150" r="102" fill="url(#g-sea)" />
          <g className={`g-lands ${moving ? "spin" : ""}`}>
            {[0, 420].map((dx) => (
              <g key={dx} transform={`translate(${dx} 0)`}>
                {LANDS.map((d, i) => (
                  <path key={i} d={d} fill={i % 3 === 1 ? "#f1d8a6" : "#a8d98f"} stroke="#2b2320" strokeWidth="3" strokeLinejoin="round" />
                ))}
              </g>
            ))}
          </g>
          {/* 南北極的冰帽：雪丸的老家 */}
          <ellipse cx="150" cy="52" rx="86" ry="20" fill="#fff" stroke="#2b2320" strokeWidth="3" />
          <ellipse cx="150" cy="250" rx="80" ry="18" fill="#fff" stroke="#2b2320" strokeWidth="3" />
          <path d="M48 150 Q150 182 252 150" fill="none" stroke="#fff" strokeWidth="2" opacity=".5" />
          <ellipse cx="112" cy="104" rx="30" ry="14" fill="#fff" opacity=".35" transform="rotate(-30 112 104)" />
        </g>
        <circle cx="150" cy="150" r="102" fill="none" stroke="#2b2320" strokeWidth="5" />
      </svg>
      {kind === "rest" ? (
        <div className="g-walker">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot/rest.svg" alt="" className="g-rest" draggable={false} />
        </div>
      ) : (
        // 雪丸跟著時間沿外圈走（像摩天輪的車廂）：位置跟著轉，身體反方向轉回來，永遠頭朝上、腳踩在路線上，背包在身後
        <div className="g-walker" style={{ transform: `rotate(${progress * 360}deg)` }}>
          <div className="g-arm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={moving ? "/mascot/walk.svg" : "/mascot/normal.svg"}
              alt=""
              className="g-walk"
              // 依行進方向轉身，讓背包在身後：上半圈往右走就左右翻轉（背包移到左邊），下半圈往左走維持原樣
              style={{ transform: `rotate(${-progress * 360}deg) scaleX(${Math.cos(progress * 2 * Math.PI) > 0 ? -1 : 1})` }}
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 數字調整 ----------
function Stepper(props: { label: string; hint: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const { label, hint, value, min, max, step, onChange } = props;
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v))));
  return (
    <div className="stepper">
      <span className="st-label">
        {label}
        <small>{hint}</small>
      </span>
      <span className="st-ctrl">
        <button className="btn" onClick={() => set(value - step)} disabled={value <= min} aria-label={`${label}減少`}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(e) => set(Number(e.target.value) || min)}
          aria-label={`${label}（分鐘）`}
        />
        <span className="st-unit">分</span>
        <button className="btn" onClick={() => set(value + step)} disabled={value >= max} aria-label={`${label}增加`}>
          ＋
        </button>
      </span>
    </div>
  );
}

// ---------- 旅行鐘頁面 ----------
export function TimerPage({ t, todayMin }: { t: TravelTimer; todayMin: number }) {
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  useEffect(() => setPlan(load(PLAN_KEY, DEFAULT_PLAN)), []);
  const segs = buildSegs(plan);
  const real = segs.reduce((a, s) => a + s.min, 0);
  const exploreMin = segs.filter((s) => s.kind === "explore").reduce((a, s) => a + s.min, 0);
  const { st, seg } = t;

  // 還沒出發：設定
  if (!st) {
    return (
      <>
        <section className="set-head">
          <h1>雪丸的旅行鐘</h1>
          <p className="lead">決定這趟旅行有多久。探險的時候專心做事，雪丸會陪你一起走；時間到了，牠會提醒你坐下來休息。</p>
        </section>
        <Globe kind="idle" progress={0} moving={false} />
        <section className="panel timer-panel">
          <h2>這趟旅行怎麼安排？</h2>
          <Stepper label="旅行總時間" hint="這次總共要讀多久" value={plan.total} min={10} max={600} step={10} onChange={(v) => setPlan({ ...plan, total: v })} />
          <Stepper label="探險" hint="每一段專心做事的時間" value={plan.work} min={5} max={120} step={5} onChange={(v) => setPlan({ ...plan, work: v })} />
          <Stepper label="休息" hint="每段探險之間休息多久" value={plan.rest} min={1} max={60} step={1} onChange={(v) => setPlan({ ...plan, rest: v })} />
          <div className="itinerary" aria-label="行程">
            {segs.map((s, i) => (
              <span key={i} className={`it ${s.kind}`} style={{ flexGrow: s.min }}>
                {s.kind === "explore" ? "探險" : "休息"} {s.min}
              </span>
            ))}
          </div>
          <p className="fine">
            共 {segs.filter((s) => s.kind === "explore").length} 段探險、{segs.filter((s) => s.kind === "rest").length} 次休息，實際 {real} 分鐘（探險 {exploreMin} 分鐘）。
            {real < plan.total && " 最後剩下的時間不夠再探險一段，所以省略最後一次休息。"}
          </p>
          <div className="actions">
            <button className="btn primary large" onClick={() => t.start(plan)}>
              出發！
            </button>
          </div>
          {todayMin > 0 && <p className="fine">今天已經探險了 {todayMin} 分鐘。</p>}
        </section>
      </>
    );
  }

  // 旅程結束
  if (st.done || !seg) {
    return (
      <section className="result timer-done">
        <Mascot mood="happy" className="m-result" />
        <h1>這趟旅行結束了！</h1>
        <p className="lead">
          這趟探險了 <b>{st.explored}</b> 分鐘{todayMin > st.explored ? `，今天一共 ${todayMin} 分鐘` : ""}。辛苦了，雪丸也學到好多。
        </p>
        <div className="actions center">
          <button className="btn primary large" onClick={t.reset}>
            再安排一趟
          </button>
        </div>
      </section>
    );
  }

  const exploreNo = st.segs.slice(0, st.idx + 1).filter((s) => s.kind === "explore").length;
  const exploreAll = st.segs.filter((s) => s.kind === "explore").length;
  const next = st.segs[st.idx + 1];
  const progress = 1 - t.remaining / t.segMs;

  return (
    <section className={`timer-run ${seg.kind}`}>
      <p className="eyebrow">{seg.kind === "explore" ? `探險中・第 ${exploreNo} / ${exploreAll} 段` : "休息中・坐下來喘口氣"}</p>
      <Globe kind={seg.kind} progress={progress} moving={!st.paused && seg.kind === "explore"} />
      <p className="t-time" aria-live="off">
        {fmt(t.remaining)}
      </p>
      <p className="lead t-note">
        {st.paused
          ? "暫停中，雪丸在原地等你。"
          : seg.kind === "explore"
            ? "專心做手上的事，雪丸陪你一起走。"
            : "站起來動一動、喝口水，雪丸也在喝冰飲。"}
        {next ? `下一段：${next.kind === "explore" ? "探險" : "休息"} ${next.min} 分鐘。` : "這是最後一段了！"}
      </p>
      <div className="journey" aria-label="整趟旅程的進度">
        {st.segs.map((s, i) => (
          <span key={i} className={`j-seg ${s.kind} ${i < st.idx ? "past" : i === st.idx ? "now" : ""}`} style={{ flexGrow: s.min }}>
            {i === st.idx && <i style={{ width: `${progress * 100}%` }} />}
          </span>
        ))}
      </div>
      <div className="actions center">
        {st.paused ? (
          <button className="btn primary large" onClick={t.resume}>
            繼續
          </button>
        ) : (
          <button className="btn primary large" onClick={t.pause}>
            暫停
          </button>
        )}
        <button className="btn large" onClick={t.skip}>
          {seg.kind === "explore" ? "提早休息" : "提早出發"}
        </button>
        <button className="btn large" onClick={t.stop}>
          結束旅程
        </button>
      </div>
    </section>
  );
}
