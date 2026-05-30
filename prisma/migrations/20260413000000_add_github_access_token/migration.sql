-- Add github_access_token to User table for storing encrypted GitHub OAuth tokens
ALTER TABLE "User" ADD COLUMN "github_access_token" TEXT;
