import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GoogleSignInButton, AuthDivider } from "@/components/google-signin-button";

const searchSchema = z.object({
  returnTo: z.string().optional(),
});

export const Route = createFileRoute("/signin")({
  head: () => ({ meta: [{ title: "Sign in — Gather" }] }),
  validateSearch: searchSchema,
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const { returnTo } = useSearch({ from: "/signin" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: returnTo ?? "/" });
  };

  return (
    <section className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to your Gather account.</p>
      <div className="mt-8">
        <GoogleSignInButton returnTo={returnTo} />
        <AuthDivider />
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Gather?{" "}
        <Link
          to="/signup"
          search={returnTo ? { returnTo } : undefined}
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </section>
  );
}
