import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASK_EVENT, askAbout } from '@/components/explorer-v2/dig/selection';

// The docs search sends a question to the chat bubble with askAbout, and opens /chat with it
// when no bubble on screen takes it.
describe('askAbout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hands the question to the listener that takes it, and says it was taken', () => {
    const page = new EventTarget();
    vi.stubGlobal('window', page);
    const prompts: string[] = [];
    page.addEventListener(ASK_EVENT, (event) => {
      prompts.push((event as CustomEvent<{ prompt: string }>).detail.prompt);
      event.preventDefault();
    });
    expect(askAbout('how much AVAX do I need to stake')).toBe(true);
    expect(prompts).toEqual(['how much AVAX do I need to stake']);
  });

  it('says the question was not taken when the listener leaves it, as a hidden bubble does', () => {
    const page = new EventTarget();
    vi.stubGlobal('window', page);
    page.addEventListener(ASK_EVENT, () => {});
    expect(askAbout('how much AVAX do I need to stake')).toBe(false);
  });
});
