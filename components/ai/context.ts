'use client';

import { type UseChatHelpers } from '@ai-sdk/react';
import { createContext, use } from 'react';

export const ChatContext = createContext<UseChatHelpers | null>(null);

export function useChatContext() {
  return use(ChatContext)!;
}
