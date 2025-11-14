/*
  # Seed Initial Badge Data
  
  This migration adds the initial badge definitions for the gamification system.
  Users will earn these badges based on their approved submissions.
*/

-- Insert Activity Badges (for any partner store visits)
INSERT INTO public.badges (name, category, required_count, image_url, description) VALUES
('Explorer Novice', 'activity', 10, 'https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=400', 'Complete your first 10 visits to any partner stores'),
('Explorer Enthusiast', 'activity', 20, 'https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=400', 'Complete 20 visits to any partner stores'),
('Explorer Expert', 'activity', 30, 'https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=400', 'Complete 30 visits to any partner stores'),
('Explorer Master', 'activity', 40, 'https://images.pexels.com/photos/1271619/pexels-photo-1271619.jpeg?auto=compress&cs=tinysrgb&w=400', 'Complete 40 visits to any partner stores');

-- Insert Cafe Badges (for cafe visits specifically)
INSERT INTO public.badges (name, category, required_count, image_url, description) VALUES
('Coffee Lover', 'cafe', 10, 'https://images.pexels.com/photos/260922/pexels-photo-260922.jpeg?auto=compress&cs=tinysrgb&w=400', 'Visit 10 partner cafes'),
('Caffeine Connoisseur', 'cafe', 20, 'https://images.pexels.com/photos/260922/pexels-photo-260922.jpeg?auto=compress&cs=tinysrgb&w=400', 'Visit 20 partner cafes'),
('Barista\'s Friend', 'cafe', 30, 'https://images.pexels.com/photos/260922/pexels-photo-260922.jpeg?auto=compress&cs=tinysrgb&w=400', 'Visit 30 partner cafes'),
('Cafe Champion', 'cafe', 40, 'https://images.pexels.com/photos/260922/pexels-photo-260922.jpeg?auto=compress&cs=tinysrgb&w=400', 'Visit 40 partner cafes');

-- Insert Restaurant Badges (for restaurant visits specifically)
INSERT INTO public.badges (name, category, required_count, image_url, description) VALUES
('Foodie Beginner', 'restaurant', 10, 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400', 'Dine at 10 partner restaurants'),
('Culinary Explorer', 'restaurant', 20, 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400', 'Dine at 20 partner restaurants'),
('Gourmet Enthusiast', 'restaurant', 30, 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400', 'Dine at 30 partner restaurants'),
('Master Chef\'s Choice', 'restaurant', 40, 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400', 'Dine at 40 partner restaurants');