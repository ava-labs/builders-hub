import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement, type BaseSyntheticEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createFormControl } from 'react-hook-form';
import postcss, { type AtRule, type Declaration } from 'postcss';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { Button as ToolboxButton } from '@/components/toolbox/components/Button';
import { cssBlock, read, ungatedHover } from './helpers';

/**
 * Task 13 of the hub motion pass, the console flow: con-tool-switch, con-step-travel, con-busy-keep,
 * con-palette-instant and con-press. Specs: .scratch/hub-motion/proposals/60-console.js.
 */
const PANE = 'app/console/layout.client.tsx';
const MOTION = 'components/console/motion.ts';
const CONTAINER = 'components/toolbox/components/Container.tsx';
const STEP_FLOW = 'components/console/step-flow.tsx';
const STEP_POSITION = 'components/console/step-position.ts';
const STEP_FLOW_ROUTE = 'components/console/step-flow-route.tsx';
const REQUIREMENTS = 'components/toolbox/components/CheckRequirements.tsx';
const BUTTON = 'components/toolbox/components/Button.tsx';
const PALETTE = 'components/console/command-palette.tsx';
const DIALOG = 'components/ui/dialog.tsx';
const HOME = 'app/console/page.tsx';
const HEADER_CHIP = 'components/toolbox/components/console-header/chip.ts';
const POS_QUERY = 'components/toolbox/console/permissionless-l1s/QueryPoSValidatorSet.tsx';
const VM_LAYOUT = 'components/toolbox/contexts/ValidatorManagerLayout.tsx';
const MIGRATE = 'components/toolbox/console/utilities/vmc-migrate-from-v1/MigrateV1ToV2.tsx';
const ADD_CHAIN = 'components/toolbox/providers/modals/AddChainModal.tsx';
const VALIDATOR_PAGES = [
  'add-validator',
  'permissioned-l1s/change-validator-weight',
  'permissionless-l1s/delegate/erc20',
  'permissionless-l1s/delegate/native',
  'permissionless-l1s/remove-delegation',
  'permissionless-l1s/submit-uptime-proof',
  'remove-validator',
].map((flow) => `app/console/${flow}/[step]/client-page.tsx`);
const CSS = 'app/global.css';

/** The step flows under app/console that render from a layout above their [step] route. */
const FLOWS = [
  'add-validator',
  'create-l1',
  'encrypted-erc/deploy',
  'encrypted-erc/deposit',
  'layer-1/create',
  'layer-1/upgrade',
  'permissioned-l1s/change-validator-weight',
  'permissioned-l1s/multisig-setup',
  'permissioned-l1s/validator-manager-setup',
  'permissionless-l1s/delegate/erc20',
  'permissionless-l1s/delegate/native',
  'permissionless-l1s/erc20-staking-manager-setup',
  'permissionless-l1s/native-staking-manager-setup',
  'permissionless-l1s/remove-delegation',
  'permissionless-l1s/submit-uptime-proof',
  'remove-validator',
  'utilities/vmcMigrateFromV1',
];
const flowLayout = (flow: string) => `app/console/${flow}/layout.tsx`;
const flowStepPage = (flow: string) => `app/console/${flow}/[step]/page.tsx`;

const TOUCHED = [
  PANE,
  MOTION,
  CONTAINER,
  STEP_FLOW,
  STEP_POSITION,
  STEP_FLOW_ROUTE,
  REQUIREMENTS,
  BUTTON,
  PALETTE,
  DIALOG,
  HOME,
  HEADER_CHIP,
  POS_QUERY,
  VM_LAYOUT,
  MIGRATE,
  ...VALIDATOR_PAGES,
  ...FLOWS.flatMap((flow) => [flowLayout(flow), flowStepPage(flow)]),
];

const TRANSITION_ALL = /transition-all|transition:\s*all/;
const EASE_IN = /\bease-in\b(?!-out)/;
const src = (path: string) => (existsSync(join(process.cwd(), path)) ? read(path) : '');

/** Every .tsx file under `dir`, as a repo path. */
const tsxUnder = (dir: string) =>
  readdirSync(join(process.cwd(), dir), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => join(dir, file));

/** The toolbox `<Button>` elements in `file`: their attributes as written, their text, and the id of the `<form>` they
 * sit in (null outside a form). JSX inside an attribute, such as an Input's `button` prop, counts where it renders. */
