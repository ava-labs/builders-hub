import { describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => createElement('a', { href, ...rest }, children),
}));

import VideoRenderer from '@/components/showcase/DemoVideoRenderer';
import Info from '@/components/showcase/sections/Info';
import Description from '@/components/showcase/sections/Description';
import { httpLinks, videoEmbed } from '@/lib/hackathons/project-links';
import { NoteBody } from '@/components/explorer-v2/evm/query-board-bits';
import type { Project } from '@/types/showcase';

/* Text that members typed into names, descriptions, bios and notes. Each
   must reach the page as text: no tag, no handler and no script of its own. */
const MARKUP = [
  '<img src=x onerror=window.__xss=1> FRESHMARK1795498513237',
  '<img src=x onerror="alert(document.cookie)">test',
  '"><script src=https://probe.example/c/1></script>',
  "'><input onfocus=eval(atob(this.id)) id=YWxlcnQoMSk= autofocus>",
  'test<u>test</u>',
  '"><h1 style=color:red>name</h1>',
  '<b>bold</b><img src=x onerror=alert(1)>',
  "<svg onload=console.log('x')>",
  '<iframe width="0" height="0" src="#" frameborder="0"></iframe><marquee>x</marquee>',
];

/** every tag of a page, in order, with its attributes and without the text between */
function tagsOf(html: string): string[] {
  return html.match(/<[^>]*>/g) ?? [];
}

/** the page's own markup around the text, with the escaped text taken out */
function withoutEscapedText(html: string): string {
  return html.replace(/&lt;[\s\S]*?&gt;/g, '');
}

function project(fields: Partial<Project>): Project {
  return {
    id: 'p1',
    hackaton_id: '',
    project_name: 'Project',
    short_description: 'Short',
    screenshots: [],
    tracks: [],
    tags: [],
    members: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    origin: 'Project submission',
    ...fields,
  } as unknown as Project;
}

describe('text a member typed renders as text', () => {
  it.each(MARKUP)('project name, description and tracks: %s', (payload) => {
    const render = (text: string) =>
      renderToStaticMarkup(createElement(Info, { project: project({ project_name: text, short_description: text, tracks: [text] }) }));
    const html = render(payload);
    expect(html).toContain('&lt;');
    // the same elements as for plain words: the text added none
    expect(tagsOf(html)).toEqual(tagsOf(render('plain words')));
  });

  it.each(MARKUP)('full description (markdown): %s', (payload) => {
    const html = renderToStaticMarkup(createElement(Description, { description: payload }));
    expect(withoutEscapedText(html)).not.toMatch(/<(img|script|input|svg|iframe|marquee|u|b)\b|<[^>]*\son\w+=/i);
  });

  it.each(MARKUP)('board note: %s', (payload) => {
    const html = renderToStaticMarkup(createElement(NoteBody, { text: `# ${payload}\n- **${payload}**\n${payload}` }));
    expect(withoutEscapedText(html)).not.toMatch(/<(img|script|input|svg|iframe|marquee|u|b|h1)\b|<[^>]*\son\w+=/i);
  });

  it('a markdown link in a description keeps only an http(s) or mail address', () => {
    const html = renderToStaticMarkup(
      createElement(Description, { description: '[a](javascript:alert(1)) [b](data:text/html,x) [c](https://example.com/)' }),
    );
    expect(html).not.toMatch(/href="(javascript|data):/i);
    expect(html).toContain('href="https://example.com/"');
  });
});

describe('project links', () => {
  it('keeps http(s) links and drops every other scheme, site path and bare text', () => {
    expect(
      httpLinks(
        'javascript:window.__xss=1, data:text/html;base64,PHNjcmlwdD4=, /console, //evil.example/x, file:///C:/a, n/a, https://github.com/a/b,http://example.com/demo',
      ),
    ).toEqual(['https://github.com/a/b', 'http://example.com/demo']);
    expect(httpLinks(null)).toEqual([]);
    expect(httpLinks('Video - https://youtu.be/Xe-x7FOjuYs , Architecture - https://youtu.be/uuQ7zljGjSE')).toHaveLength(2);
  });

  it('renders no link for a script, data or site-path address', () => {
    const html = renderToStaticMarkup(
      createElement(Info, {
        project: project({
          demo_link: 'javascript:window.__xss=1,data:text/html;base64,PHNjcmlwdD4=,/console',
          github_repository: 'javascript:window.__xss=1, https://github.com/a/b',
        }),
      }),
    );
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['https://github.com/a/b']);
  });
});

