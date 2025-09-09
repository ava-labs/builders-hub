import { User, Sparkles } from 'lucide-react';
import { type ReactElement } from 'react';

export const roleName: Record<string, string> = {
  user: 'You',
  assistant: 'AI Assistant',
};

export const roleIcon: Record<string, ReactElement> = {
  user: <User className="size-5" />,
  assistant: <Sparkles className="size-5 text-red-600" />,
};

export function parseFollowUpQuestions(content: string): string[] {
  if (!content) return [];

  const match = content.match(/---FOLLOW-UP-QUESTIONS---([\s\S]*?)---END-FOLLOW-UP-QUESTIONS---/);
  if (!match) return [];

  const questionsText = match[1].trim();
  const questions = questionsText
    .split('\n')
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((q) => q.length > 0);

  return questions;
}

export function removeFollowUpQuestions(content: string): string {
  if (!content) return '';

  let cleaned = content
    .replace(/---FOLLOW-UP-QUESTIONS---[\s\S]*?---END-FOLLOW-UP-QUESTIONS---/g, '')
    .replace(/---FOLLOW-UP-QUESTIONS---[\s\S]*$/g, '')
    .trim();

  return cleaned;
}

export function extractConsoleReferences(content: string): string[] {
  const consolePattern = /\/console\/([^\s)]+)/g;
  const matches = content.matchAll(consolePattern);
  const raw = Array.from(matches, (m) => m[1]);
  const cleaned = raw
    .map((p) => p.split(/[?#]/)[0])
    .map((p) => p.replace(/[)\].,;:!?'"`]+$/g, ''));
  return cleaned;
}
