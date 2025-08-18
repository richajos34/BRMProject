"use client";

import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Upload, FileText, Eye, Calendar as CalendarIcon, CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgreementDrawer } from "./AgreementDrawer";
import { authedFetch } from "@/lib/authedFetch"; // <-- add this
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

async function uploadFile(file: File) {
  const userId = await getUserIdClient();
  if (!userId) throw new Error("Not signed in");

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/agreements/upload", {
    method: "POST",
    body: fd,
    headers: { "x-user-id": userId },
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

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

export function Documents() {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedAgreement, setSelectedAgreement] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

  const handleViewAgreement = (agreement: AgreementRow) => {
    setSelectedAgreement(agreement);
    setIsDrawerOpen(true);
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
      for (const f of files) await uploadFile(f);
      const refreshed = await fetchAgreements();
      setAgreements(refreshed);
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
      for (const f of files) await uploadFile(f);
      const refreshed = await fetchAgreements();
      setAgreements(refreshed);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="mb-2">Documents</h1>
        <p className="text-muted-foreground">Upload and manage your contract documents</p>
      </div>

      {/* Upload Section */}
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8}>Loading…</TableCell></TableRow>
              ) : agreements.length === 0 ? (
                <TableRow><TableCell colSpan={8}>No agreements yet.</TableCell></TableRow>
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
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleViewAgreement(a)}>
                          <Eye size={16} className="mr-2" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Agreement Drawer */}
      <AgreementDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        agreement={selectedAgreement}
      />
    </div>
  );
}
