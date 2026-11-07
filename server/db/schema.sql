CREATE TABLE IF NOT EXISTS upload_intents (
 id uuid PRIMARY KEY,
 owner_id uuid,
 pathname text NOT NULL UNIQUE,
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 70),
 kind text NOT NULL CHECK (kind IN ('plain','meme')),
 layout text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','complete','rejected')),
 token_requests integer NOT NULL DEFAULT 0,
 created_at timestamptz(3) NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour'
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS gallery (
 id uuid PRIMARY KEY REFERENCES upload_intents(id),
 owner_id uuid,
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 70),
 kind text NOT NULL CHECK (kind IN ('plain','meme')),
 layout text NOT NULL,
 blob_path text NOT NULL UNIQUE,
 blob_url text NOT NULL,
 created_at timestamptz(3) NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS gallery_created ON gallery(created_at DESC) WHERE deleted_at IS NULL;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS feedback (
 id uuid PRIMARY KEY,
 owner_id uuid,
 name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 35),
 message text NOT NULL CHECK (char_length(message) BETWEEN 5 AND 600),
 rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
 likes integer NOT NULL DEFAULT 0 CHECK (likes >= 0),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 fingerprint text NOT NULL,
 created_at timestamptz(3) NOT NULL DEFAULT now(),
 UNIQUE(owner_id,fingerprint)
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS feedback_created ON feedback(created_at DESC);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS feedback_likes (
 feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
 visitor_id uuid NOT NULL,
 created_at timestamptz(3) NOT NULL DEFAULT now(),
 PRIMARY KEY(feedback_id,visitor_id)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS rate_limits (
 key text PRIMARY KEY,
 used integer NOT NULL,
 expires_at timestamptz NOT NULL
);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(expires_at);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS upload_intents_expiry ON upload_intents(expires_at) WHERE state <> 'complete';
