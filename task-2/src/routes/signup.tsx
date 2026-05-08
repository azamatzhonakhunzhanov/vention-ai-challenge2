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

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — Gather" }] }),
  validateSearch: searchSchema,
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const { returnTo } = useSearch({ from: "/signup" });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      toast.success("Account created!");
      navigate({ to: returnTo ?? "/" });
    } else {
      toast.success("Check your inbox to confirm your email.");
      navigate({ to: "/signin", search: returnTo ? { returnTo } : {} });
    }
  };

  return (
    <section className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">Join Gather to host and attend events.</p>
      <div className="mt-8">
        <GoogleSignInButton returnTo={returnTo} />
        <AuthDivider />
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/signin"
          search={returnTo ? { returnTo } : undefined}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </section>
  );
}
