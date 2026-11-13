-- An explicit link to an existing reply, not a synthetic reply or dismissal.
ALTER TABLE public.checkins
  ADD COLUMN inbox_reply_id uuid REFERENCES public.inbox_messages(id);

COMMENT ON COLUMN public.checkins.inbox_reply_id IS
  'Verified admin inbox reply to this check-in follow-up. Original replies/timestamps stay intact; newer client follow-ups reopen.';

CREATE FUNCTION public.validate_checkin_inbox_reply()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.inbox_reply_id IS NOT DISTINCT FROM OLD.inbox_reply_id THEN
    RETURN NEW;
  END IF;
  IF NEW.inbox_reply_id IS NULL AND TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF current_user NOT IN ('postgres', 'supabase_admin') AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only the service role may link a verified inbox reply';
  END IF;
  IF NEW.inbox_reply_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.inbox_messages m
    WHERE m.id = NEW.inbox_reply_id
      AND m.client_id = NEW.client_id AND m.sender_role = 'admin'
      AND length(trim(m.message)) > 0
      AND m.created_at > greatest(NEW.created_at, NEW.client_replied_at)
  ) THEN
    RAISE EXCEPTION 'Inbox reply must be an admin message after this client check-in follow-up';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER checkin_inbox_reply_validation
  BEFORE INSERT OR UPDATE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.validate_checkin_inbox_reply();
