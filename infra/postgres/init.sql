-- EDO database initialisation
-- Runs once when the Postgres container starts for the first time.

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add database schemas / initial tables here as microservices are defined.
