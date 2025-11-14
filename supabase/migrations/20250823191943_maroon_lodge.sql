-- Profiles policies
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Invitation codes policies
DROP POLICY IF EXISTS "Affiliates can read own invitation code" ON public.invitation_codes;
DROP POLICY IF EXISTS "Admins can manage all invitation codes" ON public.invitation_codes;

-- Submissions policies
DROP POLICY IF EXISTS "Users can read own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Members can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can read all submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON public.submissions;

-- Badges policies
DROP POLICY IF EXISTS "Authenticated users can read badges" ON public.badges;

-- User badges policies
DROP POLICY IF EXISTS "Users can read own badges" ON public.user_badges;
DROP POLICY IF EXISTS "System can award badges" ON public.user_badges;

/*
  # Wegood4u Membership Portal Database Schema

  1. New Tables
    - `profiles` - User profile data with questionnaire responses
    - `invitation_codes` - Unique codes for affiliate members
    - `submissions` - Proof of visit submissions for admin review
    - `badges` - Static badge definitions with requirements
    - `user_badges` - Junction table for earned badges
    
  2. Security
    - Enable RLS on all tables
    - Add comprehensive policies for role-based access
    - Secure admin-only operations
    
  3. Automation
    - Auto-create profile on user registration
    - Auto-award badges when milestones are reached
    - Track referral relationships
    
  4. Performance
    - Add indexes for frequently queried columns
    - Optimize for role-based queries
*/

-- #############################################################################
-- ## SECTION 1: CUSTOM TYPES
-- ## This creates custom types to ensure data consistency.
-- #############################################################################

CREATE TYPE public.communication_channel AS ENUM ('WhatsApp', 'Telegram', 'Line', 'WeChat');
CREATE TYPE public.user_role AS ENUM ('subscriber', 'member', 'affiliate', 'admin');
CREATE TYPE public.submission_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.badge_category AS ENUM ('activity', 'cafe', 'restaurant');
CREATE TYPE public.store_category AS ENUM ('cafe', 'restaurant', 'others');

-- #############################################################################
-- ## SECTION 2: TABLE CREATION
-- ## This section creates all the necessary tables for your application.
-- #############################################################################

-- Table: profiles
-- Stores all public user data and links to the Supabase auth system.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  inviter_id uuid REFERENCES public.profiles(id),
  full_name text,
  dob date,
  country_of_residence text,
  preferred_communication_channel public.communication_channel,
  communication_contact_details text,
  travel_destination_category text,
  travel_destination_detail text,
  travel_preference text,
  accommodation_preference text,
  travel_budget text,
  role public.user_role NOT NULL DEFAULT 'subscriber',
  verification_completed boolean DEFAULT false,
  affiliate_request_status text CHECK (affiliate_request_status IN ('pending', 'approved', 'rejected')) DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  avatar_url text
);

COMMENT ON TABLE public.profiles IS 'Stores all public user data and questionnaire responses.';
COMMENT ON COLUMN public.profiles.inviter_id IS 'Tracks who invited this user, forming the affiliate tree.';
COMMENT ON COLUMN public.profiles.role IS 'Current user role: subscriber -> member -> affiliate -> admin';
COMMENT ON COLUMN public.profiles.verification_completed IS 'Whether user completed verification questionnaire to become member';

-- Table: invitation_codes
-- Manages unique codes for affiliate members and tracks their usage.
CREATE TABLE IF NOT EXISTS public.invitation_codes (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  usage_count int NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.invitation_codes IS 'Stores unique invitation codes for affiliate members.';

-- Table: submissions
-- Tracks every proof-of-visit upload from members for admin approval.
CREATE TABLE IF NOT EXISTS public.submissions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_store_name text NOT NULL,
  partner_store_category public.store_category NOT NULL,
  status public.submission_status NOT NULL DEFAULT 'pending',
  selfie_url text NOT NULL,
  receipt_url text NOT NULL,
  admin_notes text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.submissions IS 'Records member submissions for admin review.';
COMMENT ON COLUMN public.submissions.admin_notes IS 'Notes from admin during review process';
COMMENT ON COLUMN public.submissions.reviewed_by IS 'Which admin reviewed this submission';

-- Table: badges
-- A static table defining all possible badges users can earn.
CREATE TABLE IF NOT EXISTS public.badges (
  id serial PRIMARY KEY,
  name text NOT NULL,
  category public.badge_category NOT NULL,
  required_count int NOT NULL,
  image_url text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.badges IS 'Defines all achievable badges and their requirements.';

-- Table: user_badges
-- A join table connecting users to the badges they have earned.
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id int NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

COMMENT ON TABLE public.user_badges IS 'Tracks which users have earned which badges.';

-- #############################################################################
-- ## SECTION 3: INDEXES FOR PERFORMANCE
-- ## Add indexes for frequently queried columns.
-- #############################################################################

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_inviter_id ON public.profiles(inviter_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_partner_store_category ON public.submissions(partner_store_category);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON public.invitation_codes(code);

-- #############################################################################
-- ## SECTION 4: ROW LEVEL SECURITY
-- ## Enable RLS and create policies for secure access.
-- #############################################################################

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
  
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Invitation codes policies
CREATE POLICY "Affiliates can read own invitation code"
  ON public.invitation_codes
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() AND 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('affiliate', 'admin')
    )
  );

CREATE POLICY "Admins can manage all invitation codes"
  ON public.invitation_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Submissions policies
CREATE POLICY "Users can read own submissions"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Members can create submissions"
  ON public.submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('member', 'affiliate', 'admin')
    )
  );

