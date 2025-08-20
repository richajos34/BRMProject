// src/app/api/agreements/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type Body = {
  vendor?: string;
  title?: string;
  effective_on?: string | null;  // "yyyy-mm-dd"
  end_on?: string | null;        // "yyyy-mm-dd"
  auto_renews?: boolean;
  notice_days?: number | null;
  renewal_frequency_months?: number | null;
  explicit_opt_out_on?: string | null; // optional if you have it
};

type AgreementRow = {
  id: string;
  user_id: string | null;
  vendor: string;
  title: string;
  effective_on: string | null;
  end_on: string | null;
  auto_renews: boolean | null;
  notice_days: number | null;
  renewal_frequency_months: number | null;
  explicit_opt_out_on: string | null;
};

type EventKind = "notice" | "renewal" | "termination";
const BUCKET = process.env.SUPABASE_BUCKET ?? "";

// ---- tiny date helpers (same logic as your calendar) ----
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
  if (d.getDate() !== day) { /* JS auto-adjust ok */ }
  return d;
};

const addDays = (dt: Date, days: number) => {
  const d = new Date(dt.getTime());
  d.setDate(d.getDate() + days);
  return d;
};

// Rebuild all key dates for one agreement for a broad window
function buildKeyDates(a: AgreementRow, monthsAhead = 60) {
  const rows: { agreement_id: string; event_kind: EventKind; occurs_on: string }[] = [];
  if (!a.end_on) return rows;

  const endDate = parseISO(a.end_on);
  const windowStart = new Date(); // today forward
  const windowEnd = addMonths(new Date(), monthsAhead);

  // Termination at original end
  if (endDate >= windowStart && endDate <= windowEnd) {
    rows.push({
      agreement_id: a.id,
      event_kind: "termination",
      occurs_on: toISO(endDate),
    });
  }

  const auto = !!a.auto_renews;
  const freq =
    a.renewal_frequency_months && a.renewal_frequency_months > 0
      ? a.renewal_frequency_months
      : 12;
  const noticeDays = a.notice_days ?? 0;

  if (!auto) return rows;

  // Iterate renewals (starting at end_on)
  let renewal = new Date(endDate);
  let guard = 0;
  while (renewal <= windowEnd && guard < 120) {
    if (renewal >= windowStart) {
      rows.push({
        agreement_id: a.id,
        event_kind: "renewal",
        occurs_on: toISO(renewal),
      });

      if (noticeDays > 0) {
        const nd = addDays(renewal, -noticeDays);
        if (nd >= windowStart && nd <= windowEnd) {
          rows.push({
            agreement_id: a.id,
            event_kind: "notice",
            occurs_on: toISO(nd),
          });
        }
      }
    }
    renewal = addMonths(renewal, freq);
    guard++;
  }

  return rows;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const body: Body = await req.json();

  // Optional: require ownership via x-user-id header (recommended if RLS is on)
  const reqUserId = req.headers.get("x-user-id");

  const sb = supabaseAdmin();

  // 1) Load existing (to get user_id and to compute dates)
  const { data: existing, error: getErr } = await sb
    .from("agreements")
    .select("*")
    .eq("id", id)
    .single<AgreementRow>();

  if (getErr || !existing) {
    return NextResponse.json({ error: getErr?.message || "Not found" }, { status: 404 });
  }

  if (reqUserId && existing.user_id && existing.user_id !== reqUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2) Update the agreement
  const patch: Body = {
    vendor: body.vendor,
    title: body.title,
    effective_on: body.effective_on ?? null,
    end_on: body.end_on ?? null,
    auto_renews: body.auto_renews,
    notice_days: body.notice_days ?? null,
    renewal_frequency_months:
      body.renewal_frequency_months ?? existing.renewal_frequency_months ?? 12,
    explicit_opt_out_on:
      body.explicit_opt_out_on ?? existing.explicit_opt_out_on ?? null,
  };

  const { data: updated, error: updErr } = await sb
    .from("agreements")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single<AgreementRow>();

  if (updErr || !updated) {
    return NextResponse.json({ error: updErr?.message || "Update failed" }, { status: 500 });
  }

  // 3) Rebuild key dates for this agreement: delete old, insert new
  //    Adjust TABLE/COLUMN names here to match your schema.
  const KEY_TABLE = "key_dates";
  // Optional: If your table has user_id, include it in delete/insert.
  // First, clear existing rows for this agreement:
  const { error: delErr } = await sb
    .from(KEY_TABLE)
    .delete()
    .eq("agreement_id", updated.id);

  if (delErr) {
    // Not fatal for client UX, but you can treat as 500 if you prefer.
    console.error("[key_dates] delete failed:", delErr.message);
  }

  const newDates = buildKeyDates(updated);

  if (newDates.length > 0) {
    const { error: insErr } = await sb.from(KEY_TABLE).insert(newDates);
    if (insErr) {
      console.error("[key_dates] insert failed:", insErr.message);
      // again, you can decide if this should be a 500
    }
  }

  return NextResponse.json({ ok: true, agreement: updated, key_dates_inserted: newDates.length });
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
  ) {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  
    const { id } = params;
    const sb = supabaseAdmin();
  
    // 1) Fetch the agreement to confirm ownership and get storage key
    const { data: agreement, error: fetchErr } = await sb
      .from("agreements")
      .select("id, user_id, source_file_path")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
  
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!agreement) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  
    // 2) Remove the file from Storage (if you keep originals there)
    const storageKey = (agreement.source_file_path || "").replace(/^\/+/, "");
    if (storageKey) {
      const { error: removeErr } = await sb.storage.from(BUCKET).remove([storageKey]);
      // Don’t fail the whole request if storage deletion errs; just log
      if (removeErr) console.error("[agreements:delete] storage remove error:", removeErr.message);
    }
  
    // 3) Delete related key_dates if you don’t have ON DELETE CASCADE
    // (safe to keep if you *do* have FK cascade)
    const { error: kdErr } = await sb
      .from("key_dates")
      .delete()
      .eq("agreement_id", id);
    if (kdErr) {
      // Not fatal — log and continue
      console.error("[agreements:delete] key_dates delete error:", kdErr.message);
    }
  
    // 4) Delete the agreement row
    const { error: delErr } = await sb
      .from("agreements")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
  
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
  
    return NextResponse.json({ ok: true });
  }
