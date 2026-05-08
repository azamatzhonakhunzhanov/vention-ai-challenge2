-- Broaden RSVP read access to all host members (was: only 'host' role)
DROP POLICY IF EXISTS "Own rsvp or host can read" ON public.rsvps;

CREATE POLICY "Own rsvp or host member can read"
ON public.rsvps
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_event_host_member(event_id, auth.uid()));

-- Public going-counts RPC for the explore page (anon-safe, no PII)
CREATE OR REPLACE FUNCTION public.public_event_going_counts(p_event_ids uuid[])
RETURNS TABLE(event_id uuid, going_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.event_id, count(*)::bigint AS going_count
  FROM public.rsvps r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.event_id = ANY(p_event_ids)
    AND r.status = 'going'
    AND e.status = 'published'
  GROUP BY r.event_id;
$$;

GRANT EXECUTE ON FUNCTION public.public_event_going_counts(uuid[]) TO anon, authenticated;