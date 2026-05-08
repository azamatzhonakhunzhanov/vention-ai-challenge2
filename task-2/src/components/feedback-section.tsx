import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type FeedbackRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_id: string;
  profile?: { full_name: string | null } | null;
};

export function FeedbackSection({
  eventId,
  ended,
  userIsGoing,
}: {
  eventId: string;
  ended: boolean;
  userIsGoing: boolean;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [mine, setMine] = useState<FeedbackRow | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const PAGE_SIZE = 5;

  const loadAggregate = async () => {
    const { data: rows, count } = await supabase
      .from("feedback")
      .select("id, rating, comment, created_at, user_id, profile:profiles!feedback_user_id_fkey ( full_name )", { count: "exact" })
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    // Fallback if FK alias not present
    if (!rows) {
      const { data: rows2, count: c2 } = await supabase
        .from("feedback")
        .select("id, rating, comment, created_at, user_id", { count: "exact" })
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      setItems((rows2 ?? []) as FeedbackRow[]);
      setTotal(c2 ?? 0);
      return;
    }
    setItems((rows ?? []) as unknown as FeedbackRow[]);
    setTotal(count ?? 0);
  };

  const loadMine = async () => {
    if (!user) return setMine(null);
    const { data } = await supabase
      .from("feedback")
      .select("id, rating, comment, created_at, user_id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();
    setMine((data as FeedbackRow | null) ?? null);
  };

  useEffect(() => { void loadAggregate(); /* eslint-disable-next-line */ }, [eventId, page]);
  useEffect(() => { void loadMine(); /* eslint-disable-next-line */ }, [eventId, user?.id]);

  const [allForAvg, setAllForAvg] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("feedback").select("rating").eq("event_id", eventId);
      const arr = data ?? [];
      const avg = arr.length ? arr.reduce((s, r) => s + r.rating, 0) / arr.length : 0;
      setAllForAvg({ avg, count: arr.length });
    })();
  }, [eventId, items.length]);

  const submit = async () => {
    if (!user || !rating) return;
    setSubmitting(true);
    const { error } = await supabase.from("feedback").insert({
      event_id: eventId, user_id: user.id, rating, comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks for your feedback!");
    setRating(0); setComment("");
    await loadMine();
    await loadAggregate();
  };

  const showForm = ended && userIsGoing && !mine;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Feedback</h2>
        {allForAvg.count > 0 && (
          <p className="text-sm text-muted-foreground">
            <Stars value={Math.round(allForAvg.avg)} size={14} /> {allForAvg.avg.toFixed(1)} · {allForAvg.count} {allForAvg.count === 1 ? "review" : "reviews"}
          </p>
        )}
      </div>

      {showForm && (
        <Card className="mt-3">
          <CardContent className="space-y-3 p-5">
            <div>
              <p className="text-sm font-medium">Your rating</p>
              <div className="mt-2"><StarPicker value={rating} onChange={setRating} /></div>
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you think? (optional)"
              maxLength={1000}
              rows={3}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={submit} disabled={!rating || submitting}>
                {submitting ? "Saving…" : "Submit feedback"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mine && (
        <Card className="mt-3 border-primary/30">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Your feedback</p>
            <div className="mt-2 flex items-center gap-2">
              <Stars value={mine.rating} />
            </div>
            {mine.comment && <p className="mt-2 text-sm">{mine.comment}</p>}
          </CardContent>
        </Card>
      )}

      <div className="mt-3 space-y-3">
        {items.length === 0 && !mine && (
          <Card><CardContent className="p-5 text-sm text-muted-foreground">No feedback yet.</CardContent></Card>
        )}
        {items.filter((i) => i.id !== mine?.id).map((it) => (
          <Card key={it.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stars value={it.rating} />
                  <span className="text-xs text-muted-foreground">
                    {it.profile?.full_name ?? "Attendee"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(it.created_at).toLocaleDateString()}
                </span>
              </div>
              {it.comment && <p className="mt-2 text-sm">{it.comment}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </section>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} stars`}>
          <Star className={`h-7 w-7 transition ${n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex">
      {[1,2,3,4,5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}
        />
      ))}
    </span>
  );
}
