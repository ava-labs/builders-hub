import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CourseOutlineProvider, useCourseOutline } from '@/components/academy/course/course-outline-context';

function Probe() {
  const facts = useCourseOutline();
  return createElement('output', null, facts ? `${facts.name}|${facts.modules}|${facts.lessons}` : 'none');
}

describe('course outline context', () => {
  it('hands the page facts to components inside the MDX body', () => {
    const html = renderToStaticMarkup(
      createElement(CourseOutlineProvider, {
        value: { name: 'Avalanche Fundamentals', modules: 4, lessons: 31 },
        children: createElement(Probe),
      }),
    );
    expect(html).toBe('<output>Avalanche Fundamentals|4|31</output>');
  });

  it('gives null outside a course page and on a page without an outline', () => {
    expect(renderToStaticMarkup(createElement(Probe))).toBe('<output>none</output>');
    expect(
      renderToStaticMarkup(createElement(CourseOutlineProvider, { value: null, children: createElement(Probe) })),
    ).toBe('<output>none</output>');
  });
});
