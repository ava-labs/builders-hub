import { beforeEach, describe, expect, it, vi } from 'vitest';

const { compileStandardJson } = vi.hoisted(() => ({ compileStandardJson: vi.fn() }));
vi.mock('@/lib/verification/solc', () => ({ compileStandardJson }));

import { VIA_IR_NOTE, builtViaIR, compileSources } from '@/lib/studio/compile';

const SOURCE = 'pragma solidity ^0.8.28;\ncontract Deep { function f() external {} }\n';
const stackTooDeep = {
  errors: [
    {
      severity: 'error',
      message:
        'Compiler error (/solidity/libsolidity/codegen/LValue.cpp:54):Stack too deep. Try compiling with `--via-ir` (cli) or the equivalent `viaIR: true` (standard JSON) while enabling the optimizer. Otherwise, try removing local variables.',
      sourceLocation: { file: 'contracts/Deep.sol', start: 25, end: 30 },
    },
  ],
};
const compiled = {
  contracts: { 'contracts/Deep.sol': { Deep: { abi: [], evm: { bytecode: { object: '6080' } } } } },
};
const viaIRof = (call: number) =>
  (compileStandardJson.mock.calls[call][0] as { stdJsonInput: { settings: { viaIR: boolean } } }).stdJsonInput.settings
    .viaIR;

beforeEach(() => compileStandardJson.mockReset());

describe('compileSources', () => {
  it('retries a Stack too deep failure through viaIR and says so', async () => {
    compileStandardJson
      .mockResolvedValueOnce({ output: stackTooDeep, longVersion: '0.8.28+commit.7893614a' })
      .mockResolvedValueOnce({ output: compiled, longVersion: '0.8.28+commit.7893614a' });
    const build = await compileSources({ 'contracts/Deep.sol': SOURCE });
    expect(viaIRof(0)).toBe(false);
    expect(viaIRof(1)).toBe(true);
    expect(build.ok).toBe(true);
    expect(build.input.settings.viaIR).toBe(true);
    expect(build.contracts.map((c) => c.name)).toEqual(['Deep']);
    expect(builtViaIR(build.diagnostics)).toBe(true);
    expect(build.diagnostics[0]).toEqual({ severity: 'info', message: VIA_IR_NOTE });
  });

  it('keeps the default settings for projects that compile, and does not retry other errors', async () => {
    compileStandardJson.mockResolvedValue({ output: compiled, longVersion: '0.8.28+commit.7893614a' });
    const build = await compileSources({ 'contracts/Deep.sol': SOURCE });
    expect(compileStandardJson).toHaveBeenCalledTimes(1);
    expect(build.input.settings.viaIR).toBe(false);
    expect(builtViaIR(build.diagnostics)).toBe(false);

    compileStandardJson.mockReset();
    compileStandardJson.mockResolvedValue({
      output: { errors: [{ severity: 'error', message: 'Undeclared identifier.' }] },
      longVersion: '0.8.28+commit.7893614a',
    });
    expect((await compileSources({ 'contracts/Deep.sol': SOURCE })).ok).toBe(false);
    expect(compileStandardJson).toHaveBeenCalledTimes(1);
  });

  it('reports the original error when viaIR runs out of stack too', async () => {
    compileStandardJson.mockResolvedValue({ output: stackTooDeep, longVersion: '0.8.28+commit.7893614a' });
    const build = await compileSources({ 'contracts/Deep.sol': SOURCE });
    expect(compileStandardJson).toHaveBeenCalledTimes(2);
    expect(build.ok).toBe(false);
    expect(build.input.settings.viaIR).toBe(false);
  });
});
