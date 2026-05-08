# Build Report — Gather

> Notes on tooling, what worked, what didn't, and the decisions behind the
> non-obvious parts of the codebase.

## 1. Tools & techniques

**Front-end**
- **TanStack Start v1** (React 19, Vite 7) — file-based routing under
  `src/routes/`, type-safe `Link`s, `createServerFn` for server-only calls.
- **Tailwind v4** with semantic tokens defined in `src/styles.css` (oklch).
  No raw color classes in components — everything goes through
  `bg-primary`, `text-muted-foreground`, etc.
- **shadcn/ui** + Radix primitives for accessible building blocks
  (Dialog, Popover, RadioGroup, Tooltip, Sheet…).
- **TanStack Query** for client cache + revalidation, paired with Supabase
  Realtime channels for the check-in dashboard.
- **`qrcode.react`** for ticket QR generation (no camera needed — the
  on-door flow is "type or paste the 8-char code").

**Back-end (Lovable Cloud / Supabase)**
- 11 tables with RLS enabled on every single one.
- 20+ `SECURITY DEFINER` Postgres functions encapsulating every
  privilege-sensitive operation: `rsvp_to_event`, `promote_from_waitlist`,
  `check_in_rsvp`, `undo_last_check_in`, `accept_invite`,
  `export_event_attendees`, `event_check_in_counters`,
  `public_event_going_counts`, `recent_check_ins`, `get_invite_by_token`.
- Triggers: `handle_new_user` (auto-create profile), `handle_new_host`
  (auto-add owner as host member), `handle_rsvp_status_change` &
  `handle_event_capacity_change` (auto-promote from waitlist),
  `validate_feedback` (enforce "must have RSVP'd going + event ended").
- Storage buckets: `host-logos`, `event-covers`, `gallery` — all public
  read, RLS-scoped writes.

**Concurrency / correctness**
- Capacity enforcement uses `SELECT ... FOR UPDATE` on `events` inside
  `rsvp_to_event` so two simultaneous RSVPs cannot both grab the last
  seat. Same pattern in `check_in_rsvp` and `undo_check_in` against the
  `rsvps` row.
- Waitlist is FIFO via a stable `(waitlist_position NULLS LAST, created_at)`
  ordering; positions are renumbered in the same transaction whenever
  promotion happens so the queue never has gaps.

**CSV exports**
- Generated client-side from a server-defined RPC
  (`export_event_attendees`) so authorization lives in SQL.
- File is written with a UTF-8 BOM (`\uFEFF`) — Excel needs that to
  detect UTF-8 and not mojibake non-Latin names.

## 2. What worked well

- **`createServerFn` for everything sensitive.** Keeping admin / privileged
  reads behind a server function (rather than directly hitting Supabase from
  the loader) avoided every "browser bundle leaks the service-role key"
  class of bug.
- **Doing access control in SQL.** Putting all the rules (capacity,
  waitlist, check-in idempotency, feedback gating) in `SECURITY DEFINER`
  functions made the React layer dumb in the best way: it just calls an
  RPC and renders the result. No "did I forget the owner check" moments.
- **Realtime over polling for the check-in screen.** A single
  `postgres_changes` subscription on `rsvps` filtered by `event_id`
  updates the counters and the recent-check-ins list with no extra HTTP
  traffic.
- **Tailwind v4 design tokens.** Defining the palette once in
  `src/styles.css` (with oklch) made dark mode and color tweaks trivial.

## 3. What didn't work / had to be redone

- **Real-time counters for Checkers.** Initial RLS on `rsvps` only allowed
  `event_has_host_role(..., 'host')` to read. Result: checker-role users
  saw the channel subscribe but never receive payloads, so counters
  silently fell back to 5-second polling. Fixed by widening the SELECT
  policy to `is_event_host_member(...)` (any role), which keeps invite
  tokens and other privileged data restricted while letting the door
  staff see live numbers.
- **Anonymous "X going" on Explore.** Same root cause: RLS hid `rsvps`
  from logged-out visitors so every card showed `0 going`. Fix: a
  dedicated `public_event_going_counts(uuid[])` RPC that returns only
  aggregate counts for `published` events — no PII, no RSVP rows leak.
- **`host_invites` SELECT was too broad.** The first version let any
  host member (including checkers) read invite tokens, which is a
  privilege-escalation footgun — a checker could grab a `host`-role
  invite. Tightened to `has_host_role(..., 'host')`.
- **"Coming soon" tooltip on the Paid pricing radio.** First implementation
  put the tooltip trigger directly on the disabled `<RadioGroupItem>`. The
  disabled element swallowed pointer events so the tooltip never fired.
  Wrapped the trigger in a focusable `<span>` instead.
- **TanStack Start import-graph footguns.** A couple of times an admin
  client got pulled into the client bundle through a long import chain
  (`__root → use-auth → server-fn helper → client.server`). The fix is
  always the same: keep `*.functions.ts` files thin (only `createServerFn`
  declarations), move shared helpers into `*.server.ts` so the bundler
  hard-blocks them from the client.

## 4. Notable decisions

- **Roles in their own table (`host_members`)** instead of a column on
  `profiles`. Standard advice — prevents privilege escalation and keeps
  a user's roles per-host.
- **Slug-based routes for hosts and events** (`/hosts/<slug>`,
  `/events/<slug>`) so URLs are shareable and human-readable, with
  uniqueness enforced at the DB layer.
- **Unlisted vs Public** is a separate column from `status`
  (`draft` / `published`) so an event can be published-but-unlisted —
  link-only invites without going through draft mode again.
- **Feedback gating in a trigger, not the client.** The `validate_feedback`
  trigger raises if the user didn't RSVP `going` or the event hasn't ended,
  so a malicious client can't bypass it by calling the table directly.
- **No camera dependency for check-in.** The spec allowed manual code
  entry, so we ship just that — paste the 8-char code, press Enter. QR
  codes are still printed on tickets so any external scanner app can
  feed the code into the input.
- **`Add to Calendar` is a generated `.ics`** rather than a Google
  Calendar deeplink, so it works for Apple Calendar / Outlook too.
- **Reports are a single `reports` table** with a `target_type`
  discriminator (`event` / `photo`) — fewer tables, one review queue,
  RLS scoped through `is_report_host_member`.
- **Lovable AI / Lovable Cloud only.** No third-party API keys; auth,
  storage, realtime, edge functions, and the Postgres database are all
  managed via the Lovable Cloud integration.

## 5. Known limitations / future work

- Paid events: UI hook is in place (toggle + tooltip), Stripe wiring is
  stubbed out for v2.
- No email delivery yet (ticket confirmation, waitlist promotion). The
  in-app `/my-tickets` page surfaces the same info and the `.ics`
  download covers the calendar add — adding Resend/Postmark is a
  one-edge-function change.
- No rate-limiting on the `report` flow beyond RLS — fine for a demo,
  would want a per-user-per-day cap in production.
- `public_event_going_counts` returns `bigint` from Postgres; the
  client coerces to `Number`. Fine until a single event has >2^53
  attendees, which we are willing to bet against.
