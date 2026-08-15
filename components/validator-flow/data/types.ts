export type FlowId = "add-validator";

export type ActorId =
  | "owner"
  | "node"
  | "l1"
  | "validators"
  | "aggregator"
  | "pchain";

export interface Actor {
  readonly id: ActorId;
  readonly label: string;
  readonly sublabel?: string;
  readonly detail: string;
}

export type MessageKind =
  | "warp-l1-sourced"
  | "warp-pchain-sourced"
  | "evm-tx"
  | "pchain-tx"
  | "signatures";

export interface MessageTravel {
  readonly from: ActorId;
  readonly to: ActorId;
  readonly kind: MessageKind;
  readonly label: string;
}

export interface FailureMode {
  readonly id: string;
  readonly title: string;
  readonly symptom: string;
  readonly errorSelector?: `0x${string}`;
  readonly cause: string;
  readonly fix: string;
}

export interface OperatorCommand {
  readonly label: string;
  readonly language: "bash" | "text";
  readonly code: string;
}

export interface SdkRef {
  readonly label: string;
  readonly href: string;
}

export interface OperatorDepth {
  readonly consoleHref?: string;
  readonly consoleLabel?: string;
  readonly sdkRefs?: readonly SdkRef[];
  readonly commands?: readonly OperatorCommand[];
  readonly notes?: readonly string[];
}

export interface FlowStep {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  /** Short uppercase name shown in the step rail, e.g. "SIGN L1 MSG". Max 14 chars. */
  readonly railLabel: string;
  readonly activeActors: readonly ActorId[];
  readonly travel?: MessageTravel;
  readonly operator: OperatorDepth;
  readonly failureModes: readonly FailureMode[];
}

export interface FlowDefinition {
  readonly id: FlowId;
  readonly title: string;
  readonly heroTitle: string;
  readonly actors: readonly Actor[];
  readonly steps: readonly FlowStep[];
}
