"use client";

import { useState } from "react";
import type { Subject } from "@/data/types";
import { colorOf, type Data } from "@/lib/store";
import { Mascot } from "./Travel";

const tint = (c: string) => ({ "--c": c }) as React.CSSProperties;
const fmt = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};

// 旅行手帳：每一題答過，就留下一張寫給未來自己的明信片
export function Journal({ sets, data, onOpen }: { sets: Subject[]; data: Data; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState("");
  const cards = data.journal;
  const places = new Set(cards.map((c) => c.setId)).size;
  const shown = filter ? cards.filter((c) => c.setId === filter) : cards;
  const withCards = sets.filter((s) => cards.some((c) => c.setId === s.id));

  return (
    <>
      <section className="journal-head">
        <h1>旅行手帳</h1>
        <p className="lead hand">沿途看懂的每一個路標，都寄一張明信片給未來的自己。</p>
        <div className="j-stats">
          <span>✉️ {cards.length} 張明信片</span>
          <span>📍 去過 {places} 個地方</span>
        </div>
      </section>

      {cards.length === 0 ? (
        <p className="empty"><Mascot mood="wait" className="m-empty" />手帳還是空白的。跟雪丸出發吧，走過一題就會收到第一張明信片。</p>
      ) : (
        <>
          {withCards.length > 1 && (
            <div className="chips journal-filter" role="group" aria-label="地點">
              <button className={`chip ${filter === "" ? "on" : ""}`} onClick={() => setFilter("")}>
                全部
              </button>
              {withCards.map((s) => (
                <button key={s.id} className={`chip ${filter === s.id ? "on" : ""}`} onClick={() => setFilter(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <div className="j-grid">
            {shown.map((c) => {
              const s = sets.find((x) => x.id === c.setId);
              return (
                <article key={c.key} className="postcard" style={tint(s ? colorOf(s) : "#7d6c5e")}>
                  <div className="pc-msg">
                    <p className="pc-hi">嗨，未來的我：</p>
                    <p>
                      今天在「{c.setName}」看懂了一個路標——{c.note}
                    </p>
                    <p className="pc-q">路標上寫著：{c.question}</p>
                    {c.answer && <p className="pc-a">答案是 {c.answer}</p>}
                  </div>
                  <div className="pc-side">
                    <span className="pc-stamp" aria-hidden>
                      {c.setName.slice(0, 1)}
                    </span>
                    <span className="pc-postmark" aria-hidden>
                      {fmt(c.at)}
                    </span>
                    <div className="pc-addr">
                      <span>To：未來的我</span>
                      <span>From：{c.setName}</span>
                      {c.topic && <span>{c.topic} 站</span>}
                    </div>
                    {s && (
                      <button className="link" onClick={() => onOpen(s.id)}>
                        回到這一站
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
