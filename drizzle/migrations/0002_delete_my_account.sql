CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  DELETE FROM public.shares WHERE owner = u;
  DELETE FROM public.user_docs WHERE user_id = u;
  DELETE FROM auth.users WHERE id = u;
END $$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;