/**
 * SignInPage.tsx
 *
 * Client-side page for user authentication.
 * Provides sign-in via Google OAuth or email/password using Supabase.
 */

"use client";

import { useState, useTransition } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function SignUpPage() {
  const supabase = supabaseBrowser();

  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const redirectTo = typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : undefined;

  /**
   * Handle email/password sign-up with Supabase.
   * @param e - Form submit event (prevents default behavior).
   */
  async function signUpWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    startTransition(async () => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      setInfo("Check your email to confirm your account.");
    });
  }
  /**
   * Handle Google OAuth sign-up with Supabase.
   */
  async function signUpWithGoogle() {
    setError(null);
    setInfo(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) setError(error.message);
  }

  return (
    <Card className="bg-background border">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign up with Google or your email and password.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={signUpWithGoogle}
          disabled={pending}
        >
          Continue with Google
        </Button>

        <div className="relative">
          <Separator />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="px-2 bg-background text-xs text-muted-foreground">
              OR
            </span>
          </div>
        </div>

        <form className="space-y-4" onSubmit={signUpWithEmail}>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ada Lovelace"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </form>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="text-sm text-muted-foreground" role="status">
            {info}
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/signin" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
