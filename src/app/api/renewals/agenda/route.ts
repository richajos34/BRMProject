import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parseISO = (s: string) => { const [y,m,d]=s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const addMonths = (dt: Date, n: number) => { const d=new Date(dt); const day=d.getDate(); d.setMonth(d.getMonth()+n); if (d.getDate()!==day){} return d; };
const diffInDays = (future: Date, base: Date) => {
  const A = new Date(future.getFullYear(), future.getMonth(), future.getDate());
  const B = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.round((A.getTime() - B.getTime()) / (24*60*60*1000));
};

type Agreement = {
  id: string;
  user_id: string | null;
  vendor: string;
  title: string;
  end_on: string | null;
  auto_renews: boolean | null;
  notice_days: number | null;
  renewal_frequency_months: number | null;
};

type AgendaItem = {
  id: string;
  vendor: string;
  title: string;
  date: string;      // yyyy-mm-dd
  daysUntil: number; // >=0
  type: "notice" | "renewal" | "termination";
  auto_renews: boolean;
  notice_days: number;
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
  const items: AgendaItem[] = [];

  (data as Agreement[]).forEach(a => {
    if (!a.end_on) return;
    const end = parseISO(a.end_on);
    const auto = !!a.auto_renews;
    const freq = a.renewal_frequency_months && a.renewal_frequency_months > 0 ? a.renewal_frequency_months : 12;
    const notice = a.notice_days ?? 0;

    if (auto) {
      let next = new Date(end);
      let guard = 0;
      while (next < today && guard < 120) { next = addMonths(next, freq); guard++; }

      const d = diffInDays(next, today);
      if (d >= 0) {
        items.push({
          id: `${a.id}-renewal-${toISO(next)}`,
          vendor: a.vendor,
          title: a.title,
          date: toISO(next),
          daysUntil: d,
          type: "renewal",
          auto_renews: true,
          notice_days: notice,
        });
        if (notice > 0) {
          const n = new Date(next); n.setDate(n.getDate() - notice);
          const nd = diffInDays(n, today);
          if (nd >= 0) {
            items.push({
              id: `${a.id}-notice-${toISO(n)}`,
              vendor: a.vendor,
              title: a.title,
              date: toISO(n),
              daysUntil: nd,
              type: "notice",
              auto_renews: true,
              notice_days: notice,
            });
          }
        }
      }
    } else {
      const d = diffInDays(end, today);
      if (d >= 0) {
        items.push({
          id: `${a.id}-term-${toISO(end)}`,
          vendor: a.vendor,
          title: a.title,
          date: toISO(end),
          daysUntil: d,
          type: "termination",
          auto_renews: false,
          notice_days: notice,
        });
      }
    }
  });

  // vendor summary for lower section
  const vendorsMap = new Map<string, { name: string; activeContracts: number; nextDeadline: string | null }>();
  items.forEach(it => {
    const curr = vendorsMap.get(it.vendor) || { name: it.vendor, activeContracts: 0, nextDeadline: null };
    curr.activeContracts += 1;
    if (!curr.nextDeadline || it.date < curr.nextDeadline) curr.nextDeadline = it.date;
    vendorsMap.set(it.vendor, curr);
  });

  return NextResponse.json({
    items: items.sort((a,b) => a.daysUntil - b.daysUntil || (a.date < b.date ? -1 : 1)),
    vendors: Array.from(vendorsMap.values()).sort((a,b)=>a.name.localeCompare(b.name)),
  });
}
