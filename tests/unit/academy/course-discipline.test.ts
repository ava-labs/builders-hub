import { describe, expect, it } from 'vitest';
import { BookOpen, Coins, Lightbulb, Shield } from 'lucide-react';
import { courseDiscipline } from '@/lib/academy/course-discipline';
import { getCourseOutlines } from '@/lib/academy/course-outline';
import { loadAcademyTree } from './helpers/content-tree';

describe('courseDiscipline', () => {
  it('reads the label, icon and hue from the track config', () => {
    expect(courseDiscipline('avalanche-l1', 'avalanche-fundamentals')).toEqual({ label: 'Fundamentals', Icon: BookOpen, hue: 'blue' });
    expect(courseDiscipline('avalanche-l1', 'l1-native-tokenomics')).toEqual({ label: 'L1 Tokenomics', Icon: Coins, hue: 'gold' });
    expect(courseDiscipline('blockchain', 'encrypted-erc')).toEqual({ label: 'Privacy', Icon: Shield, hue: 'teal' });
    expect(courseDiscipline('team1', 'team1-soft-skills')).toEqual({ label: 'Soft Skills', Icon: Lightbulb, hue: 'green' });
  });

  it('returns null for a course the configs do not list', () => {
    expect(courseDiscipline('avalanche-l1', 'not-a-course')).toBeNull();
    expect(courseDiscipline('unknown-track', 'avalanche-fundamentals')).toBeNull();
  });

  it('finds a discipline for every course in content/academy', () => {
    const missing = getCourseOutlines(loadAcademyTree()).filter((o) => !courseDiscipline(o.track, o.slug)).map((o) => o.url);
    expect(missing).toEqual([]);
  });
});
