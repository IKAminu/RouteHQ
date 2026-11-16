REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated;

COMMENT ON FUNCTION public.rls_auto_enable() IS
  'Internal event-trigger function that enables RLS on new public tables. Execution is restricted to database administration roles.';
