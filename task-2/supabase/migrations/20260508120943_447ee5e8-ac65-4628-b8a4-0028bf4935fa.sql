-- Realtime for rsvps
ALTER TABLE public.rsvps REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rsvps';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.rsvps';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_in_rsvp(p_event_id uuid, p_ticket_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_member boolean;
  _r public.rsvps;
  _name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT public.is_event_host_member(p_event_id, _uid) INTO _is_member;
  IF NOT _is_member THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT * INTO _r FROM public.rsvps
    WHERE event_id = p_event_id AND ticket_code = upper(trim(p_ticket_code))
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result','not_found');
  END IF;

  SELECT COALESCE(p.full_name, '') INTO _name FROM public.profiles p WHERE p.id = _r.user_id;

  IF _r.status <> 'going' THEN
    RETURN jsonb_build_object('result','not_going','status',_r.status,'name',_name);
  END IF;

  IF _r.checked_in_at IS NOT NULL THEN
    RETURN jsonb_build_object('result','already','checked_in_at',_r.checked_in_at,'name',_name,'rsvp_id',_r.id);
  END IF;

  UPDATE public.rsvps SET checked_in_at = now() WHERE id = _r.id RETURNING * INTO _r;
  INSERT INTO public.check_in_log (rsvp_id, checker_id, action) VALUES (_r.id, _uid, 'check_in');

  RETURN jsonb_build_object('result','ok','rsvp_id',_r.id,'name',_name,'checked_in_at',_r.checked_in_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_check_in(p_rsvp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _r public.rsvps;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO _r FROM public.rsvps WHERE id = p_rsvp_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF NOT public.is_event_host_member(_r.event_id, _uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.rsvps SET checked_in_at = NULL WHERE id = p_rsvp_id;
  INSERT INTO public.check_in_log (rsvp_id, checker_id, action) VALUES (p_rsvp_id, _uid, 'undo');
  RETURN jsonb_build_object('result','ok');
END;
$$;