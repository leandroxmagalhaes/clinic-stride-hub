REVOKE EXECUTE ON FUNCTION public.ensure_portal_account_link(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_portal_account_link(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_portal_account_link(uuid, text, text, text) TO authenticated;