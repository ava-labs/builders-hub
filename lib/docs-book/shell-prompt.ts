import type { Element, ElementContent } from 'hast';
import type { ShikiTransformer } from 'shiki';

/*
 * Shell prompts for docs code blocks. The transformer marks each command line of a shell fence with
 * the class `shell-command`. The "$ " itself comes from CSS (app/docs/book/code.css), so the copy
 * button (which reads textContent) and a text selection never take it. The transformer adds only
 * a class, so Academy and Blog code blocks render as before: no CSS outside /docs reads the class.
 */

const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'shellscript', 'zsh', 'console']);

// The class on a command line. app/docs/book/code.css draws the prompt from it.
export const SHELL_COMMAND_CLASS = 'shell-command';

// A fence with this word in its meta shows output, so it gets no prompts.
const NO_PROMPT = /(?:^|\s)noprompt(?:\s|$)/;

// Words that open or close a compound command. The lines inside one continue a command.
const OPENERS = new Set(['if', 'case', 'for', 'while', 'until', 'select']);
const CLOSERS = new Set(['fi', 'esac', 'done']);
// Words after which the next word is a command again (`if x; then echo y`).
const LEADERS = new Set(['then', 'do', 'else', 'elif', '!', 'time']);

const HEREDOC = /(?<!<)<<(?!<)(-?)\s*(['"]?)([A-Za-z_][\w-]*)\2/;

interface ScanState {
  // The quote that is still open at the end of the line.
  quote: "'" | '"' | null;
  // The delimiter of an open heredoc body.
  heredoc: string | null;
  // The number of open compound commands and brace groups.
  depth: number;
  // The line ended with a backslash, a pipe or a list operator.
  continues: boolean;
}

// A comment that marks the rest of the block as output: `# output`, `# Expected output:`.
const OUTPUT_COMMENT = /^#\s*(?:expected\s+|example\s+|sample\s+)?output\s*:?$/i;

// Commands whose names end in "ing", so the progress-word test must not read them as output.
const ING_COMMANDS = new Set(['ping', 'fping']);

/**
 * Returns, for each line, true when the line starts a command. A command line is not empty, is not a
 * comment, has no "$ " of its own, does not continue the line before it, and looks like a command.
 *
 * A line continues the line before it after a trailing backslash, pipe, `&&` or `||`, inside an open
 * quote, inside a heredoc body, and inside a compound command (`if` to `fi`, `for` to `done`, `{` to
 * `}`).
 *
 * Many docs fences mix commands with their output (CLI help, menus, logs, JSON). A line that does not
 * look like a command is output (see looksLikeCommand). Output continues to the next blank line (or
 * `[or]` line), so the lines after an output line get no prompt until then: a menu item or a wrapped
 * log line often looks like a command. A `# output` comment makes the rest of the block output.
 *
 * A block that starts with `#!` is a script file, and a block that has a "$ " line of its own is a
 * terminal transcript (its other lines are output). In these two blocks, no line gets a prompt.
 */
export function findCommandLines(lines: readonly string[]): boolean[] {
  const first = lines.find((line) => line.trim() !== '');
  if (first?.trim().startsWith('#!') || lines.some((line) => /^\s*\$(\s|$)/.test(line))) {
    return lines.map(() => false);
  }

  const state: ScanState = { quote: null, heredoc: null, depth: 0, continues: false };
  // An output line came before this line, and no blank line came between them.
  let inOutput = false;
  // A `# output` comment came before this line.
  let restIsOutput = false;
  return lines.map((line) => {
    if (state.heredoc !== null) {
      if (line.trim() === state.heredoc) state.heredoc = null;
      return false;
    }

    if (state.continues || state.quote !== null || state.depth > 0) {
      scanLine(line, state);
      return false;
    }
    // An output line is not scanned: an apostrophe in "Don't" must not open a quote that hides the
    // next command.
    const trimmed = line.trim();
    // An `[or]` line between two forms of a command ends the output run, as a blank line does.
    if (trimmed === '' || /^[[(]?or[\])]?$/i.test(trimmed)) {
      inOutput = false;
      return false;
    }
    if (trimmed.startsWith('#')) {
      if (OUTPUT_COMMENT.test(trimmed)) restIsOutput = true;
      return false;
    }
    if (restIsOutput || inOutput) return false;
    if (!looksLikeCommand(trimmed)) {
      inOutput = true;
      return false;
    }
    scanLine(line, state);
    return true;
  });
}

/**
 * Finds output that starts with a lowercase word, so the first-word test in looksLikeCommand would
 * read it as a command: a progress bar or a percentage (`file.tar.gz 100%[=====>]`), a timestamp
 * (`time="2024-01-02T10:00:00Z"`), a `ps` row, a progress word (`creating genesis for ...`,
 * `loading stored key ...`), a sentence that ends in a colon (`this operation is going to:`), a
 * hash (`c0fe6506a40d...`), a version banner (`avalanchego/1.11.0 [database=v1.4.5]`), a path or
 * an endpoint on its own (`/ext/bc/C/rpc`), and a Go assignment (`cfg := &tmpnet.Config{`).
 */
function looksLikeLog(trimmed: string, word: string): boolean {
  if (/\[[=#]{3,}/.test(trimmed) || /(?:^|\s)\d{1,3}(?:\.\d+)?%(?=[\s[]|$)/.test(trimmed)) return true;
  if (/\d{1,2}:\d{2}:\d{2}/.test(word)) return true;
  // USER, PID, %CPU, %MEM, VSZ and RSS.
  if (/^\S+\s+\d+\s+\d+\.\d+\s+\d+\.\d+\s+\d+\s+\d+\s/.test(trimmed)) return true;
  if (/^[a-z]{2,}ing$/.test(word) && !ING_COMMANDS.has(word)) return true;
  if (/^[a-z]+(?: [a-z']+){2,}:$/i.test(trimmed)) return true;
  if (word.length >= 7 && /^(?:0x)?[0-9a-f]*\d[0-9a-f]*$/.test(word)) return true;
  if (/^[a-z][\w.-]*\/v?\d+\.\d+/i.test(word)) return true;
  if (/^\/\S*$/.test(trimmed)) return true;
  return /^\w+\s*:=/.test(trimmed);
}

/**
 * Tells a command from output by its first word. A command starts with a lowercase name, a path
 * (`./`, `../`, `/`, `~`), a variable (`$HOME/bin/x`, `$(...)`), a test (`[ ... ]`) or an assignment
 * (`RUN_E2E=1 go test`). Output starts with a capital, a digit, a symbol (`|`, `+--`, `-h,`, `{`,
 * `?`, `<placeholder>`, a check mark) or a version (`v1.3.2`). Output also has a colon, `@`, a
 * parenthesis or a comma in its first word (`txID:`, `localhost:9650/ext/bc/P`, `user@host`,
 * `eth_baseFee()`, `help,`), or no letter at all (`_____`). A placeholder inside a path stays a
 * command (`./avalanchego-<VERSION>/build/avalanchego`). Log and progress lines are output too (see
 * looksLikeLog).
 */
function looksLikeCommand(trimmed: string): boolean {
  const word = trimmed.split(/\s+/)[0];
  if (looksLikeLog(trimmed, word)) return false;
  if (/^[A-Za-z_]\w*\+?=/.test(word)) return true;
  if (word === '[' || word === '[[' || word === '!') return true;
  // A function definition, `name() {`. A method list line such as `eth_baseFee()` has no brace.
  if (/^[A-Za-z_][\w-]*\(\)\s*\{/.test(trimmed)) return true;
  if (word.startsWith('$(')) return true;
  if (!/^(?:[a-z_/~$]|\.{1,2}\/|\.$)/.test(word) || /^v\d/.test(word)) return false;
  return /[a-z]/i.test(word) && !/[:@(),]/.test(word);
}

// Reads one line and updates the state that the next line starts from.
function scanLine(line: string, state: ScanState): void {
  // The line with quoted text masked as "x" and the comment cut off, so the word checks below
  // never read a keyword, an operator or a brace inside a string.
  let code = '';
  let quote = state.quote;
  let trailingBackslash = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      code += 'x';
      continue;
    }
    if (quote === '"') {
      if (c === '\\') i++;
      else if (c === '"') quote = null;
      code += 'x';
      continue;
    }
    if (c === '\\') {
      if (line.slice(i + 1).trim() === '') {
        trailingBackslash = true;
        break;
      }
      i++;
      code += 'x';
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      code += 'x';
      continue;
    }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) break;
    code += c;
  }

  state.quote = quote;
  state.continues = trailingBackslash || /(?:\|\||&&|\|)\s*$/.test(code);

  const heredoc = quote === null ? HEREDOC.exec(line) : null;
  if (heredoc) state.heredoc = heredoc[3];

  for (const segment of code.split(/;;|;|&&|\|\||\||&/)) {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    let first = 0;
    while (first < words.length && LEADERS.has(words[first])) first++;
    if (OPENERS.has(words[first])) state.depth++;
    if (CLOSERS.has(words[first])) state.depth--;
    for (const word of words) {
      if (word === '{') state.depth++;
      if (word === '}' || word === '};') state.depth--;
    }
  }
  if (state.depth < 0) state.depth = 0;
}

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

function isLine(node: ElementContent): node is Element {
  if (node.type !== 'element') return false;
  const value = node.properties.class ?? node.properties.className;
  const classes = Array.isArray(value) ? value : String(value ?? '').split(/\s+/);
  return classes.includes('line');
}

/**
 * Marks the command lines of bash, sh, shell, zsh and console fences. It runs in the `code` hook,
 * after the notation transformers have removed their comment lines, so it reads the lines that
 * the reader sees. Put it after those transformers.
 */
export function transformerShellPrompt(): ShikiTransformer {
  return {
    name: 'docs-book:shell-prompt',
    code(code) {
      if (this.options.structure === 'inline') return;
      if (!SHELL_LANGS.has(this.options.lang)) return;
      const meta = this.options.meta?.__raw;
      if (typeof meta === 'string' && NO_PROMPT.test(meta)) return;

      const lines = code.children.filter(isLine);
      const commands = findCommandLines(lines.map(textOf));
      lines.forEach((line, i) => {
        if (commands[i]) this.addClassToHast(line, SHELL_COMMAND_CLASS);
      });
    },
  };
}
