// app/api/settings/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

type ReminderDTO = {
  id?: string;
  type: "email" | "sms" | "push";
  days: number;
  enabled: boolean;
};

type SettingsDTO = {
  emailReminders: boolean;
  smsReminders: boolean;
  pushNotifications: boolean;
  notifEmail: string | null;
  ccEmails: string | null;
  reminders: ReminderDTO[];
};

export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();

  const { data: settings, error: sErr } = await sb
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const { data: reminders, error: rErr } = await sb
    .from("user_reminder_defaults")
    .select("id,type,days,enabled")
    .eq("user_id", userId)
    .order("days", { ascending: false });

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const payload: SettingsDTO = {
    emailReminders: settings?.email_reminders ?? true,
    smsReminders: settings?.sms_reminders ?? false,
    pushNotifications: settings?.push_notifications ?? true,
    notifEmail: settings?.notif_email ?? null,
    ccEmails: settings?.cc_emails ?? null,
    reminders: (reminders ?? []) as ReminderDTO[],
  };

  return NextResponse.json({ settings: payload });
}

export async function PUT(req: Request) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as SettingsDTO;
  const sb = supabaseAdmin();

  // Upsert settings
  const { error: upErr } = await sb
    .from("user_settings")
    .upsert({
      user_id: userId,
      email_reminders: body.emailReminders,
      sms_reminders: body.smsReminders,
      push_notifications: body.pushNotifications,
      notif_email: body.notifEmail,
      cc_emails: body.ccEmails,
      updated_at: new Date().toISOString(),
    });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Replace reminders with the provided list (delete & reinsert)
  const { error: delErr } = await sb
    .from("user_reminder_defaults")
    .delete()
    .eq("user_id", userId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (body.reminders?.length) {
    const rows = body.reminders.map(r => ({
      user_id: userId,
      type: r.type,
      days: r.days,
      enabled: r.enabled,
    }));
    const { error: insErr } = await sb
      .from("user_reminder_defaults")
      .insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}