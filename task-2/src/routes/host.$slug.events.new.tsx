import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useHostAccess } from "@/hooks/use-host-access";
import {
  EventForm, defaultEventValues, fromLocalInput, uploadEventCover,
  type EventFormSubmit,
} from "@/components/event-form";

export const Route = createFileRoute("/host/$slug/events/new")({
  head: () => ({ meta: [{ title: "New event — Gather" }] }),
  component: NewEventPage,
});

function NewEventPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const access = useHostAccess(slug);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/signin", search: { returnTo: `/host/${slug}/events/new` } });
    }
  }, [authLoading, user, navigate, slug]);

  useEffect(() => {
    if (!access.loading && user && !access.isHost && !access.notFound) {
      toast.error("You don't have permission to create events for this host.");
      navigate({ to: "/hosts/$slug", params: { slug } });
    }
  }, [access, user, navigate, slug]);

  const onSubmit = async ({ values, status, coverFile }: EventFormSubmit) => {
    if (!user || !access.host) return;
    try {
      // Slug uniqueness
      const { data: existing } = await supabase
        .from("events").select("id").eq("slug", values.slug).maybeSingle();
      if (existing) { toast.error("That slug is taken — try another"); return; }

      let coverUrl = values.cover_image_url;
      if (coverFile) coverUrl = await uploadEventCover(user.id, slug, coverFile);

      const { data: inserted, error } = await supabase
        .from("events")
        .insert({
          host_id: access.host.id,
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
          is_paid: false,
        })
        .select("slug")
        .single();
      if (error) throw error;

      toast.success(status === "published" ? "Event published" : "Draft saved");
      navigate({ to: "/host/$slug/dashboard", params: { slug } });
      void inserted;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save event");
    }
  };

  if (authLoading || access.loading) {
    return <section className="mx-auto max-w-3xl px-4 py-16"><div className="h-6 w-40 animate-pulse rounded bg-muted" /></section>;
  }
  if (access.notFound) {
    return <section className="mx-auto max-w-2xl px-4 py-24 text-center"><h1 className="text-2xl font-bold">Host not found</h1></section>;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">{access.host?.name}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Create event</h1>
      </div>
      <EventForm
        mode="create"
        initialValues={defaultEventValues()}
        onSubmit={onSubmit}
        onCancel={() => navigate({ to: "/host/$slug/dashboard", params: { slug } })}
      />
    </section>
  );
}
