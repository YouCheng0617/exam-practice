// 旅行風的裝飾與小元件。插圖都是純裝飾，螢幕閱讀器會略過。
import { useId } from "react";

export function Compass() {
  return (
    <svg className="compass" viewBox="0 0 32 32" width="28" height="28" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#fffdf7" stroke="#2a1f17" strokeWidth="2" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="#e2cdb2" strokeWidth="1" />
      <path d="M16 5l3.6 11H12.4z" fill="#f0603c" />
      <path d="M16 27l3.6-11H12.4z" fill="#2a1f17" />
      <circle cx="16" cy="16" r="1.6" fill="#fffdf7" />
    </svg>
  );
}

// ============================================================
// 橡皮章（第 13 號畫風）：單一紅色印泥、邊緣斑駁、雙框、中間一隻線條小鳥
// 斑駁效果的濾鏡由 <InkDefs /> 提供，整頁放一次就好。
// ============================================================
export function InkDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        <filter id="ink-rough" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.15 1.55" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" result="c" />
          <feTurbulence type="fractalNoise" baseFrequency=".05" seed="1" result="t" />
          <feDisplacementMap in="c" in2="t" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

const poly = (n: number, r: number, rot: number) =>
  "M" +
  Array.from({ length: n }, (_, i) => {
    const a = ((rot + (360 * i) / n) * Math.PI) / 180;
    return `${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`;
  }).join(" L") +
  "Z";
const scallop = () => {
  const n = 18;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a0 = (2 * Math.PI * i) / n;
    const a1 = (2 * Math.PI * (i + 1)) / n;
    const am = (a0 + a1) / 2;
    if (i === 0) d += `M${(50 + 42 * Math.cos(a0)).toFixed(1)} ${(50 + 42 * Math.sin(a0)).toFixed(1)}`;
    d += ` Q${(50 + 52 * Math.cos(am)).toFixed(1)} ${(50 + 52 * Math.sin(am)).toFixed(1)} ${(50 + 42 * Math.cos(a1)).toFixed(1)} ${(50 + 42 * Math.sin(a1)).toFixed(1)}`;
  }
  return d + "Z";
};

// 每一站一個形狀：圓、圓角方、六角、橢圓、八角、盾牌、菱形、波浪邊、票根
const SHAPES = [
  "M50 4 a46 46 0 1 0 0.01 0Z",
  "M18 6 H82 a12 12 0 0 1 12 12 V82 a12 12 0 0 1 -12 12 H18 a12 12 0 0 1 -12 -12 V18 a12 12 0 0 1 12 -12Z",
  poly(6, 48, 30),
  "M3 50 a47 36 0 1 0 94 0 a47 36 0 1 0 -94 0Z",
  poly(8, 48, 22.5),
  "M50 4 L92 16 V48 C92 74 72 90 50 97 C28 90 8 74 8 48 V16Z",
  poly(4, 50, 90),
  scallop(),
  "M6 18 a10 10 0 0 0 10 -10 H84 a10 10 0 0 0 10 10 V82 a10 10 0 0 0 -10 10 H16 a10 10 0 0 0 -10 -10Z",
];
const ROT = [-8, 6, -3, 10, -12, 4, -6, 8, -2];
export const stampShape = (i: number) => i % SHAPES.length;

// 線條版的吉祥物（圓身體、點點眼、小嘴、領巾、背包、尾巴、腳）
function TinyBird({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="-9" width="8" height="10" rx="2.5" fill="currentColor" stroke="none" />
      <path d="M9 7 L18 12" strokeWidth="2.4" />
      <circle r="11" fill="#fff" fillOpacity="0" />
      <circle r="11" />
      <circle cx="-4" cy="-1.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="-1.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M-1.8 1.2 H1.8 L0 3.8Z" fill="currentColor" stroke="none" />
      <path d="M-9 5 Q0 9.5 9 5" strokeWidth="2.4" />
      <path d="M-3 11 v3 M3 11 v3" />
    </g>
  );
}

