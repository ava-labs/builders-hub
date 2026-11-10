import { describe, expect, it } from 'vitest';
import { codeToHtml } from 'shiki';
import { findCommandLines, SHELL_COMMAND_CLASS, transformerShellPrompt } from '@/lib/docs-book/shell-prompt';

/** The lines of a fence that get a prompt. */
const prompted = (lines: readonly string[]) => lines.filter((_, i) => findCommandLines(lines)[i]);

describe('findCommandLines', () => {
  it('gives a prompt to each plain command', () => {
    expect(
      findCommandLines(['npm install', 'avalanche blockchain create myblockchain', './build/avalanchego']),
    ).toEqual([true, true, true]);
  });

  it('gives no prompt to a # comment or a blank line', () => {
    const lines = ['# Install the CLI.', 'curl -sSfL https://example.com/install.sh | sh', '', 'avalanche --version'];
    expect(findCommandLines(lines)).toEqual([false, true, false, true]);
  });

  it('gives no prompt to a line after a trailing backslash', () => {
    const lines = ['./build/avalanchego \\', '  --network-id=fuji \\', '  --http-host=0.0.0.0', 'echo done'];
    expect(findCommandLines(lines)).toEqual([true, false, false, true]);
  });

  it('gives no prompt to a line of a #! script', () => {
    const lines = ['#!/usr/bin/env bash', 'set -euo pipefail', 'echo "start"', 'avalanche network start'];
    expect(findCommandLines(lines)).toEqual([false, false, false, false]);
  });

  it.each([
    ['a path on its own', 'avalanche blockchain describe myblockchain', '/ext/bc/C/rpc'],
    [
      'a progress bar',
      'wget https://example.com/avalanchego.tar.gz',
      'avalanchego.tar.gz 100%[===================>] 45.20M 10.1MB/s in 4.5s',
    ],
    ['a timestamp', 'docker logs relayer', 'time="2024-01-02T10:00:00Z" level=info msg="relayer started"'],
    [
      'a ps row',
      'ps aux | grep avalanchego',
      'ubuntu    1234  2.5  1.3 123456 65432 ?  Ssl  10:00   0:42 ./build/avalanchego',
    ],
  ])('gives no prompt to %s after a command', (_, command, output) => {
    expect(findCommandLines([command, output])).toEqual([true, false]);
  });

  it('gives no prompt to output until the next blank line', () => {
    const lines = ['avalanche --help', 'Usage:', '  avalanche [command]', '', 'avalanche --version'];
    expect(prompted(lines)).toEqual(['avalanche --help', 'avalanche --version']);
  });

  it('gives no prompt to any line when the fence has "$ " lines of its own', () => {
    const lines = ['$ avalanche --version', 'avalanche-cli version 1.8.0', '$ npm install'];
    expect(findCommandLines(lines)).toEqual([false, false, false]);
  });
});

describe('transformerShellPrompt', () => {
  const render = (code: string, lang: string, meta?: string) =>
    codeToHtml(code, {
      lang,
      theme: 'github-light',
      meta: meta === undefined ? undefined : { __raw: meta },
      transformers: [transformerShellPrompt()],
    });
  const COMMAND = `class="line ${SHELL_COMMAND_CLASS}"`;

  it('adds the command class to each command line of a bash fence', async () => {
    const html = await render('# Start the node.\n./build/avalanchego\n/ext/bc/C/rpc', 'bash');
    expect(html.split(COMMAND)).toHaveLength(2);
    expect(html).toMatch(new RegExp(`${COMMAND}>.*avalanchego`));
  });

  it('adds no command class when the meta has the noprompt word', async () => {
    expect(await render('./build/avalanchego', 'bash', 'noprompt')).not.toContain(SHELL_COMMAND_CLASS);
    expect(await render('./build/avalanchego', 'bash', 'title="run.sh" noprompt')).not.toContain(SHELL_COMMAND_CLASS);
  });

  it('reads noprompt only as a full word', async () => {
    expect(await render('./build/avalanchego', 'bash', 'nopromptx')).toContain(COMMAND);
  });

  it('adds no command class to a fence that is not a shell language', async () => {
    expect(await render('npm install', 'ts')).not.toContain(SHELL_COMMAND_CLASS);
  });
});