describe('project video', () => {
  it('plays YouTube and Loom links in the host player, by video id', () => {
    const youtube = { kind: 'frame', src: 'https://www.youtube.com/embed/C0vd3iA5AlY' };
    expect(videoEmbed('https://youtu.be/C0vd3iA5AlY?si=AgacJ6o0rZ7dd72r')).toEqual(youtube);
    expect(videoEmbed('https://www.youtube.com/watch?v=C0vd3iA5AlY&t=10s')).toEqual(youtube);
    expect(videoEmbed('https://m.youtube.com/watch?feature=shared&v=C0vd3iA5AlY')).toEqual(youtube);
    expect(videoEmbed('https://youtube.com/shorts/C0vd3iA5AlY')).toEqual(youtube);
    expect(videoEmbed('https://www.youtube.com/embed/C0vd3iA5AlY')).toEqual(youtube);
    expect(videoEmbed('https://www.youtube.com/live/C0vd3iA5AlY')).toEqual(youtube);
    expect(videoEmbed('https://www.loom.com/share/b8a835fba8aa4736be1190c3d45e054e?sid=1')).toEqual({
      kind: 'frame',
      src: 'https://www.loom.com/embed/b8a835fba8aa4736be1190c3d45e054e',
    });
  });

  it('finds the video in a value that holds several links', () => {
    expect(videoEmbed('https://drive.google.com/file/d/1/view?usp=sharing,https://youtu.be/QmqTzV_bTbk')).toEqual({
      kind: 'frame',
      src: 'https://www.youtube.com/embed/QmqTzV_bTbk',
    });
  });

  it.each([
    'https://attacker.example/x.html#youtube.com',
    'https://attacker.example/youtube.com/watch?v=C0vd3iA5AlY',
    'https://attacker.example/?u=youtu.be/C0vd3iA5AlY',
    'https://youtube.com.attacker.example/watch?v=C0vd3iA5AlY',
    'https://attacker.example/loom.com/share/abc123',
    'https://loom.com@attacker.example/share/abc123',
  ])('never frames another host: %s', (link) => {
    const embed = videoEmbed(link);
    expect(embed?.kind).not.toBe('frame');
    expect(renderToStaticMarkup(createElement(VideoRenderer, { link }))).not.toContain('<iframe');
  });

  it.each([
    "javascript:window.top.__xss=1;'youtube.com'",
    'data:text/html,<script>top.__xss=1</script><h1>youtube.com</h1>',
    'vbscript:msgbox(1)//loom.com',
    'not a link',
    'https://www.youtube.com/playlist?list=PLShDGiKxdRe4',
    'https://youtube.com/@channel',
  ])('renders nothing for: %s', (link) => {
    expect(videoEmbed(link)).toBeNull();
    expect(renderToStaticMarkup(createElement(VideoRenderer, { link }))).toBe('');
  });

  it('frames only the two player hosts', () => {
    const html = renderToStaticMarkup(createElement(VideoRenderer, { link: 'https://youtu.be/C0vd3iA5AlY' }));
    expect(html).toContain('<iframe');
    expect(html).toContain('src="https://www.youtube.com/embed/C0vd3iA5AlY"');
  });

  it('plays any other http(s) link as a file', () => {
    expect(videoEmbed('https://cdn.example.com/demo.mp4')).toEqual({ kind: 'file', src: 'https://cdn.example.com/demo.mp4' });
  });
});
