# Snoonu Rider Duty Portal — Full Chat & Project Backup

## Goal
Attendance website for approximately 50 Snoonu riders. Rider logs in and presses START DUTY once per Qatar calendar day. Store Qatar duty date, timestamp, and browser GPS coordinates. Admin views daily present/absent and exports CSV.

## Stack
HTML/CSS/JavaScript modules; Supabase Auth + PostgreSQL + RLS; Vercel static hosting; Asia/Qatar timezone. Google Maps links use saved coordinates and do not need a paid Maps API.

## Files
- `index.html`, `styles.css`, `app.js`: initial frontend
- `supabase_setup.sql`: baseline schema and RLS policies
- `Snoonu_Rider_Website_Chat_Backup_Updated.txt`: recovered original discussion
- `FULL_CHAT_BACKUP.txt`: current chat context

## Schema expected
`riders`: id UUID, auth_user_id UUID, rider_id text, full_name text, is_active boolean.
`attendance`: id UUID, rider_id UUID, duty_date date, checkin_time timestamptz, latitude/longitude; unique (rider_id,duty_date).

## Security
The frontend uses only the Supabase Publishable Key. Never expose `sb_secret_...` or `service_role` keys in browser code or archives. A secret key was pasted into the chat; rotate/revoke it in Supabase Dashboard. Do not send the replacement key here.

## Status / next work
Initial frontend exists but is not live-verified against the actual Supabase schema/RLS. Rider account creation/linking UI is still missing. Test with one admin and one rider account before production. Review SQL before running if tables or policies already exist.

## Local preview
Run `python -m http.server 8000` in this folder and open http://localhost:8000. GPS requires HTTPS or localhost.


## Latest development update (2026-11-16)
- Added Admin Rider Management UI: create rider profile, edit rider ID/name/Auth User UUID, activate/deactivate, and delete.
- Added duplicate daily check-in button state by checking today's attendance.
- Improved CSV export with Present/Absent status and Qatar-local check-in time.
- Important limitation: Supabase browser client cannot safely create Auth users. Create rider users in Supabase Authentication, then link the Auth User UUID in Admin Dashboard. A server-side Edge Function can automate invitations in a later phase, but requires secure server-side setup and testing.
- Not yet live-tested against the actual project. Confirm table columns and RLS before production.
