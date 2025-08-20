import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();

  const { data: rows, error } = await sb
    .from("agreements")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const toStorageKey = (raw?: string | null): string | null => {
    if (!raw) return null;

    // If it's already a full URL, strip the origin.
    // If it's a local path like `/273a.../uploads/foo.pdf`, drop the leading slash.
    try {
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        const u = new URL(raw);
        // If the URL already points at Supabase public object,
        // try to extract the key after `/object/public/agreements/`
        const pubPrefix = "/storage/v1/object/public/agreements/";
        const signPrefix = "/storage/v1/object/sign/agreements/";
        if (u.pathname.includes(pubPrefix)) {
          return u.pathname.split(pubPrefix)[1] || null;
        }
        if (u.pathname.includes(signPrefix)) {
          // already a signed URL; keep its key portion
          const rest = u.pathname.split(signPrefix)[1];
          return rest?.split("?")[0] || null;
        }
        // Otherwise this is some other origin — fall back to path without leading slash
        return u.pathname.replace(/^\/+/, "") || null;
      }
    } catch {
      /* ignore and fall through */
    }

    // Plain path case: '/userId/uploads/file.pdf' or 'userId/uploads/file.pdf'
    return raw.replace(/^\/+/, "");
  };

  // Generate signed URLs (1 hour expiry). If a key is missing, signed_url is null.
  const withSigned = await Promise.all(
    (rows ?? []).map(async (r) => {
      const key = toStorageKey(r.source_file_path) || toStorageKey(r.source_file_name);
      if (!key) return { ...r, signed_url: null };

      const { data: signData, error: signErr } = await sb
        .storage
        .from("agreements")
        .createSignedUrl(key, 60 * 60); // 1 hour

      if (signErr || !signData?.signedUrl) {
        return { ...r, signed_url: null };
      }
      return { ...r, signed_url: signData.signedUrl };
    })
  );

  return NextResponse.json({ agreements: withSigned });
}