// 護照上每一站的入境章。done＝已抵達才蓋紅章，還沒抵達只畫虛線空位。
export function VisaStamp({ topic, index, done, progress }: { topic: string; index: number; done: boolean; progress: string }) {
  const shape = stampShape(index);
  const d = SHAPES[shape];
  const narrow = shape === 6; // 菱形中間比較窄
  const size = (topic.length <= 4 ? 14 : topic.length <= 6 ? 12 : 10.5) - (narrow ? 2 : 0);
  const long = topic.length > (narrow ? 5 : 7);
  return (
    <span className={`visa ${done ? "on" : ""}`} style={{ "--r": `${ROT[index % ROT.length]}deg` } as React.CSSProperties} title={done ? `${topic}：已抵達` : `${topic}：${progress}`}>
      <svg viewBox="-2 -2 104 104" aria-hidden>
        {done ? (
          <g filter="url(#ink-rough)">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
            <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" transform="translate(50 50) scale(.84) translate(-50 -50)" />
            <TinyBird x={48} y={32} s={0.8} />
            <text x="50" y="63" textAnchor="middle" fontSize={size} fontWeight="900" fill="currentColor" {...(long ? { textLength: narrow ? 50 : 64, lengthAdjust: "spacingAndGlyphs" } : {})}>
              {topic}
            </text>
            <text x="50" y="75" textAnchor="middle" fontSize="6.4" fontWeight="900" letterSpacing="1" fill="currentColor">
              ARRIVED
            </text>
          </g>
        ) : (
          <g>
            <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="4 4" strokeLinejoin="round" />
            <text x="50" y="50" textAnchor="middle" fontSize={size} fontWeight="900" fill="currentColor" {...(long ? { textLength: narrow ? 50 : 64, lengthAdjust: "spacingAndGlyphs" } : {})}>
              {topic}
            </text>
            <text x="50" y="66" textAnchor="middle" fontSize="10" fontWeight="800" fill="currentColor">
              {progress}
            </text>
          </g>
        )}
      </svg>
    </span>
  );
}

// 大印章（全線走完／抵達）：圓形，外圈一圈小字繞著走
export function Stamp({ text, sub, className }: { text: string; sub?: string; className?: string }) {
  const id = "ring" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <span className={`stamp-passport ${className ?? ""}`} aria-hidden>
      <svg viewBox="-2 -2 104 104">
        <defs>
          <path id={id} d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" />
        </defs>
        <g filter="url(#ink-rough)">
          <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="1.6" />
          {sub && (
            <text fontSize="8.5" fontWeight="900" letterSpacing="2" fill="currentColor">
              <textPath href={`#${id}`} startOffset="25%" textAnchor="middle">
                ★ {sub} ★
              </textPath>
            </text>
          )}
          <text x="50" y="52" textAnchor="middle" fontSize={text.length > 3 ? 13 : 16} fontWeight="900" fill="currentColor">
            {text}
          </text>
          <TinyBird x={48} y={68} s={0.42} />
          <path d="M14 76 l3 -7 l3 7 M80 76 l3 -7 l3 7" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </g>
      </svg>
    </span>
  );
}

// 首頁標題旁：一架小飛機和它飛過的虛線
export function PlaneTrail() {
  return (
    <svg className="plane-trail" viewBox="0 0 260 110" width="260" height="110" aria-hidden>
      <path d="M4 98C60 96 96 70 122 48S186 14 214 20" fill="none" stroke="#c9b396" strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" />
      <g className="plane" transform="translate(206 4) rotate(-14 24 16)">
        <path d="M2 17l34-5c6-1 11 1 11 4s-5 5-11 4z" fill="#2a1f17" />
        <path d="M20 14L30 1h5l-4 13zM20 18l8 12h5l-3-12z" fill="#f0603c" />
        <path d="M4 16L1 8h4l5 7z" fill="#f0603c" />
      </g>
    </svg>
  );
}

