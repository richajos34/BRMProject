import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/mailer";

export const runtime = "nodejs";

/**
 * Agreement row structure returned from the "agreements" table.
 */
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

/**
 * Convert a Date object into an ISO yyyy-mm-dd string.
 * @param d - Date to convert.
 * @returns Formatted date string.
 */
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

/**
 * Parse a yyyy-mm-dd string into a Date.
 * @param s - Date string or null.
 * @returns Date object or null if invalid.
 */
const parseISO = (s: string | null) => {
  if (!s) return null;
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, (m||1)-1, d||1);
};
const d0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const addMonths = (dt: Date, months: number) => { 
    const d=new Date(dt); const day=d.getDate(); 
    d.setMonth(d.getMonth()+months); 
    if(d.getDate()!==day){} return d; 
};

const addDays = (dt: Date, days: number) => { 
    const d=new Date(dt); 
    d.setDate(d.getDate()+days); 
    return d; 
};
const diffInDays = (a: Date, b: Date) => Math.round((d0(a).getTime()-d0(b).getTime())/(24*60*60*1000));

/**
 * Compute upcoming contract-related events (renewal, notice deadline, term end).
 * @param a - Agreement row.
 * @param today - Date reference point.
 * @returns Array of event objects with kind, date, and label.
 */
function nextEvents(a: AgreementRow, today: Date) {
  const events: Array<{ kind: "RENEWAL"|"NOTICE_DEADLINE"|"TERM_END"; date: Date; label: string }> = [];
  const end = parseISO(a.end_on);

  if (end && end >= today) {
    events.push({ kind: "TERM_END", date: end, label: "Term End" });
  }
  if (a.auto_renews && end) {
    const freq = a.renewal_frequency_months && a.renewal_frequency_months > 0 ? a.renewal_frequency_months : 12;
    let renewal = new Date(end.getTime());
    let guard=0;
    while (renewal < today && guard < 120) { renewal = addMonths(renewal, freq); guard++; }
    events.push({ kind: "RENEWAL", date: renewal, label: "Auto-Renewal" });

    if (typeof a.notice_days === "number" && a.notice_days > 0) {
      const nd = addDays(renewal, -a.notice_days);
      if (nd >= today) events.push({ kind: "NOTICE_DEADLINE", date: nd, label: "Notice Deadline" });
    }
  }
  return events.filter(e => e.date >= today);
}

/**
 * Build HTML markup for reminder emails.
 * @param userEmail - Email of recipient.
 * @param items - List of reminder items (vendor, title, kind, date, inDays).
 * @returns HTML string for email body.
 */
function buildRemindersHTML(userEmail: string, items: Array<{vendor:string; title:string; kind:string; on:string; inDays:number;}>) {
  const rows = items.map(i => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${i.vendor}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${i.title}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${i.kind}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${i.on}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${i.inDays} days</td>
    </tr>`).join("");
  return `
    <div style="font-family:system-ui,Segoe UI,Arial;line-height:1.5;">
      <h2 style="margin:0 0 12px;">30/60/90 Day Contract Reminders</h2>
      <p style="margin:0 0 16px;">The following events are exactly 30, 60, or 90 days out:</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Vendor</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Agreement</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Event</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Date</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">In</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="5" style="padding:12px;">No matches today.</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

/**
 * Handle GET request for sending reminders.
 * @param req - HTTP request object.
 * @returns JSON response.
 */
export async function GET(req: Request) {
    return handler(req); 
}

/**
 * Handle POST request for sending reminders.
 * @param req - HTTP request object.
 * @returns JSON response.
 */
export async function POST(req: Request) {
    return handler(req);
}

/**
 * Core handler to process reminder cron job.
 *
 * @param req - HTTP request object.
 * @returns JSON response containing results of reminders sent.
 */
async function handler(req: Request) {
  const secretHeader = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secretHeader !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const asOf = url.searchParams.get("date"); // yyyy-mm-dd (optional)
  const today = asOf ? d0(parseISO(asOf)!) : d0(new Date());
  const sb = supabaseAdmin();

  const { data: agreements, error } = await sb
    .from("agreements")
    .select("id,user_id,vendor,title,effective_on,end_on,auto_renews,notice_days,renewal_frequency_months")
    .not("user_id","is",null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  //Computes event windows & Groups by user and sends reminder emails
  const perUser: Record<string, Array<{ vendor:string; title:string; kind:string; on:string; inDays:number }>> = {};
  for (const a of (agreements ?? [])) {
    if (!a.user_id) continue;
    const events = nextEvents(a, today);
    for (const ev of events) {
      const d = diffInDays(ev.date, today);
      if (d === 30 || d === 60 || d === 90) {
        (perUser[a.user_id] ||= []).push({
          vendor: a.vendor, title: a.title, kind: ev.label, on: toISO(ev.date), inDays: d,
        });
      }
    }
  }

  const results: Array<{ user_id:string; to?:string; sent:boolean }> = [];
  for (const [user_id, items] of Object.entries(perUser)) {
    if (!items.length) { results.push({ user_id, to: undefined, sent: false }); continue; }

    const { data: ures, error: uerr } = await sb.auth.admin.getUserById(user_id);
    const to = ures?.user?.email;
    if (uerr || !to) { results.push({ user_id, to, sent: false }); continue; }

    const html = buildRemindersHTML(to, items.sort((a,b)=>a.inDays-b.inDays));
    if (!dryRun) await sendEmail({ to, subject: "Contract reminders (30/60/90 days)", html });
    results.push({ user_id, to, sent: !dryRun });
  }

  return NextResponse.json({ ok: true, dryRun, usersEmailed: results.length, results });
}