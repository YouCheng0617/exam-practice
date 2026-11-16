"use client";

import { useEffect, useRef, useState } from "react";
import type { Subject } from "@/data/types";
import { accuracy, allQuestions, colorOf, dayStr, keyOf, type Attempt, type Data } from "@/lib/store";

const DAY = 86400000;
const pctOf = (right: number, total: number) => (total ? Math.round((right / total) * 100) : 0);

// ============================================================
// 每天練了幾題（最近 14 天）
// ============================================================
export function DailyChart({ attempts }: { attempts: Attempt[] }) {
  const now = Date.now();
  const days = Array.from({ length: 14 }, (_, i) => {
    const t = now - (13 - i) * DAY;
    const d = new Date(t);
    return { key: dayStr(t), label: `${d.getMonth() + 1}/${d.getDate()}`, total: 0, right: 0 };
  });
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const a of attempts) {
    const d = byKey.get(dayStr(a.at));
    if (d) {
      d.total += a.total;
      d.right += a.right;
    }
  }
  const max = Math.max(...days.map((d) => d.total), 1);
  const sum = days.reduce((s, d) => s + d.total, 0);
  const active = days.filter((d) => d.total > 0).length;

  return (
    <figure className="chart">
      <figcaption>
        <b>每天練了幾題</b>
        <span>
          最近 14 天・{active} 天有練・共 {sum} 題
        </span>
      </figcaption>
      <div className="cols">
        <span className="cols-max">{max} 題</span>
        {days.map((d, i) => {
          const today = i === days.length - 1;
          return (
            <div
              className="col"
              key={d.key}
              tabIndex={0}
              aria-label={`${d.label}：${d.total ? `${d.total} 題，答對率 ${pctOf(d.right, d.total)}%` : "沒有練習"}`}
            >
              <div className={`tip ${i < 3 ? "left" : i > 10 ? "right" : ""}`}>
                <b>{today ? "今天" : d.label}</b>
                {d.total ? (
                  <>
                    {d.total} 題・答對 {pctOf(d.right, d.total)}%
                  </>
                ) : (
                  "沒有練習"
                )}
              </div>
              <div className="col-track">
                <i className={d.total ? "" : "zero"} style={{ height: d.total ? `${Math.max((d.total / max) * 100, 4)}%` : undefined }} />
              </div>
              <span className={`col-x ${today ? "today" : ""}`}>{today ? "今天" : i % 3 === 1 ? d.label : ""}</span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

// ============================================================
// 答對率走勢（最近 12 次練習）
// ============================================================
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function TrendChart({ attempts }: { attempts: Attempt[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pts = attempts.slice(0, 12).reverse().map((a) => ({ a, pct: pctOf(a.right, a.total) }));

  const H = 190;
  const L = 34;
  const R = 44;
  const T = 16;
  const B = 26;
  const step = pts.length > 1 ? (w - L - R) / (pts.length - 1) : 0;
  const x = (i: number) => L + i * step;
  const y = (p: number) => T + (1 - p / 100) * (H - T - B);
  const fmt = (t: number) => {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const last = pts[pts.length - 1];
  const first = pts[0];
  const diff = pts.length > 1 ? last.pct - first.pct : 0;
  const h = hover !== null ? pts[hover] : null;

  return (
    <figure className="chart">
      <figcaption>
        <b>答對率走勢</b>
        <span>
          最近 {pts.length} 次練習
          {pts.length > 1 && (diff > 0 ? `・比第一次進步 ${diff}%` : diff < 0 ? `・比第一次少 ${-diff}%` : "・跟第一次一樣")}
        </span>
      </figcaption>
      <div className="trend" ref={ref} style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {pts.length < 2 ? (
          <p className="chart-empty">再練一次就會出現走勢線，看看自己有沒有進步。</p>
        ) : (
          w > 0 && (
            <>
              <svg width={w} height={H} role="img" aria-label={`最近 ${pts.length} 次練習的答對率，從 ${first.pct}% 到 ${last.pct}%`}>
                {[0, 50, 100].map((g) => (
                  <g key={g}>
                    <line x1={L} x2={w - R} y1={y(g)} y2={y(g)} className="grid-line" />
                    <text x={L - 8} y={y(g) + 4} textAnchor="end" className="axis-text">
                      {g}
                      {g === 100 ? "%" : ""}
                    </text>
                  </g>
                ))}
                {h && hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="cross" />}
                <polyline points={pts.map((p, i) => `${x(i)},${y(p.pct)}`).join(" ")} className="trend-line" />
                {pts.map((p, i) => (
                  <circle key={p.a.id} cx={x(i)} cy={y(p.pct)} r={hover === i ? 6 : 4.5} className="trend-dot" />
                ))}
                <text x={x(pts.length - 1) + 10} y={y(last.pct) + 5} className="end-label">
                  {last.pct}%
                </text>
                <text x={x(0)} y={H - 6} textAnchor="start" className="axis-text">
                  {fmt(first.a.at)}
                </text>
                <text x={x(pts.length - 1)} y={H - 6} textAnchor="end" className="axis-text">
                  {fmt(last.a.at)}
                </text>
                {pts.map((p, i) => (
                  <rect
                    key={p.a.id}
                    x={x(i) - Math.max(step, 28) / 2}
                    y={0}
                    width={Math.max(step, 28)}
                    height={H}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${fmt(p.a.at)} ${p.a.setName}：答對率 ${p.pct}%`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    onClick={() => setHover(i)}
                  />
                ))}
              </svg>
              {h && hover !== null && (
                <div
                  className="tip show"
                  style={{
                    left: x(hover),
                    top: y(h.pct),
                    transform: `translate(${x(hover) > w * 0.7 ? "-88%" : x(hover) < w * 0.3 ? "-12%" : "-50%"}, calc(-100% - 12px))`,
                  }}
                >
                  <b>{h.pct}%</b>
                  {h.a.setName}・{h.a.mode === "exam" ? "模擬考" : "練習"}
                  <br />
                  {fmt(h.a.at)}・答對 {h.a.right} / {h.a.total}
                </div>
              )}
            </>
          )
        )}
      </div>
    </figure>
  );
}

// ============================================================
// 各科比較
// ============================================================
export function SubjectChart({ sets, data }: { sets: Subject[]; data: Data }) {
  const rows = sets
    .map((s) => ({ s, ...accuracy(data, allQuestions(s).map((q) => keyOf(s, q))) }))
    .filter((r) => r.pct !== null)
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  if (!rows.length) return null;

  return (
    <figure className="chart">
      <figcaption>
        <b>各科比一比</b>
        <span>每一科到目前為止的答對率</span>
      </figcaption>
      <ul className="hbars">
        {rows.map((r) => (
          <li key={r.s.id} style={{ "--c": colorOf(r.s) } as React.CSSProperties}>
            <span className="hb-name">
              <i aria-hidden />
              {r.s.name}
            </span>
            <span className="hb-track" aria-hidden>
              <i style={{ width: `${Math.max(r.pct ?? 0, 2)}%` }} />
            </span>
            <span className="hb-val">
              {r.pct}%<small>答 {r.seen} 題</small>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
