import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRejectedRequestError, SwitchChainError } from 'viem';
import { reportSwitchFailure } from '@/components/toolbox/hooks/useWalletSwitch';
import { WALLET_REJECTED_TEXT } from '@/components/toolbox/lib/walletRejection';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('@/lib/toast', () => ({ toast: { error: toastError } }));

describe('reportSwitchFailure', () => {
  beforeEach(() => {
    toastError.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('shows the rejection toast by default (header switch, Faucet, banners)', () => {
    const refused = new UserRejectedRequestError(new Error('User rejected the request.'));
    expect(reportSwitchFailure(refused, 43113)).toBe(false);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(WALLET_REJECTED_TEXT, undefined, { id: 'network-switch:43113' });
  });

  it('shows the switch toast with the chain name for other errors', () => {
    const unknownChain = new SwitchChainError(new Error('Unrecognized chain ID'));
    expect(reportSwitchFailure(unknownChain, 99999, { toastOnFailure: true }, 'Echo')).toBe(false);
    expect(toastError).toHaveBeenCalledWith('Your wallet did not switch to Echo.', unknownChain.shortMessage, {
      id: 'network-switch:99999',
    });
  });

  it('shows no toast when the caller turns it off (ChainGate, AutoSwitchChainGate on load)', () => {
    const refused = { code: 4001, message: 'User rejected the request.' };
    expect(reportSwitchFailure(refused, 43113, { toastOnFailure: false })).toBe(false);
    expect(reportSwitchFailure({ code: 4902 }, 43113, { toastOnFailure: false }, 'Echo')).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });
});
