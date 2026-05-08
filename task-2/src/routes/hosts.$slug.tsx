import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, MapPin, Calendar, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Host = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  logo_url: string | null;
  contact_email: string;
};

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  venue_address: string | null;
  cover_image_url: string | null;
};

export const Route = createFileRoute("/hosts/$slug")({
  loader: async ({ params }) => {
    const { data: host, error } = await supabase
      .from("hosts")
      .select("id, slug, name, bio, logo_url, contact_email")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!host) throw notFound();
    return { host: host as Host };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Host — Gather" }] };
    const { host } = loaderData;
    const desc = host.bio?.slice(0, 160) ?? `${host.name} on Gather — community events and gatherings.`;
    const title = `${host.name} — Gather`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(host.logo_url ? [{ property: "og:image", content: host.logo_url }] : []),
      ],
    };
  },
  notFoundComponent: () => (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Host not found</h1>
      <p className="mt-2 text-muted-foreground">This host page doesn't exist or has been removed.</p>
      <Button asChild className="mt-6"><Link to="/explore">Explore events</Link></Button>
    </section>
  ),
  errorComponent: ({ error }) => (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
    </section>
  ),
  component: HostPage,
});

function HostPage() {
  const { host } = Route.useLoaderData();
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id, slug, title, description, starts_at, ends_at, venue_address, cover_image_url")
        .eq("host_id", host.id)
        .eq("status", "published")
        .eq("visibility", "public")
        .order("starts_at", { ascending: true });
      if (active) {
        setEvents((data ?? []) as EventRow[]);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [host.id]);

  useEffect(() => {
    if (!user) { setIsMember(false); return; }
    let active = true;
    supabase
      .from("host_members")
      .select("host_id")
      .eq("host_id", host.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (active) setIsMember(!!data); });
    return () => { active = false; };
  }, [user, host.id]);

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.ends_at).getTime() >= now);
  const past = events.filter((e) => new Date(e.ends_at).getTime() < now);

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {host.logo_url ? (
              <img src={host.logo_url} alt={`${host.name} logo`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">{host.name.slice(0, 1)}</span>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{host.name}</h1>
            {host.bio && <p className="mt-2 max-w-2xl text-muted-foreground">{host.bio}</p>}
            <a
              href={`mailto:${host.contact_email}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" /> {host.contact_email}
            </a>
          </div>
        </div>
        {isMember && (
          <Button asChild variant="outline">
            <Link to="/host/$slug/dashboard" params={{ slug: host.slug }}>
              <Settings className="mr-2 h-4 w-4" /> Manage
            </Link>
          </Button>
        )}
      </header>

      <div className="mt-12 space-y-12">
        <EventSection title="Upcoming events" events={upcoming} loading={loading} emptyMessage="No upcoming events yet." />
        {past.length > 0 && (
          <EventSection title="Past events" events={past} loading={false} emptyMessage="" muted />
        )}
      </div>
    </section>
  );
}

function EventSection({
  title, events, loading, emptyMessage, muted,
}: {
  title: string; events: EventRow[]; loading: boolean; emptyMessage: string; muted?: boolean;
}) {
  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold tracking-tight">{title}</h2>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((e) => <EventCard key={e.id} event={e} muted={muted} />)}
        </div>
      )}
    </div>
  );
}

function EventCard({ event, muted }: { event: EventRow; muted?: boolean }) {
  const start = new Date(event.starts_at);
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
  const timeLabel = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <Link to="/events/$slug" params={{ slug: event.slug }} className="group block">
      <Card className={`overflow-hidden transition-shadow hover:shadow-md ${muted ? "opacity-80" : ""}`}>
        {event.cover_image_url && (
          <div className="aspect-[16/9] overflow-hidden bg-muted">
            <img src={event.cover_image_url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          </div>
        )}
        <CardContent className="p-4">
          <Badge variant="secondary" className="mb-2">
            <Calendar className="mr-1 h-3 w-3" /> {dateLabel} · {timeLabel}
          </Badge>
          <h3 className="font-semibold leading-tight group-hover:text-primary">{event.title}</h3>
          {event.venue_address && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {event.venue_address}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
