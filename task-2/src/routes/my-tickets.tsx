import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, MapPin, Globe, Ticket as TicketIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { PromotedBanner } from "@/components/promoted-banner";
import { useAuth } from "@/hooks/use-auth";

type MyRsvp = {
  id: string;
  status: "going" | "waitlisted";
  waitlist_position: number | null;
  ticket_code: string;
  promoted_from_waitlist_at: string | null;
  event: {
    id: string;
    slug: string;
    title: string;
    starts_at: string;
    ends_at: string;
    time_zone: string;
    cover_image_url: string | null;
    venue_address: string | null;
    online_url: string | null;
  } | null;
};

export const Route = createFileRoute("/my-tickets")({
  head: () => ({ meta: [{ title: "My Tickets — Gather" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/signin", search: { returnTo: "/my-tickets" } });
    }
  },
  component: MyTicketsPage,
});

function MyTicketsPage() {
  const { user } = useAuth();
  const [rsvps, setRsvps] = useState<MyRsvp[] | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("rsvps")
        .select(`
          id, status, waitlist_position, ticket_code, promoted_from_waitlist_at,
          event:events!inner ( id, slug, title, starts_at, ends_at, time_zone,
            cover_image_url, venue_address, online_url )
        `)
        .eq("user_id", user.id)
        .in("status", ["going", "waitlisted"])
        .gt("event.ends_at", nowIso)
        .order("starts_at", { foreignTable: "events", ascending: true });
      if (error) {
        console.error(error);
        setRsvps([]);
        return;
      }
      setRsvps((data ?? []) as unknown as MyRsvp[]);
    })();
  }, [user]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wider text-primary">My Tickets</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Your upcoming events</h1>
      </header>

      {rsvps === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : rsvps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <TicketIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No upcoming tickets yet.</p>
            <Button asChild><Link to="/explore">Browse events</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rsvps.map((r) => r.event && (
            <Card key={r.id} className="overflow-hidden">
              <div className="aspect-[16/8] w-full bg-muted">
                {r.event.cover_image_url ? (
                  <img src={r.event.cover_image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Calendar className="h-8 w-8" />
                  </div>
                )}
              </div>
              <CardContent className="space-y-3 p-5">
                <PromotedBanner rsvpId={r.id} promotedAt={r.promoted_from_waitlist_at} />
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 font-semibold">{r.event.title}</h3>
                  <Badge variant={r.status === "waitlisted" ? "secondary" : "default"}>
                    {r.status === "waitlisted" ? `Waitlist #${r.waitlist_position ?? "—"}` : "Going"}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Intl.DateTimeFormat(undefined, {
                      weekday: "short", month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit",
                      timeZone: r.event.time_zone,
                    }).format(new Date(r.event.starts_at))}
                  </div>
                  {r.event.venue_address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="line-clamp-1">{r.event.venue_address}</span>
                    </div>
                  )}
                  {r.event.online_url && !r.event.venue_address && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" /> Online
                    </div>
                  )}
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/events/$slug" params={{ slug: r.event.slug }}>View ticket</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
