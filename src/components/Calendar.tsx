"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserIdClient } from "@/lib/getUserClient";
import { AgreementDrawer } from "@/components/AgreementDrawer";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "./ui/table";

type EventType = "notice" | "renewal" | "termination";

interface CalendarEvent {
  id: string;
  title: string;
  vendor: string;
  date: string;
  type: EventType;
  description?: string;
  agreementId: string;
}

interface AgreementRow {
  id: string;
  vendor: string;
  title: string;
  effective_on: string | null;
  end_on: string | null;
  term_months: number | null;
  auto_renews: boolean | null;
  notice_days: number | null;
  explicit_opt_out_on: string | null;
  renewal_frequency_months: number | null;
  source_file_name: string;
  source_file_path: string;
  model_name: string | null;
  parse_status: string;
  created_at: string;
  updated_at: string;
}

const G_BLUE =
  "bg-[#e8f0fe] text-[#1967d2] border border-[#d2e3fc]";
const G_ORANGE = "bg-[#fef3e2] text-[#c35900] border border-[#fde1bd]";
const G_GRAY = "bg-gray-100 text-gray-700 border border-gray-200";

const getEventClasses = (type: EventType) => {
  switch (type) {
    case "renewal":
      return { chip: G_BLUE, bar: "bg-[#1a73e8]" };
    case "notice":
      return { chip: G_ORANGE, bar: "bg-[#f29900]" };
    default:
      return { chip: G_GRAY, bar: "bg-gray-400" };
  }
};

// date helpers
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const addMonths = (dt: Date, months: number) => {
  const d = new Date(dt.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) { /* JS auto adjust ok */ }
  return d;
};

const addDays = (dt: Date, days: number) => {
  const d = new Date(dt.getTime());
  d.setDate(d.getDate() + days);
  return d;
};

