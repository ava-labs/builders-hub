import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CERTIFICATE_FIELDS,
  CERTIFICATE_VIEWBOX,
  CertificateArtwork,
  certificateAcademyFor,
} from '@/components/academy/certificate/certificate-artwork';

const render = (academy: 'Avalanche Academy' | 'Entrepreneur Academy', courseTitle: string) =>
  renderToStaticMarkup(createElement(CertificateArtwork, { academy, courseTitle, className: 'w-full' }));

describe('CertificateArtwork', () => {
  const html = render('Avalanche Academy', 'Avalanche Fundamentals');

  it('is one accessible svg on the 1920 x 1080 viewBox', () => {
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).toContain('viewBox="0 0 1920 1080"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Avalanche Academy, Certificate of Completion, Avalanche Fundamentals"');
    expect(html).toContain('class="w-full"');
  });

  it('prints the academy name, the label, the course title in capitals and the two field labels', () => {
    expect(html).toContain('>Avalanche Academy</text>');
    expect(html).toContain('>Certificate of Completion</text>');
    expect(html).toContain('>AVALANCHE</tspan>');
    expect(html).toContain('>FUNDAMENTALS</tspan>');
    expect(html).toContain('>Presented To:</text>');
    expect(html).toContain('>Date:</text>');
    expect(render('Entrepreneur Academy', 'Foundations of a Web3 Venture')).toContain('>Entrepreneur Academy</text>');
  });

  it('moves the label and the rules outward for a three-line title', () => {
    expect(html).toContain('y="389.5"');
    expect(html).toContain('y="796"');
    const three = render('Avalanche Academy', 'Access Restriction Fundamentals');
    expect(three).toContain('>RESTRICTION</tspan>');
    expect(three).toContain('y="363.5"');
    expect(three).toContain('y="851"');
    expect(three).toMatch(/y="340"[^>]*>Certificate of Completion</);
  });

  it('names the Aeonik family itself and loads nothing outside public/', () => {
    expect(html).toContain('font-family="Aeonik, sans-serif"');
    expect(html.match(/href="[^"]*"/g)).toEqual(['href="/logo-black.png"']);
    expect(html).not.toMatch(/https?:/);
  });

  it('draws the template border: 116 marks, dots and slashes', () => {
    expect((html.match(/<circle /g) ?? []).length + (html.match(/<line /g) ?? []).length).toBe(116);
    expect(html).toContain('<line ');
  });

  it('keeps both field boxes inside the viewBox and clear of each other', () => {
    const { name, date } = CERTIFICATE_FIELDS;
    for (const box of [name, date]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(CERTIFICATE_VIEWBOX.width);
      expect(box.y + box.height).toBeLessThanOrEqual(CERTIFICATE_VIEWBOX.height);
    }
    expect(name.x + name.width).toBeLessThan(date.x);
  });
});

describe('certificateAcademyFor', () => {
  it('names the Entrepreneur Academy for the entrepreneur track and the Avalanche Academy otherwise', () => {
    expect(certificateAcademyFor('entrepreneur')).toBe('Entrepreneur Academy');
    expect(certificateAcademyFor('avalanche-l1')).toBe('Avalanche Academy');
    expect(certificateAcademyFor('blockchain')).toBe('Avalanche Academy');
  });
});
