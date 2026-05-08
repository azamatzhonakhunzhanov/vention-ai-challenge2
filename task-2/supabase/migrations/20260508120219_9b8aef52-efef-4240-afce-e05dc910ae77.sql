-- Tighten rsvps SELECT: only host-role members can view all RSVPs for an event.
DROP POLICY IF EXISTS "Own rsvp or host member can read" ON public.rsvps;
CREATE POLICY "Own rsvp or host can read"
ON public.rsvps
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.event_has_host_role(event_id, auth.uid(), 'host'));

-- Public invite lookup
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv public.host_invites;
  _host public.hosts;
  _state text;
BEGIN
  SELECT * INTO _inv FROM public.host_invites WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  SELECT * INTO _host FROM public.hosts WHERE id = _inv.host_id;
  _state := CASE
    WHEN _inv.used_at IS NOT NULL THEN 'used'
    WHEN _inv.expires_at IS NOT NULL AND _inv.expires_at < now() THEN 'expired'
    ELSE 'active'
  END;
  RETURN jsonb_build_object(
    'found', true,
    'state', _state,
    'role', _inv.role,
    'host', jsonb_build_object(
      'id', _host.id,
      'slug', _host.slug,
      'name', _host.name,
      'logo_url', _host.logo_url
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;

-- Accept invite
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _inv public.host_invites;
  _host public.hosts;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  SELECT * INTO _inv FROM public.host_invites WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  IF _inv.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite already used';
  END IF;
  IF _inv.expires_at IS NOT NULL AND _inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;

  SELECT * INTO _host FROM public.hosts WHERE id = _inv.host_id;

  INSERT INTO public.host_members (host_id, user_id, role)
  VALUES (_inv.host_id, _uid, _inv.role)
  ON CONFLICT DO NOTHING;

  UPDATE public.host_invites SET used_at = now() WHERE id = _inv.id;

  RETURN jsonb_build_object(
    'host_slug', _host.slug,
    'role', _inv.role
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;