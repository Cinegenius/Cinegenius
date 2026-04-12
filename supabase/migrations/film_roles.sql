-- ─────────────────────────────────────────────────────────────────
-- CineGenius – Film Departments & Roles
-- Run once in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- 1. Departments (Gewerke)
CREATE TABLE IF NOT EXISTS departments (
  id   TEXT PRIMARY KEY,        -- e.g. "kamera"
  name TEXT NOT NULL,           -- e.g. "Kamera"
  sort_order INTEGER DEFAULT 0
);

-- 2. Roles (Filmberufe)
CREATE TABLE IF NOT EXISTS roles (
  id              TEXT PRIMARY KEY,    -- e.g. "focus-puller"
  department_id   TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role_name       TEXT NOT NULL,       -- e.g. "1. AC / Focus Puller"
  role_name_en    TEXT,                -- e.g. "1st AC / Focus Puller"
  sort_order      INTEGER DEFAULT 0
);

-- 3. User ↔ Role mapping (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id    TEXT NOT NULL,   -- Clerk user_id
  role_id    TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_roles_dept   ON roles(department_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_u ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_r ON user_roles(role_id);

-- ─────────────────────────────────────────────────────────────────
-- Seed: Departments
-- ─────────────────────────────────────────────────────────────────
INSERT INTO departments (id, name, sort_order) VALUES
  ('vor-der-kamera', 'Vor der Kamera',      1),
  ('regie',          'Regie',               2),
  ('kamera',         'Kamera',              3),
  ('licht',          'Licht',               4),
  ('grip',           'Grip',                5),
  ('ton',            'Ton',                 6),
  ('maske',          'Maske & Hair',        7),
  ('kostuem',        'Kostüm',              8),
  ('szenenbild',     'Szenenbild / Art',    9),
  ('produktion',     'Produktion',         10),
  ('post',           'Postproduktion',     11)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- Seed: Roles
-- ─────────────────────────────────────────────────────────────────
INSERT INTO roles (id, department_id, role_name, role_name_en, sort_order) VALUES
  -- Vor der Kamera
  ('hauptdarsteller',   'vor-der-kamera', 'Hauptdarsteller/in',         'Lead Actor/Actress',              1),
  ('nebendarsteller',   'vor-der-kamera', 'Nebendarsteller/in',         'Supporting Actor/Actress',        2),
  ('statist',           'vor-der-kamera', 'Statist / Komparse',         'Background / Extra',              3),
  ('model',             'vor-der-kamera', 'Model',                      'Model',                           4),
  ('stunt-darsteller',  'vor-der-kamera', 'Stunt-Darsteller/in',        'Stunt Performer',                 5),
  ('sprecher',          'vor-der-kamera', 'Sprecher / Voice-Over',      'Voice Actor / Voice-Over',        6),
  -- Regie
  ('regisseur',         'regie',          'Regisseur/in',               'Director',                        1),
  ('1-regieassistenz',  'regie',          '1. Regieassistenz',          '1st Assistant Director (1st AD)', 2),
  ('2-regieassistenz',  'regie',          '2. Regieassistenz',          '2nd Assistant Director (2nd AD)', 3),
  ('script-supervisor', 'regie',          'Script Supervisor',          'Script Supervisor / Continuity',  4),
  ('regieassistenz',    'regie',          'Regieassistenz (Set-Runner)','Set PA / Runner',                 5),
  -- Kamera
  ('dop',               'kamera',         'Director of Photography (DoP)', 'Cinematographer / DoP',        1),
  ('kamera-operator',   'kamera',         'Kamera-Operator',            'Camera Operator',                 2),
  ('focus-puller',      'kamera',         '1. AC / Focus Puller',       '1st AC / Focus Puller',           3),
  ('2nd-ac',            'kamera',         '2. AC / Klappe',             '2nd AC / Clapper Loader',         4),
  ('dit',               'kamera',         'DIT (Digital Imaging Technician)', 'DIT',                       5),
  ('steadicam',         'kamera',         'Steadicam-Operator',         'Steadicam Operator',              6),
  ('drohne',            'kamera',         'Drohnen-Pilot / Aerial',     'Drone Operator / Aerial DP',      7),
  -- Licht
  ('oberbeleuchter',    'licht',          'Oberbeleuchter / Gaffer',    'Gaffer',                          1),
  ('best-boy-licht',    'licht',          'Best Boy Licht',             'Best Boy Electric',               2),
  ('beleuchter',        'licht',          'Beleuchter',                 'Electrician / Lighting Tech',     3),
  -- Grip
  ('key-grip',          'grip',           'Key Grip',                   'Key Grip',                        1),
  ('best-boy-grip',     'grip',           'Best Boy Grip',              'Best Boy Grip',                   2),
  ('dolly-grip',        'grip',           'Dolly Grip',                 'Dolly Grip',                      3),
  ('kran-operator',     'grip',           'Kran-Operator',              'Crane / Jib Operator',            4),
  -- Ton
  ('tonmeister',        'ton',            'Tonmeister / Sound Mixer',   'Production Sound Mixer',          1),
  ('boom-operator',     'ton',            'Boom Operator',              'Boom Operator',                   2),
  ('tonassistenz',      'ton',            'Tonassistenz',               'Sound Assistant',                 3),
  -- Maske
  ('maskenbildner',     'maske',          'Maskenbildner/in',           'Make-up Artist',                  1),
  ('sfx-makeup',        'maske',          'SFX Make-up Artist',         'Special FX Make-up',              2),
  ('hair-stylist',      'maske',          'Hair Stylist',               'Hair Stylist',                    3),
  ('hmu-head',          'maske',          'Head of Make-up & Hair',     'Head of Make-up & Hair',          4),
  -- Kostüm
  ('kostuembildner',    'kostuem',        'Kostümbildner/in',           'Costume Designer',                1),
  ('garderobier',       'kostuem',        'Garderobier/in',             'Wardrobe Supervisor',             2),
  ('kostuemassistenz',  'kostuem',        'Kostümassistenz',            'Costume Assistant',               3),
  -- Szenenbild
  ('production-designer','szenenbild',    'Production Designer',        'Production Designer',             1),
  ('art-director',      'szenenbild',     'Art Director',               'Art Director',                    2),
  ('set-decorator',     'szenenbild',     'Set Decorator',              'Set Decorator',                   3),
  ('requisiteur',       'szenenbild',     'Requisiteur/in',             'Props Master',                    4),
  ('buehnenbildner',    'szenenbild',     'Bühnenbauer/in',             'Set Builder / Construction',      5),
  ('graphic-artist',    'szenenbild',     'Graphic Artist (Art Dept.)', 'Graphic Artist',                  6),
  -- Produktion
  ('produzent',         'produktion',     'Produzent/in',               'Producer',                        1),
  ('line-producer',     'produktion',     'Line Producer',              'Line Producer',                   2),
  ('produktionsleiter', 'produktion',     'Produktionsleiter/in',       'Production Manager',              3),
  ('aufnahmeleiter',    'produktion',     'Aufnahmeleiter/in',          'Unit Production Manager',         4),
  ('produktionsassistenz','produktion',   'Produktionsassistenz',       'Production Assistant (PA)',       5),
  ('location-manager',  'produktion',     'Location Manager',           'Location Manager',                6),
  ('casting-director',  'produktion',     'Casting Director',           'Casting Director',                7),
  -- Postproduktion
  ('cutter',            'post',           'Cutter/in (Editor)',         'Film Editor',                     1),
  ('colorist',          'post',           'Colorist',                   'Colorist / DI',                   2),
  ('vfx-artist',        'post',           'VFX Artist / Compositor',    'VFX Artist / Compositor',         3),
  ('sound-designer',    'post',           'Sound Designer',             'Sound Designer',                  4),
  ('sound-editor',      'post',           'Sound Editor / Cutter',      'Sound Editor',                    5),
  ('motion-designer',   'post',           'Motion Designer',            'Motion Designer',                 6),
  ('online-editor',     'post',           'Online-Editor',              'Online Editor',                   7)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- RLS: user_roles — only own rows readable/writable
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_select" ON user_roles
  FOR SELECT USING (true);  -- readable by all (public profiles)

CREATE POLICY "user_roles_insert" ON user_roles
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "user_roles_delete" ON user_roles
  FOR DELETE USING (auth.uid()::text = user_id);
