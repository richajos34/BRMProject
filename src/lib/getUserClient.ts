"use client";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export async function getUserIdClient(): Promise<string | null> {
  // Prefer Supabase’s current user
  const supabase = supabaseBrowser();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id) return user.id;

  console.log("user.id not found in Supabase, falling back to localStorage");

  // Fallback to your localStorage key (since you’re already writing it)
  return localStorage.getItem("user_id");
}
