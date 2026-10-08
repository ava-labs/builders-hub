import { describe, expect, it } from 'vitest';
import { AppWindow, ArrowLeftRight, BookOpen, Layers, Lightbulb } from 'lucide-react';
import { courseDiscipline } from '@/lib/academy/course-discipline';
import { getCourseOutlines } from '@/lib/academy/course-outline';
import { loadAcademyTree } from './helpers/content-tree';

describe('courseDiscipline', () => {
  it('reads the part of the 13 landing courses, and the category of a Team1 course', () => {
    expect(courseDiscipline('avalanche-l1', 'avalanche-fundamentals')).toEqual({ label: 'Fundamentals', Icon: BookOpen, hue: null });
    expect(courseDiscipline('avalanche-l1', 'l1-native-tokenomics')).toEqual({ label: 'L1 Development', Icon: Layers, hue: 'emerald' });
    expect(courseDiscipline('avalanche-l1', 'native-token-bridge')).toEqual({ label: 'Interoperability', Icon: ArrowLeftRight, hue: 'purple' });
    expect(courseDiscipline('blockchain', 'encrypted-erc')).toEqual({ label: 'Applications', Icon: AppWindow, hue: 'gold' });
    expect(courseDiscipline('team1', 'team1-soft-skills')).toEqual({ label: 'Soft Skills', Icon: Lightbulb, hue: 'green' });
  });

  it('returns null for a course the configs do not list', () => {
    expect(courseDiscipline('avalanche-l1', 'not-a-course')).toBeNull();
    expect(courseDiscipline('unknown-track', 'avalanche-fundamentals')).toBeNull();
    expect(courseDiscipline('blockchain', 'nft-deployment')).toBeNull();
  });

  it('finds a discipline for every course in content/academy', () => {
    const missing = getCourseOutlines(loadAcademyTree()).filter((o) => !courseDiscipline(o.track, o.slug)).map((o) => o.url);
    expect(missing).toEqual([]);
  });
});
