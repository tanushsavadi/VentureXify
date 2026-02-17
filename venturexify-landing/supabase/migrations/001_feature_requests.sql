-- Feature requests table for landing page
CREATE TABLE IF NOT EXISTS feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anyone (public form)
CREATE POLICY "Anyone can insert feature requests"
  ON feature_requests
  FOR INSERT
  WITH CHECK (true);

-- Only authenticated users (admins) can read
CREATE POLICY "Only admins can read feature requests"
  ON feature_requests
  FOR SELECT
  USING (auth.role() = 'authenticated');
