// 用 Web Audio 即時合成音效，不需要音檔
let ctx: AudioContext | null = null;

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.15) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  correct(combo: number) {
    const up = Math.min(combo, 8) * 40;
    tone(523 + up, 0, 0.12, "triangle");
    tone(784 + up, 0.09, 0.2, "triangle");
  },
  wrong() {
    tone(220, 0, 0.18, "sawtooth", 0.08);
    tone(160, 0.15, 0.3, "sawtooth", 0.08);
  },
  gavel() {
    tone(120, 0, 0.08, "square", 0.12);
    tone(90, 0.1, 0.12, "square", 0.12);
  },
  tick() {
    tone(1000, 0, 0.04, "square", 0.03);
  },
  click() {
    tone(660, 0, 0.05, "sine", 0.06);
  },
  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.25, "triangle", 0.12));
  },
  sad() {
    [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.18, 0.3, "sine", 0.1));
  },
};

export const sfx2 = {
  // 翻開參考答案：紙張刷一聲
  paper() {
    const c = ac();
    if (!c) return;
    const len = 0.25;
    const buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    f.type = "bandpass";
    f.frequency.value = 2400;
    g.gain.value = 0.25;
    src.buffer = buf;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  },
  // 勾得分點
  check(on: boolean) {
    tone(on ? 880 : 440, 0, 0.08, "triangle", 0.1);
    if (on) tone(1320, 0.06, 0.1, "triangle", 0.08);
  },
  // 打字
  key() {
    tone(1800 + Math.random() * 400, 0, 0.015, "square", 0.015);
  },
  // 進入問答大題
  bell() {
    tone(988, 0, 0.6, "sine", 0.12);
    tone(1319, 0.02, 0.8, "sine", 0.06);
  },
};
