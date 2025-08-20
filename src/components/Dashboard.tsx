"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Calendar as CalIcon, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { getUserIdClient } from "@/lib/getUserClient";

type AgreementRow = {
  id: string;
  vendor: string;
  title: string;
  effective_on: string | null;
  end_on: string | null;
  term_months: number | null;
  auto_renews: boolean | null;
  notice_days: number | null;
  renewal_frequency_months: number | null;
};

type Item = {
  id: string;
  vendor: string;
  title: string;
  date: string;      // yyyy-mm-dd
  daysUntil: number; // >= 0
  type: "notice" | "renewal" | "termination";
  auto_renews: boolean;
  notice_days: number;
};

type VendorRow = { name: string; activeContracts: number; nextDeadline: string | null };

// ---------- tiny date utils ----------
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseISO = (s: string) => { const [y,m,d]=s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const addMonths = (dt: Date, n: number) => { const d=new Date(dt); const day=d.getDate(); d.setMonth(d.getMonth()+n); if (d.getDate()!==day){} return d; };
const diffInDays = (future: Date, base: Date) => {
  const A = new Date(future.getFullYear(), future.getMonth(), future.getDate());
  const B = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.round((A.getTime() - B.getTime()) / (24 * 60 * 60 * 1000));
};
// -------------------------------------

const TypeIcon = ({ t }: { t: Item["type"] }) =>
  t === "notice" ? <AlertTriangle className="h-4 w-4 text-purple-600" /> :
  t === "renewal" ? <CheckCircle className="h-4 w-4 text-purple-600" /> :
  <Clock className="h-4 w-4 text-purple-600" />;

const CuteDate = ({ iso }: { iso: string }) => {
  const d = new Date(iso);
  const day = d.getDate();
  const mon = d.toLocaleDateString("en-US", { month: "short" });
  return (
    <div className="w-12 h-12 rounded-lg border border-purple-200 bg-purple-50 flex flex-col items-center justify-center">
      <div className="text-sm font-semibold text-purple-700 leading-4">{day}</div>
      <div className="text-[10px] uppercase text-purple-500">{mon}</div>
    </div>
  );
};

export function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const userId = await getUserIdClient();
        if (!userId) throw new Error("Not signed in");

        const res = await fetch("/api/agreements", { headers: { "x-user-id": userId }, cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load");

        const agreements: AgreementRow[] = json.agreements || [];
        const today = new Date();
        const out: Item[] = [];

        // Build agenda items from agreements
        for (const a of agreements) {
          if (!a.end_on) continue;
          const end = parseISO(a.end_on);
          const auto = !!a.auto_renews;
          const freq = a.renewal_frequency_months && a.renewal_frequency_months > 0 ? a.renewal_frequency_months : 12;
          const notice = a.notice_days ?? 0;

          if (auto) {
            // next renewal >= today
            let next = new Date(end);
            let guard = 0;
            while (next < today && guard < 120) { next = addMonths(next, freq); guard++; }
            const d = diffInDays(next, today);
            if (d >= 0) {
              out.push({
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
                  out.push({
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
              out.push({
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
        }

        out.sort((a,b)=>a.daysUntil-b.daysUntil || (a.date<b.date?-1:1));
        setItems(out);

        // Vendors summary (bottom grid)
        const vMap = new Map<string, VendorRow>();
        out.forEach(it => {
          const curr = vMap.get(it.vendor) || { name: it.vendor, activeContracts: 0, nextDeadline: null };
          curr.activeContracts += 1;
          if (!curr.nextDeadline || it.date < curr.nextDeadline) curr.nextDeadline = it.date;
          vMap.set(it.vendor, curr);
        });
        setVendors(Array.from(vMap.values()).sort((a,b)=>a.name.localeCompare(b.name)));
      } catch (e:any) {
        setErr(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Groups
  const today = useMemo(()=>items.filter(i=>i.daysUntil===0),[items]);
  const out30 = useMemo(()=>items.filter(i=>i.daysUntil>0 && i.daysUntil<=30),[items]);
  const out60 = useMemo(()=>items.filter(i=>i.daysUntil>30 && i.daysUntil<=60),[items]);
  const out90 = useMemo(()=>items.filter(i=>i.daysUntil>60),[items]);

  // Client-side ICS export (12-month horizon)
  async function exportICS() {
    const horizonMonths = 12;
    const today = new Date();
    const horizon = new Date(today); horizon.setMonth(horizon.getMonth()+horizonMonths);

    // fetch agreements again quickly (ensures ICS includes everything)
    const userId = await getUserIdClient();
    const res = await fetch("/api/agreements", { headers: { "x-user-id": userId! }, cache: "no-store" });
    const json = await res.json();
    if (!res.ok) { alert(json?.error || "Failed to generate calendar"); return; }
    const agreements: AgreementRow[] = json.agreements || [];

    type E = { uid: string; summary: string; dt: Date; desc?: string };
    const evts: E[] = [];

    for (const a of agreements) {
      if (!a.end_on) continue;
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
              if (n >= today) evts.push({ uid:`${a.id}-notice-${toISO(n)}`, summary:`Notice deadline — ${a.vendor} (${a.title})`, dt:n, desc:`${notice}-day notice` });
            }
          }
          next = addMonths(next, freq); guard++;
        }
      } else if (end >= today && end <= horizon) {
        evts.push({ uid:`${a.id}-term-${toISO(end)}`, summary:`Term end — ${a.vendor} (${a.title})`, dt:end });
      }
    }

    const toICSDate = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    const lines: string[] = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//ContractHub//Renewals//EN"];
    evts.forEach(e=>{
      const s = toICSDate(e.dt);
      const eod = toICSDate(new Date(e.dt.getFullYear(), e.dt.getMonth(), e.dt.getDate()+1)); // all-day
      lines.push(
        "BEGIN:VEVENT",
        `UID:${e.uid}`,
        `SUMMARY:${e.summary}`,
        `DTSTART;VALUE=DATE:${s}`,
        `DTEND;VALUE=DATE:${eod}`,
        `DESCRIPTION:${(e.desc||"").replace(/\n/g," ")}`,
        "END:VEVENT"
      );
    });
    lines.push("END:VCALENDAR");

    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "renewals.ics";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  const Section = ({ title, rows }: { title: string; rows: Item[] }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-500">{rows.length} items</span>
      </div>
      <div className="rounded-xl border border-purple-100 bg-white">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No items</div>
        ) : rows.map(r => (
          <div key={r.id} className="flex items-center justify-between p-3 sm:p-4 border-b last:border-0 border-purple-50 hover:bg-purple-50/40 transition-colors">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <CuteDate iso={r.date} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <TypeIcon t={r.type} />
                  <span className="truncate font-medium text-gray-900">{r.vendor}</span>
                  <span className="truncate text-gray-500">• {r.title}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {r.auto_renews && <Badge className="bg-green-50 text-green-700 border border-green-200">Auto-renew</Badge>}
                  {r.notice_days > 0 && <Badge variant="outline" className="border-purple-300 text-purple-700">Notice {r.notice_days}d</Badge>}
                  <Badge variant="secondary" className="text-gray-600">
                    {r.type === "notice" ? "Notice" : r.type === "renewal" ? "Renewal" : "Term end"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 shrink-0">
              in <span className="font-medium text-purple-700">{r.daysUntil}</span> days
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Renewals</h1>
          <p className="text-sm text-muted-foreground">Upcoming renewals, notices, and term ends</p>
        </div>
        <Button onClick={exportICS} variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50">
          <CalIcon className="mr-2 h-4 w-4" />
          Add to Calendar
        </Button>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}
      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {/* Agenda groups */}
      <div className="space-y-8">
        <Section title="Today" rows={today} />
        <Section title="30 days out" rows={out30} />
        <Section title="60 days out" rows={out60} />
        <Section title="90 days out" rows={out90} />
      </div>

      {/* Vendors at a Glance */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Vendors</h2>
          <span className="text-xs text-gray-500">{vendors.length} vendors</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vendors.map(v => (
            <Card key={v.name} className="p-4 hover:shadow-sm transition-shadow border-purple-100">
              <div className="flex items-start justify-between">
                <div className="font-medium">{v.name}</div>
                <Badge className="bg-purple-50 text-purple-700 border border-purple-200">Contracts {v.activeContracts}</Badge>
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Next deadline: {v.nextDeadline ? new Date(v.nextDeadline).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "—"}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
