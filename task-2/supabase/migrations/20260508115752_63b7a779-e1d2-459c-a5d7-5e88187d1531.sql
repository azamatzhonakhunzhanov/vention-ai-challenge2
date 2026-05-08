-- Replace promote_from_waitlist to also renumber waitlist after promotion
CREATE OR REPLACE FUNCTION public.promote_from_waitlist(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _capacity int;
  _going_count int;
  _slot_open int;
BEGIN
  SELECT capacity INTO _capacity FROM public.events WHERE id = _event_id FOR UPDATE;
  IF _capacity IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO _going_count FROM public.rsvps
    WHERE event_id = _event_id AND status = 'going';
  _slot_open := _capacity - _going_count;

  IF _slot_open > 0 THEN
    UPDATE public.rsvps
    SET status = 'going',
        promoted_from_waitlist_at = now(),
        waitlist_position = NULL
    WHERE id IN (
      SELECT id FROM public.rsvps
      WHERE event_id = _event_id AND status = 'waitlisted'
      ORDER BY waitlist_position NULLS LAST, created_at
      LIMIT _slot_open
    );
  END IF;

  -- Renumber remaining waitlist starting at 1
  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY waitlist_position NULLS LAST, created_at) AS rn
    FROM public.rsvps
    WHERE event_id = _event_id AND status = 'waitlisted'
  )
  UPDATE public.rsvps r
  SET waitlist_position = o.rn
  FROM ordered o
  WHERE r.id = o.id AND r.waitlist_position IS DISTINCT FROM o.rn;
END;
$$;

-- Trigger function for rsvps: when status flips to 'cancelled' from a non-cancelled state
CREATE OR REPLACE FUNCTION public.handle_rsvp_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status,'') <> 'cancelled' THEN
    PERFORM public.promote_from_waitlist(NEW.event_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rsvps_status_change ON public.rsvps;
CREATE TRIGGER rsvps_status_change
AFTER UPDATE OF status ON public.rsvps
FOR EACH ROW
EXECUTE FUNCTION public.handle_rsvp_status_change();

-- Trigger function for events: when capacity grows
CREATE OR REPLACE FUNCTION public.handle_event_capacity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.capacity > COALESCE(OLD.capacity, 0) THEN
    PERFORM public.promote_from_waitlist(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_capacity_change ON public.events;
CREATE TRIGGER events_capacity_change
AFTER UPDATE OF capacity ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_capacity_change();