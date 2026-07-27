INSERT INTO "public"."store_referral_codes" ("partner_store_id", "code")
VALUES
  ('robs-berry', 'ROBSBC11'),
  ('groon-bread-brunch', 'GBBCC14'),
  ('cheevit-cheeva', 'CHEECC18')
ON CONFLICT ("partner_store_id") DO UPDATE SET "code" = EXCLUDED."code";