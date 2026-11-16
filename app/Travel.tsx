// 旅行風的裝飾與小元件。插圖都是純裝飾，螢幕閱讀器會略過。

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

// 圓形印章：大字是主要文字，小字是說明
export function Stamp({ text, sub, className }: { text: string; sub?: string; className?: string }) {
  return (
    <span className={`stamp-passport ${className ?? ""}`} aria-hidden>
      <span className="sp-text">{text}</span>
      {sub && <span className="sp-sub">{sub}</span>}
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
