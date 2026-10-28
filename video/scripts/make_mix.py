"""Places Divyanshh's voice over takes on the beats, cleans them, ducks the music under them. Writes public/mix.wav."""
import subprocess, wave, numpy as np, os
SR = 44100
os.makedirs("/tmp/vo44", exist_ok=True)
for i in range(1, 8):
    subprocess.run(["npx", "remotion", "ffmpeg", "-y", "-loglevel", "error", "-i", f"vo/{i}.ogg", "-ac", "1", "-ar", str(SR), f"/tmp/vo44/{i}.wav"], check=True)

def load(p):
    w = wave.open(p); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    return x if w.getnchannels() == 1 else x.reshape(-1, w.getnchannels()).mean(1)

# (clip, speech start in clip, speech end in clip, video time the speech should START)  -- all seconds.
# Speech boundaries come from the loudness curve of each clip; the words come from the transcript.
PIECES = [
    (1, 0.84, 6.38, 0.34),   # Hi, I'm Divyanshh, and I help stock traders get paid while they wait for their price.
    (2, 0.96, 4.58, 6.20),   # By letting market makers bid on their limit orders.
    (3, 0.50, 2.76, 10.00),  # You want NVIDIA at one seventy-one.
    (3, 3.80, 5.04, 12.45),  # It's at one eighty.
    (4, 0.78, 1.70, 14.00),  # So you wait.
    (4, 2.56, 3.28, 15.30),  # For nothing.
    (5, 1.18, 1.76, 18.00),  # Limit plus.  (lands on the stomp)
    (5, 3.02, 4.80, 20.20),  # You name your price. You get paid.
    (6, 0.64, 2.48, 24.20),  # Market makers bid in secret.
    (6, 3.32, 5.44, 27.70),  # The auction ends at a random moment.
    (7, 0.70, 1.82, 31.00),  # One price clears.
    (7, 2.50, 3.20, 32.40),  # You get paid.
    (7, 5.14, 7.00, 36.20),  # Friday's official close decides.
    (7, 7.66, 9.64, 39.60),  # Stock at your price. Or your money back.
    (7, 10.60, 12.38, 42.20),# Either way, you keep the payment.
    (7, 13.90, 14.64, 50.00),# Limit plus.  (second stomp)
    (7, 16.00, 18.30, 51.60),# Name your price. Get paid while you wait.
    (7, 19.70, 20.26, 54.10),# Coming soon.
]
PAD = 0.07
def clean(x):
    # light spectral gate from the quietest 15% of frames, then a 80 Hz high-pass
    n, hop = 1024, 256; win = np.hanning(n)
    fr = [np.fft.rfft(win * x[i:i + n]) for i in range(0, len(x) - n, hop)]
    mag = np.array([np.abs(f) for f in fr]); e = mag.mean(1)
    noise = np.median(mag[e <= np.percentile(e, 15)], axis=0)
    out = np.zeros(len(x) + n); wsum = np.zeros(len(x) + n)
    for k, f in enumerate(fr):
        m = np.abs(f); g = np.clip((m - 1.35 * noise) / np.maximum(m, 1e-9), 0.22, 1.0)
        seg = np.fft.irfft(f * g) * win
        out[k * hop:k * hop + n] += seg; wsum[k * hop:k * hop + n] += win ** 2
    y = (out / np.maximum(wsum, 1e-9))[: len(x)]
    Y = np.fft.rfft(y); fr_hz = np.fft.rfftfreq(len(y), 1 / SR); Y[fr_hz < 80] = 0
    return np.fft.irfft(Y, len(y))

DUR = 60
N = SR * DUR; vo = np.zeros(N)
cache = {}
for clip, a, b, at in PIECES:
    if clip not in cache: cache[clip] = clean(load(f"/tmp/vo44/{clip}.wav"))
    x = cache[clip]
    i0, i1 = int(max(0, a - PAD) * SR), int(min(len(x) / SR, b + PAD) * SR)
    seg = x[i0:i1].copy()
    f = int(0.025 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    rms = np.sqrt(np.mean(seg ** 2)) + 1e-9
    seg *= (10 ** (-17 / 20)) / rms                       # match every phrase to about -17 dBFS rms
    s = int((at - (a - max(0, a - PAD))) * SR)
    vo[s:s + len(seg)] += seg[: N - s]
vo = np.tanh(vo * 1.15) / np.tanh(1.15)                   # gentle limiter

music = np.zeros((N, 2))
w = wave.open("public/track.wav"); raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64).reshape(-1, 2) / 32768
music[: len(raw)] = raw[:N]
env = np.abs(vo); k = int(0.05 * SR); env = np.convolve(env, np.ones(k) / k, mode="same")
active = (env > 0.02).astype(float)
rel = int(0.35 * SR); active = np.convolve(active, np.ones(rel) / rel, mode="same"); active = np.minimum(1, active * 3)
duck = 1 - 0.58 * active
mix = music * duck[:, None] * 0.85 + vo[:, None] * 1.0
mix *= 0.93 / max(1e-9, np.abs(mix).max())
pcm = (mix * 32767).astype(np.int16)
with wave.open("public/mix.wav", "wb") as o:
    o.setnchannels(2); o.setsampwidth(2); o.setframerate(SR); o.writeframes(pcm.tobytes())
print("wrote public/mix.wav", len(pcm) / SR, "s;", len(PIECES), "phrases placed")
