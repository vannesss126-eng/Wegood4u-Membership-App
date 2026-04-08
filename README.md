## Wegood4u: Project Feature Summary
Wegood4u is a membership portal designed to connect bloggers and content creators with F&B and tourism businesses. The platform gamifies the process of visiting partner locations, allowing members to earn rewards while helping businesses increase their visibility.

## 1. User Authentication & Roles
The app will have a clear role-based system to manage user permissions.

User able to register immediately but once they have register they can enter the App and can go to profile page to confirm their email address.

The new register will have Subcriber role. To change to Email address they are required to confirm their email address!

Role Progression: Users progress through distinct roles:

-- Subscriber: Default role after register. User with this role only able to view our partner stores location, blogs, and checking the setting. They are not able to participate member activities such as upload proof or travel or requesting for invitation code.

In order to be member, User with Subscriber requires to:
1. Required to confirm email address
2. Required to confirm phone number
3. Required to fill the questionnaires form

The Confirm email address and phone number will be located at the account tab, while questionnaires form at Task tab

-- Member: After completing membership questionnaire form and confirm email and phone number. Members can participate in the core activities.

-- Affiliate Member: A Member who has been approved by an admin and granted a unique invitation code. This role unlocks the affiliate system features.

Admin: A privileged user who manages the approval workflow and the affiliate system.

## 2. Proof of Visit & Approval Workflow
This is the core activity loop for members to engage with partner stores.

Submission: A Member uploads proof of their visit to a partner store, consisting of a selfie and a receipt picture.

Admin Review: Each submission is sent to a queue for manual review by an Admin.

Approval/Rejection: The Admin can either approve the submission, which counts towards the member's rewards, or reject it.

## 3. Badge & Reward System
A gamified system to reward active members for their approved visits.

Badge Categories: Members earn experience and badges based on the type of partner store visited:

- Bar Explorer: For visits to partner bars.

- Coffee Lover: For visits to partner cafes.

- Foodie: For visits to partner restaurants.

- Hotel Explorer: For visits to partner hotels.

Achievement Milestones (Tiers & Ranks): Members progress through four tiers (Bronze, Silver, Gold, Platinum) with three ranks (1, 2, 3) within each tier. The requirements scale progressively from 5 approved visits (Bronze 1) up to 120 approved visits (Platinum 3) per category.

Visual Achievements: Each badge tier and category is represented by a dynamically colored UI and a unique image displayed on the member's profile to showcase their accomplishments.

## 4. Affiliate & Referral System
This system is designed to drive user growth through member invitations.

Request Referral Code: A Member can request to have unique invitation code (e.g., WEGOOD123ABC) the code usually start with WEGOOD and there will 6 random characters that contain from a-z, A-Z, and 0-9.

Two-Level Referral Tracking: The system tracks referrals two levels deep, allowing an Affiliate Member to view:

- Direct Referrals (Level 1): The list of users who signed up directly using their invitation code.

- Indirect Referrals (Level 2): The list of users who were invited by their direct referrals.

=======================================================================================================

COMMAND LIST:

-- Start app: ```npx expo start --clear```
-- Update app: ```npx expo install --check```
-- Check app health: ```npx expo-doctor```
-- build app bundle: ```eas build --platform android --profile production``` 