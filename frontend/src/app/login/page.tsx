"use client";

import { useState, useEffect, useContext, FormEvent } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
    const auth = useContext(AuthContext);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    if (!auth) {
        throw new Error("AuthContext is not available");
    }

    const { login } = auth;
    useEffect(() => {
        if (!auth?.loading && auth?.token) {
            router.replace("/");
        }
    }, [auth, router]);
    async function handleLogin(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const form = e.currentTarget;
        const email = (form.elements.namedItem("email") as HTMLInputElement).value;
        const password = (form.elements.namedItem("password") as HTMLInputElement).value;

        try {
            const res = await fetch(`http://localhost:5000/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data: { token?: string; error?: string } = await res.json();

            if (res.ok && data.token) {
                login(data.token);
            } else {
                setError(data.error || "Login failed");
            }
        } catch (err) {
            console.error("Login error:", err);
            setError("Something went wrong. Please try again.");
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
            <Card className="w-full max-w-md p-8 shadow-lg">
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-bold tracking-tight">
                        Welcome back
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Sign in to continue to your automation dashboard
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && (
                        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full">
                        Sign in
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?
                    <a
                        href="/register"
                        className="ml-1 font-medium text-primary hover:underline"
                    >
                        Create one
                    </a>
                </div>
            </Card>
        </div>
    );
}
