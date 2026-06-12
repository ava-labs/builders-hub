import type { Flashcard } from './types';
import type { LoadedSource } from './source-loader';

export interface DeckPromptOptions {
  deckTitle: string;
  targetCardCount: number;
  audience?: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
}

const SYSTEM_INSTRUCTIONS = `You generate Anki-style flashcards from Avalanche developer learning content (academy chapters or documentation pages).

CARD TYPES — produce a balanced mix:
- "qa": classic question on the front, concise answer on the back. Use for definitions, "why" questions, conceptual contrasts.
- "cloze": a single declarative sentence on the front with the elided phrase wrapped in DOUBLE square brackets, e.g. "Avalanche uses [[Snowman]] consensus for linear chains." The back must contain ONLY the elided answer (no full sentence). Cloze is for memorizing specific terms, constants, parameters.
- "code": front is a short prompt or fill-in-the-blank ("Write the call that adds a validator with weight 100", "Complete: const subnet = avm.____()"); back is the correct snippet. Set "language" to the snippet language (solidity, typescript, bash, etc.).

QUALITY RULES:
- Each card tests ONE atomic fact. No multi-part questions, no "and/or" stuffing.
- Use the exact terminology from the source. Do not paraphrase Avalanche-specific names (Snowman, ICM, ICTT, Frostbyte, Glacier, ACP-XX, etc.).
- No marketing language. No hype. No "leverages" / "robust" / "powerful".
- Code snippets must be syntactically valid and idiomatic.
- Avoid cards that depend on visual context the user no longer has (no "see the diagram above").
- If two source chapters cover the same fact, produce ONE card, not two.
- Never invent facts. If the source is thin, return fewer cards rather than fabricating.

OUTPUT FORMAT: JSON matching the provided schema. Top-level "cards" array. Aim for the requested count but go lower if source content cannot support it honestly.`;

function formatSourceForPrompt(source: LoadedSource, index: number): string {
  const title = source.anchor.chapterTitle;
  const kind = source.anchor.kind === 'academy' ? 'Academy chapter' : 'Documentation page';
  return [
    `--- SOURCE ${index + 1} (${kind}): ${title} ---`,
    source.markdown,
    '--- END SOURCE ---',
  ].join('\n\n');
}

export function buildFullDeckPrompt(
  sources: LoadedSource[],
  opts: DeckPromptOptions,
): BuiltPrompt {
  const audienceLine = opts.audience
    ? `\nAudience: ${opts.audience}.`
    : '\nAudience: developers building on Avalanche (mix of beginners reading their first chapter and returning devs refreshing).';

  const userParts: string[] = [
    `Deck title: ${opts.deckTitle}`,
    `Target card count: aim for around ${opts.targetCardCount}; never exceed ${Math.min(opts.targetCardCount + 10, 80)}.${audienceLine}`,
    '',
    `Generate flashcards from the following ${sources.length} source${sources.length === 1 ? '' : 's'}. If multiple sources overlap on the same fact, produce one card.`,
    '',
    sources.map(formatSourceForPrompt).join('\n\n'),
  ];

  return {
    system: SYSTEM_INSTRUCTIONS,
    user: userParts.join('\n'),
  };
}

export function buildSingleCardPrompt(
  sources: LoadedSource[],
  existingDeck: Flashcard[],
  rejectedCard: Flashcard,
  reason?: string,
): BuiltPrompt {
  const reasonLine = reason
    ? `Why the card was rejected: ${reason}`
    : 'The card was rejected as unsatisfactory (low quality, off-topic, or redundant).';

  const existingFronts = existingDeck
    .filter((c) => c.id !== rejectedCard.id)
    .map((c, i) => `${i + 1}. [${c.type}] ${c.front.slice(0, 120)}`)
    .join('\n');

  const userParts: string[] = [
    `Task: produce ONE replacement flashcard for the rejected card below.`,
    `Card type to produce: ${rejectedCard.type}.`,
    `Source chapter/page: ${rejectedCard.source.chapterTitle} (${rejectedCard.source.path}).`,
    '',
    `Rejected card front: ${rejectedCard.front}`,
    `Rejected card back: ${rejectedCard.back}`,
    reasonLine,
    '',
    `Do NOT duplicate any of the existing cards in this deck:`,
    existingFronts,
    '',
    `Source content to draw from:`,
    '',
    sources.map(formatSourceForPrompt).join('\n\n'),
    '',
    `Return exactly ONE card in the "cards" array.`,
  ];

  return {
    system: SYSTEM_INSTRUCTIONS,
    user: userParts.join('\n'),
  };
}
