DROP POLICY IF EXISTS "Host members read invites" ON public.host_invites;

CREATE POLICY "Hosts read invites"
ON public.host_invites
FOR SELECT
TO authenticated
USING (has_host_role(host_id, auth.uid(), 'host'));