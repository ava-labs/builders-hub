import { describe, expect, it } from 'vitest';
import { PCHAIN_COMMANDS } from '@/components/toolbox/console/shared/pchainCommands';

// Flag names from platform-cli: cmd/validator.go (add-permissionless) and cmd/l1.go (register-validator)
describe('PCHAIN_COMMANDS BLS flags', () => {
  it('addValidator passes the BLS public key and the proof of possession', () => {
    const command = PCHAIN_COMMANDS.addValidator({
      nodeId: 'NodeID-abc',
      blsPublicKey: '0xpub',
      blsPop: '0xpop',
      stake: '2000',
      duration: '336h',
      delegationFee: '0.02',
      network: 'fuji',
    });
    expect(command).toBe(
      'platform-cli validator add-permissionless --node-id NodeID-abc --bls-public-key 0xpub --bls-pop 0xpop ' +
        '--stake 2000 --duration 336h --delegation-fee 0.02 --network fuji',
    );
  });

  it('registerL1Validator passes the proof of possession', () => {
    const command = PCHAIN_COMMANDS.registerL1Validator({
      signedWarpMessage: '0xmsg',
      pop: '0xpop',
      balance: '0.1',
      network: 'mainnet',
      keyName: 'ops',
    });
    expect(command).toBe(
      'platform-cli l1 register-validator --message 0xmsg --pop 0xpop --balance 0.1 --network mainnet --key-name ops',
    );
  });
});
