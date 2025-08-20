// app/api/team/send/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { Resend } from "resend";

// simple digest email body (reuse your existing daily digest logic if you want)
async function buildDigestHtml(sb: ReturnType<typeof supabaseAdmin>, ownerUserId: string, today = new Date()) {
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { data: agreements } = await sb
    .from("agreements")
    .select("vendor,title,effective_on,end_on,auto_renews,notice_days")
    .eq("user_id", ownerUserId);

  const rows = (agreements ?? []).map(a => `
    <tr>
      <td style="padding:6px;border-bottom:1px solid #eee;">${a.vendor ?? "-"}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;">${a.title ?? "-"}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;">${a.effective_on ?? "-"}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;">${a.end_on ?? "-"}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;">${a.auto_renews ? "Yes" : "No"}</td>
      <td style="padding:6px;border-bottom:1px solid #eee;">${a.notice_days ?? 0}</td>
    </tr>
  `).join("");

  return {
    subject: `Your daily contract digest — ${toISO(today)}`,
    html: `
      <div style="font-family:system-ui,Segoe UI,Arial">
        <h2 style="margin:0 0 12px;">Your daily contract digest</h2>
        <p style="margin:0 0 12px;">Here’s a summary of agreements.</p>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead><tr>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #ddd;">Vendor</th>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #ddd;">Title</th>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #ddd;">Effective</th>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #ddd;">End</th>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #ddd;">Auto</th>
            <th style="text-align:left;padding:6px;border-bottom:2px solid #ddd;">Notice</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="6" style="padding:8px;">No agreements yet.</td></tr>`}</tbody>
        </table>
      </div>
    `,
  };
}

function buildInviteHtml(inviterEmail: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    subject: "You’re invited to ContractHub",
    html: `
      <div style="font-family:system-ui,Segoe UI,Arial">
        <h2 style="margin:0 0 12px;">You’re invited to ContractHub</h2>
        <p>${inviterEmail} invited you to join their team on ContractHub.</p>
        <p><a href="${appUrl}/signup" style="color:#4f46e5">Create your account</a> to view contract dashboards and reminders.</p>
      </div>
    `
  };
}

export async function POST(req: Request) {
  const ownerUserId = req.headers.get("x-user-id");
  if (!ownerUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { scope } = await req.json().catch(() => ({ scope: "me" } as { scope: "me" | "team" }));

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM ?? "dev@localhost.test";
  const resend = resendKey ? new Resend(resendKey) : null;

  // find owner's email (for invites + "me")
  const { data: ownerRes } = await sb.auth.admin.getUserById(ownerUserId);
  const ownerEmail = (ownerRes?.user?.email ?? "owner@localhost.test") as string;

  const digest = await buildDigestHtml(sb, ownerUserId);

  if (scope === "me") {
    // send to owner only
    let sendError: string | null = null;
    if (resend) {
      const result = await resend.emails.send({ from: fromEmail, to: ownerEmail, subject: digest.subject, html: digest.html });
      if (result.error) sendError = result.error.message ?? "Resend error";
    } else {
      sendError = "RESEND_API_KEY not set (dev mode).";
    }
    const devNotice = sendError ? "In dev/test mode, Resend may restrict recipients; check your verified sender/domain." : null;
    return NextResponse.json({ ok: true, scope: "me", to: ownerEmail, devNotice, sendError });
  }

  // scope === "team"
  const { data: members, error } = await sb
    .from("team_members")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const inviteTpl = buildInviteHtml(ownerEmail);
  const results: Array<{ email: string; type: "digest" | "invite"; ok: boolean; devNotice?: string; error?: string }> = [];

  for (const m of members ?? []) {
    const isActive = m.status === "active"; // you can mark active later when they accept
    const to = m.email;

    // In local dev without a verified domain, Resend will only allow your own address.
    let devNotice: string | undefined;
    let err: string | undefined;
    if (!resend) {
      devNotice = "RESEND_API_KEY not set (dev mode).";
      results.push({ email: to, type: isActive ? "digest" : "invite", ok: true, devNotice });
      continue;
    }

    const payload = isActive
      ? { from: fromEmail, to, subject: digest.subject, html: digest.html }
      : { from: fromEmail, to, subject: inviteTpl.subject, html: inviteTpl.html };

    const r = await resend.emails.send(payload as any);
    if (r.error) {
      err = r.error.message ?? "Resend error";
      devNotice = "Resend may restrict non-verified recipients in test mode. Use your own email or verify a domain.";
    }

    results.push({ email: to, type: isActive ? "digest" : "invite", ok: !err, devNotice, error: err });
  }

  return NextResponse.json({ ok: true, scope: "team", results });
}
