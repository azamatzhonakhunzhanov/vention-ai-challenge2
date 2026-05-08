import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Settings, ScanLine, ExternalLink, Calendar as CalendarIcon, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useHostMemberships } from "@/hooks/use-host-memberships";

export const Route = createFileRoute("/my-events")({
  head: () => ({ meta: [{ title: "My Events — Gather" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/signin", search: { returnTo: "/my-events" } });
    }
  },
  component: MyEventsPage,
});

type EventRow = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  cover_image_url: string | null;
  status: string;
  visibility: string;
  host_id: string;
};

type TimeFilter = "upcoming" | "past" | "all";

function MyEventsPage() {
  const { memberships, hostIds, loading: mLoading } = useHostMemberships();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("upcoming");
  const [hostFilter, setHostFilter] = useState<Set<string>>(new Set());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (mLoading) return;
    if (hostIds.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("events")
      .select("id, slug, title, starts_at, ends_at, cover_image_url, status, visibility, host_id")
      .in("host_id", hostIds)
      .order("starts_at", { ascending: true })
      .then(({ data }) => {
        setEvents((data ?? []) as EventRow[]);
        setLoading(false);
      });
  }, [hostIds.join(","), mLoading]);

  const roleByHost = useMemo(() => {
    const m: Record<string, "host" | "checker"> = {};
    for (const x of memberships) m[x.host_id] = x.role;
    return m;
  }, [memberships]);

  const hostByHost = useMemo(() => {
    const m: Record<string, { name: string; slug: string } | undefined> = {};
    for (const x of memberships) if (x.host) m[x.host_id] = { name: x.host.name, slug: x.host.slug };
    return m;
  }, [memberships]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    const ql = q.trim().toLowerCase();
    return events
      .filter((e) => {
        if (hostFilter.size && !hostFilter.has(e.host_id)) return false;
        const start = new Date(e.starts_at).getTime();
        const end = new Date(e.ends_at).getTime();
        if (timeFilter === "upcoming" && end < now) return false;
        if (timeFilter === "past" && end >= now) return false;
        if (fromTs !== null && start < fromTs) return false;
        if (toTs !== null && start > toTs) return false;
        if (ql && !e.title.toLowerCase().includes(ql)) return false;
        return true;
      })
      .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  }, [events, hostFilter, timeFilter, from, to, q]);

  const toggleHost = (id: string) => {
    setHostFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-primary">My Events</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">All your events</h1>
          <p className="mt-1 text-sm text-muted-foreground">Across every host you belong to.</p>
        </div>
        <Button asChild>
          <Link to="/host/new"><Plus className="mr-2 h-4 w-4" /> New host</Link>
        </Button>
      </header>

      {!mLoading && memberships.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-muted-foreground">You're not part of any host yet.</p>
            <Button asChild><Link to="/host/new">Create a host</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title…" className="pl-8" />
              </div>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
              <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                <TabsList>
                  <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                  <TabsTrigger value="past">Past</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {memberships.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground self-center">Hosts:</span>
                {memberships.map((m) => m.host && (
                  <button
                    key={m.host_id}
                    onClick={() => toggleHost(m.host_id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      hostFilter.has(m.host_id) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {m.host.name}
                  </button>
                ))}
                {hostFilter.size > 0 && (
                  <button onClick={() => setHostFilter(new Set())} className="text-xs text-muted-foreground underline">Clear</button>
                )}
              </div>
            )}
          </Card>

          {loading || mLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
                <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">No events match your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {filtered.map((ev) => {
                const role = roleByHost[ev.host_id];
                const host = hostByHost[ev.host_id];
                const start = new Date(ev.starts_at);
                return (
                  <Card key={ev.id}>
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                      <div className="h-20 w-32 shrink-0 overflow-hidden rounded-md bg-muted">
                        {ev.cover_image_url ? (
                          <img src={ev.cover_image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <CalendarIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-semibold">{ev.title}</h3>
                          <Badge variant={role === "host" ? "default" : "secondary"}>{role}</Badge>
                          {ev.status !== "published" && <Badge variant="outline">Draft</Badge>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {host?.name ?? "Host"} · {start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          {" · "}{start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/events/$slug" params={{ slug: ev.slug }}>
                            <ExternalLink className="mr-1 h-3.5 w-3.5" /> View
                          </Link>
                        </Button>
                        {role === "host" && host && (
                          <>
                            <Button asChild variant="ghost" size="sm">
                              <Link to="/host/$slug/events/$eventId/edit" params={{ slug: host.slug, eventId: ev.id }}>
                                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                              </Link>
                            </Button>
                            <Button asChild size="sm">
                              <Link to="/host/$slug/dashboard" params={{ slug: host.slug }}>
                                <Settings className="mr-1 h-4 w-4" /> Dashboard
                              </Link>
                            </Button>
                          </>
                        )}
                        {role === "checker" && host && (
                          <Button asChild size="sm">
                            <Link to="/host/$slug/events/$eventId/check-in" params={{ slug: host.slug, eventId: ev.id }}>
                              <ScanLine className="mr-1 h-4 w-4" /> Check-in
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
