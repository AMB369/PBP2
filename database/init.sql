CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE members (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, phone VARCHAR(50), created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE courts (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR(255) NOT NULL, court_number INTEGER, surface_type VARCHAR(50), is_active BOOLEAN DEFAULT true);
CREATE TABLE reservations (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), member_id UUID NOT NULL REFERENCES members(id), court_id UUID NOT NULL REFERENCES courts(id), start_time TIMESTAMP NOT NULL, end_time TIMESTAMP NOT NULL, status VARCHAR(50) DEFAULT 'confirmed', price DECIMAL(10,2), created_at TIMESTAMP DEFAULT NOW());
INSERT INTO courts (name, court_number, surface_type, is_active) VALUES ('Court 1',1,'Hard Court',true),('Court 2',2,'Hard Court',true),('Court 3',3,'Clay Court',true);
