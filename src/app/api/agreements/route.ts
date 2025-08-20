import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

/**
 * GET /api/agreements
 *
 * Returns the caller's agreements (scoped by x-user-id) plus a short-lived
 * signed URL for each document, suitable for direct browser viewing.
 *
 * Notes:
 *   - Signed URL TTL is set to 1 hour
 *
 * @param {Request} req - Next.js Request; must contain "x-user-id" header.
 * @returns {Promise<NextResponse>} 200 JSON { agreements: [...] } or an error status.
 */
export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();

  //Fetch agreements for the caller
  const { data: rows, error } = await sb
    .from("agreements")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /**
   * Normalize a stored path/URL into a storage object key suitable for signing.
   *
   * @param {string | null | undefined} raw - Raw DB path or URL.
   * @returns {string | null} - Storage key relative to the "agreements" bucket, or null.
   */
  const toStorageKey = (raw?: string | null): string | null => {
    if (!raw) return null;
    try {
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        const u = new URL(raw);
        const pubPrefix = "/storage/v1/object/public/agreements/";
        const signPrefix = "/storage/v1/object/sign/agreements/";

        if (u.pathname.includes(pubPrefix)) {
          return u.pathname.split(pubPrefix)[1] || null;
        }

        if (u.pathname.includes(signPrefix)) {
          const rest = u.pathname.split(signPrefix)[1];
          return rest?.split("?")[0] || null;
        }
        return u.pathname.replace(/^\/+/, "") || null;
      }
    } catch {}

    return raw.replace(/^\/+/, "");
  };

  const withSigned = await Promise.all(
    (rows ?? []).map(async (r) => {
      const key = toStorageKey(r.source_file_path) || toStorageKey(r.source_file_name);
      if (!key) return { ...r, signed_url: null };

      const { data: signData, error: signErr } = await sb
        .storage
        .from("agreements")
        .createSignedUrl(key, 60 * 60);

      if (signErr || !signData?.signedUrl) {
        return { ...r, signed_url: null };
      }
      return { ...r, signed_url: signData.signedUrl };
    })
  );

  return NextResponse.json({ agreements: withSigned });
}
