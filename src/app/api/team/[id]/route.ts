// app/api/team/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = params;

  const body = await req.json().catch(() => ({}));
  const { name, role, status } = body || {};

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("team_members")
    .update({ name, role, status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_user_id", userId)
    .select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data?.[0] });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = params;

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("team_members")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
