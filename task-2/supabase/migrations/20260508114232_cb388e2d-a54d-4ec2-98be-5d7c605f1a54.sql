
-- Revoke EXECUTE on SECURITY DEFINER helpers from anon/public
REVOKE EXECUTE ON FUNCTION public.is_host_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_host_role(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_host_owner(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_event_host_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.event_has_host_role(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_report_host_member(text, uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_rsvp_host_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.promote_from_waitlist(uuid) FROM anon, public;

-- Restrict storage SELECT to authenticated (bucket files are still publicly accessible by direct URL since buckets are public)
DROP POLICY IF EXISTS "Public read host-logos" ON storage.objects;
DROP POLICY IF EXISTS "Public read event-covers" ON storage.objects;
DROP POLICY IF EXISTS "Public read gallery" ON storage.objects;

CREATE POLICY "Authenticated list host-logos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'host-logos');
CREATE POLICY "Authenticated list event-covers"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'event-covers');
CREATE POLICY "Authenticated list gallery"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'gallery');
