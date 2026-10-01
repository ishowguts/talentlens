-- Runs once, on an empty data directory, as the superuser against the talentlens database.
-- Creates the test database and the extensions both databases need (ARCHITECTURE section 5).

CREATE DATABASE talentlens_test;

\connect talentlens
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

\connect talentlens_test
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
