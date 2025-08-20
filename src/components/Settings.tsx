"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Bell, Mail, Smartphone, Clock, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getUserIdClient } from "@/lib/getUserClient";


/**
 * Settings Component
 *
 * Provides the user interface for configuring notification preferences and reminder schedules.
 *
 * State managed:
 * - `emailReminders`, `smsReminders`, `pushNotifications`: toggles for each notification channel.
 * - `defaultReminders`: list of default reminder offsets (days before deadline, type, enabled flag).
 * - `notifEmail`: primary notification email address.
 * - `ccEmails`: comma-separated list of additional recipients.
 * - `newReminderDays`, `newReminderType`: input values for creating a new reminder.
 * - `loading`, `saving`: control fetch/save states.
 *
 * Key Functions:
 * - `useEffect`: loads current settings from `/api/settings` on mount.
 * - `handleSaveSettings()`: persists settings back to the API.
 * - `handleAddReminder()`: appends a new reminder to the defaults list.
 * - `handleRemoveReminder(id)`: deletes a reminder from the list.
 * - `handleToggleReminder(id)`: enables/disables a reminder.
 * - `getNotificationIcon(type)`, `getNotificationLabel(type)`: map reminder type → UI label/icon.
 *
 * Returns:
 * - A page with multiple cards:
 *   1. **Notification Preferences**: toggles for Email, SMS, Push.
 *   2. **Default Reminder Offsets**: list of reminders, plus “Add Reminder” form.
 *   3. **Email Settings**: main notification email + CC list.
 * - Save button persists all settings.
 */

type ReminderType = "email" | "sms" | "push";
interface NotificationSetting {
  id?: string; 
  type: ReminderType;
  days: number;
  enabled: boolean;
}

export function Settings() {
  // channel toggles
  const [emailReminders, setEmailReminders] = useState(true);
  const [smsReminders, setSmsReminders] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);

  // defaults list
  const [defaultReminders, setDefaultReminders] = useState<NotificationSetting[]>([]);

  // email fields
  const [notifEmail, setNotifEmail] = useState<string>("");
  const [ccEmails, setCcEmails] = useState<string>("");

  // add form
  const [newReminderDays, setNewReminderDays] = useState("");
  const [newReminderType, setNewReminderType] = useState<ReminderType>("email");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- load settings ---
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const uid = await getUserIdClient();
        const res = await fetch("/api/settings", {
          headers: { "x-user-id": uid || "" },
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load settings");

        const s = json.settings;
        setEmailReminders(!!s.emailReminders);
        setSmsReminders(!!s.smsReminders);
        setPushNotifications(!!s.pushNotifications);
        setNotifEmail(s.notifEmail || "");
        setCcEmails(s.ccEmails || "");
        setDefaultReminders(
          (s.reminders || []).map((r: any) => ({
            id: crypto.randomUUID(),
            type: r.type,
            days: r.days,
            enabled: r.enabled,
          }))
        );
      } catch (e: any) {
        toast.error(e?.message || "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- save settings ---
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const uid = await getUserIdClient();
      const payload = {
        emailReminders,
        smsReminders,
        pushNotifications,
        notifEmail: notifEmail || null,
        ccEmails: ccEmails || null,
        reminders: defaultReminders.map(r => ({
          type: r.type,
          days: r.days,
          enabled: r.enabled,
        })),
      };
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": uid || "",
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save settings");
      toast.success("Settings saved successfully");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAddReminder = () => {
    const n = parseInt(newReminderDays, 10);
    if (!n || n <= 0) {
      toast.error("Please enter a valid number of days");
      return;
    }
    const newReminder: NotificationSetting = {
      id: crypto.randomUUID(),
      type: newReminderType,
      days: n,
      enabled: true,
    };
    setDefaultReminders(prev => [newReminder, ...prev]);
    setNewReminderDays("");
    toast.success("Reminder added");
  };

  const handleRemoveReminder = (id: string) => {
    setDefaultReminders(prev => prev.filter(r => r.id !== id));
    toast.success("Reminder removed");
  };

  const handleToggleReminder = (id: string) => {
    setDefaultReminders(prev =>
      prev.map(r => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const getNotificationIcon = (type: ReminderType) => {
    switch (type) {
      case "email": return <Mail size={16} />;
      case "sms": return <Smartphone size={16} />;
      case "push": return <Bell size={16} />;
    }
  };
  const getNotificationLabel = (type: ReminderType) => {
    switch (type) {
      case "email": return "Email";
      case "sms": return "SMS";
      case "push": return "Push";
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="mb-2">Settings</h1>
        <p className="text-muted-foreground">Configure your notification preferences and default reminder settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={20} />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-reminders">Email Reminders</Label>
              <p className="text-sm text-muted-foreground">Receive contract deadline reminders via email</p>
            </div>
            <Switch
              id="email-reminders"
              checked={emailReminders}
              onCheckedChange={setEmailReminders}
              disabled={loading}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sms-reminders">SMS Reminders</Label>
              <p className="text-sm text-muted-foreground">Receive urgent reminders via text message</p>
            </div>
            <Switch
              id="sms-reminders"
              checked={smsReminders}
              onCheckedChange={setSmsReminders}
              disabled={loading}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="push-notifications">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive browser notifications for important deadlines</p>
            </div>
            <Switch
              id="push-notifications"
              checked={pushNotifications}
              onCheckedChange={setPushNotifications}
              disabled={loading}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} />
            Default Reminder Offsets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Set default reminder schedules that will be applied to new contracts. You can customize these for individual contracts later.
          </p>

          <div className="space-y-3">
            {defaultReminders.map((reminder) => (
              <div key={reminder.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Switch checked={reminder.enabled} onCheckedChange={() => handleToggleReminder(reminder.id!)} />
                  <div className="flex items-center gap-2">
                    {getNotificationIcon(reminder.type)}
                    <span className="font-medium">{reminder.days} days before</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{getNotificationLabel(reminder.type)}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveReminder(reminder.id!)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
            {defaultReminders.length === 0 && (
              <div className="text-sm text-muted-foreground">No defaults yet. Add one below.</div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <Label>Add New Reminder</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Days before deadline"
                type="number"
                value={newReminderDays}
                onChange={(e) => setNewReminderDays(e.target.value)}
                className="flex-1"
                disabled={loading}
              />
              <Select value={newReminderType} onValueChange={(v: ReminderType) => setNewReminderType(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddReminder} disabled={loading}>Add</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail size={20} />
            Email Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="notification-email">Notification Email Address</Label>
            <Input
              id="notification-email"
              type="email"
              placeholder="notifications@yourcompany.com"
              className="mt-1"
              value={notifEmail}
              onChange={(e) => setNotifEmail(e.target.value)}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground mt-1">
              All contract reminders will be sent to this email address
            </p>
          </div>

          <div>
            <Label htmlFor="cc-emails">CC Additional Recipients</Label>
            <Input
              id="cc-emails"
              type="text"
              placeholder="legal@yourcompany.com, procurement@yourcompany.com"
              className="mt-1"
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground mt-1">Separate multiple emails with commas</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} className="gap-2" disabled={saving || loading}>
          <Save size={16} />
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}