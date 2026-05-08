// Generate a downloadable .ics file for an event RSVP.
// Uses TZID with a minimal VTIMEZONE block so calendar apps preserve the
// event's named time zone instead of displaying it in UTC.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtUtc(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Format a Date as an ICS local time-string (YYYYMMDDTHHmmss) in the given IANA tz. */
function fmtLocalInTz(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return `${get("year")}${get("month")}${get("day")}T${hour}${get("minute")}${get("second")}`;
}

function escape(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fold(line: string): string {
  // RFC 5545 line folding at 75 octets
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    out.push((i === 0 ? "" : " ") + line.slice(i, i + (i === 0 ? 75 : 74)));
    i += i === 0 ? 75 : 74;
  }
  return out.join("\r\n");
}

export type IcsInput = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt: string;
  timeZone?: string | null;
  organizerEmail?: string | null;
};

export function buildIcs({
  uid,
  title,
  description,
  location,
  startsAt,
  endsAt,
  timeZone,
  organizerEmail,
}: IcsInput) {
  const tz = timeZone && timeZone.trim() ? timeZone.trim() : null;
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const dtStart = tz
    ? `DTSTART;TZID=${tz}:${fmtLocalInTz(start, tz)}`
    : `DTSTART:${fmtUtc(start)}`;
  const dtEnd = tz
    ? `DTEND;TZID=${tz}:${fmtLocalInTz(end, tz)}`
    : `DTEND:${fmtUtc(end)}`;

  // Minimal VTIMEZONE — opaque to clients; most resolve TZID against their
  // own zoneinfo db. Includes a single STANDARD component so strict parsers
  // (e.g. some Outlook versions) don't reject the calendar.
  const vtimezone = tz
    ? [
        "BEGIN:VTIMEZONE",
        `TZID:${tz}`,
        "BEGIN:STANDARD",
        "DTSTART:19700101T000000",
        "TZOFFSETFROM:+0000",
        "TZOFFSETTO:+0000",
        `TZNAME:${tz}`,
        "END:STANDARD",
        "END:VTIMEZONE",
      ]
    : [];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gather//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vtimezone,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    dtStart,
    dtEnd,
    `SUMMARY:${escape(title)}`,
    description ? `DESCRIPTION:${escape(description)}` : "",
    location ? `LOCATION:${escape(location)}` : "",
    organizerEmail ? `ORGANIZER:mailto:${organizerEmail}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n");
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
