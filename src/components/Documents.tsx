"use client";

import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Upload, FileText, Eye, Calendar as CalendarIcon, CheckCircle, X, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgreementDrawer } from "./AgreementDrawer";
import { authedFetch } from "@/lib/authedFetch";
import { getUserIdClient } from "@/lib/getUserClient";

/** Shape returned by GET /api/agreements (matches DB columns) */
type AgreementRow = {
  id: string;
  vendor: string;
  title: string;
  effective_on: string | null;
  end_on: string | null;
  auto_renews: boolean;
  notice_days: number | null;
  source_file_name: string;
  source_file_path?: string | null;
  signed_url?: string | null;
};

function getStatusBadge(status: "active" | "expiring" | "expired") {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
    case "expiring":
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Expiring</Badge>;
    case "expired":
      return <Badge variant="destructive">Expired</Badge>;
  }
}

function computeStatus(endISO: string | null): "active" | "expiring" | "expired" {
  if (!endISO) return "active";
  const end = new Date(endISO);
  const today = new Date();
  const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "expired";
  if (diffDays <= 60) return "expiring";
  return "active";
}

function fmt(dateISO: string | null) {
  if (!dateISO) return "-";
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ---------- filename / path helpers ---------- */
function basename(path?: string | null): string {
  if (!path) return "";
  try {
    const u = new URL(path);
    return u.pathname.split("/").pop() ?? "";
  } catch {
    return path.split("/").pop() ?? "";
  }
}
function splitExt(name: string): { base: string; ext: string } {
  const i = name.lastIndexOf(".");
  if (i <= 0) return { base: name, ext: "" };
  return { base: name.slice(0, i), ext: name.slice(i) };
}
function ensureUniqueFilename(originalName: string, takenNames: string[]): string {
  const norm = (s: string) => s.trim().toLowerCase();
  const taken = new Set(takenNames.map(norm));
  if (!taken.has(norm(originalName))) return originalName;
  const { base, ext } = splitExt(originalName);
  let i = 1;
  while (true) {
    const candidate = `${base} (${i})${ext}`;
    if (!taken.has(norm(candidate))) return candidate;
    i++;
  }
}

/* ---------- data fetch ---------- */
async function fetchAgreements(): Promise<AgreementRow[]> {
  const userId = await getUserIdClient();
  if (!userId) throw new Error("Not signed in");

  const res = await fetch("/api/agreements", {
    cache: "no-store",
    headers: { "x-user-id": userId },
  });

  if (!res.ok) throw new Error(await res.text());
  const { agreements } = await res.json();
  return agreements as AgreementRow[];
}

/* ---------- light modal + slide-over ---------- */
function Modal({
  open, onClose, children, title,
}: { open: boolean; onClose: () => void; children: React.ReactNode; title: string; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-xl">
        <div className="border-b px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function SlideOver({
  open, onClose, children, title,
}: { open: boolean; onClose: () => void; children: React.ReactNode; title: string; }) {
  return (
    <div className={cn("fixed inset-0 z-[60] pointer-events-none", open && "pointer-events-auto")}>
      <div
        className={cn("absolute inset-0 bg-black/40 transition-opacity", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-full md:w-[36rem] lg:w-[40rem] max-w-[33vw] bg-white shadow-2xl transform transition-transform",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="p-5 overflow-y-auto h-[calc(100%-56px)]">{children}</div>
      </div>
    </div>
  );
}

export function Documents() {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // view drawer
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // edit slide-over
  const [editAgreement, setEditAgreement] = useState<AgreementRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState<{
    effective_on: string | null;
    end_on: string | null;
    auto_renews: boolean;
    notice_days: number | null;
    title: string;
    vendor: string;
  } | null>(null);

  // duplicate modal
  const [dupOpen, setDupOpen] = useState(false);
  const [dupOf, setDupOf] = useState<AgreementRow | null>(null);
  const pendingUploadRef = useRef<File | null>(null);

  // delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgreementRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // drag
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchAgreements();
        setAgreements(data);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load agreements");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------- actions ---------- */
  const refresh = async () => {
    const data = await fetchAgreements();
    setAgreements(data);
  };

  const openView = (a: AgreementRow) => {
    if (a.signed_url) {
      window.open(a.signed_url, "_blank", "noopener,noreferrer");
    } else {
      setSelectedAgreement(a);
      setIsDrawerOpen(true);
    }
  };

  const openEdit = (a: AgreementRow) => {
    setEditAgreement(a);
    setEditForm({
      effective_on: a.effective_on,
      end_on: a.end_on,
      auto_renews: a.auto_renews,
      notice_days: a.notice_days ?? 0,
      title: a.title,
      vendor: a.vendor,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editAgreement || !editForm) return;
    setEditSaving(true);
    try {
      const res = await authedFetch(`/api/agreements/${editAgreement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error(await res.text());
      await refresh();
      setEditOpen(false);
    } catch (e: any) {
      alert(e?.message || "Failed to save");
    } finally {
      setEditSaving(false);
    }
  };

  // DELETE flow
  const askDelete = (a: AgreementRow) => {
    setDeleteTarget(a);
    setDeleteOpen(true);
  };
  const cancelDelete = () => {
    setDeleteOpen(false);
    setDeleteTarget(null);
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authedFetch(`/api/agreements/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await refresh();
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (e: any) {
      alert(e?.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  // duplicate gate: compare **file name** with existing names / basenames
  const handleUploadWithDuplicateGate = async (file: File) => {
    const existingBasenames = agreements.map(a => basename(a.source_file_path)).filter(Boolean);
    const existingNames = agreements.map(a => a.source_file_name || basename(a.source_file_path)).filter(Boolean);

    const fileName = file.name;
    const nameClash =
      existingBasenames.includes(fileName) || existingNames.includes(fileName);

    if (nameClash) {
      const match =
        agreements.find(
          a =>
            basename(a.source_file_path) === fileName ||
            a.source_file_name === fileName
        ) || null;
      pendingUploadRef.current = file;
      setDupOf(match);
      setDupOpen(true);
      return;
    }

    await actuallyUpload(file);
  };

  // always ensure unique filename on wire by overriding FormData filename
  const actuallyUpload = async (file: File) => {
    const userId = await getUserIdClient();
    if (!userId) throw new Error("Not signed in");

    const existingNames = agreements
      .map(a => a.source_file_name || basename(a.source_file_path))
      .filter(Boolean);

    const finalName = ensureUniqueFilename(file.name, existingNames);

    const fd = new FormData();
    fd.append("file", file, finalName);

    const res = await fetch("/api/agreements/upload", {
      method: "POST",
      body: fd,
      headers: { "x-user-id": userId },
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const handleConfirmReupload = async () => {
    const file = pendingUploadRef.current;
    setDupOpen(false);
    if (!file) return;
    try {
      setBusy(true);
      await actuallyUpload(file); // will auto-append (1) if needed
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Upload failed");
    } finally {
      setBusy(false);
      pendingUploadRef.current = null;
      setDupOf(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
    if (!files.length) return;

    try {
      setBusy(true);
      setError(null);
      for (const f of files) await handleUploadWithDuplicateGate(f);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  const handleChooseFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type === "application/pdf");
    if (!files.length) return;

    try {
      setBusy(true);
      setError(null);
      for (const f of files) await handleUploadWithDuplicateGate(f);
      await refresh();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  /* ---------- render ---------- */
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="mb-2">Documents</h1>
        <p className="text-muted-foreground">Upload and manage your contract documents</p>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload New Agreement</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-border/80",
              busy && "opacity-70 pointer-events-none"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <Upload size={24} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium">Drop your PDF files here</p>
                <p className="text-muted-foreground">or click to browse</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={handleChooseFiles}
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={busy}>
                Choose Files
              </Button>

              {busy && <p className="text-sm text-muted-foreground">Uploading & parsing…</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agreements Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Agreements</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <CalendarIcon size={16} className="mr-2" />
                Filter by Date
              </Button>
              <Button variant="outline" size="sm">Export</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Auto-Renew</TableHead>
                <TableHead>Notice Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Edit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9}>Loading…</TableCell></TableRow>
              ) : !agreements || agreements.length === 0 ? (
                <TableRow><TableCell colSpan={9}>No agreements yet.</TableCell></TableRow>
              ) : agreements.map((a) => {
                const status = computeStatus(a.end_on);
                return (
                  <TableRow key={a.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{a.vendor}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-muted-foreground" />
                        {a.title}
                      </div>
                    </TableCell>
                    <TableCell>{fmt(a.effective_on)}</TableCell>
                    <TableCell>{fmt(a.end_on)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {a.auto_renews ? (
                          <>
                            <CheckCircle size={16} className="text-green-600" />
                            <span>Yes</span>
                          </>
                        ) : (
                          <>
                            <X size={16} className="text-red-600" />
                            <span>No</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{a.notice_days ?? 0} days</TableCell>
                    <TableCell>{getStatusBadge(status)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(a)}>
                        <Pencil size={16} />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openView(a)}>
                        <Eye size={16} className="mr-2" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => askDelete(a)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Drawer (use your AgreementDrawer) */}
      <AgreementDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {/* Edit Slide-over */}
      <SlideOver open={editOpen} onClose={() => setEditOpen(false)} title="Edit agreement">
        {editForm && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveEdit();
            }}
          >
            <div className="grid grid-cols-1 gap-4">
              <label className="text-sm font-medium">Vendor
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  value={editForm.vendor ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                />
              </label>
              <label className="text-sm font-medium">Title
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2"
                  value={editForm.title ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-sm font-medium">Effective on
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    value={editForm.effective_on ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, effective_on: e.target.value || null })}
                  />
                </label>
                <label className="text-sm font-medium">End on
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    value={editForm.end_on ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, end_on: e.target.value || null })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-sm font-medium">Notice days
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    value={editForm.notice_days ?? 0}
                    onChange={(e) =>
                      setEditForm({ ...editForm, notice_days: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="text-sm font-medium">Auto-renews
                  <select
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    value={editForm.auto_renews ? "yes" : "no"}
                    onChange={(e) =>
                      setEditForm({ ...editForm, auto_renews: e.target.value === "yes" })
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </SlideOver>

      {/* Duplicate Modal */}
      <Modal
        open={dupOpen}
        onClose={() => {
          setDupOpen(false);
          pendingUploadRef.current = null;
          setDupOf(null);
        }}
        title="Duplicate file detected"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A document with the same file path/name already exists. You can edit that record, or
            continue to upload — we’ll append “(1)” to the new file name.
          </p>

          {dupOf && (
            <div className="rounded-lg border p-3">
              <div className="font-medium">{dupOf.vendor}</div>
              <div className="text-sm text-muted-foreground">{dupOf.title}</div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div>Effective: <span className="font-medium">{fmt(dupOf.effective_on)}</span></div>
                <div>End: <span className="font-medium">{fmt(dupOf.end_on)}</span></div>
                <div>Auto-renew: <span className="font-medium">{dupOf.auto_renews ? "Yes" : "No"}</span></div>
                <div>Notice days: <span className="font-medium">{dupOf.notice_days ?? 0}</span></div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (dupOf) openEdit(dupOf);
                setDupOpen(false);
              }}
            >
              Edit existing
            </Button>
            <Button variant="ghost" onClick={() => setDupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReupload}>Re-upload anyway</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteOpen}
        onClose={deleting ? () => {} : cancelDelete}
        title="Delete agreement"
      >
        <div className="space-y-4">
          <p className="text-sm">
            Are you sure you want to delete <span className="font-medium">{deleteTarget?.title}</span> from{" "}
            <span className="font-medium">{deleteTarget?.vendor}</span>? This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={cancelDelete} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}