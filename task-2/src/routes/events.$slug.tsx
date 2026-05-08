import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Calendar, Clock, MapPin, Globe, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Ticket, type TicketRsvp } from "@/components/ticket";
import { FeedbackSection } from "@/components/feedback-section";
import { GallerySection } from "@/components/gallery-section";
import { ReportDialog } from "@/components/report-dialog";

type EventDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  venue_address: string | null;
  online_url: string | null;
  capacity: number;
  cover_image_url: string | null;
  visibility: "public" | "unlisted";
  status: "draft" | "published";
  host: { id: string; slug: string; name: string; logo_url: string | null; contact_email: string | null } | null;
};

export const Route = createFileRoute("/events/$slug")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("events")
      .select(`
        id, slug, title, description, starts_at, ends_at, time_zone,
        venue_address, online_url, capacity, cover_image_url, visibility, status,
        host:hosts ( id, slug, name, logo_url, contact_email )
      `)
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.status !== "published") throw notFound();
    return { event: data as unknown as EventDetail };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Event — Gather" }] };
    const { event } = loaderData;
    const desc = (event.description ?? "").slice(0, 160) || `${event.title} — find this event on Gather.`;
    const title = `${event.title} — Gather`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(event.cover_image_url ? [{ property: "og:image", content: event.cover_image_url }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        ...(event.cover_image_url ? [{ name: "twitter:image", content: event.cover_image_url }] : []),
      ],
    };
  },
  notFoundComponent: () => (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Event not found</h1>
      <p className="mt-2 text-muted-foreground">This event doesn't exist or has been unpublished.</p>
      <Button asChild className="mt-6"><Link to="/explore">Browse events</Link></Button>
    </section>
  ),
  errorComponent: ({ error }) => (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
    </section>
  ),
  component: EventPage,
});

function EventPage() {
  const { event } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [goingCount, setGoingCount] = useState(0);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [myRsvp, setMyRsvp] = useState<TicketRsvp | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refreshCounts = useCallback(async () => {
    const [going, waitlist] = await Promise.all([
      supabase.from("rsvps").select("*", { count: "exact", head: true })
        .eq("event_id", event.id).eq("status", "going"),
      supabase.from("rsvps").select("*", { count: "exact", head: true })
        .eq("event_id", event.id).eq("status", "waitlisted"),
    ]);
    setGoingCount(going.count ?? 0);
    setWaitlistCount(waitlist.count ?? 0);
  }, [event.id]);

  const refreshMyRsvp = useCallback(async () => {
    if (!user) { setMyRsvp(null); return; }
    const { data } = await supabase
      .from("rsvps")
      .select("id, ticket_code, status, waitlist_position, promoted_from_waitlist_at")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .in("status", ["going", "waitlisted"])
      .maybeSingle();
    setMyRsvp((data as TicketRsvp | null) ?? null);
  }, [event.id, user]);

  useEffect(() => { refreshCounts(); }, [refreshCounts]);
  useEffect(() => { refreshMyRsvp(); }, [refreshMyRsvp]);

  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const ended = end.getTime() < Date.now();
  const spotsLeft = Math.max(0, event.capacity - goingCount);
  const isWaitlistOnly = spotsLeft === 0;

  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", timeZone: event.time_zone, timeZoneName: "short",
    }).format(d);

  const onRsvp = async () => {
    if (!user) {
      navigate({ to: "/signin", search: { returnTo: `/events/${slug}` } });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("rsvp_to_event", { p_event_id: event.id });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const r = data as unknown as TicketRsvp;
    setMyRsvp(r);
    await refreshCounts();
    toast.success(r.status === "going" ? "You're going!" : `You're #${r.waitlist_position} on the waitlist`);
  };

  const onCancel = async () => {
    if (!myRsvp) return;
    const { error } = await supabase
      .from("rsvps")
      .update({ status: "cancelled", waitlist_position: null })
      .eq("id", myRsvp.id);
    if (error) { toast.error(error.message); return; }
    toast.success("RSVP cancelled");
    setMyRsvp(null);
    await refreshCounts();
  };

  return (
    <article className="mx-auto max-w-4xl px-4 py-8">
      {/* Cover */}
      <div className="relative overflow-hidden rounded-2xl bg-muted">
        <div className="aspect-[16/7] w-full">
          {event.cover_image_url ? (
            <img src={event.cover_image_url} alt={event.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Calendar className="h-10 w-10" />
            </div>
          )}
        </div>
        {ended && (
          <Badge variant="secondary" className="absolute left-4 top-4 text-sm">Ended</Badge>
        )}
        {event.visibility === "unlisted" && !ended && (
          <Badge variant="outline" className="absolute right-4 top-4 bg-background/90">Unlisted</Badge>
        )}
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
        {/* Main */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{event.title}</h1>

          {event.host && (
            <Link
              to="/hosts/$slug"
              params={{ slug: event.host.slug }}
              className="mt-4 inline-flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border bg-muted">
                {event.host.logo_url ? (
                  <img src={event.host.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">
                    {event.host.name.slice(0, 1)}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hosted by</p>
                <p className="text-sm font-medium">{event.host.name}</p>
              </div>
            </Link>
          )}

          {event.description && (
            <div className="prose prose-sm mt-8 max-w-none dark:prose-invert">
              <ReactMarkdown>{event.description}</ReactMarkdown>
            </div>
          )}

          <div className="mt-12 space-y-10">
            <GallerySection
              eventId={event.id}
              ended={ended}
              userIsGoing={myRsvp?.status === "going"}
            />
            {ended && (
              <FeedbackSection
                eventId={event.id}
                ended={ended}
                userIsGoing={myRsvp?.status === "going"}
              />
            )}
          </div>

          {user && (
            <div className="mt-10 flex justify-end">
              <ReportDialog targetType="event" targetId={event.id} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex gap-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium">{fmtDate(start)}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" /> Ends {fmtDate(end)}
                  </p>
                </div>
              </div>

              {event.online_url ? (
                <div className="flex gap-3">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">Online event</p>
                    {user ? (
                      <a href={event.online_url} target="_blank" rel="noreferrer"
                         className="break-all text-primary hover:underline">
                        {event.online_url}
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">Link revealed after RSVP</p>
                    )}
                  </div>
                </div>
              ) : event.venue_address ? (
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm">{event.venue_address}</p>
                </div>
              ) : null}

              <div className="flex gap-3">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-medium">{goingCount} going</p>
                  <p className="text-xs text-muted-foreground">
                    {ended
                      ? `${event.capacity} capacity`
                      : isWaitlistOnly
                        ? `Waitlist only · ${waitlistCount} on waitlist`
                        : `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left`}
                  </p>
                </div>
              </div>

              {!ended && !myRsvp && (
                <Button className="w-full" size="lg" onClick={onRsvp} disabled={submitting}>
                  {submitting ? "Saving…" : isWaitlistOnly ? "Join waitlist" : "RSVP"}
                </Button>
              )}
            </CardContent>
          </Card>

          {myRsvp && (
            <Ticket
              event={event}
              rsvp={myRsvp}
              attendeeName={user?.user_metadata?.full_name ?? user?.email ?? null}
              onCancel={onCancel}
            />
          )}
        </aside>
      </div>
    </article>
  );
}
