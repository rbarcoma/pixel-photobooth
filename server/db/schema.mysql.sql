CREATE TABLE IF NOT EXISTS upload_intents (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
 pathname VARCHAR(100) NOT NULL UNIQUE,
 title VARCHAR(70) NOT NULL CHECK (CHAR_LENGTH(title) BETWEEN 1 AND 70),
 kind VARCHAR(5) NOT NULL CHECK (kind IN ('plain','meme')),
 layout VARCHAR(50) NOT NULL,
 state VARCHAR(8) NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','complete','rejected')),
 token_requests INT NOT NULL DEFAULT 0,
 created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 expires_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3) + INTERVAL 1 HOUR),
 INDEX upload_intents_expiry(expires_at,state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS gallery (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
 title VARCHAR(70) NOT NULL CHECK (CHAR_LENGTH(title) BETWEEN 1 AND 70),
 kind VARCHAR(5) NOT NULL CHECK (kind IN ('plain','meme')),
 layout VARCHAR(50) NOT NULL,
 blob_path VARCHAR(100) NOT NULL UNIQUE,
 blob_url TEXT NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 deleted_at DATETIME(3),
 FOREIGN KEY(id) REFERENCES upload_intents(id),
 INDEX gallery_created(deleted_at,created_at DESC,id DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS feedback (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
 name VARCHAR(35) NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 35),
 message VARCHAR(600) NOT NULL CHECK (CHAR_LENGTH(message) BETWEEN 5 AND 600),
 rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
 likes INT NOT NULL DEFAULT 0 CHECK (likes >= 0),
 status VARCHAR(8) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 UNIQUE(owner_id,fingerprint),
 INDEX feedback_created(created_at DESC,id DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS feedback_likes (
 feedback_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 visitor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 PRIMARY KEY(feedback_id,visitor_id),
 FOREIGN KEY(feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS rate_limits (
 `key` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 used INT NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 INDEX rate_limits_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
