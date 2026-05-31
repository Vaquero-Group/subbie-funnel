// ─────────────────────────────────────────────────────────────────────────
//  notify-application — Supabase Edge Function
//
//  Fires on every new row in `subbie_applications` and pings the GM so no
//  application lands silently. Telegram is primary (matches the COWBOY stack);
//  email via Resend is an optional second channel. Both are opt-in by secret —
//  if a channel's secrets aren't set, it's skipped, no error.
//
//  Wiring (one-time, see /supabase/README.md for the full walkthrough):
//    1. supabase functions deploy notify-application --no-verify-jwt
//    2. supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...
//    3. Dashboard → Database → Webhooks → create a webhook on
//       `subbie_applications` INSERT → call this function.
// ─────────────────────────────────────────────────────────────────────────

interface ApplicationRow {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  specialty?: string[];
  experience?: string;
  abn?: string;
  insurance?: string;
  whitecard?: string;
  postcode?: string;
  availability?: string;
  reference?: string;
  work_link?: string;
  notes?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  submitted_at?: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: ApplicationRow | null;
  old_record: ApplicationRow | null;
}

const env = (k: string): string | undefined => Deno.env.get(k);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function line(label: string, value?: string | string[] | null): string {
  if (!value || (Array.isArray(value) && value.length === 0)) return "";
  const v = Array.isArray(value) ? value.join(", ") : value;
  return `<b>${label}:</b> ${escapeHtml(v)}\n`;
}

function formatMessage(r: ApplicationRow): string {
  const source = [r.utm_source, r.utm_campaign, r.utm_content]
    .filter(Boolean)
    .join(" / ");
  return (
    `🟡 <b>New subbie application</b>\n\n` +
    line("Name", r.name) +
    line("Phone", r.phone) +
    line("Email", r.email) +
    line("Specialty", r.specialty) +
    line("Experience", r.experience) +
    line("ABN", r.abn) +
    line("PL cover", r.insurance) +
    line("White card", r.whitecard) +
    line("Area", r.postcode) +
    line("Availability", r.availability) +
    line("Reference", r.reference) +
    line("Work", r.work_link) +
    line("Notes", r.notes) +
    (source ? line("Source", source) : "")
  ).trim();
}

async function sendTelegram(text: string): Promise<string> {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = env("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return "telegram: skipped (no secrets)";
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  return `telegram: ${res.status}`;
}

async function sendEmail(r: ApplicationRow): Promise<string> {
  const key = env("RESEND_API_KEY");
  const to = env("NOTIFY_EMAIL");
  if (!key || !to) return "email: skipped (no secrets)";
  const from = env("NOTIFY_FROM") ?? "Vaquero Intake <onboarding@resend.dev>";
  const rows = Object.entries({
    Name: r.name,
    Phone: r.phone,
    Email: r.email,
    Specialty: r.specialty?.join(", "),
    Experience: r.experience,
    ABN: r.abn,
    "PL cover": r.insurance,
    "White card": r.whitecard,
    Area: r.postcode,
    Availability: r.availability,
    Reference: r.reference,
    Work: r.work_link,
    Notes: r.notes,
  })
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#888">${k}</td><td>${escapeHtml(String(v))}</td></tr>`)
    .join("");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `New subbie application — ${r.name ?? "unknown"}`,
      html: `<h2>New subbie application</h2><table style="font:14px/1.5 sans-serif">${rows}</table>`,
    }),
  });
  return `email: ${res.status}`;
}

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    const record = payload?.record;
    if (!record) {
      return new Response(JSON.stringify({ ok: false, reason: "no record" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const msg = formatMessage(record);
    const results = await Promise.allSettled([sendTelegram(msg), sendEmail(record)]);
    const summary = results.map((x) => (x.status === "fulfilled" ? x.value : `error: ${x.reason}`));
    return new Response(JSON.stringify({ ok: true, channels: summary }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Never 500 back to the webhook — log and acknowledge so Supabase doesn't retry-storm.
    console.error("notify-application error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
