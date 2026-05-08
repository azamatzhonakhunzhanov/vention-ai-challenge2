CREATE OR REPLACE FUNCTION public.rsvp_to_event(p_event_id uuid)
RETURNS public.rsvps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _capacity int;
  _ends_at timestamptz;
  _status_event text;
  _going_count int;
  _next_pos int;
  _existing public.rsvps;
  _new public.rsvps;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  SELECT capacity, ends_at, status
    INTO _capacity, _ends_at, _status_event
    FROM public.events
    WHERE id = p_event_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  IF _status_event <> 'published' THEN
    RAISE EXCEPTION 'Event is not published';
  END IF;
  IF _ends_at <= now() THEN
    RAISE EXCEPTION 'Event has ended';
  END IF;

  SELECT * INTO _existing FROM public.rsvps
    WHERE event_id = p_event_id AND user_id = _uid
    LIMIT 1;

  IF FOUND THEN
    IF _existing.status IN ('going','waitlisted') THEN
      RETURN _existing;
    END IF;
    -- previously cancelled: re-evaluate
    SELECT count(*) INTO _going_count FROM public.rsvps
      WHERE event_id = p_event_id AND status = 'going';
    IF _going_count < _capacity THEN
      UPDATE public.rsvps
        SET status = 'going', waitlist_position = NULL
        WHERE id = _existing.id
        RETURNING * INTO _new;
    ELSE
      SELECT COALESCE(MAX(waitlist_position),0)+1 INTO _next_pos
        FROM public.rsvps WHERE event_id = p_event_id AND status = 'waitlisted';
      UPDATE public.rsvps
        SET status = 'waitlisted', waitlist_position = _next_pos
        WHERE id = _existing.id
        RETURNING * INTO _new;
    END IF;
    RETURN _new;
  END IF;

  SELECT count(*) INTO _going_count FROM public.rsvps
    WHERE event_id = p_event_id AND status = 'going';

  IF _going_count < _capacity THEN
    INSERT INTO public.rsvps (event_id, user_id, status)
      VALUES (p_event_id, _uid, 'going')
      RETURNING * INTO _new;
  ELSE
    SELECT COALESCE(MAX(waitlist_position),0)+1 INTO _next_pos
      FROM public.rsvps WHERE event_id = p_event_id AND status = 'waitlisted';
    INSERT INTO public.rsvps (event_id, user_id, status, waitlist_position)
      VALUES (p_event_id, _uid, 'waitlisted', _next_pos)
      RETURNING * INTO _new;
  END IF;

  RETURN _new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rsvp_to_event(uuid) TO authenticated;