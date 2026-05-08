GRANT EXECUTE ON FUNCTION public.is_host_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_host_role(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_host_owner(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_host_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_has_host_role(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_rsvp_host_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_report_host_member(text, uuid, uuid) TO anon, authenticated;