function generateEventsFromAgreement(
  a: AgreementRow,
  windowStart: Date,
  windowEnd: Date,
  cap: number = 36
): CalendarEvent[] {
  const evts: CalendarEvent[] = [];
  if (!a.end_on) return evts;

  const vendor = a.vendor;
  const title = a.title;
  const endDate = parseISO(a.end_on);

  if (endDate >= windowStart && endDate <= windowEnd) {
    evts.push({
      id: `${a.id}-term-${a.end_on}`,
      title: "Term End",
      vendor,
      date: a.end_on,
      type: "termination",
      description: "End of current term",
      agreementId: a.id,
    });
  }

  const auto = !!a.auto_renews;
  const freq =
    a.renewal_frequency_months && a.renewal_frequency_months > 0
      ? a.renewal_frequency_months
      : 12;
  const noticeDays = a.notice_days ?? 0;

  if (!auto) return evts;

  let renewal = new Date(endDate);
  let guard = 0;
  while (renewal < windowStart && guard < cap) {
    renewal = addMonths(renewal, freq);
    guard++;
  }

  while (renewal <= windowEnd && guard < cap) {
    const renewalISO = toISO(renewal);

    evts.push({
      id: `${a.id}-renewal-${renewalISO}`,
      title: "Contract Renewal",
      vendor,
      date: renewalISO,
      type: "renewal",
      description: `${title} auto-renews`,
      agreementId: a.id,
    });

    if (noticeDays > 0) {
      const noticeDate = addDays(renewal, -noticeDays);
      const noticeISO = toISO(noticeDate);
      if (noticeDate >= windowStart && noticeDate <= windowEnd) {
        evts.push({
          id: `${a.id}-notice-${noticeISO}-${renewalISO}`,
          title: "Notice Deadline",
          vendor,
          date: noticeISO,
          type: "notice",
          description: `${noticeDays} day notice before ${renewalISO}`,
          agreementId: a.id,
        });
      }
    }

    renewal = addMonths(renewal, freq);
    guard++;
  }

  return evts;
}

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const windowStart = useMemo(
    () => addMonths(new Date(year, month, 1), -6),
    [year, month]
  );
  const windowEnd = useMemo(
    () => addMonths(new Date(year, month + 1, 0), 6),
    [year, month]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const userId = await getUserIdClient();
        if (!userId) throw new Error("Not signed in");

        const res = await fetch("/api/agreements", {
          cache: "no-store",
          headers: { "x-user-id": userId },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load agreements");
        const agreements: AgreementRow[] = json.agreements || [];

        const all: CalendarEvent[] = [];
        for (const a of agreements) {
          const evts = generateEventsFromAgreement(a, windowStart, windowEnd);
          all.push(...evts);
        }

        all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        if (!cancelled) setEvents(all);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [windowStart, windowEnd]);

  const days: Array<number | null> = [];
  for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  const goPrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const goNext = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const dateKey = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const getEventsForDate = (d: number) =>
    events.filter((e) => e.date === dateKey(d));

  const today = new Date();
  const isToday = (d: number) =>
    today.getDate() === d &&
    today.getMonth() === month &&
    today.getFullYear() === year;

  const monthStartISO = toISO(new Date(year, month, 1));
  const monthEndISO = toISO(new Date(year, month + 1, 0));
  const monthEvents = useMemo(
    () => events.filter((e) => e.date >= monthStartISO && e.date <= monthEndISO),
    [events, monthStartISO, monthEndISO]
  );

  const EventPill = ({ e }: { e: CalendarEvent }) => {
    const cls = getEventClasses(e.type);
    return (
      <button
        onClick={() => { setSelectedEvent(e); setIsDrawerOpen(true); }}
        className={cn(
          "group relative w-full text-left rounded-md text-xs px-2 py-1 flex items-center gap-2",
          "transition-all",
          cls.chip,
          "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1a73e8]"
        )}
        title={e.description}
      >
        <span className={cn("h-3 w-0.5 rounded-sm", cls.bar)} />
        <span className="truncate">
          {e.type === "notice" ? "Notice — " : e.type === "renewal" ? "Renewal — " : "Term — "}
          {e.vendor}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={goToday}
            className="rounded-full border-gray-300">
            <CalendarIcon size={16} className="mr-2" />
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={goPrev}
              className="rounded-full hover:bg-gray-100">
              <ChevronLeft size={18} />
            </Button>
            <Button variant="ghost" size="icon" onClick={goNext}
              className="rounded-full hover:bg-gray-100">
              <ChevronRight size={18} />
            </Button>
          </div>
          <h1 className="text-xl font-semibold">
            {monthNames[month]} {year}
          </h1>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 text-xs font-medium text-gray-500 bg-white sticky top-0 z-10 border-b">
            {["SUN","MON","TUE","WED","THU","FRI","SAT"].map((d) => (
              <div key={d} className="px-3 py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {days.map((day, idx) => (
              <div
                key={idx}
                className="min-h-[132px] bg-white"
              >
                {day && (
                  <div className="h-full w-full p-2">
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "h-7 w-7 flex items-center justify-center rounded-full text-sm",
                          isToday(day)
                            ? "bg-[#1a73e8] text-white font-medium"
                            : "text-gray-700"
                        )}
                      >
                        {day}
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {getEventsForDate(day).slice(0, 3).map((e) => (
                        <EventPill key={e.id} e={e} />
                      ))}
                      {getEventsForDate(day).length > 3 && (
                        <div className="text-[11px] text-[#1967d2] font-medium px-1">
                          +{getEventsForDate(day).length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#1a73e8]" />
          <span>Renewal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#f29900]" />
          <span>Notice deadline</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-gray-500" />
          <span>Term end</span>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No events this month.
                  </TableCell>
                </TableRow>
              )}
              {monthEvents.map((e) => {
                const { chip } = getEventClasses(e.type);
                return (
                  <TableRow key={e.id} className="hover:bg-gray-50">
                    <TableCell>{e.date}</TableCell>
                    <TableCell>
                      <Badge className={chip}>
                        {e.type === "notice" ? "Notice" : e.type === "renewal" ? "Renewal" : "Term End"}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.vendor}</TableCell>
                    <TableCell>{e.title}</TableCell>
                    <TableCell className="text-muted-foreground">{e.description}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AgreementDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        event={selectedEvent}
      />
    </div>
  );
}
