"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const supabase = supabaseBrowser();

  async function onSignOut() {
    await supabase.auth.signOut();
    router.replace("/signin");
  }

  return (
    <Button variant="outline" className={className} onClick={onSignOut}>
      Sign out
    </Button>
  );
}
