import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const toICSDate = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
const parseISO = (s: string) => { const [y,m,d]=s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const addMonths = (dt: Date, n: number) => { const d=new Date(dt); const day=d.getDate(); d.setMonth(d.getMonth()+n); if (d.getDate()!==day){} return d; };

type Agreement = {
  id: string; user_id: string | null; vendor: string; title: string;
  end_on: string | null; auto_renews: boolean | null; notice_days: number | null;
  renewal_frequency_months: number | null;
};

export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Missing x-user-id" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("agreements")
    .select("id,user_id,vendor,title,end_on,auto_renews,notice_days,renewal_frequency_months")
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = new Date();
  const horizon = new Date(today); horizon.setMonth(horizon.getMonth()+12);

  type E = { uid: string; summary: string; dt: Date; desc?: string };
  const evts: E[] = [];

  (data as Agreement[]).forEach(a => {
    if (!a.end_on) return;
    const end = parseISO(a.end_on);
    const auto = !!a.auto_renews;
    const freq = a.renewal_frequency_months && a.renewal_frequency_months > 0 ? a.renewal_frequency_months : 12;
    const notice = a.notice_days ?? 0;

    if (auto) {
      let next = new Date(end);
      let guard = 0;
      while (next <= horizon && guard < 24) {
        if (next >= today) {
          evts.push({ uid:`${a.id}-renewal-${toISO(next)}`, summary:`Renewal — ${a.vendor} (${a.title})`, dt:new Date(next), desc:"Auto-renewal" });
          if (notice > 0) {
            const n = new Date(next); n.setDate(n.getDate()-notice);
            if (n >= today)
              evts.push({ uid:`${a.id}-notice-${toISO(n)}`, summary:`Notice deadline — ${a.vendor} (${a.title})`, dt:n, desc:`${notice}-day notice` });
          }
        }
        next = addMonths(next, freq); guard++;
      }
    } else if (end >= today && end <= horizon) {
      evts.push({ uid:`${a.id}-term-${toISO(end)}`, summary:`Term end — ${a.vendor} (${a.title})`, dt:end });
    }
  });

  const lines: string[] = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//ContractHub//Renewals//EN"];
  evts.forEach(e => {
    const s = toICSDate(e.dt);
    const eod = toICSDate(new Date(e.dt.getFullYear(), e.dt.getMonth(), e.dt.getDate()+1)); // all-day
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `SUMMARY:${e.summary}`,
      `DTSTART;VALUE=DATE:${s}`,
      `DTEND;VALUE=DATE:${eod}`,
      `DESCRIPTION:${(e.desc||"").replace(/\n/g," ")}`,
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="renewals.ics"',
    },
  });
}
