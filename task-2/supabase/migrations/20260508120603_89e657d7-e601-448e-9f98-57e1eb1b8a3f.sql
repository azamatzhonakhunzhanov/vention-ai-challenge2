CREATE OR REPLACE FUNCTION public.export_event_attendees(p_event_id uuid)
RETURNS TABLE(name text, email text, rsvp_status text, check_in_time timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.event_has_host_role(p_event_id, auth.uid(), 'host') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    COALESCE(p.full_name, '') AS name,
    COALESCE(u.email, '') AS email,
    r.status AS rsvp_status,
    r.checked_in_at AS check_in_time
  FROM public.rsvps r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN auth.users u ON u.id = r.user_id
  WHERE r.event_id = p_event_id
  ORDER BY r.status, p.full_name NULLS LAST;
END;
$$;