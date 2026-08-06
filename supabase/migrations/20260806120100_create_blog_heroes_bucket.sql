-- Public Storage bucket for blog-post hero images, keyed by slug:
--   blog-heroes/<slug>.webp
--
-- Populated out-of-band by Code/supabase/scripts/seed-blog-posts.mjs (service
-- role). Public so next/image can fetch + optimize them server-side and any of
-- the three sites (wegood4u / thaigood4u / msiagood4u) can render them by URL.
--
-- Idempotent: ON CONFLICT (id) DO NOTHING.
--
-- VERIFY:
--   SELECT id, name, public FROM storage.buckets WHERE id = 'blog-heroes';

INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-heroes', 'blog-heroes', true)
ON CONFLICT (id) DO NOTHING;
