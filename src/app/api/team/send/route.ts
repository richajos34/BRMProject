// src/app/api/team/send/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/mailer";

type Scope = "me" | "team";

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

function digestHtml({
  appUrl,
  rows,
  invitedBanner,
}: {
  appUrl: string;
  rows: Array<{
    vendor: string;
    title: string;
    effective_on: string | null;
    end_on: string | null;
    auto_renews: boolean | null;
    notice_days: number | null;
  }>;
  invitedBanner?: { ownerEmail: string } | null;
}) {
  const banner = invitedBanner
    ? `<div style="padding:12px 16px;margin:0 0 12px;border:1px solid #e9d5ff;border-radius:8px;background:#faf5ff;color:#6b21a8;">
         <strong>You're invited!</strong> ${invitedBanner.ownerEmail} invited you to join their ContractHub workspace.
         <a href="${appUrl}" style="color:#7c3aed;text-decoration:underline;margin-left:6px;">Accept invite</a>
       </div>`
    : "";

  const bodyRows =
    rows.length === 0
      ? `<tr><td colspan="6" style="padding:12px;">No agreements yet.</td></tr>`
      : rows
          .sort((a, b) => a.vendor.localeCompare(b.vendor))
          .map((a) => {
            const eff = a.effective_on
              ? new Date(a.effective_on).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "-";
            const end = a.end_on
              ? new Date(a.end_on).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "-";
            return `
              <tr>
                <td style="padding:8px;border-bottom:1px solid #eee;">${a.vendor}</td>
                <td style="padding:8px;border-bottom:1px solid #eee;">${a.title}</td>
                <td style="padding:8px;border-bottom:1px solid #eee;">${eff}</td>
                <td style="padding:8px;border-bottom:1px solid #eee;">${end}</td>
                <td style="padding:8px;border-bottom:1px solid #eee;">${a.auto_renews ? "Yes" : "No"}</td>
                <td style="padding:8px;border-bottom:1px solid #eee;">${a.notice_days ?? 0}</td>
              </tr>
            `;
          })
          .join("");

  return `
  <div style="font-family:system-ui,Segoe UI,Arial;line-height:1.45;">
    ${banner}
    <h2 style="margin:0 0 12px;">ContractHub daily digest</h2>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Vendor</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Title</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Effective</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">End</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Auto-renews</th>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd;">Notice days</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <p style="margin:16px 0 0;">
      <a href="${appUrl}" style="color:#7c3aed;text-decoration:underline">Open ContractHub</a>
    </p>
  </div>`;
}

export async function POST(req: Request) {
  try {
    const sb = supabaseAdmin();
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { scope } = (await req.json()) as { scope: Scope };
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // who is sending
    const { data: meRes, error: meErr } = await sb.auth.admin.getUserById(userId);
    if (meErr || !meRes?.user?.email) {
      return NextResponse.json({ error: "Cannot resolve sender email" }, { status: 400 });
    }
    const ownerEmail = meRes.user.email as string;

    // agreements for digest
    const { data: agreements, error: aErr } = await sb
      .from("agreements")
      .select("vendor,title,effective_on,end_on,auto_renews,notice_days")
      .eq("user_id", userId);

    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

    const todayISO = toISO(new Date());
    const subjectDigest = `ContractHub digest — ${todayISO}`;

    if (scope === "me") {
      const html = digestHtml({ appUrl, rows: agreements ?? [] });
      const res = await sendEmail({ to: ownerEmail, subject: subjectDigest, html });
      return NextResponse.json({ ok: true, sent: [{ to: ownerEmail, id: res?.messageId ?? null }] });
    }

    // scope === "team": include BOTH active and invited (exclude removed)
    const { data: members, error: mErr } = await sb
      .from("team_members")
      .select("email,status")
      .eq("owner_user_id", userId)
      .neq("status", "removed");

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    const everyone = (members ?? []).map((m) => m.email);
    const invitedSet = new Set((members ?? []).filter((m) => m.status === "invited").map((m) => m.email));

    const sends = await Promise.allSettled(
      everyone.map((to) =>
        sendEmail({
          to,
          subject: subjectDigest,
          html: digestHtml({
            appUrl,
            rows: agreements ?? [],
            invitedBanner: invitedSet.has(to) ? { ownerEmail } : null,
          }),
        })
      )
    );

    const results = sends.map((r, i) =>
      r.status === "fulfilled"
        ? { to: everyone[i], ok: true }
        : { to: everyone[i], ok: false, error: (r as PromiseRejectedResult).reason?.message ?? "send failed" }
    );

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error("/api/team/send error:", err);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}