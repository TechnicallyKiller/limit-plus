"""Original temp track for the intro, 120 BPM, 60 s (30 bars). Writes public/track.wav. Leaves space for voice over."""
import numpy as np, wave
SR = 44100; BPM = 120; BEAT = 60 / BPM; BAR = BEAT * 4; DUR = 60
N = SR * DUR; L = np.zeros(N); R = np.zeros(N); FL = np.zeros(N); FR = np.zeros(N); rng = np.random.default_rng(11)

def put(sig, t, g=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i < 0 or i >= N: return
    s = sig[: j - i] * g
    L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))

def putfx(sig, t, g=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i < 0 or i >= N: return
    s_ = sig[: j - i] * g
    FL[i:j] += s_ * (1 - max(0, pan)); FR[i:j] += s_ * (1 + min(0, pan))

def kick(dur=0.45):
    t = np.arange(int(dur * SR)) / SR; f = 45 + 110 * np.exp(-t * 28)
    return np.sin(np.cumsum(2 * np.pi * f / SR)) * np.exp(-t / 0.16) * 1.0 + 0.3 * rng.standard_normal(len(t)) * np.exp(-t / 0.006)
def snare(dur=0.3):
    t = np.arange(int(dur * SR)) / SR
    return (rng.standard_normal(len(t)) * np.exp(-t / 0.07) * 0.6 + np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.5)
def hat(dur=0.08):
    t = np.arange(int(dur * SR)) / SR
    x = rng.standard_normal(len(t)); x = x - np.concatenate([[0], x[:-1]])
    return x * np.exp(-t / 0.018) * 0.35
def bass(f, dur):
    t = np.arange(int(dur * SR)) / SR
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t)
    return s * np.minimum(1, t / 0.01) * np.exp(-t / (dur * 0.9)) * 0.55
def pluck(f, dur=0.35):
    t = np.arange(int(dur * SR)) / SR
    s = sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 7)) * np.exp(-t / 0.12)
    return s * 0.12
def impact(dur=2.6):
    t = np.arange(int(dur * SR)) / SR; f = 28 + 60 * np.exp(-t * 4)
    return (np.sin(np.cumsum(2 * np.pi * f / SR)) * np.exp(-t / 1.0) + rng.standard_normal(len(t)) * np.exp(-t / 0.12) * 0.5) * 1.1
def riser(dur, f0=200, f1=6000):
    n = int(dur * SR); t = np.arange(n) / SR; k = t / dur
    noise = rng.standard_normal(n); out = np.zeros(n); prev = 0.0
    cut = f0 * (f1 / f0) ** k
    for i in range(n):
        a = 2 * np.pi * cut[i] / SR; a = a / (1 + a); prev += a * (noise[i] - prev); out[i] = prev
    return out * (k ** 2) * 0.5

bars = lambda b: (b - 1) * BAR   # bar numbers are 1-based, matching the script
# Bars 1-3: hook. Kick on every beat enters at bar 2; hats from bar 3
for b in range(1, 31):
    t0 = bars(b)
    section_drive = 2 <= b <= 5 or 11 <= b <= 25 or b >= 26
    if b == 9 or b == 10:        # the turn: stripped for the stomp
        pass
    if section_drive and b not in (9, 10, 16, 25):
        for beat in range(4): put(kick(), t0 + beat * BEAT, 0.9)
        for e in range(8): put(hat(), t0 + e * BEAT / 2 + BEAT / 4, 0.5 if e % 2 else 0.3)
        put(snare(), t0 + BEAT, 0.6); put(snare(), t0 + 3 * BEAT, 0.6)
    # bass line follows the chord roots A F C G in 55 Hz octave
    roots = [55, 43.65, 65.41, 49]
    if 2 <= b <= 8 or 11 <= b <= 30:
        r = roots[(b - 1) % 4]
        for e in range(8): put(bass(r, BEAT / 2 * 0.9), t0 + e * BEAT / 2, 0.55)
    # arp plucks from the solution on
    if 11 <= b <= 25:
        notes = [220, 261.6, 329.6, 392, 329.6, 261.6, 220, 196]
        for e in range(16): put(pluck(notes[e % 8] * (2 if e % 4 == 3 else 1)), t0 + e * BEAT / 4, 0.7, pan=(e % 4 - 1.5) / 3)
# Story (bars 6-8): drive thins out to a ticking pulse, so the freeze at bar 8 end lands
for b in (6, 7, 8):
    for beat in range(4): put(hat(0.05), bars(b) + beat * BEAT, 0.7)
# Risers into the turn and into the end
putfx(riser(BAR * 2), bars(8), 0.7); putfx(riser(BAR * 2, 300, 8000), bars(24), 0.6)
# The turn at bar 9 beat 3 (0:17): half a beat of silence at bar 9, then the stomp on bar 10 beat 1 (0:18)
putfx(impact(), bars(10), 1.0)
# Candle goes out (bar 15 end / bar 16): one beat of silence then a hit
putfx(impact(1.6), bars(16) + BEAT, 0.8)
# Closing hit and tail
putfx(impact(3.0), bars(26) - 4 / 30, 1.0); putfx(impact(1.8), bars(28), 0.85)
for i, f in enumerate([523, 659, 784, 1047]): putfx(pluck(f, 1.2) * 3, bars(29) + i * BEAT / 2, 0.6)

# Sidechain duck under voice over lines (approximate windows, seconds) so the voice always sits on top
vo = [(0.2, 6.0), (6.2, 8.3), (10.0, 16.0), (18.0, 19.0), (20.0, 22.0), (24.0, 26.0), (28.0, 30.0), (32.0, 34.0), (36.0, 44.0), (44.0, 47.0), (52.0, 58.0)]
duck = np.ones(N)
for a, b in vo:
    i, j = int(a * SR), int(b * SR); duck[i:j] = 0.45
duck = np.convolve(duck, np.ones(2000) / 2000, mode="same")
L *= duck; R *= duck
m = max(np.abs(L).max(), np.abs(R).max()); L *= 0.88 / m; R *= 0.88 / m
pcm = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open("public/track.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote public/track.wav", len(pcm) / SR, "s")

mf = max(np.abs(FL).max(), np.abs(FR).max(), 1e-9)
fx = (np.stack([FL, FR], 1) / mf * 0.9 * 32767).astype(np.int16)
with wave.open("public/fx.wav", "wb") as w2:
    w2.setnchannels(2); w2.setsampwidth(2); w2.setframerate(SR); w2.writeframes(fx.tobytes())
print("wrote public/fx.wav")
