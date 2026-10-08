import { describe, expect, it } from 'vitest';
import { layoutCertificate, titleWidth } from '@/components/academy/certificate/certificate-layout';
import COURSES, { getCourseConfig } from '@/content/courses';

// The title block stays between the rules: cap top below the first rule, last baseline above the second.
const fits = (title: string) => {
  const { size, lines, baselines, rules } = layoutCertificate(title);
  const capTop = baselines[0] - 0.709 * size;
  return capTop >= rules[0] + 12 && baselines[baselines.length - 1] <= rules[1] && lines.every((line) => titleWidth(line, size) <= 1602);
};

describe('layoutCertificate', () => {
  it('sets two lines as the FW3V template does', () => {
    expect(layoutCertificate('Foundations of a Web3 Venture')).toEqual({
      size: 173.4, lines: ['FOUNDATIONS OF A', 'WEB3 VENTURE'], baselines: [585, 724.9], labelY: 366, rules: [389.5, 796],
    });
  });

  it('sets three lines with the label and rules pushed outward, as the W3GTM template does', () => {
    expect(layoutCertificate('Web3 Go-to-Market Strategist')).toEqual({
      size: 173.4, lines: ['WEB3', 'GO-TO-MARKET', 'STRATEGIST'], baselines: [528.5, 668.5, 808.4], labelY: 340, rules: [363.5, 851],
    });
  });

  it('centres one line between the FW3V rules', () => {
    expect(layoutCertificate('NFT Deployment')).toEqual({ size: 173.4, lines: ['NFT DEPLOYMENT'], baselines: [655], labelY: 366, rules: [389.5, 796] });
  });

  it('fits every course and certificate name in content/courses.tsx', () => {
    const names = COURSES.official.map((c) => c.name).concat(Object.values(getCourseConfig()).map((c) => c.name));
    expect(names.length).toBeGreaterThan(0);
    names.forEach((name) => expect(fits(name), name).toBe(true));
    expect(layoutCertificate('Access Restriction Fundamentals').lines).toEqual(['ACCESS', 'RESTRICTION', 'FUNDAMENTALS']);
  });

  it('sets a title that needs more than three lines smaller until it fits', () => {
    const long = 'Supercalifragilisticexpialidocious Extraordinarily Long Course Title For Testing Purposes Only';
    const layout = layoutCertificate(long);
    expect(layout.size).toBeLessThan(173.4);
    expect(layout.lines.length).toBeLessThanOrEqual(3);
    expect(fits(long)).toBe(true);
  });
});
