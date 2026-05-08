import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { ArrowLeft, ScanLine, Undo2, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHostAccess } from "@/hooks/use-host-access";
import { QrScanner } from "@/components/qr-scanner";

export const Route = createFileRoute("/host/$slug/events/$eventId/check-in")({
  head: () => ({ meta: [{ title: "Check-in — Gather" }] }),
  component: CheckInPage,
});

type Counters = { going: number; checkedIn: number };
type Recent = {
  rsvp_id: string;
  name: string;
  at: string;
  by_me: boolean;
  checker_name: string;
};
type FeedbackKind = "ok" | "already" | "not_going" | "not_found";
type Feedback = { kind: FeedbackKind; message: string } | null;

function CheckInPage() {
  const { slug, eventId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const access = useHostAccess(slug);

  const [event, setEvent] = useState<{ id: string; title: string } | null>(null);
  const [counters, setCounters] = useState<Counters>({ going: 0, checkedIn: 0 });
  const [recent, setRecent] = useState<Recent[]>([]);
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/signin", search: { returnTo: `/host/${slug}/events/${eventId}/check-in` } });
    }
  }, [authLoading, user, slug, eventId, navigate]);

  // Permission gate
  useEffect(() => {
    if (access.loading || !user) return;
    if (access.notFound || (access.role !== "host" && access.role !== "checker")) {
      toast.error("You don't have access to check-in.");
      navigate({ to: "/" });
    }
  }, [access, user, navigate]);

  const loadEvent = useCallback(async () => {
    const { data } = await supabase.from("events").select("id, title, host_id").eq("id", eventId).maybeSingle();
    if (data && access.host && data.host_id === access.host.id) {
      setEvent({ id: data.id, title: data.title });
    } else if (data) {
      toast.error("Event does not belong to this host.");
      navigate({ to: "/host/$slug/dashboard", params: { slug } });
    }
  }, [eventId, access.host, navigate, slug]);

  const loadCounters = useCallback(async () => {
    const { data, error } = await supabase.rpc("event_check_in_counters", { p_event_id: eventId });
    if (error || !data) return;
    const d = data as { going: number; checked_in: number };
    setCounters({ going: d.going, checkedIn: d.checked_in });
  }, [eventId]);

  const loadRecent = useCallback(async () => {
    const { data, error } = await supabase.rpc("recent_check_ins", { p_event_id: eventId, p_limit: 10 });
    if (error || !data) return;
    const rows = data as Array<{ rsvp_id: string; name: string; checked_in_at: string; checker_id: string | null; checker_name: string | null }>;
    setRecent(rows.map((r) => ({
      rsvp_id: r.rsvp_id,
      name: r.name || "Guest",
      at: r.checked_in_at,
      by_me: !!user && r.checker_id === user.id,
      checker_name: r.checker_name || "",
    })));
  }, [eventId, user]);

  useEffect(() => {
    if (access.loading || !access.host) return;
    void loadEvent();
    void loadCounters();
    void loadRecent();
  }, [access.host, access.loading, loadEvent, loadCounters, loadRecent]);

  // Realtime + polling fallback (realtime delivery respects RLS, so checkers fall back to poll)
  useEffect(() => {
    if (!event) return;
    const channel = supabase
      .channel(`checkin-${event.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rsvps", filter: `event_id=eq.${event.id}` },
        () => {
          void loadCounters();
          void loadRecent();
        },
      )
      .subscribe();
    const interval = window.setInterval(() => {
      void loadCounters();
      void loadRecent();
    }, 5000);
    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(interval);
    };
  }, [event, loadCounters, loadRecent]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, [event]);

  const performCheckIn = useCallback(async (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (!value || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("check_in_rsvp", {
        p_event_id: eventId,
        p_ticket_code: value,
      });
      if (error) {
        setFeedback({ kind: "not_found", message: error.message });
      } else {
        const res = data as { result: FeedbackKind; name?: string; checked_in_at?: string; status?: string };
        if (res.result === "ok") {
          setFeedback({ kind: "ok", message: `Checked in: ${res.name || "Guest"}` });
        } else if (res.result === "already") {
          const t = res.checked_in_at ? new Date(res.checked_in_at).toLocaleTimeString() : "earlier";
          setFeedback({ kind: "already", message: `Already checked in at ${t}` });
        } else if (res.result === "not_going") {
          setFeedback({ kind: "not_going", message: `Not a confirmed attendee (${res.status ?? "n/a"})` });
        } else {
          setFeedback({ kind: "not_found", message: "Invalid code" });
        }
      }
    } finally {
      setBusy(false);
      setCode("");
      setTimeout(() => inputRef.current?.focus(), 50);
      setTimeout(() => setFeedback(null), 4000);
    }
  }, [busy, eventId]);

  const submit = () => performCheckIn(code);

  const onScan = useCallback((text: string) => {
    // Tickets are short alphanumeric. If a QR encodes a URL with ?ticket=XXXX, extract it.
    let value = text.trim();
    try {
      const url = new URL(value);
      const t = url.searchParams.get("ticket") || url.searchParams.get("code");
      if (t) value = t;
    } catch {
      // not a URL, use as-is
    }
    void performCheckIn(value);
  }, [performCheckIn]);

  const undoLast = async () => {
    const { data, error } = await supabase.rpc("undo_last_check_in", { p_event_id: eventId });
    if (error) return toast.error(error.message);
    const res = data as { result: string };
    if (res.result === "none") {
      toast.info("No recent check-in to undo.");
      return;
    }
    toast.success("Check-in undone");
    void loadCounters();
    void loadRecent();
  };

  const undoRow = async (rsvpId: string) => {
    const { error } = await supabase.rpc("undo_check_in", { p_rsvp_id: rsvpId });
    if (error) return toast.error(error.message);
    void loadCounters();
    void loadRecent();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  const feedbackStyles = useMemo(() => {
    if (!feedback) return "";
    if (feedback.kind === "ok") return "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300";
    if (feedback.kind === "not_found") return "border-destructive/50 bg-destructive/10 text-destructive";
    return "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }, [feedback]);

  if (authLoading || access.loading || !event) {
    return <section className="mx-auto max-w-2xl px-4 py-16"><div className="h-8 w-48 animate-pulse rounded bg-muted" /></section>;
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/host/$slug/dashboard" params={{ slug }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
      </div>
      <header className="mb-6">
        <p className="text-sm font-medium text-primary">{access.host?.name}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Check-in: {event.title}</h1>
        <Badge variant="secondary" className="mt-2">{access.role}</Badge>
      </header>

      <Card className="mb-6 flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Checked in</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {counters.checkedIn} <span className="text-muted-foreground">/ {counters.going}</span>
          </p>
        </div>
        <ScanLine className="h-10 w-10 text-muted-foreground" />
      </Card>

      <Card className="mb-4 p-5">
        <Tabs defaultValue="camera">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="camera">Camera</TabsTrigger>
            <TabsTrigger value="manual">Manual code</TabsTrigger>
          </TabsList>
          <TabsContent value="camera" className="mt-4">
            <QrScanner onDecode={onScan} paused={busy} />
            <p className="mt-2 text-xs text-muted-foreground">
              Point the camera at a guest's QR ticket. Scans are deduplicated for 2s.
            </p>
          </TabsContent>
          <TabsContent value="manual" className="mt-4">
            <label htmlFor="ticket" className="text-sm font-medium">Enter ticket code</label>
            <Input
              id="ticket"
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={onKeyDown}
              placeholder="ABCD1234"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={32}
              className="mt-2 h-14 text-center text-2xl font-mono tracking-widest"
            />
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={submit} disabled={busy || !code.trim()}>Check in</Button>
            </div>
          </TabsContent>
        </Tabs>
        <div className="mt-4 flex justify-end border-t pt-3">
          <Button variant="ghost" size="sm" onClick={undoLast}>
            <Undo2 className="mr-1 h-4 w-4" /> Undo last scan
          </Button>
        </div>
      </Card>

      {feedback && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${feedbackStyles}`}>
          {feedback.kind === "ok" && <CheckCircle2 className="h-4 w-4" />}
          {feedback.kind === "not_found" && <XCircle className="h-4 w-4" />}
          {(feedback.kind === "already" || feedback.kind === "not_going") && <AlertCircle className="h-4 w-4" />}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Recent check-ins</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No check-ins yet.</p>
        ) : (
          <ul className="divide-y">
            {recent.map((r) => {
              const canUndo = r.by_me || access.role === "host";
              return (
                <li key={r.rsvp_id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.at).toLocaleTimeString()}
                      {" · "}
                      {r.by_me ? "by you" : r.checker_name ? `by ${r.checker_name}` : "by staff"}
                    </p>
                  </div>
                  {canUndo && (
                    <Button variant="ghost" size="sm" onClick={() => undoRow(r.rsvp_id)}>
                      <Undo2 className="mr-1 h-3.5 w-3.5" /> Undo
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
