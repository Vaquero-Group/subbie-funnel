# Vaquero — Subbie Network funnel

Single-file recruiting funnel for **Vaquero Floorcoverings** — subcontractor
intake for commercial floor layers across Australia. Applications post to
Supabase. No build step: one HTML file, vanilla CSS/JS, Google Fonts only.

**Live:** https://vaquero-group.github.io/subbie-funnel/
**Send it:** built for direct send (SMS / Messenger / email) to subbies you've picked.

---

## Edit & deploy

Everything lives in [`index.html`](./index.html) — markup, styles, and script
inlined. To change copy or styling, edit it and push:

```bash
git add index.html && git commit -m "tweak copy" && git push
```

GitHub Pages redeploys automatically (~30s). That's the whole loop.

The share-card image is [`og-image.png`](./og-image.png), generated from
[`og-card.html`](./og-card.html). To regenerate after editing the card:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --window-size=1200,630 --virtual-time-budget=3500 \
  --screenshot="$PWD/og-image.png" "file://$PWD/og-card.html"
```

## Where applications go

Straight to Supabase (`subbie_applications`), insert-only RLS. The publishable
key in the page is safe to expose. View / export / get alerted: see
[`supabase/README.md`](./supabase/README.md).

- **Alerts:** deploy the `notify-application` Edge Function → Telegram ping per
  application. One-time setup in `supabase/README.md`.
- **Until then:** applications still persist — read them in the Supabase dashboard.

## Custom domain (optional polish)

The github.io URL is fine to send. For `subbies.vaquero.com.au`, connect the repo
to **Cloudflare Pages** (Workers & Pages → Create → Pages → Connect to Git →
this repo; framework preset **None**, build command blank, output dir `/`), then
add the custom domain there. Update the `og:url` / `og:image` absolute URLs in
`index.html` to the new domain when you switch.

## Form behaviour

- 6 steps, in-character validation, optimistic-UI submit (success shows
  immediately; the POST fires in the background — fits patchy site reception).
- **Hard reject:** PL cover below $10M → deferral panel, no submission.
- **Honeypot:** hidden `company` field; bot-filled submissions are silently dropped.
- **Attribution:** UTM + referrer + landing URL captured at load, attached to the row.
  FB/group link convention: `?utm_source=facebook&utm_medium=group&utm_campaign=subbie_intake&utm_content=<group_slug>`

## Tone

Recruiting, not sales. Descriptive, premium, un-tradie. No pain agitation, no
closing-pitch CTA, no time-based promises ("weekly invoicing", not "7-day terms";
"GM reads every application", not "48h response").
