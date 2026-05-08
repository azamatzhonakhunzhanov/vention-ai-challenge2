import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHostAccess } from "@/hooks/use-host-access";

export const Route = createFileRoute("/host/$slug/events/$eventId/gallery")({
  head: () => ({ meta: [{ title: "Gallery moderation — Gather" }] }),
  component: GalleryModerationPage,
});

type Item = { id: string; image_url: string; status: string; created_at: string; user_id: string };

function GalleryModerationPage() {
  const { slug, eventId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const access = useHostAccess(slug);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/signin", search: { returnTo: `/host/${slug}/events/${eventId}/gallery` } });
    }
  }, [authLoading, user, navigate, slug, eventId]);

  useEffect(() => {
    if (!access.loading && user && !access.isHost) {
      toast.error("Only hosts can moderate the gallery.");
      navigate({ to: "/host/$slug/dashboard", params: { slug } });
    }
  }, [access, user, navigate, slug]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("gallery_items")
      .select("id, image_url, status, created_at, user_id")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Item[]);
    setLoading(false);
  }, [eventId]);

  useEffect(() => { if (access.isHost) void load(); }, [access.isHost, load]);

  const setStatus = async (id: string, status: "approved" | "hidden") => {
    const { error } = await supabase.from("gallery_items").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved" : "Hidden");
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
  };

  if (authLoading || access.loading) {
    return <section className="mx-auto max-w-4xl px-4 py-16"><div className="h-6 w-40 animate-pulse rounded bg-muted" /></section>;
  }

  const pending = items.filter((i) => i.status === "pending");
  const approved = items.filter((i) => i.status === "approved");
  const hidden = items.filter((i) => i.status === "hidden");

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/host/$slug/dashboard" params={{ slug }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
      </div>
      <header className="mb-6">
        <p className="text-sm font-medium text-primary">{access.host?.name}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Gallery moderation</h1>
      </header>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="hidden">Hidden ({hidden.length})</TabsTrigger>
        </TabsList>
        {[
          { val: "pending", arr: pending },
          { val: "approved", arr: approved },
          { val: "hidden", arr: hidden },
        ].map(({ val, arr }) => (
          <TabsContent key={val} value={val} className="mt-6">
            {loading ? (
              <div className="h-40 animate-pulse rounded bg-muted" />
            ) : arr.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
                  <ImageIcon className="h-6 w-6" /> Nothing here.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {arr.map((it) => (
                  <Card key={it.id} className="overflow-hidden">
                    <div className="aspect-square w-full bg-muted">
                      <img src={it.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <CardContent className="space-y-2 p-3">
                      <Badge variant={it.status === "approved" ? "default" : it.status === "hidden" ? "destructive" : "secondary"}>{it.status}</Badge>
                      <div className="flex gap-1">
                        {it.status !== "approved" && (
                          <Button size="sm" className="flex-1" onClick={() => setStatus(it.id, "approved")}>
                            <Check className="mr-1 h-3.5 w-3.5" /> Approve
                          </Button>
                        )}
                        {it.status !== "hidden" && (
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => setStatus(it.id, "hidden")}>
                            <X className="mr-1 h-3.5 w-3.5" /> {it.status === "approved" ? "Hide" : "Reject"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
