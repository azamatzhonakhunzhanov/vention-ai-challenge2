import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { EventCard, type EventCardData } from "@/components/event-card";

const PAGE_SIZE = 20;

const searchSchema = z.object({
  q: z.string().optional(),
  loc: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  past: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
});

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore events — Gather" },
      { name: "description", content: "Discover community events near you on Gather." },
    ],
  }),
  validateSearch: searchSchema,
  component: ExplorePage,
});

type HostMini = { slug: string; name: string; logo_url: string | null };
type EventRow = Omit<EventCardData, "host" | "going_count"> & {
  host: HostMini | HostMini[] | null;
};

function ExplorePage() {
  const navigate = useNavigate({ from: "/explore" });
  const search = Route.useSearch();

  const [q, setQ] = useState(search.q ?? "");
  const [loc, setLoc] = useState(search.loc ?? "");
  const [events, setEvents] = useState<EventCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const includePast = !!search.past;
  const page = search.page ?? 1;

  // Sync local input state when URL changes
  useEffect(() => { setQ(search.q ?? ""); }, [search.q]);
  useEffect(() => { setLoc(search.loc ?? ""); }, [search.loc]);

  const updateSearch = (patch: Partial<z.infer<typeof searchSchema>>) => {
    navigate({
      search: (prev: z.infer<typeof searchSchema>) => {
        const next: Record<string, unknown> = { ...prev, ...patch };
        if (!("page" in patch)) next.page = 1;
        Object.keys(next).forEach((k) => {
          const v = next[k];
          if (v === "" || v === false || v === undefined) delete next[k];
        });
        return next as z.infer<typeof searchSchema>;
      },
      replace: true,
    });
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("events")
        .select(
          `id, slug, title, starts_at, ends_at, cover_image_url, venue_address, online_url,
           host:hosts ( slug, name, logo_url )`,
          { count: "exact" },
        )
        .eq("status", "published")
        .eq("visibility", "public");

      if (!includePast) {
        query = query.gte("ends_at", new Date().toISOString());
      }
      if (search.q) {
        const term = `%${search.q}%`;
        query = query.or(`title.ilike.${term},description.ilike.${term}`);
      }
      if (search.loc) {
        query = query.ilike("venue_address", `%${search.loc}%`);
      }
      if (search.from) {
        query = query.gte("starts_at", new Date(search.from).toISOString());
      }
      if (search.to) {
        const end = new Date(search.to);
        end.setHours(23, 59, 59, 999);
        query = query.lte("starts_at", end.toISOString());
      }

      query = query.order("starts_at", { ascending: !includePast }).range(from, to);

      const { data, count } = await query;
      if (!active) return;
      const rows = (data ?? []) as unknown as EventRow[];
      const ids = rows.map((r) => r.id);

      // Fetch going counts via public RPC (works for anon visitors)
      const goingMap: Record<string, number> = {};
      if (ids.length) {
        const { data: counts } = await supabase.rpc("public_event_going_counts", { p_event_ids: ids });
        for (const c of (counts ?? []) as Array<{ event_id: string; going_count: number }>) {
          goingMap[c.event_id] = Number(c.going_count) ?? 0;
        }
      }

      setEvents(rows.map((r) => ({
        ...r,
        host: Array.isArray(r.host) ? (r.host[0] ?? null) : r.host,
        going_count: goingMap[r.id] ?? 0,
      })));
      setTotal(count ?? 0);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [search.q, search.loc, search.from, search.to, includePast, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(search.q || search.loc || search.from || search.to || includePast);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearch({ q: q.trim() || undefined, loc: loc.trim() || undefined });
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Explore events</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover community gatherings, workshops, and meetups.
        </p>
      </header>

      <form onSubmit={onSearchSubmit} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or description"
            className="pl-9"
          />
        </div>
        <Input
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          placeholder="Location"
        />
        <Input
          type="date"
          value={search.from ?? ""}
          onChange={(e) => updateSearch({ from: e.target.value || undefined })}
          className="md:w-40"
          aria-label="From date"
        />
        <Input
          type="date"
          value={search.to ?? ""}
          onChange={(e) => updateSearch({ to: e.target.value || undefined })}
          className="md:w-40"
          aria-label="To date"
        />
        <Button type="submit">Search</Button>
        <div className="flex items-center justify-between gap-3 md:col-span-5">
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Switch
              checked={includePast}
              onCheckedChange={(v) => updateSearch({ past: v || undefined })}
            />
            Include past events
          </Label>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setQ(""); setLoc(""); navigate({ search: {}, replace: true }); }}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Clear filters
            </Button>
          )}
        </div>
      </form>

      <div className="mt-8">
        {loading ? (
          <ResultsSkeleton />
        ) : events.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {total} {total === 1 ? "event" : "events"}
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((ev) => <EventCard key={ev.id} event={ev} />)}
            </div>
            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPage={(p) => updateSearch({ page: p > 1 ? p : undefined })}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border">
          <div className="aspect-[16/9] animate-pulse bg-muted" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-20 text-center">
      <h3 className="text-lg font-semibold">No events found</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Try adjusting your filters or check back soon for new gatherings.
      </p>
    </div>
  );
}

function Pagination({
  page, totalPages, onPage,
}: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages = useMemo(() => {
    const arr: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, totalPages]);

  return (
    <nav className="mt-10 flex items-center justify-center gap-1">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      {pages.map((p) => (
        <Button
          key={p}
          size="sm"
          variant={p === page ? "default" : "ghost"}
          onClick={() => onPage(p)}
        >
          {p}
        </Button>
      ))}
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}
