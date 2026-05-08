
DO $$
DECLARE
  names text[] := ARRAY[
    'Aigerim Bekova','Nurlan Aitmatov','Aizada Sultanova','Bekzat Osmonov','Cholpon Toktosunova',
    'Daniyar Joldoshev','Elmira Karimova','Farrukh Tashkentov','Gulnara Asanova','Hasan Mirzoyev',
    'Iskender Beishenaliev','Jamilya Akmatova','Kanat Nogoibaev','Leila Yusupova','Marat Sydykov',
    'Nargiza Omurova','Omar Qodirov','Perizat Kalybekova','Rustam Abdullaev','Saltanat Imanalieva',
    'Talant Bakirov','Umai Choibekova','Vasily Petrov','Wendy Lin','Xenia Romanova',
    'Yusuf Ergashev','Zarina Mukhtarova','Adil Ryskulov','Bermet Asylbekova','Chyngyz Junior',
    'Diana Kim','Erbol Tashtanaliev','Feruza Niyazova','Gulzat Beksultanova','Hayrullo Karimov',
    'Indira Chodronova','Jakshylyk Maamytov','Klara Esengulova','Lazzat Aidarova','Maksat Turdu',
    'Nadira Sharipova','Otabek Yuldashev','Pirmat Aliev','Rakhat Bekboeva','Sanjar Mamatov'
  ];
  uid uuid;
  i int;
  email_local text;
  full_name text;
  ev_id uuid := '5783a27c-3796-4167-ba29-c7ecfd759b5e';
  st text;
  checked timestamptz;
  wpos int;
BEGIN
  FOR i IN 1..array_length(names,1) LOOP
    full_name := names[i];
    email_local := lower(regexp_replace(full_name, '[^a-zA-Z]+', '.', 'g')) || '.' || i || '@example.com';
    uid := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      email_local, crypt('seedpassword', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', full_name),
      now() - interval '60 days', now(), '', '', '', ''
    );

    INSERT INTO profiles (id, full_name) VALUES (uid, full_name) ON CONFLICT (id) DO NOTHING;

    IF i <= 40 THEN st := 'going'; wpos := NULL;
       checked := CASE WHEN i <= 32 THEN '2026-04-25 08:00:00+00'::timestamptz + (i * interval '90 seconds') ELSE NULL END;
    ELSIF i <= 44 THEN st := 'waitlisted'; wpos := i - 40; checked := NULL;
    ELSE st := 'cancelled'; wpos := NULL; checked := NULL;
    END IF;

    INSERT INTO rsvps (event_id, user_id, status, checked_in_at, waitlist_position)
    VALUES (ev_id, uid, st, checked, wpos);
  END LOOP;
END $$;
