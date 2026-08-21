import type { FlowDefinition } from "./types";

const SDK_REGISTER_FILE =
  "https://github.com/ava-labs/avalanche-sdk-typescript/blob/main/interchain/src/validator-manager/registerL1Validator.ts";

export const addValidatorFlow: FlowDefinition = {
  id: "add-validator",
  title: "Adding a validator to an Avalanche L1",
  heroTitle: "Add a validator",
  actors: [
    {
      id: "owner",
      label: "Operator",
      sublabel: "you",
      detail:
        "Holds the manager owner key (or PoS stake) and sends the two L1 transactions that open and close the registration.",
    },
    {
      id: "node",
      label: "New validator node",
      sublabel: "NodeID + BLS key",
      detail:
        "The machine joining the validator set. Its NodeID and BLS public key identify it on the P-Chain.",
    },
    {
      id: "l1",
      label: "ValidatorManager",
      sublabel: "contract + Warp precompile",
      detail:
        "The L1 contract that tracks the validator set. It emits and verifies warp messages through the Warp precompile.",
    },
    {
      id: "validators",
      label: "L1 validator set",
      sublabel: "each syncs its own P-Chain view",
      detail:
        "The current validators. They BLS-sign warp messages, and each one independently tracks the P-Chain.",
    },
    {
      id: "aggregator",
      label: "Signature aggregator",
      sublabel: "collects signatures\nto 67% of weight",
      detail:
        "A service that asks validators for BLS signatures and combines them into one aggregated signature. The Builder Console uses the hosted Glacier aggregator; self-run aggregators also work.",
    },
    {
      id: "pchain",
      label: "P-Chain",
      sublabel: "validator registry",
      detail:
        "The Avalanche Primary Network chain that records every L1 validator, its weight, and its continuous fee balance.",
    },
  ],
  steps: [
    {
      id: "initiate",
      title: "Initiate registration on the L1",
      railLabel: "INITIATE",
      summary:
        "The operator calls initiateValidatorRegistration on the ValidatorManager with the new node's NodeID, BLS public key, and weight. The contract emits an L1-sourced RegisterL1ValidatorMessage through the Warp precompile.",
      activeActors: ["owner", "l1", "node"],
      travel: {
        from: "owner",
        to: "l1",
        kind: "evm-tx",
        label: "initiateValidatorRegistration",
      },
      operator: {
        consoleHref: "/console/add-validator/initiate-registration",
        consoleLabel: "Add Validator: initiate registration",
        sdkRefs: [{ label: "initiateValidatorRegistration", href: SDK_REGISTER_FILE }],
        notes: [
          "Pick the L1 first: the console flow starts at select-subnet.",
          "PoA chains call the ValidatorManager directly; PoS chains go through the StakingManager.",
        ],
      },
      failureModes: [],
    },
    {
      id: "aggregate-l1",
      title: "Validators sign the L1 message",
      railLabel: "SIGN L1 MSG",
      summary:
        "The aggregator asks the L1 validators to BLS-sign the RegisterL1ValidatorMessage and combines the signatures until they represent at least 67% of the total validator weight.",
      activeActors: ["validators", "aggregator"],
      travel: {
        from: "validators",
        to: "aggregator",
        kind: "signatures",
        label: "BLS signatures (67% of weight)",
      },
      operator: {
        consoleHref: "/console/add-validator/pchain-registration",
        consoleLabel: "Add Validator: P-Chain registration",
        sdkRefs: [{ label: "AggregateSignaturesFn", href: SDK_REGISTER_FILE }],
        notes: [
          "The console performs this aggregation for you inside the P-Chain registration step, via the hosted signature aggregator.",
        ],
      },
      failureModes: [
        {
          id: "aggregator-not-whitelisted",
          title: "Aggregator cannot reach the validators",
          symptom:
            'connectedWeight: 0 while totalWeight is nonzero; "failed to collect a threshold of signatures".',
          cause:
            "On validators-only L1s the validators accept peer connections only from allowlisted NodeIDs. The aggregator's own NodeID is not in allowedNodes, so no validator answers it.",
          fix: "Add the aggregator's NodeID to the allowedNodes configuration of the L1 validators (your infra provider can do this), then retry.",
        },
      ],
    },
    {
      id: "register-pchain",
      title: "Submit RegisterL1ValidatorTx to the P-Chain",
      railLabel: "P-CHAIN TX",
      summary:
        "The aggregated, signed message goes into a P-Chain RegisterL1ValidatorTx. When it is accepted, the P-Chain assigns a validationID and the validator starts consuming its continuous fee balance.",
      activeActors: ["aggregator", "pchain"],
      travel: {
        from: "aggregator",
        to: "pchain",
        kind: "pchain-tx",
        label: "RegisterL1ValidatorTx",
      },
      operator: {
        consoleHref: "/console/add-validator/pchain-registration",
        consoleLabel: "Add Validator: P-Chain registration",
        sdkRefs: [{ label: "SubmitPChainRegisterTxFn", href: SDK_REGISTER_FILE }],
        notes: [
          "The console builds and submits this transaction for you. Self-serve paths exist via the Avalanche SDK.",
          "The P-Chain account paying the fee needs sufficient AVAX; the console links a faucet and the C-P bridge if the balance is low.",
        ],
      },
      failureModes: [
        {
          id: "registration-expired",
          title: "Registration window expired",
          symptom:
            "The P-Chain rejects the transaction, or a stale pending registration blocks a new attempt for the same NodeID.",
          cause:
            "Each initiated registration carries an expiry. If the P-Chain transaction is not accepted before it, the registration can no longer be completed.",
          fix: "Clean up the expired registration on the L1, or register again from scratch. Rotating to a fresh NodeID sidesteps a stuck expired entry entirely.",
        },
      ],
    },
    {
      id: "pchain-message",
      title: "The P-Chain acknowledges the registration",
      railLabel: "P-CHAIN ACK",
      summary:
        "The registration is now a P-Chain fact. A P-Chain-sourced L1ValidatorRegistrationMessage (validationID, registered = true) becomes available for the L1 validators to sign. Its source chain is the P-Chain itself.",
      activeActors: ["pchain"],
      operator: {
        notes: [
          "Nothing to do here: this is a state change, not a transaction. The validationID from step 3 is the handle everything else uses.",
        ],
      },
      failureModes: [],
    },
    {
      id: "aggregate-pchain",
      title: "Validators sign the P-Chain message",
      railLabel: "SIGN P-MSG",
      summary:
        "The aggregator asks the L1 validators to sign the P-Chain-sourced message. Each validator checks the claim against its own synced view of the P-Chain (the justification) before signing.",
      activeActors: ["validators", "aggregator", "pchain"],
      travel: {
        from: "validators",
        to: "aggregator",
        kind: "signatures",
        label: "BLS signatures over the P-Chain message",
      },
      operator: {
        consoleHref: "/console/add-validator/complete-registration",
        consoleLabel: "Add Validator: complete registration",
        sdkRefs: [{ label: "AggregateSignaturesFn", href: SDK_REGISTER_FILE }],
        notes: [
          "P-Chain-sourced aggregation is stricter than step 2: validators must recognize the registration in their own P-Chain view before they sign.",
        ],
      },
      failureModes: [
        {
          id: "pchain-sourced-timeouts",
          title: "Validators refuse the P-Chain-sourced request",
          symptom:
            "accumulatedWeight stays 0 out of the total weight; every validator returns an immediate timeout.",
          cause:
            "Validators reject the request during message or justification validation, often because their P-Chain view does not (yet) contain the registration, or the aggregator is not allowlisted (see step 2).",
          fix: "Confirm the RegisterL1ValidatorTx is accepted, give validators time to sync past it, verify aggregator connectivity, then retry the aggregation.",
        },
      ],
    },
    {
      id: "complete",
      title: "Complete registration on the L1",
      railLabel: "COMPLETE",
      summary:
        "The signed P-Chain message rides inside the transaction's access list as a warp predicate. The block proposer's node verifies it against its own P-Chain view while building the block; then completeValidatorRegistration marks the validator active in the ValidatorManager.",
      activeActors: ["aggregator", "l1", "owner"],
      travel: {
        from: "aggregator",
        to: "l1",
        kind: "warp-pchain-sourced",
        label: "signed message as access-list predicate",
      },
      operator: {
        consoleHref: "/console/add-validator/complete-registration",
        consoleLabel: "Add Validator: complete registration",
        sdkRefs: [{ label: "completeValidatorRegistration", href: SDK_REGISTER_FILE }],
        commands: [
          {
            label:
              "Completion via cast when your wallet cannot attach an access list (the console generates this exact command with your manager address, RPC URL, and signed access list filled in):",
            language: "bash",
            code: 'cast send $VALIDATOR_MANAGER \\\n  0xa3a65e480000000000000000000000000000000000000000000000000000000000000000 \\\n  --access-list "$WARP_PREDICATE_ACCESS_LIST" \\\n  --gas-limit 2000000 \\\n  --rpc-url $L1_RPC_URL \\\n  --private-key $PRIVATE_KEY',
          },
        ],
        notes: [
          "The calldata above is completeValidatorRegistration(uint32) with message index 0: selector 0xa3a65e48 plus the zero-encoded argument.",
          "The Warp precompile lives at 0x0200000000000000000000000000000000000005; the predicate is packed into the access list entry for that address.",
          "requirePrimaryNetworkSigners does not apply here: P-Chain-sourced messages are exempt in Subnet-EVM v0.8.0 and later, so the L1 validator set verifies this message.",
          "Verify the result afterwards in the console's verify-validator-set step.",
        ],
      },
      failureModes: [
        {
          id: "invalid-warp-message",
          title: "InvalidWarpMessage on a correct transaction",
          symptom:
            "The transaction reverts with the InvalidWarpMessage custom error even though the access list and predicate are correctly formed; getVerifiedWarpMessage returns empty data.",
          errorSelector: "0x6b2f19e9",
          cause:
            "The block proposer built the block against a P-Chain height that predates the registration, so the signature verification ran against an older validator set view.",
          fix: "Wait for the chain to progress, then resend the identical transaction. The same calldata and access list succeed once the proposer's P-Chain view includes the registration.",
        },
      ],
    },
  ],
};
