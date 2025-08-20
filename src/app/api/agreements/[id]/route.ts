import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

/**
 * Body shape for PATCH requests.
 * All fields are optional because PATCH is a partial update.
 */
type Body = {
  vendor?: string;
  title?: string;
  effective_on?: string | null;
  end_on?: string | null;
  auto_renews?: boolean;
  notice_days?: number | null;
  renewal_frequency_months?: number | null;
  explicit_opt_out_on?: string | null;
};

/**
 * Represents a row in the `agreements` table.
 * This is the canonical contract object persisted in the database.
 */
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

/** Possible lifecycle events tied to an agreement */
type EventKind = "notice" | "renewal" | "termination";
const BUCKET = process.env.SUPABASE_BUCKET ?? "";

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
  if (d.getDate() !== day) {}
  return d;
};

const addDays = (dt: Date, days: number) => {
  const d = new Date(dt.getTime());
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Build key lifecycle dates (termination, renewal, notice) for a given agreement.
 *
 * @param a Agreement row to build events for.
 * @param monthsAhead How far into the future to compute key dates (default: 60).
 * @returns Array of key date rows ready for insertion into `key_dates` table.
 */
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

/**
 * PATCH /agreements/:id
 * Partially updates an agreement and regenerates its key lifecycle dates.
 *
 * @param req Request object with JSON body matching {@link Body}.
 * @param params.id Agreement ID to patch.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const body: Body = await req.json();

  const reqUserId = req.headers.get("x-user-id");

  const sb = supabaseAdmin();

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

  const KEY_TABLE = "key_dates";
  const { error: delErr } = await sb
    .from(KEY_TABLE)
    .delete()
    .eq("agreement_id", updated.id);

  if (delErr) {
    console.error("[key_dates] delete failed:", delErr.message);
  }

  const newDates = buildKeyDates(updated);

  if (newDates.length > 0) {
    const { error: insErr } = await sb.from(KEY_TABLE).insert(newDates);
    if (insErr) {
      console.error("[key_dates] insert failed:", insErr.message);
    }
  }

  return NextResponse.json({ ok: true, agreement: updated, key_dates_inserted: newDates.length });
}

/**
 * DELETE /agreements/:id
 * Deletes an agreement and all associated artifacts (file storage, key_dates).
 *
 * @param req Request object with `x-user-id` header for authorization.
 * @param params.id Agreement ID to delete.
 */
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
  
    const storageKey = (agreement.source_file_path || "").replace(/^\/+/, "");
    if (storageKey) {
      const { error: removeErr } = await sb.storage.from(BUCKET).remove([storageKey]);
      if (removeErr) console.error("[agreements:delete] storage remove error:", removeErr.message);
    }

    const { error: kdErr } = await sb
      .from("key_dates")
      .delete()
      .eq("agreement_id", id);
    if (kdErr) {
      console.error("[agreements:delete] key_dates delete error:", kdErr.message);
    }
  
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
