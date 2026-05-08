import QRCode from "react-qr-code";
import { Calendar, MapPin, Globe, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { PromotedBanner } from "@/components/promoted-banner";

export type TicketEvent = {
  id: string;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  venue_address?: string | null;
  online_url?: string | null;
  host?: { name?: string | null; contact_email?: string | null } | null;
};

export type TicketRsvp = {
  id: string;
  ticket_code: string;
  status: "going" | "waitlisted" | "cancelled";
  waitlist_position: number | null;
  promoted_from_waitlist_at?: string | null;
};

export function Ticket({
  event,
  rsvp,
  attendeeName,
  onCancel,
}: {
  event: TicketEvent;
  rsvp: TicketRsvp;
  attendeeName?: string | null;
  onCancel?: () => Promise<void> | void;
}) {
  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: event.time_zone, timeZoneName: "short",
  }).format(new Date(event.starts_at));

  const handleIcs = () => {
    const ics = buildIcs({
      uid: rsvp.id,
      title: event.title,
      description: event.description ?? "",
      location: event.venue_address ?? event.online_url ?? "",
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      timeZone: event.time_zone,
      organizerEmail: event.host?.contact_email ?? null,
    });
    downloadIcs(event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase(), ics);
  };

  const isWaitlisted = rsvp.status === "waitlisted";

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant={isWaitlisted ? "secondary" : "default"}>
              {isWaitlisted ? "Waitlisted" : "Going"}
            </Badge>
            <h3 className="mt-2 text-lg font-semibold">{event.title}</h3>
          </div>
        </div>

        <PromotedBanner rsvpId={rsvp.id} promotedAt={rsvp.promoted_from_waitlist_at} />

        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{fmt}</span>
          </div>
          {event.venue_address && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{event.venue_address}</span>
            </div>
          )}
          {event.online_url && (
            <div className="flex items-start gap-2">
              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <a href={event.online_url} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
                {event.online_url}
              </a>
            </div>
          )}
          {attendeeName && (
            <p className="pt-1 text-muted-foreground">Attendee: <span className="text-foreground">{attendeeName}</span></p>
          )}
        </div>

        {isWaitlisted ? (
          <div className="rounded-lg border bg-muted/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">You're on the waitlist</p>
            <p className="mt-1 text-3xl font-bold">#{rsvp.waitlist_position ?? "—"}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              We'll auto-promote you if a spot opens.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-background p-5">
            <div className="rounded-md bg-white p-3">
              <QRCode value={rsvp.ticket_code} size={160} />
            </div>
            <p className="font-mono text-2xl font-bold tracking-widest">{rsvp.ticket_code}</p>
            <p className="text-xs text-muted-foreground">Show this at check-in</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleIcs}>
            <Download className="mr-2 h-4 w-4" /> Add to calendar
          </Button>
          {onCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <X className="mr-2 h-4 w-4" /> Cancel RSVP
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel your RSVP?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You can RSVP again later if spots are still available.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep RSVP</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onCancel()}>Cancel RSVP</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
