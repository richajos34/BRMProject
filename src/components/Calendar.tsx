"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserIdClient } from "@/lib/getUserClient"; // <-- add this
import { AgreementDrawer } from "@/components/AgreementDrawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type EventType = "notice" | "renewal" | "termination";

interface CalendarEvent {
  id: string;
  title: string;
  vendor: string;
  date: string; // yyyy-mm-dd
  type: EventType;
  description?: string;
  agreementId: string;
}

interface AgreementRow {
  id: string;
  vendor: string;
  title: string;
  effective_on: string | null; // yyyy-mm-dd
  end_on: string | null;       // yyyy-mm-dd
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

const getEventColor = (type: EventType) => {
  switch (type) {
    case "notice":
      return "bg-red-100 text-red-800 border-red-200";
    case "renewal":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "termination":
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

// --- date helpers (no external deps) ---
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  // Note: months are 0-based in JS Date
  return new Date(y, (m || 1) - 1, d || 1);
};

const addMonths = (dt: Date, months: number) => {
  const d = new Date(dt.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // If month rollover happened (e.g., Jan 31 -> Mar 3), keep JS behavior.
  // For our use case (end dates/renewals), this is acceptable.
  if (d.getDate() !== day) {
    // nothing special; JS auto-adjusts
  }
  return d;
};

const addDays = (dt: Date, days: number) => {
  const d = new Date(dt.getTime());
  d.setDate(d.getDate() + days);
  return d;
};

// Generate recurring renewal dates within a window, starting from end_on.
function generateEventsFromAgreement(
  a: AgreementRow,
  windowStart: Date,
  windowEnd: Date,
  cap: number = 36 // safety cap
): CalendarEvent[] {
  const evts: CalendarEvent[] = [];
  if (!a.end_on) return evts;

  const vendor = a.vendor;
  const title = a.title;
  const endDate = parseISO(a.end_on);

  // Always include the original term end (aka termination)
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
  const freq = a.renewal_frequency_months && a.renewal_frequency_months > 0 ? a.renewal_frequency_months : 12;
  const noticeDays = a.notice_days ?? 0;

  if (!auto) return evts;

  // Find the first renewal date >= windowStart
  let renewal = new Date(endDate.getTime());
  let guard = 0;
  while (renewal < windowStart && guard < cap) {
    renewal = addMonths(renewal, freq);
    guard++;
  }

  // Push renewals + notice deadlines within the window
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

  // Compute the visible month window
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // For fetching & generating events, use a broader window so prev/next month
  // buttons don't immediately re-fetch. Here: current month +/- 6 months.
  const windowStart = useMemo(() => addMonths(new Date(year, month, 1), -6), [year, month]);
  const windowEnd = useMemo(() => addMonths(new Date(year, month + 1, 0), 6), [year, month]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {

        const userId = await getUserIdClient();
        console.log("Loading agreements for user:", userId);
        if (!userId) throw new Error("Not signed in");

        const res = await fetch("/api/agreements", {
          cache: "no-store",
          headers: { "x-user-id": userId },
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "Failed to load agreements");
        }
        const agreements: AgreementRow[] = json.agreements || [];

        const all: CalendarEvent[] = [];
        for (const a of agreements) {
          const evts = generateEventsFromAgreement(a, windowStart, windowEnd);
          all.push(...evts);
        }

        // sort by date asc for stable UI
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

  // Build the days grid
  const days: Array<number | null> = [];
  for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const goToPreviousMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getEventsForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.date === dateStr);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  // Events only for the current month (for the table)
  const monthStartISO = toISO(new Date(year, month, 1));
  const monthEndISO = toISO(new Date(year, month + 1, 0));
  const monthEvents = useMemo(() => {
    return events.filter((e) => e.date >= monthStartISO && e.date <= monthEndISO);
  }, [events, monthStartISO, monthEndISO]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2">Calendar</h1>
          <p className="text-muted-foreground">View all contract deadlines and renewals</p>
        </div>
        <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
          <CalendarIcon size={16} className="mr-2" />
          Today
        </Button>
      </div>

      {/* Calendar Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {monthNames[month]} {year}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft size={18} />
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNextMonth}>
                <ChevronRight size={18} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-muted-foreground">Loading events…</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="p-3 text-center text-sm text-muted-foreground font-medium">
                {d}
              </div>
            ))}
            {/* Days */}
            {days.map((day, idx) => (
              <div
                key={idx}
                className={cn(
                  "min-h-[120px] border border-border p-2 bg-background",
                  day && "hover:bg-muted/50 cursor-pointer"
                )}
              >
                {day && (
                  <>
                    <div
                      className={cn("text-sm mb-2 font-medium", isToday(day) && "text-primary")}
                    >
                      {day}
                    </div>
                    <div className="space-y-1">
                      {getEventsForDate(day).map((event) => (
                        <div
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className={cn(
                            "text-xs p-1 rounded border cursor-pointer hover:shadow-sm transition-shadow",
                            getEventColor(event.type)
                          )}
                          title={event.description}
                        >
                          <div className="font-medium truncate">{event.title}</div>
                          <div className="truncate opacity-75">{event.vendor}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-sm">Notice Deadline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-sm">Renewal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-500" />
              <span className="text-sm">Term End</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table for current month */}
      <Card>
        <CardHeader>
          <CardTitle>Events this month</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
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
              {monthEvents.map((e) => (
                <TableRow key={e.id} className="hover:bg-muted/50">
                  <TableCell>{e.date}</TableCell>
                  <TableCell>
                    <Badge className={cn(getEventColor(e.type).replace("bg-", "bg-"))}>
                      {e.type === "notice"
                        ? "Notice"
                        : e.type === "renewal"
                          ? "Renewal"
                          : "Term End"}
                    </Badge>
                  </TableCell>
                  <TableCell>{e.vendor}</TableCell>
                  <TableCell>{e.title}</TableCell>
                  <TableCell className="text-muted-foreground">{e.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drawer */}
      <AgreementDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        event={selectedEvent}
      />
    </div>
  );
}
