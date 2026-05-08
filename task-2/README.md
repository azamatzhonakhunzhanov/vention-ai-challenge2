# Gather — Event Hosting & RSVP Platform

**Live app:** https://gather-up-joy.lovable.app

A community events platform for publishing events, collecting RSVPs, issuing QR tickets, and running door check-in. This README is a usage guide for the four core flows. For implementation notes and decisions see [`report.md`](./report.md).

---

## 1. Publish an Event (Host flow)

1. **Sign up / sign in** at `/signin`. Email + password or Google.
2. **Create a Host** at `/host/new` — set name, slug, contact email, logo, short bio. The creator is automatically given the `host` role on that organization.
3. Open the host dashboard at `/host/<slug>/dashboard`.
4. Click **New event**. Fill in:
   - title, description (Markdown supported)
   - start / end date-time + time zone
   - venue address **or** online URL
   - capacity (waitlist kicks in once exceeded)
   - cover image
   - **Visibility:** Public (appears in `/explore`) or Unlisted (link-only)
   - **Pricing:** Free (Paid is shown but disabled — "Coming soon")
5. Click **Save draft** to keep it private, or **Publish** to make it live.
6. From the dashboard, drafts and published events expose **Edit**, **Duplicate**, **Unpublish**, and **Delete** actions.

### Inviting team members
- On the host dashboard → **Members** tab → **Create invite**.
- Pick `host` (full access) or `checker` (check-in only) and copy the link.
- Invitee opens the link, signs in, and accepts → they appear under Members.

---

## 2. RSVP & Ticket (Attendee flow)

1. Browse events on `/explore` (text search, date range, location filter, "Include past" toggle) or open an event by direct link.
2. Click **RSVP**.
   - If signed out, you'll be sent to `/signin?returnTo=...` and dropped back on the event page after login.
   - If capacity is full, your RSVP is added to the **waitlist** (FIFO position shown).
3. After confirming, your **ticket** appears with:
   - a unique 8-character code,
   - a QR code encoding that code,
   - an **Add to calendar** (.ics) button.
4. All your upcoming tickets live at `/my-tickets`. From there you can also **cancel** an RSVP — the next person on the waitlist is promoted automatically.
5. Once the event ends, the ticket page unlocks **Leave feedback** (1–5 stars + optional comment) and **Upload to gallery** (host approval required before public display).

---

## 3. Check-in (Checker / Host flow)

1. Open `/host/<slug>/events/<eventId>/check-in` — accessible to anyone with the `host` or `checker` role on that host.
2. The page shows live counters: `checked-in / going` and a feed of recent check-ins (real-time via Supabase Realtime).
3. Type or paste the attendee's 8-character ticket code (or scan their QR with any reader and paste it in) and press **Enter**.
   - ✅ **OK** — checked in.
   - ⚠️ **Already** — they were already checked in (no double count).
   - ❌ **Not going / Not found** — RSVP was cancelled, waitlisted, or invalid.
4. Made a mistake? Click **Undo last** or the **Undo** button on the most recent row.
5. Capacity, duplicate prevention, and concurrent check-ins are enforced server-side via a `SECURITY DEFINER` Postgres function with `SELECT ... FOR UPDATE` row locking — there is no race window.

---

## 4. Exporting attendees (Host only)

From the host dashboard, open an event and click **Export CSV**. The file:
- is UTF-8 with BOM so it opens correctly in Excel and Google Sheets,
- contains columns `name, email, rsvp_status, check_in_time`,
- includes everyone who RSVP'd (going / waitlisted / cancelled) plus check-in timestamps.

A sample is provided at `example-attendees-export.csv` in this folder.

---

## Other pages worth knowing

| Path | Purpose |
| --- | --- |
| `/explore` | Public event discovery |
| `/hosts/<slug>` | Public host page |
| `/events/<slug>` | Public event page (with social preview metadata) |
| `/my-events` | Aggregated list of every event where you hold a role |
| `/my-tickets` | Your upcoming tickets |
| `/host/<slug>/dashboard` | Host control panel: events, members, invites |
| `/about`, `/terms`, `/privacy` | Static pages |

---

## Tech stack (one-liner)

TanStack Start (React 19, Vite 7) + Tailwind v4 + shadcn/ui on the front-end; Supabase (Postgres + Auth + Storage + Realtime) on the back-end via Lovable Cloud. All sensitive operations go through `SECURITY DEFINER` SQL functions; RLS is enabled on every table. See [`report.md`](./report.md) for the full breakdown.
