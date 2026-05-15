-- Add memberships column to profiles (unions, guilds, agencies)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS memberships TEXT[] DEFAULT '{}';
