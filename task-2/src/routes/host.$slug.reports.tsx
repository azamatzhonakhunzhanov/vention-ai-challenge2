import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, EyeOff, X, Flag, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHostAccess } from "@/hooks/use-host-access";

export const Route = createFileRoute("/host/$slug/reports")({
  head: () => ({ meta: [{ title: "Reports — Gather" }] }),
  component: ReportsPage,
});

type Report = {
  id: string;
  target_type: "event" | "photo";
  target_id: string;
  reason: string | null;
  status: "open" | "dismissed" | "actioned";
  created_at: string;
};

type Enriched = Report & {
  preview?: { title?: string; image_url?: string; slug?: string };
};

function ReportsPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const access = useHostAccess(slug);
  const [reports, setReports] = useState<Enriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"open" | "all">("open");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/signin", search: { returnTo: `/host/${slug}/reports` } });
    }
  }, [authLoading, user, navigate, slug]);

  useEffect(() => {
    if (!access.loading && user && !access.isHost) {
      toast.error("Only hosts can view reports.");
      navigate({ to: "/host/$slug/dashboard", params: { slug } });
    }
  }, [access, user, navigate, slug]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("reports")
      .select("id, target_type, target_id, reason, status, created_at")
      .order("created_at", { ascending: false });
    const list = (rows ?? []) as Report[];
    // Fetch previews
    const eventIds = list.filter((r) => r.target_type === "event").map((r) => r.target_id);
    const photoIds = list.filter((r) => r.target_type === "photo").map((r) => r.target_id);
    const [eventsRes, photosRes] = await Promise.all([
      eventIds.length
        ? supabase.from("events").select("id, title, slug, host_id").in("id", eventIds)
        : Promise.resolve({ data: [] as { id: string; title: string; slug: string; host_id: string }[] }),
      photoIds.length
        ? supabase.from("gallery_items").select("id, image_url, event_id, events:events!inner(host_id)").in("id", photoIds)
        : Promise.resolve({ data: [] as { id: string; image_url: string; event_id: string; events: { host_id: string } }[] }),
    ]);
    const eventsMap = new Map((eventsRes.data ?? []).map((e) => [e.id, e]));
    const photosMap = new Map(((photosRes.data ?? []) as unknown as { id: string; image_url: string; event_id: string; events: { host_id: string } }[]).map((p) => [p.id, p]));

    const enriched: Enriched[] = [];
    for (const r of list) {
      if (r.target_type === "event") {
        const e = eventsMap.get(r.target_id);
        if (!e || e.host_id !== access.host?.id) continue;
        enriched.push({ ...r, preview: { title: e.title, slug: e.slug } });
      } else {
        const p = photosMap.get(r.target_id);
        if (!p || p.events?.host_id !== access.host?.id) continue;
        enriched.push({ ...r, preview: { image_url: p.image_url } });
      }
    }
    setReports(enriched);
    setLoading(false);
  }, [access.host?.id]);

  useEffect(() => { if (access.isHost && access.host) void load(); }, [access.isHost, access.host, load]);

  const onHide = async (r: Enriched) => {
    if (r.target_type === "event") {
      const { error } = await supabase.from("events").update({ status: "draft" }).eq("id", r.target_id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("gallery_items").update({ status: "hidden" }).eq("id", r.target_id);
      if (error) return toast.error(error.message);
    }
    const { error: rErr } = await supabase.from("reports").update({ status: "actioned" }).eq("id", r.id);
    if (rErr) return toast.error(rErr.message);
    toast.success(r.target_type === "event" ? "Event unpublished" : "Photo hidden");
    void load();
  };

  const onDismiss = async (r: Enriched) => {
    const { error } = await supabase.from("reports").update({ status: "dismissed" }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Dismissed");
    void load();
  };

  if (authLoading || access.loading) {
    return <section className="mx-auto max-w-3xl px-4 py-16"><div className="h-6 w-40 animate-pulse rounded bg-muted" /></section>;
  }

  const visible = tab === "open" ? reports.filter((r) => r.status === "open") : reports;

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/host/$slug/dashboard" params={{ slug }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
      </div>
      <header className="mb-6">
        <p className="text-sm font-medium text-primary">{access.host?.name}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Reported events and photos for your hosted events.</p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "open" | "all")}>
        <TabsList>
          <TabsTrigger value="open">Open ({reports.filter((r) => r.status === "open").length})</TabsTrigger>
          <TabsTrigger value="all">All ({reports.length})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-6">
          {loading ? (
            <div className="h-32 animate-pulse rounded bg-muted" />
          ) : visible.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
                <Flag className="h-6 w-6" /> No reports here.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {visible.map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                      {r.target_type === "photo" && r.preview?.image_url ? (
                        <img src={r.preview.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          {r.target_type === "photo" ? <ImageIcon className="h-5 w-5" /> : <Flag className="h-5 w-5" />}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{r.target_type}</Badge>
                        <Badge variant={r.status === "open" ? "destructive" : "secondary"}>{r.status}</Badge>
                        {r.target_type === "event" && r.preview?.slug && (
                          <Link
                            to="/events/$slug"
                            params={{ slug: r.preview.slug }}
                            className="text-sm font-medium hover:underline truncate"
                          >
                            {r.preview.title}
                          </Link>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{r.reason || "(no reason given)"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    {r.status === "open" && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => onDismiss(r)}>
                          <X className="mr-1 h-3.5 w-3.5" /> Dismiss
                        </Button>
                        <Button size="sm" onClick={() => onHide(r)}>
                          <EyeOff className="mr-1 h-3.5 w-3.5" /> Hide
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
