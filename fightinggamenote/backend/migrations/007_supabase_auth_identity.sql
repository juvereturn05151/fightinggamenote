-- Add Supabase Auth as an alternative identity provider during the Clerk
-- transition. Existing Clerk identities and internal user UUIDs remain intact.
ALTER TABLE users
  ALTER COLUMN clerk_user_id DROP NOT NULL,
  ADD COLUMN supabase_user_id uuid,
  ADD CONSTRAINT users_supabase_user_id_key UNIQUE (supabase_user_id),
  ADD CONSTRAINT users_auth_identity_check CHECK (
    clerk_user_id IS NOT NULL OR supabase_user_id IS NOT NULL
  );
