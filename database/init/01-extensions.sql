-- Runs once on first container init (docker-entrypoint-initdb.d)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
