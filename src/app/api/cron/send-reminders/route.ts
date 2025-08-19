// src/app/api/cron/send-reminders/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { Resend } from "resend";

// ---- tiny date helpers ----
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const parseISO = (s: string | null) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const addMonths = (dt: Date, months: number) => {
  const d = new Date(dt.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // allow JS auto-adjust
  if (d.getDate() !== day) { /* ignore */ }
  return d;
};

const diffInDays = (future: Date | null, base: Date) => {
  if (!future) return null;
  const MS = 24 * 60 * 60 * 1000;
  const a = new Date(future.getFullYear(), future.getMonth(), future.getDate());
  const b = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.round((a.getTime() - b.getTime()) / MS);
};

type AgreementRow = {
  id: string;
  user_id: string | null;
  vendor: string;
  title: string;
  effective_on: string | null;
  end_on: string | null;
  auto_renews: boolean | null;
  notice_days: number | null;
  renewal_frequency_months: number | null;
};

export const runtime = "nodejs";
export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }

async function handler(req: Request) {
  // Simple auth: shared secret header
  const secretHeader = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secretHeader !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Optional: ?dryRun=1 to preview without sending
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const asOf = url.searchParams.get("date");
  const today = asOf ? new Date(asOf) : new Date();

  // 1) Pull ALL agreements that are assigned to a user
  const { data: agreements, error: aErr } = await sb
    .from("agreements")
    .select("id,user_id,vendor,title,effective_on,end_on,auto_renews,notice_days,renewal_frequency_months")
    .not("user_id", "is", null);

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  // Group by user
  const byUser = (agreements ?? []).reduce<Record<string, AgreementRow[]>>((acc, a) => {
    if (!a.user_id) return acc;
    (acc[a.user_id] ||= []).push(a);
    return acc;
  }, {});

  // Nothing to do
  if (Object.keys(byUser).length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No agreements found" });
  }

  const resend = resendKey ? new Resend(resendKey) : null;
  const results: Array<{ user_id: string; to?: string; sent: number }> = [];

  // For each user with agreements, send one daily digest email
  for (const [user_id, rows] of Object.entries(byUser)) {
    // Look up user email (service role key can use Admin API)
    const { data: ures, error: uerr } = await sb.auth.admin.getUserById(user_id);
    if (uerr || !ures?.user?.email) {
      results.push({ user_id, to: undefined, sent: 0 });
      continue;
    }
    const to = ures.user.email as string;

    // Build HTML table of agreements
    const htmlRows = rows
      .sort((a, b) => (a.vendor.localeCompare(b.vendor)))
      .map((a) => {
        const effective = a.effective_on ? new Date(a.effective_on).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";
        const end = a.end_on ? new Date(a.end_on).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";

        // Optional: compute next renewal date (if auto_renews && end_on)
        let nextRenewalStr = "-";
        let daysUntilStr = "-";
        if (a.auto_renews && a.end_on) {
          const freq = a.renewal_frequency_months && a.renewal_frequency_months > 0 ? a.renewal_frequency_months : 12;
          let next = parseISO(a.end_on)!;
          let guard = 0;
          while (next < today && guard < 120) {
            next = addMonths(next, freq);
            guard++;
          }
          nextRenewalStr = toISO(next);
          const days = diffInDays(next, today);
          if (typeof days === "number") daysUntilStr = `${days}d`;
        }

        return `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${a.vendor}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${a.title}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${effective}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${end}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${a.auto_renews ? "Yes" : "No"}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${a.notice_days ?? 0}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${nextRenewalStr}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${daysUntilStr}</td>
          </tr>
        `;
      })
      .join("");

    const subject = `Your daily contract digest — ${toISO(today)}`;
    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial; line-height:1.45;">
        <h2 style="margin:0 0 12px;">Your daily contract digest</h2>
        <p style="margin:0 0 16px;">Here’s a summary of all agreements on your account.</p>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; font-size:14px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Vendor</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Title</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Effective</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">End</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Auto-renews</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Notice days</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Next renewal</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">In</th>
            </tr>
          </thead>
          <tbody>
            ${htmlRows || `<tr><td colspan="8" style="padding:12px;">No agreements yet.</td></tr>`}
          </tbody>
        </table>

        <p style="margin:16px 0 0;">
          <a href="${appUrl}" style="color:#4f46e5;text-decoration:underline">Open ContractHub</a>
        </p>
      </div>
    `;

    const from = process.env.EMAIL_FROM || "ContractHub <onboarding@resend.dev>";
    if (!dryRun && resendKey) {
        const resend = new Resend(resendKey);   // <- typed as Resend (not nullable)
        try {
          const sendResult = await resend.emails.send({
            from,
            to : "richajos24@gmail.com",
            subject,
            html,
          });
          console.log("[resend] sendResult:", sendResult);
        } catch (err) {
          console.error("[resend] send error:", err);
        }
      } else {
        console.log("[resend] skipping send (dryRun or no RESEND_API_KEY)");
      }
      

      try {
        const payload = rows.map(a => ({
          user_id,
          agreement_id: a.id,          // per-agreement logging
          event_kind: "DAILY_DIGEST",  // make sure your CHECK allows this value
          occurs_on: toISO(today),     // the run date (yyyy-mm-dd)
          offset_days: 0               // allowed by your CHECK (0,30,60,90)
        }));
      
        const { data: insRows, error: insErr } = await sb
          .from("email_reminders_sent")
          .upsert(payload, {
            onConflict: "user_id,agreement_id,event_kind,occurs_on",
            ignoreDuplicates: true, // safe no-op if the row already exists
          })
          .select("*");
      
        if (insErr) {
          console.error("[cron] insert email_reminders_sent error:", insErr.message);
        } else {
          console.log("[cron] logged digest rows:", insRows?.length ?? 0);
        }
      } catch (e: any) {
        console.error("[cron] insert catch:", e?.message || e);
      }

    results.push({ user_id, to, sent: 1 });
  }

  return NextResponse.json({ ok: true, dryRun, date: toISO(today), results });
}