function toolboxButtons(file: string): { attrs: Record<string, string>; text: string; form: string | null }[] {
  const sf = ts.createSourceFile(file, src(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const attrsOf = (attributes: ts.JsxAttributes) =>
    Object.fromEntries(
      attributes.properties
        .filter(ts.isJsxAttribute)
        .map((attr) => [attr.name.getText(sf), attr.initializer ? attr.initializer.getText(sf) : 'true']),
    );
  const found: { attrs: Record<string, string>; text: string; form: string | null }[] = [];
  const visit = (node: ts.Node, form: string | null): void => {
    let inner = form;
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(sf);
      const attrs = attrsOf(node.openingElement.attributes);
      if (tag === 'form') inner = attrs.id ?? 'form';
      if (tag === 'Button')
        found.push({
          attrs,
          text: node.children
            .map((c) => c.getText(sf))
            .join('')
            .trim(),
          form,
        });
    } else if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(sf) === 'Button') {
      found.push({ attrs: attrsOf(node.attributes), text: '', form });
    }
    ts.forEachChild(node, (child) => visit(child, inner));
  };
  visit(sf, null);
  return found;
}

/** The con-tool-switch block of global.css: its heading comment and the rules after it, up to a blank line. */
const toolSwitchBlock = (): string => cssBlock('con-tool-switch');

