/*
  # Update Profile Creation Trigger
  
  This migration updates the profile creation trigger to include username and full_name
  from the auth user metadata when a new user registers.
*/

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create updated function that includes user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    role,
    dob,
    gender
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'username',
    'subscriber',
    (NEW.raw_user_meta_data ->> 'dob')::date,          -- cast to DATE
    NEW.raw_user_meta_data ->> 'gender'               -- stored as text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();