"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser();

    // This parses the URL hash (?/#access_token=...) and stores the session.
    // detectSessionInUrl is true by default in supabase-js, but calling
    // getSession() ensures the client initializes and we can then redirect.
    supabase.auth.getSession().finally(() => {
      router.replace("/dashboard");
    });
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}