import { describe, expect, it } from 'vitest';
import { destructiveStatement, pendingMigrations } from '@/scripts/lib/migration-guard.mjs';

describe('pendingMigrations', () => {
  it('returns the folders the database has not applied, in order', () => {
    expect(pendingMigrations(['20260102_b', '20260101_a', '20260103_c'], ['20260101_a'])).toEqual([
      '20260102_b',
      '20260103_c',
    ]);
  });

  it('returns nothing when all are applied', () => {
    expect(pendingMigrations(['a', 'b'], ['b', 'a'])).toEqual([]);
  });
});

describe('destructiveStatement', () => {
  it('allows additive changes', () => {
    const sql = [
      'ALTER TABLE "ValidatorAlert" ADD COLUMN "source" TEXT,',
      'ALTER COLUMN "user_id" DROP NOT NULL;',
      'CREATE INDEX "ValidatorAlert_email_idx" ON "ValidatorAlert"("email");',
    ].join('\n');
    expect(destructiveStatement(sql)).toBeNull();
  });

  it.each([
    ['ALTER TABLE "User" DROP COLUMN "bio";', 'DROP COLUMN'],
    ['DROP TABLE "Old";', 'DROP TABLE'],
    ['TRUNCATE "Log";', 'TRUNCATE'],
    ['DELETE FROM "Log" WHERE true;', 'DELETE FROM'],
    ['ALTER TABLE "User" ALTER COLUMN "age" SET DATA TYPE BIGINT;', 'ALTER COLUMN "AGE" SET DATA TYPE'],
    ['ALTER TABLE "User" RENAME COLUMN "a" TO "b";', 'RENAME COLUMN'],
  ])('stops %s', (sql, statement) => {
    expect(destructiveStatement(sql)).toBe(statement);
  });

  it('ignores statements in comments', () => {
    expect(destructiveStatement('-- DROP TABLE "Old" in a later PR\nSELECT 1;')).toBeNull();
  });

  it('allows an approved destructive migration', () => {
    expect(destructiveStatement('-- destructive: approved\nDROP TABLE "Old";')).toBeNull();
  });
});
