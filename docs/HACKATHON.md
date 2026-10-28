# Hack in Hills, final round: submission checklist

Deadline: **28 October 2026**, no extension. Applies to the prototype submission and the social round.

## What the organisers asked for

1. Team details in the Google Form.
2. Prototype: project description plus a working prototype or demo link, or the other required materials.
3. LinkedIn (mandatory): a 1 minute elevator pitch video: what we built, the problem it solves, how it works.
4. X / Twitter (mandatory): the same kind of video, reusing the LinkedIn video is fine.
5. Instagram (optional): a post or reel announcing participation, tagging the organisers.

Rules for the posts:
- Tag all of: `@TinyFish @Nexido @BuilderBase @Web3India`.
- In the introduction of the video, say the exact phrase: **"Hack in Hills, powered by TinyFish."**
- Posts must be public.
- Put the post links in the Google Form.

## Status

| Item | Status |
|---|---|
| Video under 1 minute | Yes, 58 s (`video/out/intro-v7-street-4x5.mp4`) |
| Explains what we built, the problem, how it works | Yes |
| Exact phrase "Hack in Hills, powered by TinyFish." in the intro | **No, needs a re-record of the intro (see below)** |
| Tags in the post text | Drafted below |
| Public prototype or demo link | **Missing: the app only runs locally** |
| Public repo up to date | **No: 12 local commits are unpushed** |
| Music licence checked | **No: verify the licence for "Street Life" before posting** |
| Google Form submitted | Not yet |

## Intro re-record (needed for the exact phrase)

The introduction currently has two clips (clip 1 and clip 2). Replace them with:

- A: "Hi, I'm Divyanshh, and this is Limit plus, built for **Hack in Hills, powered by TinyFish.**"
- B: "It helps stock traders get paid while they wait for their price."

That is about the same length as the current intro (0 to 10 s), so the rest of the video keeps its timings. Everything else in the video stays as recorded.

## Post copy with the required tags

LinkedIn:
```
Every limit order you have ever placed is a bet that you would wait. For nothing.

I built Limit+ for Hack in Hills, powered by TinyFish, so you get paid for the waiting.

You name your price for a tokenized stock. Market makers bid for your order in a sealed auction that ends at a random moment. At Friday's official close you either buy at your price or get your money back, and you keep the payment either way.

Onchain, on Solana. Coming soon.

Prototype. Example numbers. Not financial advice.

@TinyFish @Nexido @BuilderBase @Web3India
```

X:
```
You wait for nothing.
Limit+ pays you to wait.

Built for Hack in Hills, powered by TinyFish.

Name your price. Market makers bid in secret. Friday's close decides: stock at your price, or your money back. You keep the payment either way.

Onchain, on Solana.

@TinyFish @Nexido @BuilderBase @Web3India
```

Put links in the first reply. Upload the video natively on both. Make both posts public, then add both post links to the form.

## Prototype links (the gap)

The Form needs a working prototype or demo link. Right now we have: a public GitHub repo (stale), a local-only app, no devnet deployment (the deploy wallet had about 1 SOL and a deploy needs about 3).
Options, fastest first:
1. Push the code (not the video assets) to the public repo, and link the repo plus the video.
2. Host the Next.js app (example data mode works without a chain) and link it.
3. Devnet deployment once the wallet has about 3 SOL.
