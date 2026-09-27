import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CertificateCredential,
  credentialAcademy,
  credentialFacts,
  credentialTitle,
  type CertificateCredentialProps,
} from '@/components/quizzes/certificate-credential';

const props = (over: Partial<CertificateCredentialProps> = {}): CertificateCredentialProps => ({
  academy: 'Avalanche Academy',
  courseTitle: 'Avalanche Fundamentals',
  facts: credentialFacts({ name: 'Avalanche Fundamentals', modules: 4, lessons: 31 }),
  isGenerating: false,
  certificatePdfUrl: null,
  linkedInUrl: 'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME',
  onGenerate: () => undefined,
  onShareOnX: () => undefined,
  onViewCertificate: () => undefined,
  ...over,
});
const render = (over?: Partial<CertificateCredentialProps>) =>
  renderToStaticMarkup(createElement(CertificateCredential, props(over)));
/** The class list of the control labelled `label`: the last a or button tag that opens before the label. */
const controlClasses = (html: string, label: string) => {
  const end = html.indexOf(`${label}</`);
  if (end < 0) return [];
  const before = html.slice(0, end);
  const tag = before.slice(Math.max(before.lastIndexOf('<a '), before.lastIndexOf('<button ')));
  return (tag.match(/class="([^"]*)"/)?.[1] ?? '').split(' ');
};

describe('credentialFacts', () => {
  it('reads Modules and Lessons from the course outline, then Format', () => {
    expect(credentialFacts({ name: 'Avalanche Fundamentals', modules: 4, lessons: 31 })).toEqual([
      { label: 'Modules', value: '4' },
      { label: 'Lessons', value: '31' },
      { label: 'Format', value: 'PDF' },
    ]);
  });

  it('leaves out a count the outline does not have', () => {
    expect(credentialFacts({ name: 'Team1 Fundamentals', modules: 0, lessons: 12 })).toEqual([
      { label: 'Lessons', value: '12' },
      { label: 'Format', value: 'PDF' },
    ]);
    expect(credentialFacts(null)).toEqual([{ label: 'Format', value: 'PDF' }]);
  });
});

describe('credentialTitle', () => {
  it('names the course as its certificate entry does, then the outline, then the quiz data', () => {
    const outline = { name: 'Outline name', modules: 6, lessons: 30 };
    expect(credentialTitle('solidity-foundry', outline)).toBe('Solidity Programming with Foundry');
    expect(credentialTitle('access-restriction-advanced', outline)).toBe('Access Restriction Advanced');
    expect(credentialTitle('team1-fundamentals', outline)).toBe('Outline name');
    expect(credentialTitle('team1-fundamentals', null)).toBe('Team1 Fundamentals');
  });
});

describe('credentialAcademy', () => {
  it('names the academy of the track the certificate page sits in', () => {
    expect(credentialAcademy('/academy/entrepreneur/go-to-market/certificate')).toBe('Entrepreneur Academy');
    expect(credentialAcademy('/academy/avalanche-l1/avalanche-fundamentals/get-certificate')).toBe('Avalanche Academy');
    expect(credentialAcademy('/academy/blockchain/solidity-foundry/certificate')).toBe('Avalanche Academy');
  });
});

describe('CertificateCredential', () => {
  it('frames the credential: the academy with one mark, the label, the course and the line', () => {
    const html = render();
    expect(html).toContain('>Avalanche Academy</span>');
    expect(html.split('viewBox="0 0 220 190"')).toHaveLength(2);
    expect(html).not.toContain('Layer_1');
    expect(html).toContain('>Certificate of completion</p>');
    expect(html).toContain('>Avalanche Fundamentals</h2>');
    expect(html).toContain('Every quiz in this course is complete. Generate the certificate to download it as a PDF.');
    expect(html).toContain('border border-ac-ink');
  });

  it('keeps the credential out of the prose heading margins, so they cannot change the frame height', () => {
    expect(render()).toMatch(/^<div class="not-prose /);
  });

  it('names the Entrepreneur Academy on an Entrepreneur certificate', () => {
    const html = render({ academy: 'Entrepreneur Academy', courseTitle: 'Go-to-Market Strategist' });
    expect(html).toContain('>Entrepreneur Academy</span>');
    expect(html).not.toContain('Avalanche Academy');
    expect(html).toContain('>Go-to-Market Strategist</h2>');
  });

  it('lists Modules, Lessons and Format, and no Course cell', () => {
    const html = render();
    expect(html).toMatch(/>Modules<\/dt><dd[^>]*>4<\/dd>/);
    expect(html).toMatch(/>Lessons<\/dt><dd[^>]*>31<\/dd>/);
    expect(html).toMatch(/>Format<\/dt><dd[^>]*>PDF<\/dd>/);
    expect(html).not.toContain('>Course<');
  });

  it('offers the ink Generate My Certificate button at its own width', () => {
    const html = render();
    expect(html).toContain('>Generate My Certificate</button>');
    expect(html).toContain('bg-ac-ink');
    expect(html).toContain('text-ac-paper!');
    expect(html).not.toContain('w-full');
  });

  it("keeps production's share block and text", () => {
    const html = render();
    expect(html).toContain('Share your achievement:');
    expect(html).toContain('Your certificate PDF has been downloaded. You can attach it when sharing on social media.');
    expect(html).toContain('Add to LinkedIn');
    expect(html).toContain('Share on X');
    expect(html).toContain('href="https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME"');
    expect(html).not.toContain('View Certificate');
  });

  it("keeps each share control's rule border under keyboard focus, not buttonVariants' ring colour", () => {
    const html = render({ certificatePdfUrl: 'blob:certificate' });
    ['View Certificate', 'Add to LinkedIn', 'Share on X'].forEach((label) => {
      const classes = controlClasses(html, label);
      expect(classes).toEqual(expect.arrayContaining(['border-ac-rule', 'focus-visible:border-ac-rule']));
      expect(classes).not.toContain('focus-visible:border-ring');
    });
  });

  it('offers View Certificate once a PDF exists, and a disabled button while generating', () => {
    expect(render({ certificatePdfUrl: 'blob:certificate' })).toContain('View Certificate');
    const generating = render({ isGenerating: true });
    expect(generating).toContain('Generating Certificate...');
    expect(generating).toMatch(/<button[^>]*disabled=""/);
  });
});
