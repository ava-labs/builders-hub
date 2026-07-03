-- Migration: add_resource_model
-- Adds the new Resource table introduced in the PR.
-- All operations are idempotent (IF NOT EXISTS / DO NOTHING guards).

CREATE TABLE IF NOT EXISTS "Resource" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "link"        TEXT NOT NULL,
    "icon"        TEXT NOT NULL,
    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);
