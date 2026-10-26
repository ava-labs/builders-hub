import postcss, { type AtRule } from 'postcss';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { block, declsOf, frame, globalCss, read, ungatedHover } from './helpers';

// The chapter list renders each question's quiz only once its row opens; the rows here stay closed.
vi.mock('@/components/quizzes/quiz', () => ({ default: () => null }));

import {
  CertificateChapters,
  CertificateProgress,
  ChapterHeading,
  QuestionTitle,
} from '@/components/quizzes/certificate-progress';
import {
  CertificateCredential,
  credentialFacts,
  revealScrollBy,
  revealsCredential,
  type CertificateCredentialProps,
} from '@/components/quizzes/certificate-credential';
import { QuizFeedback, QuizOption, type OptionState } from '@/components/quizzes/quiz-question';

/**
 * Task 12 of the hub motion pass, the Academy quizzes and certificate: the knowledge check settles instead of
 * switching (acad-quiz-check, variant a), a question passed on the certificate page advances the bar, its ring and the
 * counts (acad-cert-progress, variant a), and the credential prints in once, right after the course is completed on
 * the page (acad-credential-reveal, variant a). Only what the learner does on this visit draws, rolls or prints: the
 * checks, explanations, counts and credential of a state restored from the browser's storage show at rest.
 */
const CSS = 'app/global.css';
const QUESTION = 'components/quizzes/quiz-question.tsx';
const QUIZ = 'components/quizzes/quiz.tsx';
const PROGRESS = 'components/quizzes/certificate-progress.tsx';
const CREDENTIAL = 'components/quizzes/certificate-credential.tsx';
const PAGE = 'components/quizzes/certificates.tsx';
const TOUCHED = [CSS, QUESTION, QUIZ, PROGRESS, CREDENTIAL, PAGE];
const IDS = ['acad-quiz-check', 'acad-cert-progress', 'acad-credential-reveal'];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const REDUCE = '(prefers-reduced-motion: reduce)';

const unescape = (text: string) =>
  text
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');

interface Tag {
  name: string;
  tag: string;
  classes: string[];
}

/** Every opening tag of `html`, in order, with its class list unescaped. */
const tagsOf = (html: string): Tag[] =>
  [...html.matchAll(/<([a-z0-9]+)\b[^>]*>/g)].map(([tag, name]) => ({
    name,
    tag,
    classes: unescape(tag.match(/\bclass="([^"]*)"/)?.[1] ?? '')
      .split(' ')
      .filter(Boolean),
  }));

/** The first tag of `html` named `name`, or carrying the class `name` when it holds a dash. */
function tagOf(html: string, name: string): Tag {
  const found = tagsOf(html).find((tag) => (name.includes('-') ? tag.classes.includes(name) : tag.name === name));
  expect(found, name).toBeDefined();
  return found as Tag;
}

/**
 * Every class of `html` that runs one of this task's animations (fumadocs' accordion rows carry their own): its own
 * keyframes, or the site's plain fade, vs-fade-in.
 */
