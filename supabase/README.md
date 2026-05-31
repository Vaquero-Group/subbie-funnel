# Supabase — backend for the subbie funnel

The funnel posts applications straight to Supabase via the REST API using the
**publishable (anon) key**, which is safe in client-side code because the table
is **insert-only** under RLS.

- Project: `bctfwsmwxmhsfhayvwhj`
- Table: `subbie_applications` (schema in [`schema.sql`](./schema.sql)) — **live and verified**
- RLS: anon may `INSERT` only. No read/update/delete from the page.

## Connecting the dashboard (The Rail / vaquero-crew)

The intended home for applications is the ops dashboard. The full, ready-to-wire
read connection — endpoint, auth, drop-in client, env vars, realtime — is in
[`INTEGRATION.md`](./INTEGRATION.md). Wire it when you connect the dashboard;
nothing there blocks the funnel collecting applications now.

## Viewing applications

Dashboard → Table Editor → `subbie_applications`. Or, for a CSV pull with the
**service-role** key (server-side only — never put this in the page):

```bash
curl "https://bctfwsmwxmhsfhayvwhj.supabase.co/rest/v1/subbie_applications?select=*&order=created_at.desc" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Accept: text/csv" -o applications.csv
```

## Notifications — `notify-application` Edge Function

Pings the GM on every new application so none land silently. Telegram is the
primary channel (matches the COWBOY stack); email via Resend is an optional
second channel. Each channel is opt-in — set its secrets or it's skipped.

### Deploy (one time, ~5 min)

```bash
# from the repo root, with the Supabase CLI installed + logged in:
supabase link --project-ref bctfwsmwxmhsfhayvwhj
supabase functions deploy notify-application --no-verify-jwt

# Telegram (primary). Reuse an existing COWBOY bot token or make a fresh one
# via @BotFather. Chat ID: message the bot, then read it from
# https://api.telegram.org/bot<TOKEN>/getUpdates
supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABC... TELEGRAM_CHAT_ID=987654321

# Email (optional second channel). Resend free tier; onboarding@resend.dev works
# without domain verification for testing.
supabase secrets set RESEND_API_KEY=re_... NOTIFY_EMAIL=admin@vaquerocommercialflooring.com.au
```

### Wire the trigger

Dashboard → **Database → Webhooks → Create a new hook**

- Table: `subbie_applications`
- Events: **Insert**
- Type: **Supabase Edge Functions** → `notify-application`
- Method: `POST`

Submit a test application on the live site — the Telegram message should land
within a second or two. If it doesn't, check **Edge Functions → Logs**.

### Quietest fallback (no function)

If you'd rather not deploy the function tonight, applications still persist in
the table — just check the dashboard. The function only adds the *alert*.
