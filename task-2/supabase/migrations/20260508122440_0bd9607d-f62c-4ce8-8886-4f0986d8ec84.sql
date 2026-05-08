DROP FUNCTION IF EXISTS public.recent_check_ins(uuid, integer);

CREATE OR REPLACE FUNCTION public.recent_check_ins(p_event_id uuid, p_limit integer DEFAULT 10)
 RETURNS TABLE(rsvp_id uuid, name text, checked_in_at timestamp with time zone, checker_id uuid, checker_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT public.is_event_host_member(p_event_id, _uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT
    r.id AS rsvp_id,
    COALESCE(p.full_name, 'Guest') AS name,
    r.checked_in_at,
    l.checker_id,
    COALESCE(cp.full_name, '') AS checker_name
  FROM public.rsvps r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN LATERAL (
    SELECT cl.checker_id, cl.created_at
    FROM public.check_in_log cl
    WHERE cl.rsvp_id = r.id AND cl.action = 'check_in'
    ORDER BY cl.created_at DESC
    LIMIT 1
  ) l ON TRUE
  LEFT JOIN public.profiles cp ON cp.id = l.checker_id
  WHERE r.event_id = p_event_id AND r.checked_in_at IS NOT NULL
  ORDER BY r.checked_in_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
END;
$function$;