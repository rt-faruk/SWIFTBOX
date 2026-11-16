-- Run once in Supabase SQL Editor
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS shift_start time;
