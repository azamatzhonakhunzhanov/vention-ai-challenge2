import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Calendar, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { EventCard, type EventCardData } from "@/components/event-card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gather — Find and host community events" },
      { name: "description", content: "Discover meetups, workshops and gatherings near you, or host your own in minutes." },
      { property: "og:title", content: "Gather — Find and host community events" },
      { property: "og:description", content: "Discover meetups, workshops and gatherings near you, or host your own in minutes." },
    ],
  }),
  component: Index,
});

type HostMini = { slug: string; name: string; logo_url: string | null };
type EventRow = Omit<EventCardData, "host" | "going_count"> & {
  host: HostMini | HostMini[] | null;
};

function Index() {
  const [featured, setFeatured] = useState<EventCardData[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("events")
        .select(`id, slug, title, starts_at, ends_at, cover_image_url, venue_address, online_url,
                 host:hosts ( slug, name, logo_url )`)
        .eq("status", "published")
        .eq("visibility", "public")
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(6);
      if (!active) return;
      const rows = (data ?? []) as unknown as EventRow[];
      setFeatured(rows.map((r) => ({
        ...r,
        host: Array.isArray(r.host) ? (r.host[0] ?? null) : r.host,
      })));
    })();
    return () => { active = false; };
  }, []);

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 md:pb-24 md:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              ✨ Where communities come together
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">
              Find and host{" "}
              <span className="bg-gradient-to-r from-primary to-[oklch(0.65_0.2_310)] bg-clip-text text-transparent">
                community events
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Discover meetups, workshops, and gatherings near you — or host your
              own in minutes. Simple, beautiful, and free.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-11 px-6">
                <Link to="/explore">
                  Explore events <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-6">
                <Link to="/host/new">Host an event</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured events */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Upcoming events</h2>
            <p className="mt-1 text-sm text-muted-foreground">Hand-picked gatherings happening soon.</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/explore">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {featured === null ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-lg border">
                <div className="aspect-[16/9] animate-pulse bg-muted" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No upcoming events yet — be the first to host one.
            </p>
            <Button asChild className="mt-4">
              <Link to="/host/new">Host an event</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((ev) => <EventCard key={ev.id} event={ev} />)}
          </div>
        )}
      </section>

      {/* Feature highlights */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Calendar, title: "Plan in minutes", body: "Create a beautiful event page with everything attendees need." },
            { icon: Users, title: "Grow your community", body: "Manage RSVPs, guest lists, and updates from one dashboard." },
            { icon: MapPin, title: "Discover locally", body: "Browse curated events happening in your neighborhood." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
