-- `your-father-cnx` was seeded pointing at another store's image file
-- (partner-store-images/colxlab.webp). Point it at its own image, so a future
-- re-upload of colxlab's photo cannot change what this store shows.
UPDATE "public"."partner_stores"
SET "image" = 'https://dimpgwotujtaacoajisn.supabase.co/storage/v1/object/public/partner-store-images/Your%20Father%20CNX.webp'
WHERE "id" = 'your-father-cnx';
