// The Native and ERC20 staking-manager-setup "Read Contract" steps are
// functionally identical — both detect native AND erc20 staking managers
// automatically based on the target L1. Re-export the canonical
// implementation from the native path to keep the behavior in lockstep.
export { default } from '@/components/toolbox/console/permissionless-l1s/native-staking-manager-setup/steps/ReadContractStep';