CREATE POLICY "Admins can read all submissions"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update submissions"
  ON public.submissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Badges policies (read-only for authenticated users)
CREATE POLICY "Authenticated users can read badges"
  ON public.badges
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- User badges policies
CREATE POLICY "Users can read own badges"
  ON public.user_badges
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can award badges"
  ON public.user_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- #############################################################################
-- ## SECTION 5: AUTOMATION FUNCTIONS
-- ## Functions for automated processes.
-- #############################################################################

-- 5.1: Create profile on user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'username', 'subscriber');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2: Update invitation code usage count
CREATE OR REPLACE FUNCTION public.increment_invitation_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inviter_id IS NOT NULL THEN
    UPDATE public.invitation_codes 
    SET usage_count = usage_count + 1,
        updated_at = now()
    WHERE user_id = NEW.inviter_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.3: Auto-award badges based on approved submissions
CREATE OR REPLACE FUNCTION public.check_and_award_badges()
RETURNS TRIGGER AS $$
DECLARE
  total_approved_count INT;
  cafe_approved_count INT;
  restaurant_approved_count INT;
  badge_record RECORD;
BEGIN
  -- Only proceed if submission was just approved
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    
    -- Get current counts for the user
    SELECT COUNT(*) INTO total_approved_count
    FROM public.submissions 
    WHERE user_id = NEW.user_id AND status = 'approved';
    
    SELECT COUNT(*) INTO cafe_approved_count
    FROM public.submissions 
    WHERE user_id = NEW.user_id AND status = 'approved' AND partner_store_category = 'cafe';
    
    SELECT COUNT(*) INTO restaurant_approved_count
    FROM public.submissions 
    WHERE user_id = NEW.user_id AND status = 'approved' AND partner_store_category = 'restaurant';
    
    -- Check for activity badges
    FOR badge_record IN 
      SELECT id, required_count 
      FROM public.badges 
      WHERE category = 'activity' AND required_count <= total_approved_count AND is_active = true
    LOOP
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.user_id, badge_record.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
    
    -- Check for cafe badges
    FOR badge_record IN 
      SELECT id, required_count 
      FROM public.badges 
      WHERE category = 'cafe' AND required_count <= cafe_approved_count AND is_active = true
    LOOP
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.user_id, badge_record.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
    
    -- Check for restaurant badges
    FOR badge_record IN 
      SELECT id, required_count 
      FROM public.badges 
      WHERE category = 'restaurant' AND required_count <= restaurant_approved_count AND is_active = true
    LOOP
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (NEW.user_id, badge_record.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.4: Update timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- #############################################################################
-- ## SECTION 6: TRIGGERS
-- ## Set up all triggers for automation.
-- #############################################################################

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for invitation code usage tracking
CREATE TRIGGER on_profile_inviter_set
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.increment_invitation_usage();

-- Trigger for automatic badge awarding
CREATE TRIGGER on_submission_approved
  AFTER UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.check_and_award_badges();

-- Triggers for updated_at timestamps
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER invitation_codes_updated_at
  BEFORE UPDATE ON public.invitation_codes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- #############################################################################
-- ## SECTION 7: HELPER VIEWS
-- ## Create useful views for common queries.
-- #############################################################################

-- View for user statistics
CREATE OR REPLACE VIEW public.user_stats AS
SELECT 
  p.id,
  p.username,
  p.full_name,
  p.role,
  COALESCE(s.total_submissions, 0) as total_submissions,
  COALESCE(s.approved_submissions, 0) as approved_submissions,
  COALESCE(s.pending_submissions, 0) as pending_submissions,
  COALESCE(b.badge_count, 0) as badge_count,
  COALESCE(r.direct_referrals, 0) as direct_referrals,
  p.created_at
FROM public.profiles p
LEFT JOIN (
  SELECT 
    user_id,
    COUNT(*) as total_submissions,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_submissions,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_submissions
  FROM public.submissions
  GROUP BY user_id
) s ON p.id = s.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as badge_count
  FROM public.user_badges
  GROUP BY user_id
) b ON p.id = b.user_id
LEFT JOIN (
  SELECT inviter_id, COUNT(*) as direct_referrals
  FROM public.profiles
  WHERE inviter_id IS NOT NULL
  GROUP BY inviter_id
) r ON p.id = r.inviter_id;

-- View for two-level referral tracking
CREATE OR REPLACE VIEW public.referral_tree AS
WITH RECURSIVE referral_levels AS (
  -- Level 1: Direct referrals
  SELECT 
    p1.inviter_id as affiliate_id,
    p1.id as user_id,
    p1.username,
    p1.full_name,
    1 as level,
    p1.created_at
  FROM public.profiles p1
  WHERE p1.inviter_id IS NOT NULL
  
  UNION ALL
  
  -- Level 2: Referrals of referrals
  SELECT 
    rl.affiliate_id,
    p2.id as user_id,
    p2.username,
    p2.full_name,
    2 as level,
    p2.created_at
  FROM referral_levels rl
  JOIN public.profiles p2 ON p2.inviter_id = rl.user_id
  WHERE rl.level = 1
)
SELECT * FROM referral_levels
ORDER BY affiliate_id, level, created_at;