// src/lib/authedFetch.ts
"use client";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { getUserIdClient } from "@/lib/getUserClient";

export async function authedFetch(input: RequestInfo, init: RequestInit = {}) {
    const uid = await getUserIdClient();
    return fetch(input.toString(), {
      ...init,
      headers: {
        ...(init.headers || {}),
        "x-user-id": uid || "",    // <- this is the important bit
      },
      cache: "no-store",
    });
  }
