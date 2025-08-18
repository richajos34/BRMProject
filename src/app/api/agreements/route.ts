import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  console.log("Fetching agreements for user:", userId);
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("agreements")
    .select("*")
    .eq("user_id", userId)           // <-- filter by user
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agreements: data });
}
