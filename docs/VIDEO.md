# Hawker: video cut (judged from the video, < 3:00)

**Thesis, verbatim, on screen from 0:00 and as the last line:** *Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.*

**Cut 1 (2026-11-08): 2:04.5**, 1920×1080, 25 fps, H.264 + AAC, narration at −16 LUFS. File: `internal/video/hawker-demo-2026-11-08.mp4` (gitignored; production scripts beside it). Upload: YouTube, public (rules §4), then play it logged-out in a private window.

Narration: ElevenLabs, voice Eric (`cjVigY5qzO86Huf0OWal`, `eleven_multilingual_v2`; verified against the live API 2026-11-08). Every value on screen is live from the deployed app and the PayPal sandbox (E-032). Labels carry the claim for muted viewers.

## The take (E-032)
One item's whole life, in one session on the deployed stall (show 5, "Sunday Live"), recorded on a desk (1280×800) and two phones (390×844) at once. Two buyers: **@amaka.lagos** (Pidgin) and **@jasmine.manila** (Taglish), both read by Groq. The only speed change is the 3:00 timer, shown 16× faster and labelled. PayPal's login screens are cut (the sandbox buyer's email never appears); the checkout's review screen and the payment are shown.

| Time | Picture | Label | Narration |
|---|---|---|---|
| 0:00–0:14 | Landing: the thesis; the pad's labelled replay of this take's pass (No. 0045 → @jasmine.manila) | **Every hold ends one of two ways.** | "In a live sale, the chat moves faster than the seller. Everyone types 'mine', and not everyone pays. Hawker makes every hold end one of two ways: paid through PayPal, or passed to the next buyer." |
| 0:14–0:26 | Amaka types “abeg I go take the XL”; the desk reads it (Groq) and No. 0045 appears with its invoice and 3:00 | **Pidgin, read by a model. Code decides who holds it.** | "Amaka comments in Pidgin. A model reads what she meant; plain code checks the catalog and gives her the last XL, with her own PayPal invoice and a three-minute timer." |
| 0:26–0:38 | Jasmine types “akin na lang yung XL please”; No. 0046 waits, No. 1 in line | **Taglish. The XL is held, so she waits in line.** | "Jasmine wants the same XL, in Taglish. It's held, so she waits in line, in the order the comments arrived." |
| 0:38–1:03 | The timer (16×), then PASSED → @jasmine.manila tears off; Jasmine's copy turns yellow with a new invoice | **Unpaid: passed to the next buyer.** | "Amaka doesn't pay. When time runs out, Hawker asks PayPal first, cancels her unpaid invoice, and passes the XL to Jasmine, with a new one." |
| 1:03–1:16 | The ledger in AG Studio: “Who still owes right now?” → the agent's PayPal receipt: No. 0046 UNPAID | **The seller's ledger, built in AG Studio.** | "On the seller's ledger, built in AG Studio, the agent re-reads PayPal before it says who still owes." |
| 1:16–1:40 | Jasmine taps Pay → PayPal's invoice → checkout (login cut) → Complete Purchase → PAID on her phone and the desk, txn 04R62957391906807 | **Paid only when PayPal says so.** | "Jasmine pays with PayPal. Hawker reads the invoice from PayPal, the only source of payment truth, and stamps it paid. There is no mark-as-paid button." |
| 1:40–1:58 | Landing, “Every way out, refused.”: Try all 9 → 9 of 9 refused | **Every other ending, attempted live and refused.** | "Every other ending is refused, and anyone can try. PayPal won't cancel a paid invoice. The database won't turn a paid copy into a passed one, end a copy twice, or invent a third state." |
| 1:58–2:04 | Landing hero with No. 0046 PAID | **Paid through PayPal, or passed to the next buyer.** · hawker-8q2t.onrender.com | "Hawker. Every hold ends one of two ways: paid through PayPal, or passed to the next buyer." |

## Claims check
Every narrated or labelled factual sentence has a verified row in docs/EVIDENCE.md: C-1 thesis · C-2 English/Pidgin/Taglish · C-3 PayPal read, no mark-as-paid · C-4 asks PayPal first · C-5 database refuses · C-6 sandbox · C-7 arrival order, 3:00 · C-10 refusals · C-11 ledger · C-14 the agent re-reads PayPal. "Not everyone pays" is the seller's problem stated without a number.

## Deliberately not in this video
Architecture; the eval and failover (README); the agent delegating to Studio's agents; the last-second payment race (E-027); the buzz on phones; code.

## Takes
- Take 1 (L): complete, not used. Groq read the Taglish “sakin na lang yung L po” as a question for the seller (no hold, the safe path); the line stayed pinned on the desk. Now an eval case (E-032).
- Take 2: stopped at join: both handles were taken on the stall by take 1.
- Take 3 (XL): used.
