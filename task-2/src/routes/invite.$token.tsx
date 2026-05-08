import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type InviteData = {
  found: boolean;
  state?: "active" | "used" | "expired";
  role?: "host" | "checker";
  host?: { id: string; slug: string; name: string; logo_url: string | null };
};

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Accept invite — Gather" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_invite_by_token", { p_token: token });
      if (error) { toast.error(error.message); return; }
      setInvite(data as unknown as InviteData);
    })();
  }, [token]);

  const onAccept = async () => {
    if (!user) {
      navigate({ to: "/signin", search: { returnTo: `/invite/${token}` } });
      return;
    }
    setAccepting(true);
    const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
    setAccepting(false);
    if (error) return toast.error(error.message);
    const result = data as unknown as { host_slug: string; role: "host" | "checker" };
    toast.success("You're in!");
    if (result.role === "host") {
      navigate({ to: "/host/$slug/dashboard", params: { slug: result.host_slug } });
    } else {
      navigate({ to: "/my-events" });
    }
  };

  if (!invite || authLoading) {
    return <section className="mx-auto max-w-md px-4 py-24 text-center"><div className="h-6 w-40 mx-auto animate-pulse rounded bg-muted" /></section>;
  }

  if (!invite.found) {
    return (
      <section className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Invite not found</h1>
        <p className="mt-2 text-muted-foreground">Double-check the link, or ask for a new one.</p>
        <Button asChild className="mt-6"><Link to="/">Go home</Link></Button>
      </section>
    );
  }

  if (invite.state !== "active") {
    return (
      <section className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">
          {invite.state === "used" ? "Invite already used" : "Invite expired"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {invite.state === "used"
            ? "This invite link has already been claimed."
            : "Ask the host for a fresh link."}
        </p>
        <Button asChild className="mt-6"><Link to="/">Go home</Link></Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md px-4 py-20">
      <Card>
        <CardContent className="space-y-5 p-8 text-center">
          {invite.host?.logo_url ? (
            <img src={invite.host.logo_url} alt="" className="mx-auto h-16 w-16 rounded-lg border object-cover" />
          ) : (
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg border bg-muted text-2xl font-bold">
              {invite.host?.name?.slice(0, 1)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">You've been invited</h1>
            <p className="mt-2 text-muted-foreground">
              Join <span className="font-semibold text-foreground">{invite.host?.name}</span> as a{" "}
              <span className="font-semibold capitalize text-foreground">{invite.role}</span>.
            </p>
          </div>
          {user ? (
            <Button className="w-full" size="lg" onClick={onAccept} disabled={accepting}>
              {accepting ? "Accepting…" : "Accept invite"}
            </Button>
          ) : (
            <Button asChild className="w-full" size="lg">
              <Link to="/signin" search={{ returnTo: `/invite/${token}` }}>Sign in to accept</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
