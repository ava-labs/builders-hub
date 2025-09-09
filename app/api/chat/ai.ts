import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
const ANTHROPIC_DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-20250219';

export function getModel(model: 'anthropic' | 'openai') {
  if (model === 'openai') {
    return openai(OPENAI_DEFAULT_MODEL);
  }
  return anthropic(ANTHROPIC_DEFAULT_MODEL);
}
