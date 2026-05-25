import { describe, expect, it } from 'vitest';
import { toLegacyItem, type Flashcard } from '@/lib/flashcards/types';

const baseSource = { kind: 'academy' as const, path: '/academy/x', chapterTitle: 'X' };

describe('toLegacyItem', () => {
  it('maps a QA card term/definition directly', () => {
    const card: Flashcard = {
      id: '1',
      type: 'qa',
      front: 'What is ICM?',
      back: 'Interchain Messaging.',
      source: baseSource,
    };
    const legacy = toLegacyItem(card);
    expect(legacy.term).toBe('What is ICM?');
    expect(legacy.definition).toBe('Interchain Messaging.');
    expect(legacy.example).toBeUndefined();
  });

  it('renders cloze front as a blank-filled sentence and exposes the answer in example', () => {
    const card: Flashcard = {
      id: '2',
      type: 'cloze',
      front: 'Avalanche uses [[Snowman]] consensus for linear chains.',
      back: 'Snowman',
      source: baseSource,
    };
    const legacy = toLegacyItem(card);
    expect(legacy.term).toContain('_____');
    expect(legacy.term).not.toContain('Snowman');
    expect(legacy.example).toContain('Snowman');
    expect(legacy.definition).toBe('Snowman');
  });

  it('keeps code cards as plain term/definition (HTML formatting happens at .apkg time)', () => {
    const card: Flashcard = {
      id: '3',
      type: 'code',
      front: 'Complete the validator-add call.',
      back: 'validator.add({ weight: 100 })',
      language: 'typescript',
      source: baseSource,
    };
    const legacy = toLegacyItem(card);
    expect(legacy.term).toBe('Complete the validator-add call.');
    expect(legacy.definition).toContain('validator.add');
  });
});
