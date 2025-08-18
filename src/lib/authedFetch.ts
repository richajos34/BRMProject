// src/lib/authedFetch.ts
"use client";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export async function authedFetch(input: RequestInfo, init: RequestInit = {}) {
  const supabase = supabaseBrowser();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not signed in");
  }

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${session.access_token}`);

  return fetch(input, { ...init, headers });
}
