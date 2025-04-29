# Precompile Contract ABIs

This directory contains the ABI definitions for Avalanche's precompiled contracts. These ABIs are essential for interacting with the precompiles through the Builders Hub toolbox.

## How to Regenerate ABIs

The ABIs in this directory can be regenerated from the Subnet-EVM source code. Here's how:

1. Clone the Subnet-EVM repository:
```bash
git clone https://github.com/ava-labs/subnet-evm.git
cd subnet-evm
```

2. The precompile contracts are written in Go and located in `subnet-evm/precompile/contracts/`. Each precompile has its own directory containing a `contract.go` file that defines the actual contract implementation and interface:

   - AllowList (two implementations):
     - `subnet-evm/precompile/contracts/deployerallowlist/contract.go`
     - `subnet-evm/precompile/contracts/txallowlist/contract.go`
   - FeeManager: `subnet-evm/precompile/contracts/feemanager/contract.go`
   - NativeMinter: `subnet-evm/precompile/contracts/nativeminter/contract.go`
   - RewardManager: `subnet-evm/precompile/contracts/rewardmanager/contract.go`
   - WarpMessenger: `subnet-evm/precompile/contracts/warp/contract.go`

3. To regenerate the ABIs:

```bash
# Install dependencies
go mod download

# Generate the contract artifacts
go generate ./...
```

The generated contract artifacts will include the ABIs. You can find them in the respective contract directories.

## ABI Details

### AllowList.json
Standard allowlist interface used by multiple precompiles for access control:
- `setAdmin(address)`
- `setEnabled(address)`
- `setManager(address)`
- `setNone(address)`
- `readAllowList(address)`

### FeeManager.json
Controls the dynamic fee parameters:
- `setFeeConfig(...)`
- `getFeeConfig()`
- `getFeeConfigLastChangedAt()`

### NativeMinter.json
Allows minting of native tokens:
- `mintNativeCoin(address, uint256)`
- Includes AllowList interface

### RewardManager.json
Manages validator rewards:
- `allowFeeRecipients()`
- `areFeeRecipientsAllowed()`
- `currentRewardAddress()`
- `disableRewards()`
- `setRewardAddress(address)`

### WarpMessenger.json
Handles cross-chain messaging:
- `sendWarpMessage(bytes)`
- `getBlockchainID()`
- `getVerifiedWarpBlockHash(uint32)`
- `getVerifiedWarpMessage(uint32)`

## Note
The precompile contracts are an integral part of Avalanche's Subnet-EVM implementation. Their addresses are fixed and they provide essential functionality for chain management. Always refer to the [official Avalanche documentation](https://docs.avax.network/build/subnet/upgrade/customize-a-subnet#precompiles) for the most up-to-date information about precompiles.

## Source Code
The precompile contracts source code can be found in the [subnet-evm repository](https://github.com/ava-labs/subnet-evm/tree/master/precompile/contracts). 