"""Original sound design for THE WAIT. Nothing sampled or borrowed. Writes public/sfx.wav (44.1 kHz stereo, 60 s)."""
import numpy as np, wave
SR = 44100; DUR = 60
N = SR * DUR
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if i >= N or j <= i: return
    s = sig[: j - i] * gain
    L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))

def tick(freq=1900, dec=0.018):
    t = np.arange(int(0.12 * SR)) / SR
    return (np.sin(2 * np.pi * freq * t) * np.exp(-t / dec) + 0.35 * rng.standard_normal(len(t)) * np.exp(-t / 0.004)) * 0.9

# ---- clock tick tempo map (seconds -> ticks per second) ----
def rate(t):
    if t < 4: return 1.0
    if t < 9: return 1.0 + (t - 4) / 5 * 11            # accelerates into chaos
    if t < 11.0: return 0.0                             # silence
    if t < 15: return 0.0                               # candle + title, no ticks
    if t < 25: return 70 / 60
    if t < 31: return 40 / 60
    if t < 36: return 40 / 60 * (1 - (t - 31) / 5) + 0.12   # dies away
    if t < 37.0: return 0.0                             # dead
    if t < 40: return 0.0
    if t < 46: return 0.0
    return 1.0                                          # back at 60 BPM from 0:46
t = 0.0; phase = 0.0; dt = 0.001
while t < DUR:
    r = rate(t); phase += r * dt
    if phase >= 1:
        phase -= 1; add(tick(1900 + rng.uniform(-60, 60)), t, 0.55 if t < 4 else 0.35, pan=rng.uniform(-0.6, 0.6) if 4 < t < 9 else 0)
    t += dt
# the very first tick is dry and close
add(tick(2100), 0.2, 0.8)

# ---- Shepard riser from 4 s to 36 s, torn away at the candle going out ----
def shepard(t0, t1):
    n = int((t1 - t0) * SR); tt = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(8):
        # each voice glides up one octave over the length, wrapping with a gaussian amplitude window across octaves
        pos = (k + tt / (t1 - t0) * 2.2) % 8                      # position in octave stack
        f = 55 * 2 ** (pos)                                      # 55 Hz .. 14 kHz
        amp = np.exp(-0.5 * ((pos - 4) / 1.3) ** 2)
        ph = np.cumsum(2 * np.pi * f / SR)
        out += amp * np.sin(ph)
    env = np.minimum(1, tt / 4) * 0.5
    return out / 6 * env
sh = shepard(4, 36)
sh *= np.minimum(1, np.linspace(0, 1, len(sh)) * 3)
# duck during the silent hole (9 to 11 s)
duck = np.ones(len(sh)); a, b = int((9 - 4) * SR), int((11 - 4) * SR); duck[a:b] = 0; duck[b:b + SR // 2] = np.linspace(0, 1, SR // 2)
add(sh * duck, 4, 0.22)

# ---- sub drops (own synthesis: 35 Hz sine falling + noise tail) ----
def sub(dur=2.4, f0=62, f1=34):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt * 3)
    s = np.sin(np.cumsum(2 * np.pi * f / SR)) * np.exp(-tt / 0.9)
    noise = rng.standard_normal(n) * np.exp(-tt / 0.08) * 0.25
    return (s + noise) * 0.95
add(sub(), 14.0, 0.9); add(sub(3.0), 55.0, 1.0)
# one glass hit on the final card
def chime(f, dur=1.4):
    n = int(dur * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.76 * tt)) * np.exp(-tt / 0.35) * 0.4
for i, f in enumerate([1318, 1567, 1760, 2093, 1975, 2349]):
    add(chime(f), 37.3 + i * 0.35, 0.5, pan=(i - 2.5) / 6)

# ---- rewind whoosh 37 to 40 s: filtered noise rising ----
n = int(3 * SR); tt = np.arange(n) / SR
noise = rng.standard_normal(n)
cut = 300 + 7000 * (tt / 3) ** 2
y = np.zeros(n); prev = 0.0
for i in range(n):
    a = min(0.99, 2 * np.pi * cut[i] / SR / (1 + 2 * np.pi * cut[i] / SR)); prev += a * (noise[i] - prev); y[i] = prev
add(y * np.minimum(1, tt / 0.4) * np.exp(-((tt - 3) ** 2) / 0.6) * 0.9, 37, 0.7)

# ---- two Fridays: one clean tone per half (40 to 46 s) ----
def tone(f, dur=1.6):
    n = int(dur * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.6) * 0.5
add(tone(392), 42.0, 0.5, pan=-0.5); add(tone(587), 44.0, 0.5, pan=0.5)
add(tone(784, 2.2), 48.6, 0.35)   # the amber line

# ---- coin ticks as the counter rolls (level 1, 20.0 to 22.5 s) ----
for i in range(22):
    add(tick(3200, 0.01) * 0.6, 20.0 + i * 0.11, 0.35, pan=0.3)

# silence windows: true digital zero
def zero(a, b): L[int(a * SR):int(b * SR)] = 0; R[int(a * SR):int(b * SR)] = 0
zero(9.0, 11.0); zero(36.0, 37.0)

m = max(np.abs(L).max(), np.abs(R).max()); L *= 0.9 / m; R *= 0.9 / m
pcm = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open("public/sfx.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote public/sfx.wav", len(pcm) / SR, "s")
