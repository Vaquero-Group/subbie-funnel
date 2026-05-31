# Connecting the intake to the dashboard

The funnel is the **producer**: it writes applications to Supabase. The dashboard
(The Rail / vaquero-crew) will be the **consumer**: it reads them for review.
This doc is the ready-to-use connection — wire it when you connect the dashboard.

Nothing here needs to be live for the funnel to collect applications. Data is
already landing in the table; this is purely the read side.

## Connection facts

| | |
|---|---|
| Project ref | `bctfwsmwxmhsfhayvwhj` |
| Base URL | `https://bctfwsmwxmhsfhayvwhj.supabase.co` |
| Table | `public.subbie_applications` |
| Columns | see [`schema.sql`](./schema.sql) (24 fields) |
| Order by | `created_at desc` (newest first) |
| Read auth | **service-role key** (server-side) — or an authenticated read policy, below |

## ⚠️ The read key is NOT in this repo

Reads bypass the insert-only RLS, so they need the **service-role key**, which is
a full-access secret. It is deliberately *not* committed (this repo is public).
Pull it when wiring the dashboard:

> Supabase dashboard → Project Settings → API → **`service_role` secret**

Store it only as a **server-side env var** in the dashboard app. Never ship it to
a browser.

## Dashboard env vars

```
SUBBIE_SUPABASE_URL=https://bctfwsmwxmhsfhayvwhj.supabase.co
SUBBIE_SUPABASE_SERVICE_KEY=<service_role secret from Settings → API>
```

## Drop-in read client (supabase-js, server-side)

```ts
import { createClient } from "@supabase/supabase-js";

// server-side only — never import this into client/browser code
const subbieDb = createClient(
  process.env.SUBBIE_SUPABASE_URL!,
  process.env.SUBBIE_SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } },
);

export interface SubbieApplication {
  id: string;
  name: string; phone: string; email: string;
  specialty: string[]; experience: string;
  abn: string; insurance: string; whitecard: string;
  postcode: string; availability: string;
  reference: string; work_link: string; notes: string;
  utm_source: string | null; utm_medium: string | null;
  utm_campaign: string | null; utm_content: string | null; utm_term: string | null;
  referrer: string | null; landing_url: string | null;
  submitted_at: string | null; created_at: string;
}

export async function listApplications({ limit = 50, offset = 0 } = {}) {
  const { data, error } = await subbieDb
    .from("subbie_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data as SubbieApplication[];
}
```

## Or hit REST directly

```bash
curl "https://bctfwsmwxmhsfhayvwhj.supabase.co/rest/v1/subbie_applications?select=*&order=created_at.desc&limit=50" \
  -H "apikey: $SUBBIE_SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUBBIE_SUPABASE_SERVICE_KEY"
```

Useful filters (PostgREST): `?insurance=eq.$20M` · `?availability=eq.Available%20now`
· `?created_at=gte.2026-05-01` · `?postcode=like.3*`

## Live updates (optional)

For a dashboard that updates as applications arrive, subscribe to Realtime
instead of polling:

```ts
subbieDb
  .channel("subbie-intake")
  .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "subbie_applications" },
      (payload) => handleNewApplication(payload.new))
  .subscribe();
```

Enable Realtime for the table: Dashboard → Database → Replication → add
`subbie_applications`.

## If the dashboard shares this Supabase project's auth

Instead of the service-role key, you can give a logged-in dashboard role direct
read access with an RLS policy (commented in `schema.sql`):

```sql
create policy "authenticated can read applications"
  on subbie_applications for select
  to authenticated
  using (true);
```

Use service-role for a separate app (simplest); use the read policy if operators
authenticate against this same project.

## Interim alerting (already built, optional)

If you want a ping before the dashboard's connected, the
[`notify-application`](./functions/notify-application/index.ts) Edge Function
sends a Telegram/email alert per application — deploy steps in
[`README.md`](./README.md). Independent of the dashboard read path; use either,
both, or neither.
