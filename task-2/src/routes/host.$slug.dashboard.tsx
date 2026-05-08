import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Calendar as CalendarIcon, ExternalLink, Pencil, Copy, EyeOff, Download, Image as ImageIcon, ScanLine, MoreHorizontal } from "lucide-react";
import { toCsv, downloadCsv, isoDate } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHostAccess } from "@/hooks/use-host-access";
import { slugify } from "@/lib/slug";

export const Route = createFileRoute("/host/$slug/dashboard")({
  head: () => ({ meta: [{ title: "Host dashboard — Gather" }] }),
  component: HostDashboard,
});

type EventRow = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  cover_image_url: string | null;
  status: "draft" | "published";
  visibility: "public" | "unlisted";
  host_id: string;
  description: string | null;
  time_zone: string;
  venue_address: string | null;
  online_url: string | null;
  capacity: number;
  is_paid: boolean;
};

type RsvpAgg = { going: number; waitlisted: number; checked_in: number };

function HostDashboard() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const access = useHostAccess(slug);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [aggs, setAggs] = useState<Record<string, RsvpAgg>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/signin", search: { returnTo: `/host/${slug}/dashboard` } });
    }
  }, [authLoading, user, navigate, slug]);

  useEffect(() => {
    if (!access.loading && user && !access.isHost && !access.notFound) {
      toast.error("You don't have permission to manage this host.");
      navigate({ to: "/hosts/$slug", params: { slug } });
    }
  }, [access, user, navigate, slug]);

  const loadEvents = async () => {
    if (!access.host) return;
    setLoading(true);
    const { data } = await supabase
      .from("events")
      .select("id, slug, title, starts_at, ends_at, cover_image_url, status, visibility, host_id, description, time_zone, venue_address, online_url, capacity, is_paid")
      .eq("host_id", access.host.id)
      .order("starts_at", { ascending: false });
    const rows = (data ?? []) as EventRow[];
    setEvents(rows);

    if (rows.length) {
      const ids = rows.map((e) => e.id);
      const { data: rsvps } = await supabase
        .from("rsvps")
        .select("event_id, status, checked_in_at")
        .in("event_id", ids);
      const map: Record<string, RsvpAgg> = {};
      for (const id of ids) map[id] = { going: 0, waitlisted: 0, checked_in: 0 };
      for (const r of rsvps ?? []) {
        const a = map[r.event_id];
        if (!a) continue;
        if (r.status === "going") a.going++;
        else if (r.status === "waitlisted") a.waitlisted++;
        if (r.checked_in_at) a.checked_in++;
      }
      setAggs(map);
    } else {
      setAggs({});
    }
    setLoading(false);
  };

  useEffect(() => { void loadEvents(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [access.host?.id]);

  const now = Date.now();
  const upcoming = useMemo(
    () => events.filter((e) => new Date(e.ends_at).getTime() >= now).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    [events, now],
  );
  const past = useMemo(
    () => events.filter((e) => new Date(e.ends_at).getTime() < now),
    [events, now],
  );

  const onUnpublish = async (id: string) => {
    const { error } = await supabase.from("events").update({ status: "draft" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Event unpublished");
    void loadEvents();
  };

  const onDuplicate = async (ev: EventRow) => {
    const newTitle = `${ev.title} (Copy)`;
    let newSlug = slugify(newTitle);
    for (let i = 0; i < 10; i++) {
      const { data: existing } = await supabase.from("events").select("id").eq("slug", newSlug).maybeSingle();
      if (!existing) break;
      newSlug = `${slugify(newTitle)}-${Math.random().toString(36).slice(2, 6)}`;
    }
    const { error } = await supabase.from("events").insert({
      host_id: ev.host_id,
      slug: newSlug,
      title: newTitle,
      description: ev.description,
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      time_zone: ev.time_zone,
      venue_address: ev.venue_address,
      online_url: ev.online_url,
      capacity: ev.capacity,
      cover_image_url: ev.cover_image_url,
      visibility: ev.visibility,
      status: "draft",
      is_paid: ev.is_paid,
    });
    if (error) return toast.error(error.message);
    toast.success("Duplicated as draft");
    void loadEvents();
  };

  const onExportCsv = async (ev: EventRow) => {
    const { data, error } = await supabase.rpc("export_event_attendees", { p_event_id: ev.id });
    if (error) return toast.error(error.message);
    const rows = (data ?? []).map((r) => ({
      name: r.name ?? "",
      email: r.email ?? "",
      rsvp_status: r.rsvp_status ?? "",
      check_in_time: r.check_in_time ? new Date(r.check_in_time).toISOString() : "",
    }));
    const csv = toCsv(rows, ["name", "email", "rsvp_status", "check_in_time"]);
    downloadCsv(`${ev.slug}-attendees-${isoDate()}.csv`, csv);
  };

  if (authLoading || access.loading) {
    return <section className="mx-auto max-w-5xl px-4 py-16"><div className="h-6 w-40 animate-pulse rounded bg-muted" /></section>;
  }
  if (access.notFound) {
    return <section className="mx-auto max-w-2xl px-4 py-24 text-center"><h1 className="text-2xl font-bold">Host not found</h1></section>;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">{access.host?.name}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your events, drafts and attendees.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/host/$slug/reports" params={{ slug }}>Reports</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/host/$slug/members" params={{ slug }}>Team</Link>
          </Button>
          <Button asChild>
            <Link to="/host/$slug/events/new" params={{ slug }}>
              <Plus className="mr-2 h-4 w-4" /> New event
            </Link>
          </Button>
        </div>
      </header>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-6">
          <EventList
            loading={loading}
            events={upcoming}
            aggs={aggs}
            isPast={false}
            slug={slug}
            onUnpublish={onUnpublish}
            onDuplicate={onDuplicate}
            onExportCsv={onExportCsv}
          />
        </TabsContent>
        <TabsContent value="past" className="mt-6">
          <EventList
            loading={loading}
            events={past}
            aggs={aggs}
            isPast={true}
            slug={slug}
            onUnpublish={onUnpublish}
            onDuplicate={onDuplicate}
            onExportCsv={onExportCsv}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function EventList({
  loading, events, aggs, isPast, slug, onUnpublish, onDuplicate, onExportCsv,
}: {
  loading: boolean;
  events: EventRow[];
  aggs: Record<string, RsvpAgg>;
  isPast: boolean;
  slug: string;
  onUnpublish: (id: string) => void;
  onDuplicate: (ev: EventRow) => void;
  onExportCsv: (ev: EventRow) => void;
}) {
  if (loading) {
    return <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>;
  }
  if (events.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <CalendarIcon className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No events here yet.</p>
        {!isPast && (
          <Button asChild size="sm">
            <Link to="/host/$slug/events/new" params={{ slug }}>
              <Plus className="mr-2 h-4 w-4" /> Create event
            </Link>
          </Button>
        )}
      </Card>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <ul className="divide-y">
        {events.map((ev) => (
          <EventRowItem
            key={ev.id} ev={ev} agg={aggs[ev.id]} isPast={isPast} slug={slug}
            onUnpublish={() => onUnpublish(ev.id)} onDuplicate={() => onDuplicate(ev)}
            onExportCsv={() => onExportCsv(ev)}
          />
        ))}
      </ul>
    </div>
  );
}

function EventRowItem({
  ev, agg, isPast, slug, onUnpublish, onDuplicate, onExportCsv,
}: {
  ev: EventRow; agg?: RsvpAgg; isPast: boolean; slug: string;
  onUnpublish: () => void; onDuplicate: () => void; onExportCsv: () => void;
}) {
  const start = new Date(ev.starts_at);
  const dateLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const timeLabel = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const primaryAction = isPast
    ? { to: "/host/$slug/events/$eventId/gallery" as const, label: "Gallery", Icon: ImageIcon }
    : { to: "/host/$slug/events/$eventId/check-in" as const, label: "Check-in", Icon: ScanLine };

  return (
    <li className="group flex items-center gap-4 p-3 transition-colors hover:bg-accent/40 sm:p-4">
      <div className="hidden h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted sm:block">
        {ev.cover_image_url ? (
          <img src={ev.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to="/events/$slug"
            params={{ slug: ev.slug }}
            className="truncate text-sm font-semibold leading-tight hover:text-primary sm:text-base"
          >
            {ev.title}
          </Link>
          {ev.status === "draft" && <Badge variant="secondary" className="text-[10px]">Draft</Badge>}
          {ev.visibility === "unlisted" && <Badge variant="outline" className="text-[10px]">Unlisted</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{dateLabel} · {timeLabel}</span>
          {agg && (
            <>
              <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/40 sm:inline-block" />
              <span><span className="font-medium text-foreground">{agg.going}</span> going</span>
              {agg.waitlisted > 0 && <span><span className="font-medium text-foreground">{agg.waitlisted}</span> waitlist</span>}
              {agg.checked_in > 0 && <span><span className="font-medium text-foreground">{agg.checked_in}</span> checked-in</span>}
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link to="/host/$slug/events/$eventId/edit" params={{ slug, eventId: ev.id }}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={primaryAction.to} params={{ slug, eventId: ev.id }}>
            <primaryAction.Icon className="mr-1.5 h-3.5 w-3.5" /> {primaryAction.label}
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild className="sm:hidden">
              <Link to="/host/$slug/events/$eventId/edit" params={{ slug, eventId: ev.id }}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/events/$slug" params={{ slug: ev.slug }}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> View public page
              </Link>
            </DropdownMenuItem>
            {!isPast && (
              <DropdownMenuItem asChild>
                <Link to="/host/$slug/events/$eventId/gallery" params={{ slug, eventId: ev.id }}>
                  <ImageIcon className="mr-2 h-3.5 w-3.5" /> Gallery
                </Link>
              </DropdownMenuItem>
            )}
            {isPast && (
              <DropdownMenuItem asChild>
                <Link to="/host/$slug/events/$eventId/check-in" params={{ slug, eventId: ev.id }}>
                  <ScanLine className="mr-2 h-3.5 w-3.5" /> Check-in
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onExportCsv}>
              <Download className="mr-2 h-3.5 w-3.5" /> Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
            </DropdownMenuItem>
            {ev.status === "published" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onUnpublish}>
                  <EyeOff className="mr-2 h-3.5 w-3.5" /> Unpublish
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
