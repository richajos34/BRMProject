export type EventType = "notice" | "renewal" | "termination";

export interface CalendarEvent {
  id: string;
  title: string;
  vendor: string;
  date: string;            // yyyy-mm-dd
  type: EventType;
  description?: string;    // optional so either side can omit it
  agreementId: string;
}
