-- One feedback per user per event
CREATE UNIQUE INDEX IF NOT EXISTS feedback_user_event_unique ON public.feedback (user_id, event_id);

-- Storage policies for gallery bucket
DO $$ BEGIN
  CREATE POLICY "Authenticated upload to gallery"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'gallery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update gallery objects"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'gallery' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete gallery objects"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'gallery' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;