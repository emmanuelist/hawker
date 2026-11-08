# Hawker: live demo run-of-show

**Thesis in one line:** *Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.*

Judging is from the video (docs/VIDEO.md); this is for any live showing. Target ~3 minutes. Lead with the feeling, escalate to proof, close on the thesis. Everything on screen is live.

## Pre-flight
- [ ] `/api/health` on https://hawker-8q2t.onrender.com answers with the expected commit (keep-warm holds it up; a cold start takes ~1 min)
- [ ] Tabs open on the deployed origin, console clean: the landing, the desk (laptop), the stall on a phone, the ledger
- [ ] No copy Holding or Waiting on the demo stall; a fresh show if the chat is busy (`npm run show:new -- "<title>" A2`)
- [ ] The phone signed into nothing: buyers join with a name on the stall
- [ ] The one moment: the PASSED stamp landing on the desk as the copy passes to the next buyer
- [ ] Backup: the uploaded video, and the captures in `docs/evidence/` (E-028 … E-031)

## Cold open: the problem (0:00–0:20)
> "In a live sale, the chat moves faster than the seller. Everyone types 'mine', the seller invoices by hand, and half of them never pay, so the item sits held for someone who's gone."

## Act 1: the feel (0:20–1:30)
1. On the phone, join as a buyer and type a claim the way you would on a live: Pidgin (“abeg I go take the L”).
   > "A model reads what she meant; plain code checks the catalog and gives her the copy, with her own PayPal invoice and a timer."
2. A second buyer claims the same last one in Taglish: they wait in line, and the desk shows who's next.
3. **The reversal.** Let the first buyer's timer run out (or Release from the stall). Slow down here: the desk stamps PASSED → the next buyer and tears the copy off; the second phone turns yellow with a new invoice.
   > "Unpaid isn't a third state. Hawker asked PayPal first, cancelled the unpaid invoice, and passed it on."
4. The second buyer pays on PayPal; PAID lands on their phone and the desk with the PayPal transaction.

## Act 2: and it's real (1:30–2:30)
- The landing's **Every way out, refused.**: Try all 9. PayPal refuses cancelling a paid invoice (`422 CANNOT_CANCEL_PAID_INVOICE`); the database refuses changing an ending, ending twice, a third state.
- The ledger in AG Studio: ask "Who still owes right now?"; the agent re-reads PayPal and prints its receipt.
- One click: "Open on PayPal (sandbox)" on the landing shows a paid invoice on PayPal's own page.

## Close (2:30–3:00)
> "PayPal sandbox only; no real money moves. Hawker: every hold ends one of two ways: paid through PayPal, or passed to the next buyer."

## If something breaks
- The app is cold → wait for `/api/health` (~1 min) while telling the cold open; or play the video.
- A model is slow or rate-limited → type the claim the canonical way (“mine L”): the fast path reads it without a model.
- PayPal's checkout window doesn't open → click the PayPal button again; or pay from a laptop window (T-29).
- Refusals answer 429 → you've hit 30 attempts a minute; show the previous replies or the E-029 capture.