describe('con-tool-switch: opening a tool is one 150ms fade, no loader flash', () => {
  it('the pane fades in over 150ms on the strong ease-out with a CSS animation, and nothing moves', () => {
    const pane = src(PANE);
    expect(pane).toContain('animate-[vs-fade-in_150ms_var(--ease-out)]');
    expect(pane).not.toContain('framer-motion');
    expect(pane).not.toMatch(/\by:\s*\d/);
    // the fade is opacity only, so Reduce Motion keeps it: the site reducer would otherwise play it in 1ms
    expect(pane).toContain('motion-reduce:[animation-duration:150ms]!');

    // the site's plain fade (exp-view-switch): the con-tool-switch block defines no keyframes of its own
    postcss
      .parse(toolSwitchBlock())
      .walkAtRules('keyframes', (rule) => expect.unreachable(`@keyframes ${rule.params}`));
    const keyframes: AtRule[] = [];
    postcss.parse(read(CSS)).walkAtRules('keyframes', (rule) => {
      if (rule.params === 'vs-fade-in') keyframes.push(rule);
    });
    expect(keyframes).toHaveLength(1);
    const props: string[] = [];
    keyframes[0].walkDecls((decl: Declaration) => {
      props.push(decl.prop);
    });
    expect(props).toEqual(['opacity']);
  });

  it('no second entrance inside the pane: the tool chrome and the step flow do not rise again', () => {
    for (const file of [CONTAINER, STEP_FLOW]) {
      const code = src(file);
      expect(code).not.toContain('framer-motion');
      expect(code).not.toMatch(/sectionContainer|sectionItem|<motion\./);
    }
    expect(src(CONTAINER)).toContain('data-console-tool={title}');
    expect(src(STEP_FLOW)).toContain('data-console-flow');
  });

  it('the requirements loader shows only when the check takes longer than 400ms, Reduce Motion included', () => {
    const code = src(REQUIREMENTS);
    expect(code).toContain('animate-[vs-fade-in_150ms_var(--ease-out)_400ms_both]');
    expect(code).toContain('motion-reduce:[animation-delay:400ms]!');
    expect(code).toMatch(
      /if \(state\.isLoading\) \{\s*return \(\s*<div className=\{`\$\{GATE_FRAME\} \$\{LOADER_WAIT\}`\}>/,
    );
  });
});

describe('con-step-travel: the step bar holds still and the red mark travels', () => {
  it.each(FLOWS)('%s renders from a layout above its [step] route, so its step bar stays mounted', (flow) => {
    const layout = src(flowLayout(flow));
    expect(layout).toMatch(/^import \w+ from ['"]\.\/\[step\]\/client-page['"];$/m);
    expect(layout).toMatch(/^export default stepFlowLayout\(\w+\);$/m);
    // the [step] page renders only the marker that Next scrolls into view on a step change
    const page = src(flowStepPage(flow));
    expect(page).not.toMatch(/client-page|StepFlow/);
    expect(page).toMatch(/return <div aria-hidden data-step-route \/>;/);
    expect(page).toMatch(/^export const metadata = consoleToolMetadata\(/m);
  });

  it('every StepFlow flow with a [step] route takes the pattern, but the ICTT bridge, which keeps its own error page', () => {
    const stepFlowPages = tsxUnder('app/console')
      .filter((file) => file.endsWith('/[step]/client-page.tsx') && src(file).includes('<StepFlow'))
      .map((file) => file.replace(/^app\/console\//, '').replace(/\/\[step\]\/client-page\.tsx$/, ''));
    expect(stepFlowPages.sort()).toEqual([...FLOWS].sort());
    // the bridge's StepFlow sits in BridgeLayout, ICM's in IcmLayout; each keeps an error.tsx at its base, where a
    // layout would go, so both still mount with each step
    expect(src('app/console/ictt/[step]/page.tsx')).toContain('<IcttBridgeStepClientPage currentStep={step} />');
    expect(src('app/console/icm/[phase]/page.tsx')).toContain('<IcmPhaseClientPage currentPhase={phase} />');
    for (const base of ['app/console/ictt', 'app/console/icm']) {
      expect(existsSync(join(process.cwd(), `${base}/error.tsx`))).toBe(true);
      expect(existsSync(join(process.cwd(), `${base}/layout.tsx`))).toBe(false);
    }
  });

  it('the validator flows stay mounted but read the validator manager fresh on every step, as before', () => {
    const flow = src(STEP_FLOW).replace(/\s+/g, ' ');
    // the wrapper sits inside the step's keyed boundary, so it mounts with the step
    expect(flow).toContain(
      '<StepErrorBoundary key={shown.key}>{wrapStep ? wrapStep(stepBody) : stepBody}</StepErrorBoundary>',
    );
    const layout = src(VM_LAYOUT).replace(/\s+/g, ' ');
    expect(layout).toContain(
      'return function wrapStep(step: React.ReactNode) { return <ValidatorManagerProvider subnetId={subnetId}>{step}</ValidatorManagerProvider>; };',
    );
    expect(layout).toContain(
      'if (providerPerStep) return content; return <ValidatorManagerProvider subnetId={subnetIdL1}>{content}</ValidatorManagerProvider>;',
    );
    const validatorFlows = FLOWS.filter((f) =>
      src(`app/console/${f}/[step]/client-page.tsx`).includes('<ValidatorManagerLayout'),
    );
    expect(validatorFlows).toHaveLength(7);
    for (const f of validatorFlows) {
      const page = src(`app/console/${f}/[step]/client-page.tsx`);
      if (f === 'remove-validator') {
        // its step list follows the manager's owner type, so it keeps the flow's provider and adds one per step
        expect(page).not.toContain('providerPerStep');
        expect(page).toContain('wrapStep={validatorManagerPerStep(vmcCtx.subnetId)}');
      } else {
        expect(page).toMatch(/<ValidatorManagerLayout subnetIdL1=\{subnetIdL1\} providerPerStep[ >]/);
        expect(page).toContain('wrapStep={validatorManagerPerStep(subnetIdL1)}');
      }
    }
    // a tool that mounts once per route keeps the layout's own provider
    expect(src('components/toolbox/console/permissioned-l1s/ChangeWeight.tsx')).not.toContain('providerPerStep');
  });

  it('the layout renders the flow on a [step] route only, under the marker; other pages render as they are', () => {
    const route = src(STEP_FLOW_ROUTE);
    expect(route).toContain('const { step } = useParams<{ step?: string }>();');
    expect(route).toContain("if (typeof step !== 'string') return children;");
    expect(route.indexOf('{children}')).toBeLessThan(route.indexOf('<Flow currentStepKey={step} />'));
  });

  it('the pane fades once per flow: a [step] route shares its flow key, a sibling page keeps its own', () => {
    const pane = src(PANE);
    const list = pane.match(/const MOUNTED_FLOWS = \[([^\]]*)\];/)?.[1] ?? '';
    const bases = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(bases).toEqual(FLOWS.map((flow) => `/console/${flow}/`));
    expect(pane).toContain('const { step } = useParams<{ step?: string }>();');
    expect(pane).toContain('MOUNTED_FLOWS.find((base) => pathname === `${base}${step}`)');
    expect(pane).toContain('key={flow ?? pathname}');
  });

  it('one red mark moves with transform on the ease-in-out curve over 300ms, a CSS transition that retargets', () => {
    const flow = src(STEP_FLOW);
    expect(flow).toMatch(
      /className="pointer-events-none absolute left-0 top-2 h-1 bg-\[#E6212F\] transition-transform duration-300 ease-in-out"\s*style=\{markStyle\(currentIndex, totalSteps\)\}/,
    );
    // the step the mark lands on turns red as it lands, not before
    expect(flow).toContain("'bg-[#E6212F] [transition:background-color_0ms_300ms]'");
  });

  it('ink sweeps in from the side the mark left: scaleX 0 to 1, 300ms, the same curve', () => {
    const flow = src(STEP_FLOW).replace(/\s+/g, ' ');
    // one fill per colour, each with a fixed colour, so a step that fills shows its colour at once
    expect(flow).toContain(
      "'bg-amber-400 group-hover/seg:bg-amber-500 dark:bg-amber-500/80', status === 'skipped' ? 'scale-x-100' : 'scale-x-0',",
    );
    expect(flow).toContain(
      "'bg-zinc-900 group-hover/seg:bg-zinc-600 dark:bg-zinc-100 dark:group-hover/seg:bg-zinc-400', status === 'done' ? 'scale-x-100' : 'scale-x-0',",
    );
    // the step being left moves its fill; the other fills ease a colour on hover
    expect(flow).toMatch(
      /i === leftStep \? \[ ?'\[transition:[^\]]*\]', currentIndex > i \? 'origin-left' : 'origin-right',? ?\] : 'transition-colors',/,
    );
  });

  it('the step the mark leaves eases its hover colour as its neighbours do: background-color 150ms, default curve', () => {
    const left = src(STEP_FLOW).match(/i === leftStep\s*\?\s*\[\s*'\[transition:([^\]]*)\]'/)?.[1] ?? '';
    const parts = left.split(',').map((part) => part.split('_'));
    expect(parts).toContainEqual(['scale', '300ms', 'var(--ease-in-out)']);
    // its neighbours' transition-colors: Tailwind's 150ms on its default curve. The fills change background-color only.
    expect(read('node_modules/tailwindcss/theme.css')).toContain('--default-transition-duration: 150ms;');
    expect(parts).toContainEqual(['background-color', '150ms', 'var(--default-transition-timing-function)']);
    expect(parts).toHaveLength(2);
  });

  it('a step change closes the completion modal without finishing the flow (the browser Back after Finish)', () => {
    const flow = src(STEP_FLOW);
    // the modal is open only on the step where the flow finished (completionOn, tested in step-position.test.ts); the
    // render that shows another step closes it
    expect(flow).toMatch(/import \{[^}]*\bcompletionOn\b[^}]*\} from ['"]@\/components\/console\/step-position['"];/);
    expect(flow).toContain('const completionStep = completionOn(finishedOn, currentStepKey);');
    expect(flow).toContain('if (completionStep !== finishedOn) setFinishedOn(completionStep);');
    expect(flow).toMatch(/<FlowCompletionModal\s+open=\{completionStep !== null\}/);
    // Finish opens it on the step on screen; only the builder's own close finishes the flow
    expect(flow).toContain('setFinishedOn(currentStepKey);');
    const close = flow.match(/const handleCompletionModalChange = useCallback\(([\s\S]*?)\n {2}\);/)?.[1] ?? '';
    expect(close).toContain('setFinishedOn(open ? currentStepKey : null);');
    expect(close).toContain('if (!open && onFinish) onFinish();');
    // onFinish runs from that close and from the two paths with no modal, never from a step change
    expect(flow.match(/\bonFinish\(\)/g)).toHaveLength(3);
    expect(flow).not.toContain('isCompletionModalOpen');
  });

  it('the title dips with a 2px blur and the body with opacity only, 250ms ease, and both swap at the dip', () => {
    const flow = src(STEP_FLOW);
    expect(flow).toContain('const dipping = currentStepKey !== shownKey;');
    expect(flow).toContain("dipping ? 'duration-[90ms] opacity-0 motion-safe:blur-[2px]' : 'duration-[160ms]'");
    expect(flow).toContain("dipping ? 'duration-[90ms] opacity-0' : 'duration-[160ms]'");
    expect(flow.match(/ease-\[ease\]/g)).toHaveLength(2);
    // the swap waits for the bottom of the dip: 36% of 250ms, or the 150ms fade the site reducer keeps
    expect(flow).toContain('reduce ? 150 : 90');
    // the step on its way out takes no clicks or focus
    expect(flow).toContain('inert={dipping}');
    // a new step mounts fresh, as the route change mounted it
    expect(flow).toContain('<StepErrorBoundary key={shown.key}>');
  });
});

describe('con-busy-keep: a busy button keeps its colour and cross-fades to the spinner', () => {
  it('keeps its colours and aria-busy, ignores clicks and shows a progress cursor', () => {
    const button = src(BUTTON);
    expect(button).toContain('const isDisabled = disabled && !loading;');
    expect(button).toContain('disabled={isDisabled}');
    expect(button).not.toContain('disabled={disabled || loading}');
    expect(button).toContain('aria-busy={loading}');
    expect(button).toContain('onClick={loading ? ignoreBusyClick : onClick}');
    expect(button).toMatch(
      /function ignoreBusyClick\(event: MouseEvent<HTMLButtonElement>\) \{\s*event\.preventDefault\(\);/,
    );
    expect(button).toContain('aria-busy:cursor-progress');
  });

  it('a busy click stops at the button, and the busy button reads as disabled to assistive technology', () => {
    // the click goes no further: no ancestor's handler runs while the action is busy
    expect(src(BUTTON)).toMatch(
      /function ignoreBusyClick\(event: MouseEvent<HTMLButtonElement>\) \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*\}/,
    );
    const button = (props: { loading?: boolean; disabled?: boolean }) => {
      const markup = renderToStaticMarkup(createElement(ToolboxButton, { ...props, children: 'Deploy' }));
      return markup.match(/<button[^>]*>/)?.[0] ?? '';
    };
    expect(button({ loading: true })).toContain('aria-disabled="true"');
    expect(button({ loading: true })).toContain('aria-busy="true"');
    // busy keeps its colours: no native disabled, so the disabled look stays off
    expect(button({ loading: true, disabled: true })).not.toMatch(/\sdisabled=""/);
    expect(button({ loading: true, disabled: true })).toContain('aria-disabled="true"');
    // idle, no aria-disabled at all: a really disabled button carries only its native disabled state
    expect(button({})).not.toContain('aria-disabled');
    expect(button({ disabled: true })).toMatch(/\sdisabled=""/);
    expect(button({ disabled: true })).not.toContain('aria-disabled');
  });

  it('no toolbox form reloads the page: a Button given no type submits, so each form prevents its own submit', () => {
    const forms = [...tsxUnder('components/toolbox'), ...tsxUnder('app/console')].flatMap((file) =>
      [...src(file).matchAll(/<form\b(?:[^>{]|\{(?:[^{}]|\{[^{}]*\})*\})*>/g)].map((tag) => ({ file, tag: tag[0] })),
    );
    expect(forms.length).toBeGreaterThan(0);
    for (const { file, tag } of forms) expect(tag, file).toMatch(/\bonSubmit=\{/);
    // the Migrate tool's form only lays out its fields: its main button runs the migration and must not reload
    expect(src(MIGRATE)).toContain('<form className="space-y-4" onSubmit={(e) => e.preventDefault()}>');
  });

  it('the toolbox Button takes an optional type; unset, it renders exactly as before, with no type attribute', () => {
    const markup = (props: Record<string, unknown>) =>
      renderToStaticMarkup(createElement(ToolboxButton, props as never, 'Label'));
    // every caller that passes no type keeps the HTML default: inside a form, a submit button
    expect(markup({})).not.toMatch(/<button[^>]*\stype=/);
    expect(markup({ type: undefined })).toBe(markup({}));
    expect(markup({ type: 'button' })).toMatch(/^<button type="button" /);
    // the attribute is the only difference
    expect(markup({ type: 'button' }).replace(' type="button"', '')).toBe(markup({}));
  });

  // The Lookup sat inside the add-chain form with no type, so a click on it, or Enter on the chain ID field, submitted
  // the form: its onSubmit asked the wallet to add an empty chain (chainId 0x0) and closed the modal before the lookup
  // landed.
  it('the add-chain Lookup is a type="button" Button, so a click on it runs the lookup and never submits the form', () => {
    const buttons = toolboxButtons(ADD_CHAIN);
    const lookup = buttons.find((button) => button.text === 'Lookup');
    expect(lookup?.form).toBe('"add-chain-form"');
    expect(lookup?.attrs.type).toBe('"button"');
    // no toolbox Button in the form submits it; the footer's Cancel and Add Chain sit outside it and keep no type
    const inForm = buttons.filter((button) => button.form === '"add-chain-form"');
    expect(inForm.map((button) => button.attrs.type)).toEqual(['"button"']);
    expect(buttons.filter((button) => !button.form).map((button) => button.attrs.type)).toEqual([undefined, undefined]);
  });

  // AddChainModal's Lookup is a toolbox Button inside the add-chain form, so a click on it submits that form. The form's
  // onSubmit is react-hook-form's handleSubmit, which prevents the default before its first await: no reload.
  it('the add-chain form prevents its own submit: its onSubmit is react-hook-form handleSubmit', async () => {
    const modal = src(ADD_CHAIN);
    expect(modal).toContain('<form id="add-chain-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">');
    let prevented = false;
    const submit = createFormControl({ defaultValues: { rpcUrl: '' } }).handleSubmit(() => {})({
      preventDefault: () => {
        prevented = true;
      },
      persist: () => {},
    } as unknown as BaseSyntheticEvent);
    // the browser reads defaultPrevented as soon as the submit event is dispatched: it must be set before any await
    expect(prevented).toBe(true);
    await submit;
  });

  // A <ul> inside a <p> is invalid HTML: React logs it ("cannot be a descendant of <p>") and a server render would split
  // the paragraph. The intro keeps its classes on a <div>, which may hold a list.
  it('the Migrate tool holds its list in an element that may hold one: no list inside a <p>', () => {
    const migrate = src(MIGRATE);
    expect(migrate).not.toMatch(/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<(?:ul|ol)\b/);
    expect(migrate).toMatch(
      /<div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">\s*This tool allows you to migrate/,
    );
  });

  it('the label fades out in place while the spinner and busy label fade in from a 2px blur', () => {
    const button = src(BUTTON);
    // the label stays in the flow, so the button keeps its width
    expect(button).toContain("'inline-flex items-center gap-[inherit] transition-opacity duration-100 ease-[ease]'");
    expect(button).toContain("loading && 'opacity-0'");
    // the busy layer lies over the button and never widens it
    expect(button).toMatch(
      /'pointer-events-none absolute inset-0 flex flex-wrap justify-center gap-x-2 overflow-hidden px-1 transition-\[opacity,filter\] duration-180 ease-out'/,
    );
    expect(button).toContain("'starting:opacity-0 motion-safe:starting:blur-[2px]'");
    expect(button).toContain("!loading && 'opacity-0 motion-safe:blur-[2px]'");
    // 750ms a turn
    expect(button).toContain('animate-[spin_750ms_linear_infinite]');
    expect(button).not.toContain('paused');
    // assistive tech reads one label at a time
    expect(button).toContain('aria-hidden={loading || undefined}');
    expect(button).toContain('aria-hidden={!loading || undefined}');
  });

  it('the busy layer is in the page only while busy and through its fade-out', () => {
    const button = src(BUTTON);
    expect(button).toContain('const [busyLayer, setBusyLayer] = useState(loading);');
    expect(button).toContain('if (loading && !busyLayer) setBusyLayer(true);');
    expect(button).toContain('window.setTimeout(() => setBusyLayer(false), 180)');
    expect(button).toContain('{busyLayer && (');
  });
});

describe('con-palette-instant: the command palette opens and closes in one frame', () => {
  it('the palette asks for an instant dialog and carries no animation class', () => {
    const palette = src(PALETTE);
    expect(palette).toMatch(/<DialogContent instant className="overflow-hidden p-0">/);
    expect(palette).not.toMatch(/animate-in|animate-out|zoom-in|zoom-out|fade-in|fade-out/);
  });

  it('every other dialog keeps its zoom and fade', () => {
    const dialog = src(DIALOG).replace(/\s+/g, ' ');
    // both default to animated, and only an instant dialog drops the classes, its overlay with it
    expect(dialog.match(/instant = false/g)).toHaveLength(2);
    expect(dialog).toContain('<DialogOverlay instant={instant} />');
    expect(dialog).toContain(
      '!instant && "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",',
    );
    expect(dialog).toContain(
      '!instant && "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",',
    );
  });
});

describe('con-press: console buttons press in under the finger', () => {
  it('the press dips to 0.97, full width to 0.98, and dims to 85% instead under Reduce Motion', () => {
    const motion = src(MOTION);
    expect(motion).toContain(
      "export const PRESS = 'active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:active:opacity-85';",
    );
    expect(motion).toContain(
      "export const PRESS_WIDE = 'active:scale-[0.98] motion-reduce:active:scale-100 motion-reduce:active:opacity-85';",
    );
    // colours, the hover shadow and gradient stops keep 150ms on the default curve; the press (Tailwind's `scale`
    // property) takes 160ms on the strong ease-out
    expect(motion).toContain(
      "'[transition:color_150ms_var(--default-transition-timing-function),background-color_150ms_var(--default-transition-timing-function),border-color_150ms_var(--default-transition-timing-function),box-shadow_150ms_var(--default-transition-timing-function),--tw-gradient-from_150ms_var(--default-transition-timing-function),--tw-gradient-via_150ms_var(--default-transition-timing-function),--tw-gradient-to_150ms_var(--default-transition-timing-function),scale_160ms_var(--ease-out)]'",
    );
  });

  it('no toolbox Button caller passes transition classes that the press transition would silently override', () => {
    const button = resolve(process.cwd(), 'components/toolbox/components/Button');
    const offenders: string[] = [];
    for (const file of [...tsxUnder('app'), ...tsxUnder('components')]) {
      const code = src(file);
      const from = code.match(/import \{[^}]*\bButton\b[^}]*\} from ['"]([^'"]+)['"]/)?.[1];
      if (!from) continue;
      const target = from.startsWith('@/')
        ? resolve(process.cwd(), from.slice(2))
        : from.startsWith('.')
          ? resolve(process.cwd(), dirname(file), from)
          : null;
      if (target !== button) continue;
      for (const tag of code.matchAll(/<Button\b((?:[^>{]|\{(?:[^{}]|\{[^{}]*\})*\})*)>/g)) {
        const className = tag[1].match(/className=("[^"]*"|\{`[^`]*`\}|\{[^}]*\})/)?.[1] ?? '';
        if (/\b(transition(-\S+)?|duration-\S+|ease-\S+)\b/.test(className)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the toolbox Button, the step flow buttons, the home calls to action and Connect wallet press', () => {
    const button = src(BUTTON);
    expect(button).toMatch(
      /import \{ PRESS, PRESS_TRANSITION, PRESS_WIDE \} from ['"]@\/components\/console\/motion['"];/,
    );
    expect(button).toContain("classes.split(' ').includes('w-full') ? PRESS_WIDE : PRESS");
    expect(button).toContain('loading || isDisabled ? undefined');

    const flow = src(STEP_FLOW);
    const footerButton = flow.match(/const BTN =\s*`[^`]*`;/)?.[0] ?? '';
    expect(footerButton).toMatch(/^const BTN =\s*`inline-flex h-10 [^`]*\$\{PRESS_TRANSITION\} \$\{PRESS\}`;$/);

    const home = src(HOME);
    expect(home.match(/className=\{`inline-flex h-9 [^`]*\$\{PRESS_TRANSITION\} \$\{PRESS\}`\}/g)).toHaveLength(2);

    const chip = src(HEADER_CHIP);
    const connect = chip.match(/export const HEADER_PRIMARY =\s*`[^`]*`;/)?.[0] ?? '';
    expect(connect).toMatch(/`inline-flex h-8 [^`]*\$\{PRESS_TRANSITION\} \$\{PRESS\}`;$/);

    // one transition list per control: a transition-colors beside the press transition would fight it
    expect(button).not.toContain('transition-colors');
    expect(footerButton).not.toContain('transition-colors');
    expect(connect).not.toContain('transition-colors');
  });
});

describe('conventions', () => {
  it.each(TOUCHED)('%s exists, with no transition-all and no ease-in', (file) => {
    const code = src(file);
    expect(code).not.toBe('');
    expect(code).not.toMatch(TRANSITION_ALL);
    expect(code).not.toMatch(EASE_IN);
  });

  it('global.css heads a con-tool-switch block, with no transition-all, no ease-in and no ungated hover', () => {
    const block = toolSwitchBlock();
    expect(block).not.toBe('');
    expect(block).not.toMatch(TRANSITION_ALL);
    expect(block).not.toMatch(EASE_IN);
    expect(ungatedHover(block)).toBe(0);
  });
});
