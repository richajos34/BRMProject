"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/**
 * SignInPage Component
 *
 * Renders the sign-in page for the application, supporting authentication
 * via email/password and Google OAuth. This component uses Supabase for
 * authentication and integrates with Next.js router to redirect after
 * successful login.
 *
 * Features:
 * - Email/password sign-in
 * - Google OAuth sign-in
 * - Inline error handling and display
 * - Redirection to the next page (default `/`) after successful login
 */

export default function SignInPage() {
    const router = useRouter();
    const params = useSearchParams();
    const supabase = supabaseBrowser();

    const [pending, startTransition] = useTransition();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState<string | null>(null);

    const next = params.get("next") || "/";
    
    /**
     * Handles sign-in using email and password credentials.
     *
     * @param {React.FormEvent} e - The form submission event.
     */
    async function signInWithEmail(e: React.FormEvent) {
        console.log("Signing in with email:", email);
        e.preventDefault();
        setError(null);

        startTransition(async () => {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
                return;
            }

            console.log("Sign in successful:", data);

            router.replace(next);
        });
    }

    /**
     * Handles sign-in using Google OAuth.
     */
    async function signInWithGoogle() {
        setError(null);
        console.log("Signing in with Google...");

        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback?next=/api/whoami`,
                queryParams: { prompt: "consent" },
            },
        });

        if (error) setError(error);
    }

    return (
        <Card className="bg-background border">
            <CardHeader className="space-y-2">
                <CardTitle className="text-2xl">Welcome back</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Sign in with Google or your email and password.
                </p>
            </CardHeader>

            <CardContent className="space-y-6">
                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={signInWithGoogle}
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

                <form className="space-y-4" onSubmit={signInWithEmail}>
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
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <Button type="submit" className="w-full" disabled={pending}>
                        {pending ? "Signing in…" : "Sign in"}
                    </Button>
                </form>

                {error && (
                    <p className="text-sm text-destructive" role="alert">
                        {error}
                    </p>
                )}

                <div className="text-sm text-muted-foreground flex items-center justify-between">
                    <a href="/signup" className="text-primary underline-offset-4 hover:underline">
                        Create an account
                    </a>
                    <a href="/reset-password" className="underline-offset-4 hover:underline">
                        Forgot password?
                    </a>
                </div>
            </CardContent>
        </Card>
    );
}
