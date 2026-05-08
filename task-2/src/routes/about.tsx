import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CalendarCheck, QrCode, Users, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Gather" },
      { name: "description", content: "Gather helps communities run delightful events: RSVPs, waitlists, QR check-in, and shared galleries." },
      { property: "og:title", content: "About Gather" },
      { property: "og:description", content: "A simple, modern platform for community events — from RSVP to recap." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const features = [
    { icon: CalendarCheck, title: "Event pages", text: "Beautiful, shareable pages with RSVPs, capacity and waitlists." },
    { icon: QrCode, title: "QR check-in", text: "Fast door scanning with camera or manual ticket codes." },
    { icon: Users, title: "Host teams", text: "Invite co-hosts and door staff with the right permissions." },
    { icon: ImageIcon, title: "Shared gallery", text: "Attendees contribute photos that hosts moderate after the event." },
  ];
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">About Gather</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Gather is a lightweight platform for communities to host events people actually remember —
          from the first RSVP to the post-event recap.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="rounded-lg border bg-card p-5">
            <f.icon className="mb-3 h-5 w-5 text-primary" />
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-lg border bg-muted/30 p-6 text-center">
        <h2 className="text-xl font-semibold">Ready to host your next event?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Create a host page and publish your first event in minutes.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button asChild><Link to="/host/new">Create a host</Link></Button>
          <Button asChild variant="outline"><Link to="/explore">Explore events</Link></Button>
        </div>
      </div>
    </section>
  );
}
