import { embedQuery } from '@/lib/embeddings';
import type { Flashcard } from './types';

const DEFAULT_THRESHOLD = 0.88;
const EMBEDDING_BATCH_SIZE = 8;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

async function embedAll(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const embeddings = await Promise.all(batch.map((t) => embedQuery(t)));
    out.push(...embeddings);
  }
  return out;
}

export interface DedupeResult {
  kept: Flashcard[];
  droppedIds: string[];
}

/**
 * Drop near-duplicate flashcards within a single deck using cosine similarity
 * on their `front` embeddings. Earlier-listed cards win when a pair is too close.
 *
 * Returns the kept cards (in original order) and the ids of dropped ones.
 */
export async function dedupeFlashcards(
  cards: Flashcard[],
  threshold: number = DEFAULT_THRESHOLD,
): Promise<DedupeResult> {
  if (cards.length < 2) {
    return { kept: [...cards], droppedIds: [] };
  }

  const embeddings = await embedAll(cards.map((c) => c.front));
  const drop = new Set<string>();

  for (let i = 0; i < cards.length; i++) {
    if (drop.has(cards[i].id)) continue;
    for (let j = i + 1; j < cards.length; j++) {
      if (drop.has(cards[j].id)) continue;
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      if (sim >= threshold) {
        drop.add(cards[j].id);
      }
    }
  }

  return {
    kept: cards.filter((c) => !drop.has(c.id)),
    droppedIds: Array.from(drop),
  };
}

export { cosineSimilarity };
