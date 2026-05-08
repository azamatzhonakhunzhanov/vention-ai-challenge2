
-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- HOSTS
-- =========================================
CREATE TABLE public.hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  logo_url text,
  bio text,
  contact_email text NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hosts ENABLE ROW LEVEL SECURITY;

-- =========================================
-- HOST MEMBERS
-- =========================================
CREATE TABLE public.host_members (
  host_id uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('host','checker')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (host_id, user_id)
);
ALTER TABLE public.host_members ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_host_member(_host_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.host_members
    WHERE host_id = _host_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_host_role(_host_id uuid, _user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.host_members
    WHERE host_id = _host_id AND user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_host_owner(_host_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hosts WHERE id = _host_id AND owner_id = _user_id
  );
$$;

-- Hosts policies
CREATE POLICY "Hosts public select" ON public.hosts FOR SELECT USING (true);
CREATE POLICY "Authenticated can create host"
  ON public.hosts FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates host"
  ON public.hosts FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owner deletes host"
  ON public.hosts FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Host members policies
CREATE POLICY "Members can read host_members"
  ON public.host_members FOR SELECT TO authenticated
  USING (public.is_host_member(host_id, auth.uid()));
CREATE POLICY "Owner inserts members"
  ON public.host_members FOR INSERT TO authenticated
  WITH CHECK (public.is_host_owner(host_id, auth.uid()));
CREATE POLICY "Owner deletes members"
  ON public.host_members FOR DELETE TO authenticated
  USING (public.is_host_owner(host_id, auth.uid()) OR user_id = auth.uid());

-- Trigger: when a host is created, add owner as 'host' member
CREATE OR REPLACE FUNCTION public.handle_new_host()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.host_members (host_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'host')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_host_created
  AFTER INSERT ON public.hosts
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_host();

-- =========================================
-- HOST INVITES
-- =========================================
CREATE TABLE public.host_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('host','checker')),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  expires_at timestamptz,
  used_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.host_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host members read invites"
  ON public.host_invites FOR SELECT TO authenticated
  USING (public.is_host_member(host_id, auth.uid()));
CREATE POLICY "Hosts create invites"
  ON public.host_invites FOR INSERT TO authenticated
  WITH CHECK (public.has_host_role(host_id, auth.uid(), 'host'));
CREATE POLICY "Hosts update invites"
  ON public.host_invites FOR UPDATE TO authenticated
  USING (public.has_host_role(host_id, auth.uid(), 'host'));
CREATE POLICY "Hosts delete invites"
  ON public.host_invites FOR DELETE TO authenticated
  USING (public.has_host_role(host_id, auth.uid(), 'host'));

-- =========================================
-- EVENTS
-- =========================================
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  time_zone text NOT NULL DEFAULT 'UTC',
  venue_address text,
  online_url text,
  capacity int NOT NULL DEFAULT 50,
  cover_image_url text,
  visibility text NOT NULL CHECK (visibility IN ('public','unlisted')) DEFAULT 'public',
  status text NOT NULL CHECK (status IN ('draft','published')) DEFAULT 'draft',
  is_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published events"
  ON public.events FOR SELECT
  USING (
    status = 'published'
    OR public.is_host_member(host_id, auth.uid())
  );
CREATE POLICY "Hosts insert events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.has_host_role(host_id, auth.uid(), 'host'));
CREATE POLICY "Hosts update events"
  ON public.events FOR UPDATE TO authenticated
  USING (public.has_host_role(host_id, auth.uid(), 'host'));
CREATE POLICY "Hosts delete events"
  ON public.events FOR DELETE TO authenticated
  USING (public.has_host_role(host_id, auth.uid(), 'host'));

-- helpers for event-based access
CREATE OR REPLACE FUNCTION public.is_event_host_member(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.host_members hm ON hm.host_id = e.host_id
    WHERE e.id = _event_id AND hm.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.event_has_host_role(_event_id uuid, _user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.host_members hm ON hm.host_id = e.host_id
    WHERE e.id = _event_id AND hm.user_id = _user_id AND hm.role = _role
  );
$$;

-- =========================================
-- RSVPS
-- =========================================
CREATE TABLE public.rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('going','waitlisted','cancelled')),
  waitlist_position int,
  ticket_code text UNIQUE NOT NULL DEFAULT upper(substring(encode(gen_random_bytes(6),'hex') for 8)),
  checked_in_at timestamptz,
  promoted_from_waitlist_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own rsvp or host member can read"
  ON public.rsvps FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_event_host_member(event_id, auth.uid()));
