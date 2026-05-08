CREATE OR REPLACE FUNCTION public.event_check_in_counters(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _going int;
  _checked int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT public.is_event_host_member(p_event_id, _uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT count(*) INTO _going FROM public.rsvps WHERE event_id = p_event_id AND status = 'going';
  SELECT count(*) INTO _checked FROM public.rsvps WHERE event_id = p_event_id AND checked_in_at IS NOT NULL;
  RETURN jsonb_build_object('going', _going, 'checked_in', _checked);
END;
$$;

CREATE OR REPLACE FUNCTION public.recent_check_ins(p_event_id uuid, p_limit int DEFAULT 10)
RETURNS TABLE(rsvp_id uuid, name text, checked_in_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT public.is_event_host_member(p_event_id, _uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT r.id, COALESCE(p.full_name, 'Guest'), r.checked_in_at
  FROM public.rsvps r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.event_id = p_event_id AND r.checked_in_at IS NOT NULL
  ORDER BY r.checked_in_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_last_check_in(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rsvp_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT public.is_event_host_member(p_event_id, _uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT l.rsvp_id INTO _rsvp_id
  FROM public.check_in_log l
  JOIN public.rsvps r ON r.id = l.rsvp_id
  WHERE l.checker_id = _uid AND l.action = 'check_in' AND r.event_id = p_event_id
    AND r.checked_in_at IS NOT NULL
  ORDER BY l.created_at DESC
  LIMIT 1;
  IF _rsvp_id IS NULL THEN
    RETURN jsonb_build_object('result','none');
  END IF;
  UPDATE public.rsvps SET checked_in_at = NULL WHERE id = _rsvp_id;
  INSERT INTO public.check_in_log (rsvp_id, checker_id, action) VALUES (_rsvp_id, _uid, 'undo');
  RETURN jsonb_build_object('result','ok','rsvp_id',_rsvp_id);
END;
$$;