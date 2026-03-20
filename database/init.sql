-- ============================================================
-- The Padel Foundry – full database schema
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Members ──────────────────────────────────────────────────
CREATE TABLE members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(50),
  skill_level   VARCHAR(20) DEFAULT 'beginner' CHECK (skill_level IN ('beginner','intermediate','advanced','pro')),
  photo_url     TEXT,
  role          VARCHAR(20) DEFAULT 'player' CHECK (role IN ('player','admin')),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ── Courts ───────────────────────────────────────────────────
CREATE TABLE courts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(255) NOT NULL,
  court_number   INTEGER,
  surface_type   VARCHAR(50),
  is_active      BOOLEAN DEFAULT true,
  price_per_hour DECIMAL(10,2) DEFAULT 80.00,
  description    TEXT
);

-- ── Reservations ─────────────────────────────────────────────
CREATE TABLE reservations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  court_id     UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  start_time   TIMESTAMP NOT NULL,
  end_time     TIMESTAMP NOT NULL,
  status       VARCHAR(30) DEFAULT 'confirmed' CHECK (status IN ('pending_payment','confirmed','cancelled','completed')),
  price        DECIMAL(10,2),
  recurring_id UUID,
  notes        TEXT,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ── Recurring bookings ───────────────────────────────────────
CREATE TABLE recurring_bookings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  court_id     UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_hour   INTEGER NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ── Waitlist ─────────────────────────────────────────────────
CREATE TABLE waitlist (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  court_id        UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  requested_date  DATE NOT NULL,
  requested_start TIME NOT NULL,
  requested_end   TIME NOT NULL,
  status          VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting','notified','fulfilled','expired')),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── Payments ─────────────────────────────────────────────────
CREATE TABLE payments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id        UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  member_id             UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount                DECIMAL(10,2) NOT NULL,
  currency              VARCHAR(10) DEFAULT 'AED',
  status                VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  stripe_session_id     TEXT,
  stripe_payment_intent TEXT,
  created_at            TIMESTAMP DEFAULT NOW()
);

-- ── Push subscriptions ───────────────────────────────────────
CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth_key   TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(member_id, endpoint)
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_reservations_member ON reservations(member_id);
CREATE INDEX idx_reservations_court  ON reservations(court_id);
CREATE INDEX idx_reservations_start  ON reservations(start_time);
CREATE INDEX idx_waitlist_court_date ON waitlist(court_id, requested_date);
CREATE INDEX idx_push_member         ON push_subscriptions(member_id);

-- ── Seed courts ──────────────────────────────────────────────
INSERT INTO courts (name, court_number, surface_type, is_active, price_per_hour, description) VALUES
  ('Court 1', 1, 'Hard Court', true, 80.00, 'Covered hard court with LED lighting'),
  ('Court 2', 2, 'Hard Court', true, 80.00, 'Covered hard court, tournament spec'),
  ('Court 3', 3, 'Clay Court', true, 70.00, 'Open-air clay court');

-- ── Default admin (password: Admin@123) ──────────────────────
INSERT INTO members (name, email, password_hash, role, skill_level) VALUES
  ('Admin', 'admin@padelfoundry.com',
   '$2b$10$K7L.7CbLGd3HN8PSQplQ5.SqMU/6eXrANuIlxGiHFDH8PpbV.qLYS',
   'admin', 'pro');