CREATE POLICY "Users insert own rsvp"
  ON public.rsvps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own rsvp"
  ON public.rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Waitlist promotion (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.promote_from_waitlist(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _capacity int;
  _going_count int;
  _slot_open int;
BEGIN
  SELECT capacity INTO _capacity FROM public.events WHERE id = _event_id;
  SELECT count(*) INTO _going_count FROM public.rsvps
    WHERE event_id = _event_id AND status = 'going';
  _slot_open := _capacity - _going_count;
  IF _slot_open <= 0 THEN RETURN; END IF;

  UPDATE public.rsvps
  SET status = 'going',
      promoted_from_waitlist_at = now(),
      waitlist_position = NULL
  WHERE id IN (
    SELECT id FROM public.rsvps
    WHERE event_id = _event_id AND status = 'waitlisted'
    ORDER BY waitlist_position NULLS LAST, created_at
    LIMIT _slot_open
  );
END;
$$;

-- =========================================
-- GALLERY ITEMS
-- =========================================
CREATE TABLE public.gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','approved','hidden')) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gallery select"
  ON public.gallery_items FOR SELECT
  USING (
    status = 'approved'
    OR user_id = auth.uid()
    OR public.is_event_host_member(event_id, auth.uid())
  );
CREATE POLICY "Authenticated insert gallery"
  ON public.gallery_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Hosts moderate gallery"
  ON public.gallery_items FOR UPDATE TO authenticated
  USING (public.event_has_host_role(event_id, auth.uid(), 'host'));
CREATE POLICY "Hosts delete gallery"
  ON public.gallery_items FOR DELETE TO authenticated
  USING (public.event_has_host_role(event_id, auth.uid(), 'host'));

-- =========================================
-- FEEDBACK
-- =========================================
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads feedback"
  ON public.feedback FOR SELECT USING (true);

-- Validation trigger: only allow feedback from confirmed attendees, after event ended
CREATE OR REPLACE FUNCTION public.validate_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ends_at timestamptz;
  _has_going boolean;
BEGIN
  IF NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot submit feedback as another user';
  END IF;
  SELECT ends_at INTO _ends_at FROM public.events WHERE id = NEW.event_id;
  IF _ends_at IS NULL OR _ends_at > now() THEN
    RAISE EXCEPTION 'Feedback only allowed after the event has ended';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.rsvps
    WHERE event_id = NEW.event_id AND user_id = NEW.user_id AND status = 'going'
  ) INTO _has_going;
  IF NOT _has_going THEN
    RAISE EXCEPTION 'Must have RSVP''d going to leave feedback';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_feedback_trigger
  BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.validate_feedback();

CREATE POLICY "Authenticated insert feedback"
  ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own feedback"
  ON public.feedback FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- =========================================
-- REPORTS
-- =========================================
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('event','photo')),
  target_id uuid NOT NULL,
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  status text NOT NULL CHECK (status IN ('open','hidden','dismissed')) DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member of host responsible for the report's target
CREATE OR REPLACE FUNCTION public.is_report_host_member(_target_type text, _target_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _target_type = 'event' THEN EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.host_members hm ON hm.host_id = e.host_id
      WHERE e.id = _target_id AND hm.user_id = _user_id
    )
    WHEN _target_type = 'photo' THEN EXISTS (
      SELECT 1 FROM public.gallery_items g
      JOIN public.events e ON e.id = g.event_id
      JOIN public.host_members hm ON hm.host_id = e.host_id
      WHERE g.id = _target_id AND hm.user_id = _user_id
    )
    ELSE false
  END;
$$;

CREATE POLICY "Authenticated insert reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Host members read reports"
  ON public.reports FOR SELECT TO authenticated
  USING (public.is_report_host_member(target_type, target_id, auth.uid()));
CREATE POLICY "Host members update reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (public.is_report_host_member(target_type, target_id, auth.uid()));

-- =========================================
-- CHECK-IN LOG
-- =========================================
CREATE TABLE public.check_in_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id uuid NOT NULL REFERENCES public.rsvps(id) ON DELETE CASCADE,
  checker_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL CHECK (action IN ('check_in','undo')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.check_in_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_rsvp_host_member(_rsvp_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rsvps r
    JOIN public.events e ON e.id = r.event_id
    JOIN public.host_members hm ON hm.host_id = e.host_id
    WHERE r.id = _rsvp_id AND hm.user_id = _user_id
  );
$$;

CREATE POLICY "Host members read check-in log"
  ON public.check_in_log FOR SELECT TO authenticated
  USING (public.is_rsvp_host_member(rsvp_id, auth.uid()));
CREATE POLICY "Host members insert check-in log"
  ON public.check_in_log FOR INSERT TO authenticated
  WITH CHECK (
    public.is_rsvp_host_member(rsvp_id, auth.uid())
    AND checker_id = auth.uid()
  );

-- =========================================
-- INDEXES
-- =========================================
CREATE INDEX idx_events_host_id ON public.events(host_id);
CREATE INDEX idx_events_status_visibility_starts ON public.events(status, visibility, starts_at);
CREATE INDEX idx_rsvps_event_status ON public.rsvps(event_id, status);
CREATE INDEX idx_rsvps_user ON public.rsvps(user_id);
CREATE INDEX idx_gallery_event_status ON public.gallery_items(event_id, status);
CREATE INDEX idx_reports_status_target ON public.reports(status, target_type);

-- =========================================
-- STORAGE BUCKETS (public read)
-- =========================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('host-logos', 'host-logos', true),
  ('event-covers', 'event-covers', true),
  ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read; authenticated upload to own folder (first folder = user id)
CREATE POLICY "Public read host-logos"
  ON storage.objects FOR SELECT USING (bucket_id = 'host-logos');
CREATE POLICY "Auth upload host-logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'host-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth update own host-logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'host-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth delete own host-logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'host-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read event-covers"
  ON storage.objects FOR SELECT USING (bucket_id = 'event-covers');
CREATE POLICY "Auth upload event-covers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth update own event-covers"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth delete own event-covers"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read gallery"
  ON storage.objects FOR SELECT USING (bucket_id = 'gallery');
CREATE POLICY "Auth upload gallery"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth update own gallery"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth delete own gallery"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);
