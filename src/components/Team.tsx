// app/team/page.tsx  (or src/components/Team.tsx if you prefer and route it)
"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getUserIdClient } from "@/lib/getUserClient";

type Member = {
  id: string;
  owner_user_id: string;
  email: string;
  name: string | null;
  role: string | null;
  status: "invited" | "active" | "removed";
  created_at: string;
  updated_at: string;
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ name: string; email: string; role: string }>({ name: "", email: "", role: "" });
  const [sending, setSending] = useState<"me" | "team" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function fetchMembers() {
    const userId = await getUserIdClient();
    const res = await fetch("/api/team", { headers: { "x-user-id": userId! }, cache: "no-store" });
    const json = await res.json();
    if (res.ok) setMembers(json.members ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchMembers(); }, []);

  async function addMember() {
    setSaving(true);
    setMessage(null);
    try {
      const userId = await getUserIdClient();
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId! },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to add");
      setForm({ name: "", email: "", role: "" });
      await fetchMembers();
    } catch (e: any) {
      setMessage(e?.message || "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(id: string) {
    setSaving(true);
    setMessage(null);
    try {
      const userId = await getUserIdClient();
      const res = await fetch(`/api/team/${id}`, { method: "DELETE", headers: { "x-user-id": userId! } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to remove");
      await fetchMembers();
    } catch (e: any) {
      setMessage(e?.message || "Failed to remove");
    } finally {
      setSaving(false);
    }
  }

  async function send(scope: "me" | "team") {
    setSending(scope);
    setMessage(null);
    try {
      const userId = await getUserIdClient();
      const res = await fetch("/api/team/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId! },
        body: JSON.stringify({ scope }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to send");
      // Surface a helpful dev message when running locally with Resend limits:
      if (json.devNotice) setMessage(json.devNotice);
      else setMessage("Sent!");
    } catch (e: any) {
      setMessage(e?.message || "Failed to send");
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-1">Team</h1>
          <p className="text-muted-foreground">Manage teammates and send digests or invites.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => send("me")} disabled={sending !== null}>
            {sending === "me" ? "Sending…" : "Send digest to me"}
          </Button>
          <Button onClick={() => send("team")} disabled={sending !== null}>
            {sending === "team" ? "Sending…" : "Send to team"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add teammate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input placeholder="Name (optional)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input placeholder="Role (optional)" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={addMember} disabled={saving || !form.email}>Add</Button>
            {message && <span className="text-sm text-muted-foreground">{message}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
              ) : members.length === 0 ? (
                <TableRow><TableCell colSpan={5}>No teammates yet.</TableCell></TableRow>
              ) : members.map(m => (
                <TableRow key={m.id}>
                  <TableCell>{m.name || "-"}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>{m.role || "-"}</TableCell>
                  <TableCell>
                    {m.status === "active" ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                    ) : m.status === "invited" ? (
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Invited</Badge>
                    ) : (
                      <Badge variant="secondary">Removed</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)} disabled={saving}>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