// 頁尾的風景：山、太陽、開過去的火車、站牌旁的巴士
export function Scenery() {
  return (
    <div className="scenery" aria-hidden>
      <svg viewBox="0 0 1200 170" preserveAspectRatio="xMidYMax slice">
        <circle cx="190" cy="66" r="32" fill="#ffd84d" opacity=".75" />
        <g fill="#fff" opacity=".85">
          <ellipse cx="420" cy="42" rx="46" ry="12" />
          <ellipse cx="452" cy="34" rx="26" ry="10" />
          <ellipse cx="860" cy="30" rx="54" ry="12" />
          <ellipse cx="826" cy="38" rx="30" ry="9" />
        </g>
        {/* 遠山、近丘 */}
        <path d="M0 132L140 62l120 60 120-72 140 76 120-56 140 58 120-70 140 64 160-42v90H0z" fill="#f1dcbd" />
        <path d="M0 142q150-40 300-4t300-2 300 4 300-10v40H0z" fill="#dfe9c9" />
        {/* 樹 */}
        <g fill="#b9d3a0">
          <path d="M96 138l12-30 12 30zM120 140l10-24 10 24zM640 136l12-30 12 30zM1110 134l12-30 12 30zM1136 136l9-22 9 22z" />
        </g>
        {/* 巴士與站牌（在遠一點的路上） */}
        <g transform="translate(930 112)">
          <path d="M-18 24V-6" stroke="#8d8378" strokeWidth="3" strokeLinecap="round" />
          <circle cx="-18" cy="-10" r="8" fill="#fffdf7" stroke="#8d8378" strokeWidth="2.5" />
          <rect x="0" y="0" width="52" height="24" rx="6" fill="#17a08c" />
          <path d="M6 5h9v8H6zM19 5h9v8h-9zM32 5h9v8h-9z" fill="#e6f7f4" />
          <circle cx="13" cy="25" r="4.5" fill="#2a1f17" />
          <circle cx="40" cy="25" r="4.5" fill="#2a1f17" />
        </g>
        {/* 鐵軌 */}
        <path d="M0 158h1200" stroke="#b9a48a" strokeWidth="3" />
        <path d="M0 162h1200" stroke="#b9a48a" strokeWidth="4" strokeDasharray="4 14" />
        {/* 火車：慢慢開過去 */}
        <g className="train">
          <g transform="translate(0 122)">
            {[0, 78, 156].map((x) => (
              <g key={x} transform={`translate(${x} 0)`}>
                <rect x="0" y="4" width="70" height="26" rx="6" fill="#ffc83d" />
                <path d="M8 10h14v9H8zM28 10h14v9H28zM48 10h14v9H48z" fill="#fff7ec" />
                <circle cx="16" cy="32" r="5" fill="#2a1f17" />
                <circle cx="54" cy="32" r="5" fill="#2a1f17" />
                <path d="M70 22h8" stroke="#2a1f17" strokeWidth="3" />
              </g>
            ))}
            <g transform="translate(234 0)">
              <path d="M0 4h44c16 0 26 10 30 26H0z" fill="#f0603c" />
              <path d="M8 10h16v10H8zM30 10h14c6 1 10 5 12 10H30z" fill="#fff7ec" />
              <circle cx="16" cy="32" r="5" fill="#2a1f17" />
              <circle cx="52" cy="32" r="5" fill="#2a1f17" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

// 吉祥物「雪丸 Yukimaru」（圖檔在 public/mascot/，透明背景）
// 設定：來自寒冷地方、好奇又愛探險的小鳥，很怕熱，為了學習各地的知識跟家人告別，踏上自己的旅程。
export type Mood = "normal" | "wave" | "happy" | "comfort" | "wait" | "wow";
export function Mascot({ mood, className = "" }: { mood: Mood; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/mascot/${mood}.svg`} alt="" aria-hidden className={`mascot ${className}`} draggable={false} />;
}
