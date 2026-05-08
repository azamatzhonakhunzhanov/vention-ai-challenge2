import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2, Link as LinkIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHostAccess } from "@/hooks/use-host-access";

export const Route = createFileRoute("/host/$slug/members")({
  head: () => ({ meta: [{ title: "Team — Gather" }] }),
  component: MembersPage,
});

type Member = {
  user_id: string;
  role: "host" | "checker";
  created_at: string;
  profile: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

type Invite = {
  id: string;
  token: string;
  role: "host" | "checker";
  created_at: string;
  used_at: string | null;
  expires_at: string | null;
};

function MembersPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const access = useHostAccess(slug);

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteRole, setInviteRole] = useState<"host" | "checker">("checker");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/signin", search: { returnTo: `/host/${slug}/members` } });
    }
  }, [authLoading, user, navigate, slug]);

  useEffect(() => {
    if (!access.loading && user && !access.isHost && !access.notFound) {
      toast.error("You don't have permission to manage members.");
      navigate({ to: "/hosts/$slug", params: { slug } });
    }
  }, [access, user, navigate, slug]);

  const refresh = useCallback(async () => {
    if (!access.host) return;
    setLoading(true);
    const [mRes, iRes] = await Promise.all([
      supabase
        .from("host_members")
        .select("user_id, role, created_at, profile:profiles ( id, full_name, avatar_url )")
        .eq("host_id", access.host.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("host_invites")
        .select("id, token, role, created_at, used_at, expires_at")
        .eq("host_id", access.host.id)
        .order("created_at", { ascending: false }),
    ]);
    setMembers((mRes.data ?? []) as unknown as Member[]);
    setInvites((iRes.data ?? []) as unknown as Invite[]);
    setLoading(false);
  }, [access.host]);

  useEffect(() => { refresh(); }, [refresh]);

  const generateInvite = async () => {
    if (!access.host || !user) return;
    setCreating(true);
    const expires = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const { error } = await supabase.from("host_invites").insert({
      host_id: access.host.id,
      role: inviteRole,
      created_by: user.id,
      expires_at: expires,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Invite link created");
    refresh();
  };

  const inviteUrl = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/invite/${token}` : `/invite/${token}`;

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("host_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invite revoked");
    refresh();
  };

  const removeMember = async (memberId: string) => {
    if (!access.host) return;
    if (memberId === user?.id) {
      toast.error("You can't remove yourself");
      return;
    }
    const { error } = await supabase
      .from("host_members")
      .delete()
      .eq("host_id", access.host.id)
      .eq("user_id", memberId);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    refresh();
  };

  const inviteState = (i: Invite): "active" | "used" | "expired" => {
    if (i.used_at) return "used";
    if (i.expires_at && new Date(i.expires_at) < new Date()) return "expired";
    return "active";
  };

  if (authLoading || access.loading) {
    return <section className="mx-auto max-w-3xl px-4 py-16"><div className="h-6 w-40 animate-pulse rounded bg-muted" /></section>;
  }
  if (access.notFound) {
    return <section className="mx-auto max-w-3xl px-4 py-16 text-center"><p>Host not found.</p></section>;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">{access.host?.name}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Team & invites</h1>
          <p className="mt-1 text-sm text-muted-foreground">Add hosts and check-in helpers.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/host/$slug/dashboard" params={{ slug }}>Dashboard</Link>
        </Button>
      </header>

      <Card className="mb-6">
        <CardContent className="space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <LinkIcon className="h-4 w-4" /> Generate invite link
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "host" | "checker")}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checker">Checker (check-in only)</SelectItem>
                  <SelectItem value="host">Host (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateInvite} disabled={creating}>
              {creating ? "Creating…" : "Create link"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Links expire in 7 days and can only be used once.</p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="space-y-3 p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4" /> Current members ({members.length})
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.profile?.full_name || m.user_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">Joined {new Date(m.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.role === "host" ? "default" : "secondary"}>{m.role}</Badge>
                    {m.user_id !== user?.id && (
                      <Button size="icon" variant="ghost" onClick={() => removeMember(m.user_id)} title="Remove">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-base font-semibold">Invite links</h2>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invites yet.</p>
          ) : (
            <ul className="divide-y">
              {invites.map((i) => {
                const state = inviteState(i);
                return (
                  <li key={i.id} className="space-y-2 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={i.role === "host" ? "default" : "secondary"}>{i.role}</Badge>
                        <Badge
                          variant="outline"
                          className={
                            state === "active" ? "border-primary/40 text-primary"
                              : state === "used" ? "text-muted-foreground"
                                : "border-destructive/40 text-destructive"
                          }
                        >
                          {state}
                        </Badge>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => revoke(i.id)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Revoke
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={inviteUrl(i.token)} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                      <Button size="sm" variant="outline" onClick={() => copyLink(i.token)}>
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
