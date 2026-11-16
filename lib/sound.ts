// 小音效：用 Web Audio 直接合成，不需要音檔
let ctx: AudioContext | null = null;

function tone(freq: number, at: number, dur: number, type: OscillatorType = "sine", vol = 0.12) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime + at;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  } catch {}
}

export const sfx = {
  right(combo = 1) {
    const up = Math.min(combo - 1, 5) * 40; // 連對越多音越高
    tone(660 + up, 0, 0.12);
    tone(880 + up, 0.09, 0.2);
  },
  wrong() {
    tone(240, 0, 0.16, "triangle");
    tone(190, 0.12, 0.24, "triangle");
  },
  done() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.26));
  },
};
