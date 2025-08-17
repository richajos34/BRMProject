import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";
import {
  Bell,
  Mail,
  Smartphone,
  Clock,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface NotificationSetting {
  id: string;
  type: "email" | "sms" | "push";
  days: number;
  enabled: boolean;
}

export function Settings() {
  const [emailReminders, setEmailReminders] = useState(true);
  const [smsReminders, setSmsReminders] = useState(false);
  const [pushNotifications, setPushNotifications] =
    useState(true);

  const [defaultReminders, setDefaultReminders] = useState<
    NotificationSetting[]
  >([
    { id: "1", type: "email", days: 90, enabled: true },
    { id: "2", type: "email", days: 30, enabled: true },
    { id: "3", type: "email", days: 7, enabled: true },
    { id: "4", type: "sms", days: 7, enabled: false },
  ]);

  const [newReminderDays, setNewReminderDays] = useState("");
  const [newReminderType, setNewReminderType] = useState<
    "email" | "sms" | "push"
  >("email");

  const handleSaveSettings = () => {
    // Handle save logic here
    toast.success("Settings saved successfully");
  };

  const handleAddReminder = () => {
    if (!newReminderDays || parseInt(newReminderDays) <= 0) {
      toast.error("Please enter a valid number of days");
      return;
    }

    const newReminder: NotificationSetting = {
      id: Date.now().toString(),
      type: newReminderType,
      days: parseInt(newReminderDays),
      enabled: true,
    };

    setDefaultReminders([...defaultReminders, newReminder]);
    setNewReminderDays("");
    toast.success("Reminder added successfully");
  };

  const handleRemoveReminder = (id: string) => {
    setDefaultReminders(
      defaultReminders.filter((reminder) => reminder.id !== id),
    );
    toast.success("Reminder removed");
  };

  const handleToggleReminder = (id: string) => {
    setDefaultReminders(
      defaultReminders.map((reminder) =>
        reminder.id === id
          ? { ...reminder, enabled: !reminder.enabled }
          : reminder,
      ),
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "email":
        return <Mail size={16} />;
      case "sms":
        return <Smartphone size={16} />;
      case "push":
        return <Bell size={16} />;
      default:
        return <Bell size={16} />;
    }
  };

  const getNotificationLabel = (type: string) => {
    switch (type) {
      case "email":
        return "Email";
      case "sms":
        return "SMS";
      case "push":
        return "Push";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Page Header */}
      <div>
        <h1 className="mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure your notification preferences and default
          reminder settings
        </p>
      </div>

      {/* Notification Preferences */}
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
              <Label htmlFor="email-reminders">
                Email Reminders
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive contract deadline reminders via email
              </p>
            </div>
            <Switch
              id="email-reminders"
              checked={emailReminders}
              onCheckedChange={setEmailReminders}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sms-reminders">
                SMS Reminders
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive urgent reminders via text message
              </p>
            </div>
            <Switch
              id="sms-reminders"
              checked={smsReminders}
              onCheckedChange={setSmsReminders}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="push-notifications">
                Push Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive browser notifications for important
                deadlines
              </p>
            </div>
            <Switch
              id="push-notifications"
              checked={pushNotifications}
              onCheckedChange={setPushNotifications}
            />
          </div>
        </CardContent>
      </Card>

      {/* Default Reminder Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} />
            Default Reminder Offsets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Set default reminder schedules that will be applied
            to new contracts. You can customize these for
            individual contracts later.
          </p>

          {/* Existing Reminders */}
          <div className="space-y-3">
            {defaultReminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={reminder.enabled}
                    onCheckedChange={() =>
                      handleToggleReminder(reminder.id)
                    }
                  />
                  <div className="flex items-center gap-2">
                    {getNotificationIcon(reminder.type)}
                    <span className="font-medium">
                      {reminder.days} days before
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {getNotificationLabel(reminder.type)}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    handleRemoveReminder(reminder.id)
                  }
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          {/* Add New Reminder */}
          <div className="space-y-4">
            <Label>Add New Reminder</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Days before deadline"
                type="number"
                value={newReminderDays}
                onChange={(e) =>
                  setNewReminderDays(e.target.value)
                }
                className="flex-1"
              />
              <Select
                value={newReminderType}
                onValueChange={(
                  value: "email" | "sms" | "push",
                ) => setNewReminderType(value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddReminder}>Add</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail size={20} />
            Email Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="notification-email">
              Notification Email Address
            </Label>
            <Input
              id="notification-email"
              type="email"
              placeholder="notifications@yourcompany.com"
              className="mt-1"
            />
            <p className="text-sm text-muted-foreground mt-1">
              All contract reminders will be sent to this email
              address
            </p>
          </div>

          <div>
            <Label htmlFor="cc-emails">
              CC Additional Recipients
            </Label>
            <Input
              id="cc-emails"
              type="email"
              placeholder="legal@yourcompany.com, procurement@yourcompany.com"
              className="mt-1"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Separate multiple email addresses with commas
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} className="gap-2">
          <Save size={16} />
          Save Settings
        </Button>
      </div>
    </div>
  );
}