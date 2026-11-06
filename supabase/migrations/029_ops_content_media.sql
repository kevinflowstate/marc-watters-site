-- Private originals for exact-version content review. Server routes enforce admin access.
-- No public or authenticated-client Storage policies are added.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ops-content-media', 'ops-content-media', false, 3145728, ARRAY['image/png','image/jpeg'])
ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM storage.buckets
   WHERE id='ops-content-media' AND public=false AND file_size_limit<=3145728 AND file_size_limit>0)
 THEN RAISE EXCEPTION 'ops-content-media must remain private and limited to 3 MiB'; END IF;
END $$;