const animationsOf = (html: string) =>
  tagsOf(html)
    .flatMap((tag) => tag.classes)
    .filter((name) => /animate-\[(acad-|vs-fade-in_)/.test(name));

describe('every file this task touches', () => {
  it.each(TOUCHED)('%s transitions no "all" and never uses ease-in', (path) => {
    const src = read(path);
    expect(src).not.toMatch(TRANSITION_ALL);
    expect(src).not.toMatch(EASE_IN);
  });

  it.each(IDS)('the %s block in global.css exists and gates every hover', (id) => {
    const text = block(id);
    expect(text, `a comment-headed block for ${id}`).not.toBe('');
    expect(ungatedHover(text)).toBe(0);
  });
});

describe('acad-quiz-check: the answer settles instead of switching', () => {
  const quiz = postcss.parse(block('acad-quiz-check'));
  const STATES: OptionState[] = ['idle', 'selected', 'correct', 'wrong', 'dimmed'];
  const option = (state: OptionState, checkedNow?: boolean) =>
    renderToStaticMarkup(
      createElement(QuizOption, {
        state,
        marker: 'B',
        multiple: false,
        locked: false,
        name: 'quiz-310',
        checked: state !== 'idle' && state !== 'dimmed',
        onSelect: () => undefined,
        checkedNow,
        children: 'Signature and public key aggregation',
      }),
    );
  const feedback = (checkedNow?: boolean) =>
    renderToStaticMarkup(createElement(QuizFeedback, { correct: true, checkedNow, children: 'BLS aggregates' }));
  const DRAW = '[&>path]:animate-[acad-quiz-draw_260ms_var(--ease-out)_60ms_backwards]!';

  it('every row settles its border, fill and ring in 150ms on plain ease, a colour change', () => {
    for (const state of STATES) {
      const row = tagOf(option(state), 'label').classes;
      expect(row, state).toEqual(
        expect.arrayContaining([
          'transition-[border-color,background-color,box-shadow]',
          'duration-150',
          'ease-[ease]',
        ]),
      );
      expect(row.filter((name) => name.startsWith('transition-'))).toEqual([
        'transition-[border-color,background-color,box-shadow]',
      ]);
    }
  });

  it('every marker settles the same in 150ms, its glyph colour with it', () => {
    for (const state of STATES) {
      const marker = tagsOf(option(state)).find((tag) => tag.tag.includes('aria-hidden="true"') && tag.name === 'span');
      expect(marker?.classes, state).toEqual(
        expect.arrayContaining(['transition-[border-color,background-color,color]', 'duration-150', 'ease-[ease]']),
      );
    }
  });

  it('the check of an answer checked on this visit draws itself: its dash from 23 to 0, 260ms, 60ms in, strong ease-out', () => {
    const check = tagOf(option('correct', true), 'lucide-check').classes;
    expect(check).toEqual(expect.arrayContaining(['[&>path]:[stroke-dasharray:23]', DRAW]));
    expect(frame('acad-quiz-draw', 'from', { root: quiz })).toEqual({ 'stroke-dashoffset': '23' });
    expect(frame('acad-quiz-draw', 'to', { root: quiz })).toEqual({ 'stroke-dashoffset': '0' });
  });

  it('the check still draws under Reduce Motion: the draw is !important, past the site policy that ends animations in 1ms', () => {
    // A Tailwind important utility sits in a cascade layer, and a layered !important beats the unlayered policy. Read
    // from the rendered check: its one draw class is important and carries no motion variant, so it runs either way.
    const draws = tagOf(option('correct', true), 'lucide-check').classes.filter((name) =>
      name.includes('acad-quiz-draw'),
    );
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatch(/\]!$/);
    expect(draws[0]).not.toMatch(/^motion-(safe|reduce):/);
    expect(option('correct', true)).not.toContain('motion-reduce:');
  });

  it('an answer restored from the browser storage shows its check at rest, and no other row animates', () => {
    expect(animationsOf(option('correct'))).toEqual([]);
    for (const state of STATES.filter((state) => state !== 'correct')) {
      expect(animationsOf(option(state, true)), state).toEqual([]);
    }
  });

  it('the explanation of an answer checked on this visit fades up 4px into place in 220ms on the strong ease-out', () => {
    const panel = tagsOf(feedback(true))[0].classes;
    expect(panel).toContain('animate-[acad-quiz-rise_220ms_var(--ease-out)_backwards]');
    expect(frame('acad-quiz-rise', 'from', { root: quiz })).toEqual({ opacity: '0', transform: 'translateY(4px)' });
  });

  it('under Reduce Motion the explanation only fades, over the same 220ms, past the site policy', () => {
    const panel = tagsOf(feedback(true))[0].classes;
    expect(panel).toContain('motion-reduce:animate-[vs-fade-in_220ms_var(--ease-out)_backwards]!');
    // the site's plain fade (exp-view-switch)
    expect(frame('vs-fade-in', 'from')).toEqual({ opacity: '0' });
  });

  it('an explanation restored from the browser storage shows at rest', () => {
    expect(animationsOf(feedback())).toEqual([]);
    expect(animationsOf(feedback(false))).toEqual([]);
  });

  it('the quiz marks an answer checked on this visit: Check Answer sets it, a saved response never does', () => {
    const src = read(QUIZ);
    expect(src).toContain('const [checkedNow, setCheckedNow] = useState(false);');
    const checkAnswer = src.slice(src.indexOf('const checkAnswer'), src.indexOf('const handleTryAgain'));
    expect(checkAnswer).toContain('setCheckedNow(true);');
    expect(src.match(/setCheckedNow\(/g)).toHaveLength(1);
    // Both the options and the explanation take it.
    expect(src.split('checkedNow={checkedNow}')).toHaveLength(3);
  });

  it('a wrong answer does not nudge (variant b is not built)', () => {
    expect(block('acad-quiz-check')).not.toMatch(/translateX|nudge/);
  });
});

describe('acad-cert-progress: a passed question advances the bar', () => {
  const cert = postcss.parse(block('acad-cert-progress'));
  const progress = (completed: number, total: number, rolls?: boolean) =>
    renderToStaticMarkup(createElement(CertificateProgress, { completed, total, rolls }));
  const ROLL = 'inline-block motion-safe:animate-[acad-quiz-rise_220ms_var(--ease-out)_backwards]';
  const DRAW = '[&>path]:animate-[acad-quiz-draw_300ms_var(--ease-out)_100ms_backwards]!';

  it('the fill spans the track with its own round ends and slides in from the left to the share: never width, scale or clip', () => {
    // The track's rounded overflow clips the part slid out; a scale would square the round end, and a clip-path
    // edge off the pixel grid thins the bar's top row (measured on the dev server).
    const fill = tagOf(progress(5, 14), 'bg-ac-red');
    expect(fill.classes).toEqual(expect.arrayContaining(['w-full', 'rounded-[2px]', 'transition-transform']));
    expect(fill.tag).toContain('style="transform:translateX(-64.28571428571428%)"');
    expect(fill.tag).not.toMatch(/width|scale|clip/);
    expect(tagOf(progress(0, 0), 'bg-ac-red').tag).toContain('style="transform:translateX(-100%)"');
    expect(tagOf(progress(15, 14), 'bg-ac-red').tag).toContain('style="transform:translateX(0%)"');
    expect(tagOf(progress(5, 14), 'bg-ac-rule').classes).toEqual(
      expect.arrayContaining(['overflow-hidden', 'rounded-[2px]']),
    );
  });

  it('a pass fills the bar to its new share in 600ms on the strong ease-out', () => {
    const fill = tagOf(progress(6, 14), 'bg-ac-red').classes;
    expect(fill).toEqual(expect.arrayContaining(['duration-600', 'ease-out']));
    expect(fill.filter((name) => name.startsWith('transition-'))).toEqual(['transition-transform']);
  });

  it('under Reduce Motion the bar changes at once: the site policy transitions colour and opacity, no transform', () => {
    let props: string[] = [];
    globalCss.walkRules((rule) => {
      const media = rule.parent?.type === 'atrule' ? (rule.parent as AtRule) : null;
      if (media?.params !== REDUCE || !rule.selectors.includes('*')) return;
      const decl = declsOf(rule).find((d) => d.prop === 'transition-property');
      if (decl?.important) props = decl.value.split(',').map((prop) => prop.trim());
    });
    expect(props).toContain('opacity');
    expect(props).not.toContain('transform');
  });

  it('at rest the count is plain text, as before', () => {
    const html = progress(5, 14);
    expect(html).toContain('>5 of 14 quizzes completed.</p>');
    expect(animationsOf(html)).toEqual([]);
  });

  it('a count changed on this visit rolls its number up 4px and fades it in, 220ms on the strong ease-out', () => {
    expect(progress(6, 14, true)).toContain(
      `><span><span class="${ROLL}">6</span> of 14 quizzes completed.</span></p>`,
    );
    // the knowledge check's rise (acad-quiz-check): this block defines no keyframes of its own
    expect(frame('acad-quiz-rise', 'from')).toEqual({ opacity: '0', transform: 'translateY(4px)' });
    cert.walkAtRules('keyframes', (keyframes) => expect.unreachable(`@keyframes ${keyframes.params}`));
  });

  it('under Reduce Motion the number changes at once: the roll runs only with motion allowed', () => {
    expect(animationsOf(progress(6, 14, true))).toEqual([
      'motion-safe:animate-[acad-quiz-rise_220ms_var(--ease-out)_backwards]',
    ]);
  });

  it('the chapter count rolls the same, as one item beside its check', () => {
    const heading = (completed: number, rolls?: boolean) =>
      renderToStaticMarkup(createElement(ChapterHeading, { chapter: 'Signature Schemes', completed, total: 2, rolls }));
    expect(heading(1)).toContain('>1 of 2</span></h3>');
    expect(heading(2, true)).toContain(`</svg><span><span class="${ROLL}">2</span> of 2</span></span></h3>`);
  });

  it('the ring fills in 200ms on plain ease, and the check of a question passed on this visit draws over 300ms, 100ms later', () => {
    const title = renderToStaticMarkup(
      createElement(QuestionTitle, { question: 'What is BLS?', answered: true, passedNow: true }),
    );
    const ring = tagOf(title, 'rounded-full').classes;
    expect(ring).toEqual(
      expect.arrayContaining(['transition-[border-color,background-color]', 'duration-200', 'ease-[ease]']),
    );
    expect(tagOf(title, 'lucide-check').classes).toEqual(
      expect.arrayContaining(['[&>path]:[stroke-dasharray:23]', DRAW]),
    );
    // the knowledge check's draw (acad-quiz-check), the same 23-unit dash
    expect(frame('acad-quiz-draw', 'from')).toEqual({ 'stroke-dashoffset': '23' });
    expect(frame('acad-quiz-draw', 'to')).toEqual({ 'stroke-dashoffset': '0' });
    // Under Reduce Motion the check still draws: the rendered draw class is !important past the site policy, with no
    // motion variant.
    const draws = tagOf(title, 'lucide-check').classes.filter((name) => name.includes('acad-quiz-draw'));
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatch(/\]!$/);
    expect(draws[0]).not.toMatch(/^motion-(safe|reduce):/);
  });

  it('a question passed before this visit shows its check at rest', () => {
    const title = renderToStaticMarkup(createElement(QuestionTitle, { question: 'What is BLS?', answered: true }));
    expect(animationsOf(title)).toEqual([]);
    expect(tagOf(title, 'rounded-full').classes).toContain('transition-[border-color,background-color]');
  });

  it('the chapter list hands each question and chapter what was passed on this visit', () => {
    const html = renderToStaticMarkup(
      createElement(CertificateChapters, {
        chapters: ['Primer on Avalanche Consensus', 'Signature Schemes'],
        quizzesByChapter: {
          'Primer on Avalanche Consensus': [
            { id: '101', question: 'What is the underlying principle?' },
            { id: '102', question: 'What is the role of validators?' },
          ],
          'Signature Schemes': [{ id: '309', question: 'What is the purpose of Recover?' }],
        },
        completedQuizzes: ['101', '102', '309'],
        onQuizCompleted: () => undefined,
        passedNow: ['102'],
      }),
    );
    // One rolling count (the chapter of question 102) and one drawn check (question 102): what passed before rests.
    expect(animationsOf(html)).toEqual(['motion-safe:animate-[acad-quiz-rise_220ms_var(--ease-out)_backwards]', DRAW]);
    expect(html).toContain(`<span><span class="${ROLL}">2</span> of 2</span>`);
    expect(html).toContain('>1 of 1</span></h3>');
  });

  it('the page records the quizzes passed on it, and hands them to the bar and the chapter list', () => {
    const src = read(PAGE);
    const handler = src.slice(src.indexOf('const handleQuizCompleted'), src.indexOf('const allQuizzesCompleted'));
    expect(handler).toContain('setPassedNow(prev => [...prev, quizId]);');
    expect(src.match(/setPassedNow\(/g)).toHaveLength(1);
    expect(src).toContain('rolls={passedNow.length > 0}');
    expect(src).toContain('passedNow={passedNow}');
  });
});

describe('revealsCredential: the credential prints in once, right after the course is completed on the page', () => {
  it('reveals when a quiz passed on this page completed the course', () => {
    expect(revealsCredential(1, 14, 14)).toBe(true);
    expect(revealsCredential(14, 14, 14)).toBe(true);
  });

  it('rests when the page opened on a finished course: nothing was passed on it', () => {
    expect(revealsCredential(0, 14, 14)).toBe(false);
  });

  it('rests while the course is unfinished, and for a course without quizzes', () => {
    expect(revealsCredential(3, 13, 14)).toBe(false);
    expect(revealsCredential(0, 0, 0)).toBe(false);
  });
});

describe('revealScrollBy: the credential comes into view when the shortened page left its top above its landing', () => {
  // The landing is the card's scroll margin, 128px (scroll-mt-32): the sticky header ends at 105px, and the frame ring
  // reaches 7px above the card's top, so a top between 105 and 128 shows under the header but its ring does not.
  it('scrolls up from its top to its landing whenever the top sits above the landing', () => {
    // Measured: after the last quiz the top sat 272px above the viewport at 390 and 51px above at 1440.
    expect(revealScrollBy(-272, 128)).toBe(-400);
    expect(revealScrollBy(-51, 128)).toBe(-179);
    // Under the header (it ends at 105px).
    expect(revealScrollBy(60, 128)).toBe(-68);
  });

  it('scrolls a top that shows below the header but above the landing (105 to 128px): its frame ring is still under it', () => {
    expect(revealScrollBy(105, 128)).toBe(-23);
    expect(revealScrollBy(110, 128)).toBe(-18);
    expect(revealScrollBy(127, 128)).toBe(-1);
  });

  it('stays put when the top already sits at or below its landing', () => {
    expect(revealScrollBy(128, 128)).toBe(0);
    expect(revealScrollBy(300, 128)).toBe(0);
  });
});

describe('acad-credential-reveal: the credential is issued, not swapped in', () => {
  const reveal = postcss.parse(block('acad-credential-reveal'));
  const props: CertificateCredentialProps = {
    academy: 'Avalanche Academy',
    courseTitle: 'Avalanche Fundamentals',
    facts: credentialFacts({ name: 'Avalanche Fundamentals', modules: 4, lessons: 31 }),
    isGenerating: false,
    certificatePdfUrl: null,
    linkedInUrl: 'https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME',
    onGenerate: () => undefined,
    onShareOnX: () => undefined,
    onViewCertificate: () => undefined,
  };
  const render = (revealed?: boolean) =>
    renderToStaticMarkup(createElement(CertificateCredential, { ...props, reveal: revealed }));

  it('the card prints down from its top edge in 700ms on the in-out curve, fading in over the first 200ms', () => {
    expect(tagsOf(render(true))[0].classes).toContain(
      'motion-safe:animate-[acad-cred-print_700ms_var(--ease-in-out)_backwards,vs-fade-in_200ms_var(--ease-out)_backwards]',
    );
    // The clip sits 8px outside the box, so the frame ring (7px out) stays whole.
    expect(frame('acad-cred-print', 'from', { root: reveal })).toEqual({ 'clip-path': 'inset(-8px -8px 100% -8px)' });
    expect(frame('acad-cred-print', 'to', { root: reveal })).toEqual({ 'clip-path': 'inset(-8px)' });
    // the fade is the site's plain fade (exp-view-switch)
    expect(frame('vs-fade-in', 'from')).toEqual({ opacity: '0' });
  });

  it('the course name rises 8px into place over 500ms on the strong ease-out, 250ms in', () => {
    expect(tagOf(render(true), 'h2').classes).toContain(
      'motion-safe:animate-[acad-cred-rise_500ms_var(--ease-out)_250ms_backwards]',
    );
    expect(frame('acad-cred-rise', 'from', { root: reveal })).toEqual({ opacity: '0', transform: 'translateY(8px)' });
  });

  it('Generate comes last: it fades in at 550ms over 300ms', () => {
    expect(tagOf(render(true), 'button').classes).toContain(
      'motion-safe:animate-[vs-fade-in_300ms_var(--ease-out)_550ms_backwards]',
    );
  });

  it('without the reveal the credential shows at rest, as before', () => {
    expect(animationsOf(render())).toEqual([]);
    expect(animationsOf(render(false))).toEqual([]);
    expect(render()).toMatch(/^<div class="not-prose /);
  });

  it('under Reduce Motion the card only fades in, over 200ms past the site policy: no wipe and no rise', () => {
    const animations = animationsOf(render(true));
    // A Tailwind important utility is layered and beats the unlayered policy's 1ms; the curve is the strong ease-out.
    expect(animations.filter((name) => name.startsWith('motion-reduce:'))).toEqual([
      'motion-reduce:animate-[vs-fade-in_200ms_var(--ease-out)_backwards]!',
    ]);
    expect(tagsOf(render(true))[0].classes).toContain(
      'motion-reduce:animate-[vs-fade-in_200ms_var(--ease-out)_backwards]!',
    );
    // The wipe, the rise and Generate's late fade run only with motion allowed.
    const moving = animations.filter((name) => !name.startsWith('motion-reduce:'));
    expect(moving).toHaveLength(3);
    moving.forEach((name) => expect(name.startsWith('motion-safe:')).toBe(true));
  });

  it('lands 8rem down: below the 105px sticky header with its 7px frame ring clear', () => {
    expect(tagsOf(render(true))[0].classes).toContain('scroll-mt-32');
  });

  it('brings its top into view before the first paint of the reveal, and never on a later visit', () => {
    const src = read(CREDENTIAL);
    expect(src).toContain('useLayoutEffect(() => {');
    expect(src).toContain('if (!reveal || !card) return;');
    expect(src).toContain(
      'const by = revealScrollBy(card.getBoundingClientRect().top, parseFloat(getComputedStyle(card).scrollMarginTop));',
    );
    expect(src).toContain("if (by !== 0) window.scrollBy({ top: by, behavior: 'instant' });");
  });

  it('the page reveals it only after its own pass completed the course', () => {
    expect(read(PAGE)).toContain(
      'reveal={revealsCredential(passedNow.length, correctlyAnsweredQuizzes, totalQuizzes)}',
    );
  });

  it('the block header tells the Reduce Motion path as built: a 200ms fade, not a static card', () => {
    const comment = (
      globalCss.nodes.find((node) => node.type === 'comment' && node.text.startsWith('acad-credential-reveal:')) as
        | { text: string }
        | undefined
    )?.text.replace(/\s+/g, ' ');
    expect(comment).toContain('Under Reduce Motion the card only fades in over 200ms');
  });

  it('throws no confetti (variant b is not built)', () => {
    expect(block('acad-credential-reveal')).not.toMatch(/confetti/i);
    expect(read(CREDENTIAL)).not.toMatch(/confetti/i);
    expect(read(PAGE)).not.toMatch(/confetti/i);
  });
});
