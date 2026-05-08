import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { useState } from "react";

export function GoogleSignInButton({ returnTo }: { returnTo?: string }) {
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const redirect = returnTo ? `${origin}${returnTo}` : origin;
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: redirect,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Could not sign in with Google");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      // Tokens received and session set
      window.location.href = redirect;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign in with Google");
      setLoading(false);
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={onClick}
      disabled={loading}
    >
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1A6.2 6.2 0 1 1 12 5.8c1.7 0 3 .7 3.7 1.3l2.5-2.4C16.7 3.2 14.5 2.2 12 2.2 6.5 2.2 2 6.7 2 12.2s4.5 10 10 10c5.8 0 9.6-4 9.6-9.8 0-.7-.1-1.2-.2-1.8H12z"/>
      </svg>
      {loading ? "Connecting…" : "Continue with Google"}
    </Button>
  );
}

export function AuthDivider() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
      </div>
    </div>
  );
}
