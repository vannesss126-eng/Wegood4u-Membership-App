-- Central blog/story store shared by the wegood4u / thaigood4u / msiagood4u
-- Next.js sites. One row per post; `brands[]` tags which sites display it and
-- `country` its geographic focus, so each site fetches only its slice — at BUILD
-- time (SSG/ISR), so there is no per-request DB hit. Migrated from the 27 static
-- posts in Web/src/data/stories/* plus the thaigood4u/msiagood4u WP archives.
--
-- Security (matches CLAUDE.md "anon key only, RLS on"):
--   * PUBLISHED posts are world-readable (anon + authenticated); drafts are private.
--   * Writes are limited to admins (public.is_admin) and the service_role
--     (migrations + Supabase Studio). No other role can insert / edit / delete.
--
-- VERIFY:
--   SELECT count(*) FROM public.blog_posts;                 -- 27 after seeding
--   SELECT slug, country, brands FROM public.blog_posts LIMIT 5;

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  title             text NOT NULL,
  meta_title        text NOT NULL,
  meta_description  text NOT NULL,
  excerpt           text NOT NULL,
  content           text NOT NULL,                          -- first-party markdown
  category          text NOT NULL CHECK (category IN ('Food','Travel','Lifestyle')),
  country           text NOT NULL CHECK (country IN ('Malaysia','Thailand')),
  city              text NOT NULL,
  brands            text[] NOT NULL DEFAULT '{}'::text[]
                      CHECK (brands <@ ARRAY['wegood4u','thaigood4u','msiagood4u']),
  hero_url          text NOT NULL,                          -- Supabase Storage public URL
  hero_alt          text NOT NULL,
  youtube_id        text,
  venue_id          text,                                   -- soft ref -> partner_stores.id
  status            text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  published_at      date NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.blog_posts IS
  'Shared blog/story content for the wegood4u / thaigood4u / msiagood4u Next.js sites. Public-read (published only); writes via admins + service_role.';

-- Indexes for the queries each site runs: newest-first, by site, by region.
CREATE INDEX IF NOT EXISTS blog_posts_published_at_idx ON public.blog_posts (published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_status_idx        ON public.blog_posts (status);
CREATE INDEX IF NOT EXISTS blog_posts_country_idx       ON public.blog_posts (country);
CREATE INDEX IF NOT EXISTS blog_posts_brands_gin        ON public.blog_posts USING gin (brands);

-- Keep updated_at fresh, reusing the project's shared trigger function.
DROP TRIGGER IF EXISTS blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Public read of PUBLISHED posts only (drafts stay private). Mirrors the
-- partner_stores "public read" policy so signed-out visitors get the blog.
DROP POLICY IF EXISTS "public read published blog posts" ON public.blog_posts;
CREATE POLICY "public read published blog posts"
  ON public.blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Admins may create / edit / delete (and read drafts). The service_role bypasses
-- RLS entirely, so migrations + Supabase Studio can always manage posts. Nobody
-- else can write.
DROP POLICY IF EXISTS "admins manage blog posts" ON public.blog_posts;
CREATE POLICY "admins manage blog posts"
  ON public.blog_posts
  FOR ALL
  TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));
