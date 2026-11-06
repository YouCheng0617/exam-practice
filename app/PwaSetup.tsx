"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Hint = "" | "ios" | "android-prompt" | "android-manual";

const DISMISS_KEY = "clg_install_dismissed";

export default function PwaSetup({ base }: { base: string }) {
  const [hint, setHint] = useState<Hint>("");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    // 註冊離線快取（開發模式不註冊，免得改程式還看到舊畫面）
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    } catch {}
    if (Date.now() - dismissedAt < 7 * 24 * 3600 * 1000) return;

    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const isAndroid = /android/i.test(ua);

    if (isIOS) {
      const t = setTimeout(() => setHint("ios"), 1500);
      return () => clearTimeout(t);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setHint("android-prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const t = isAndroid ? setTimeout(() => setHint((h) => h || "android-manual"), 4000) : undefined;
    const onInstalled = () => setHint("");
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (t) clearTimeout(t);
    };
  }, [base]);

  function dismiss() {
    setHint("");
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setHint("");
  }

  if (!hint) return null;

  return (
    <div className="install-bar" role="dialog" aria-label="加到主畫面">
      <img src={`${base}/icon-192.png`} alt="" width={44} height={44} />
      <div className="install-text">
        <b>把考試題庫訓練加到主畫面</b>
        {hint === "ios" && (
          <span>
            點 Safari 下方的 <ShareIcon /> 分享，再選「<b>加入主畫面</b>」
          </span>
        )}
        {hint === "android-prompt" && <span>像 App 一樣全螢幕玩，沒網路也能複習</span>}
        {hint === "android-manual" && (
          <span>
            點 Chrome 右上角 <b>⋮</b>，選「<b>加到主畫面</b>」或「安裝應用程式」
          </span>
        )}
      </div>
      {hint === "android-prompt" && (
        <button className="install-btn" onClick={install}>
          安裝
        </button>
      )}
      <button className="install-close" onClick={dismiss} aria-label="關閉">
        ✕
      </button>
      {hint === "ios" && <span className="install-arrow">▼</span>}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="17" viewBox="0 0 14 17" style={{ verticalAlign: "-2px", margin: "0 2px" }} aria-label="分享">
      <path d="M7 1v10M3.5 4.5 7 1l3.5 3.5" fill="none" stroke="#2563eb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 7H2v9h10V7H9.5" fill="none" stroke="#2563eb" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
