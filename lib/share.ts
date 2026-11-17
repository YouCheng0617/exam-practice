import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import type { Subject } from "@/data/types";
import { parseSet } from "./analyze";

// ============================================================
// 分享連結：整份題庫壓縮後放在網址的 # 後面。
// # 後面的內容不會送到伺服器，題庫也不會存在任何地方；拿到連結的人才能匯入。
// ============================================================

const toB64 = (u: Uint8Array) => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64 = (t: string) => {
  const b = atob(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
};

export function encodeSet(s: Subject): string {
  const payload = {
    v: 1,
    name: s.name,
    desc: s.desc,
    year: s.year,
    highlights: s.highlights,
    color: s.color,
    exam: s.exam,
    modes: s.modes,
    roundSize: s.roundSize,
    questions: s.questions,
    essays: s.essays,
  };
  return toB64(deflateSync(strToU8(JSON.stringify(payload)), { level: 9 }));
}

export function decodeSet(code: string): Subject {
  let text: string;
  try {
    text = strFromU8(inflateSync(fromB64(code)));
  } catch {
    throw new Error("這個分享連結不完整，可能複製時被截斷了，請對方再傳一次。");
  }
  return parseSet(text);
}

// 同一個連結匯入兩次，只會留一份
export function shareKeyOf(code: string): string {
  let h = 5381;
  for (let i = 0; i < code.length; i++) h = ((h * 33) ^ code.charCodeAt(i)) >>> 0;
  return h.toString(36) + code.length.toString(36);
}

export const shareUrl = (s: Subject) => `${location.origin}/#s=${encodeSet(s)}`;
export const readShareHash = () => location.hash.match(/^#s=([A-Za-z0-9_-]+)$/)?.[1] ?? null;
