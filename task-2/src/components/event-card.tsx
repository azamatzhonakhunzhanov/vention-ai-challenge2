import { Calendar, MapPin, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type EventCardData = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  cover_image_url: string | null;
  venue_address: string | null;
  online_url: string | null;
  going_count?: number;
  host?: { slug: string; name: string; logo_url: string | null } | null;
};

export function EventCard({ event }: { event: EventCardData }) {
  const start = new Date(event.starts_at);
  const ended = new Date(event.ends_at).getTime() < Date.now();
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
  const timeLabel = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const location = event.online_url ? "Online" : event.venue_address;

  return (
    <Link to="/events/$slug" params={{ slug: event.slug }} className="group block">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          {event.cover_image_url ? (
            <img
              src={event.cover_image_url}
              alt=""
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Calendar className="h-8 w-8" />
            </div>
          )}
          {ended && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
              <Badge variant="secondary" className="text-sm">Ended</Badge>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Calendar className="h-3 w-3" /> {dateLabel} · {timeLabel}
          </div>
          <h3 className="mt-2 line-clamp-2 font-semibold leading-tight group-hover:text-primary">
            {event.title}
          </h3>
          {event.host && (
            <p className="mt-1 truncate text-xs text-muted-foreground">by {event.host.name}</p>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            {location ? (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{location}</span>
              </span>
            ) : <span />}
            {typeof event.going_count === "number" && (
              <span className="flex shrink-0 items-center gap-1">
                <Users className="h-3 w-3" /> {event.going_count}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
