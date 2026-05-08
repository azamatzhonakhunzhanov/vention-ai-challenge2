import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHostAccess } from "@/hooks/use-host-access";
import {
  EventForm, defaultEventValues, fromLocalInput, toLocalInput, uploadEventCover,
  type EventFormSubmit, type EventFormValues,
} from "@/components/event-form";
import { slugify } from "@/lib/slug";

export const Route = createFileRoute("/host/$slug/events/$eventId/edit")({
  head: () => ({ meta: [{ title: "Edit event — Gather" }] }),
  component: EditEventPage,
});

function EditEventPage() {
  const { slug, eventId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const access = useHostAccess(slug);

  const [initial, setInitial] = useState<EventFormValues | null>(null);
  const [currentStatus, setCurrentStatus] = useState<"draft" | "published">("draft");
  const [submitting, setSubmitting] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/signin", search: { returnTo: `/host/${slug}/events/${eventId}/edit` } });
    }
  }, [authLoading, user, navigate, slug, eventId]);

  useEffect(() => {
    if (!access.loading && user && !access.isHost && !access.notFound) {
      toast.error("You don't have permission to edit this event.");
      navigate({ to: "/hosts/$slug", params: { slug } });
    }
  }, [access, user, navigate, slug]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, description, starts_at, ends_at, time_zone, venue_address, online_url, capacity, cover_image_url, visibility, status, is_paid")
        .eq("id", eventId)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        toast.error("Event not found");
        navigate({ to: "/host/$slug/dashboard", params: { slug } });
        return;
      }
      setCurrentStatus(data.status as "draft" | "published");
      const base = defaultEventValues();
      setInitial({
        ...base,
        title: data.title,
        slug: data.slug,
        description: data.description ?? "",
        starts_at: toLocalInput(new Date(data.starts_at)),
        ends_at: toLocalInput(new Date(data.ends_at)),
        time_zone: data.time_zone || base.time_zone,
        venue_type: data.online_url ? "online" : "in_person",
        venue_address: data.venue_address ?? "",
        online_url: data.online_url ?? "",
        capacity: data.capacity,
        cover_image_url: data.cover_image_url,
        visibility: data.visibility as "public" | "unlisted",
        is_paid: data.is_paid,
      });
      setLoadingEvent(false);
    })();
    return () => { active = false; };
  }, [eventId, slug, navigate]);

  const onSubmit = async ({ values, status, coverFile }: EventFormSubmit) => {
    if (!user || !access.host) return;
    setSubmitting(true);
    try {
      // If slug changed, check uniqueness
      if (values.slug !== initial?.slug) {
        const { data: existing } = await supabase
          .from("events").select("id").eq("slug", values.slug).maybeSingle();
        if (existing && existing.id !== eventId) {
          toast.error("That slug is taken — try another");
          setSubmitting(false);
          return;
        }
      }

      let coverUrl = values.cover_image_url;
      if (coverFile) coverUrl = await uploadEventCover(user.id, slug, coverFile);

      const { error } = await supabase
        .from("events")
        .update({
          slug: values.slug,
          title: values.title,
          description: values.description || null,
          starts_at: fromLocalInput(values.starts_at),
          ends_at: fromLocalInput(values.ends_at),
          time_zone: values.time_zone,
          venue_address: values.venue_type === "in_person" ? values.venue_address : null,
          online_url: values.venue_type === "online" ? values.online_url : null,
          capacity: values.capacity,
          cover_image_url: coverUrl,
          visibility: values.visibility,
          status,
        })
        .eq("id", eventId);
      if (error) throw error;
      toast.success(status === "published" ? "Event published" : "Draft saved");
      navigate({ to: "/host/$slug/dashboard", params: { slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save event");
    } finally {
      setSubmitting(false);
    }
  };

  const onUnpublish = async () => {
    const { error } = await supabase.from("events").update({ status: "draft" }).eq("id", eventId);
    if (error) return toast.error(error.message);
    toast.success("Event unpublished");
    setCurrentStatus("draft");
  };

  const onDuplicate = async () => {
    if (!access.host) return;
    const { data: original, error } = await supabase
      .from("events").select("*").eq("id", eventId).single();
    if (error || !original) return toast.error("Could not load original");
    const newTitle = `${original.title} (Copy)`;
    let newSlug = slugify(newTitle);
    // ensure unique
    for (let i = 0; i < 10; i++) {
      const { data: existing } = await supabase.from("events").select("id").eq("slug", newSlug).maybeSingle();
      if (!existing) break;
      newSlug = `${slugify(newTitle)}-${Math.random().toString(36).slice(2, 6)}`;
    }
    const { error: insErr } = await supabase.from("events").insert({
      host_id: original.host_id,
      slug: newSlug,
      title: newTitle,
      description: original.description,
      starts_at: original.starts_at,
      ends_at: original.ends_at,
      time_zone: original.time_zone,
      venue_address: original.venue_address,
      online_url: original.online_url,
      capacity: original.capacity,
      cover_image_url: original.cover_image_url,
      visibility: original.visibility,
      status: "draft",
      is_paid: original.is_paid,
    });
    if (insErr) return toast.error(insErr.message);
    toast.success("Event duplicated as draft");
    navigate({ to: "/host/$slug/dashboard", params: { slug } });
  };

  const onDelete = async () => {
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) return toast.error(error.message);
    toast.success("Event deleted");
    navigate({ to: "/host/$slug/dashboard", params: { slug } });
  };

  if (authLoading || access.loading || loadingEvent || !initial) {
    return <section className="mx-auto max-w-3xl px-4 py-16"><div className="h-6 w-40 animate-pulse rounded bg-muted" /></section>;
  }

  const adjustCapacity = async (delta: number) => {
    const { data: cur } = await supabase.from("events").select("capacity").eq("id", eventId).single();
    if (!cur) return;
    const next = Math.max(1, (cur.capacity ?? 1) + delta);
    const { error } = await supabase.from("events").update({ capacity: next }).eq("id", eventId);
    if (error) return toast.error(error.message);
    toast.success(`Capacity → ${next}`);
    setInitial((p) => (p ? { ...p, capacity: next } : p));
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">{access.host?.name}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Edit event</h1>
        </div>
        {import.meta.env.DEV && (
          <div className="flex items-center gap-1 rounded-md border border-dashed p-1 text-xs">
            <span className="px-2 text-muted-foreground">DEV capacity</span>
            <Button type="button" size="sm" variant="outline" onClick={() => adjustCapacity(-1)}>−</Button>
            <span className="w-8 text-center font-mono">{initial.capacity}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => adjustCapacity(1)}>+</Button>
          </div>
        )}
      </div>
      <EventForm
        mode="edit"
        initialValues={initial}
        onSubmit={onSubmit}
        submitting={submitting}
        onCancel={() => navigate({ to: "/host/$slug/dashboard", params: { slug } })}
        extraActions={
          <>
            {currentStatus === "published" && (
              <Button type="button" variant="ghost" onClick={onUnpublish}>Unpublish</Button>
            )}
            <Button type="button" variant="ghost" onClick={onDuplicate}>Duplicate</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the event and all its RSVPs. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Delete event</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />
    </section>
  );
}
