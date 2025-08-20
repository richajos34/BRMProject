import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

/**
 * GET /api/team
 * Fetch all team members for the given user.
 *
 * @param req - The incoming HTTP request (expects `x-user-id` header).
 * @returns JSON response with members or an error.
 */
export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("team_members")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}

/**
 * POST /api/team
 * Add or update a team member for the given user.
 *
 * @param req - The incoming HTTP request (expects `x-user-id` header and JSON body).
 *   Body fields:
 *     - email: string (required)
 *     - name: string (optional)
 *     - role: string (optional)
 * @returns JSON response with the added/updated member or an error.
 */
export async function POST(req: Request) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { email, name, role } = body || {};
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("team_members")
    .upsert(
      [{ owner_user_id: userId, email, name: name ?? null, role: role ?? null, status: "invited" }],
      { onConflict: "owner_user_id,email" }
    )
    .select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data?.[0] });
}
