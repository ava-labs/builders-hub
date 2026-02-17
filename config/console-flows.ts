export interface FlowNextStep {
  title: string;
  description: string;
  path: string;
  priority: "recommended" | "optional";
}

export interface FlowMetadata {
  title: string;
  description: string;
  completionSummary: string;
  accomplishments: string[];
  nextSteps: FlowNextStep[];
}

const flowRegistry: Record<string, FlowMetadata> = {};

export function getFlowMetadata(_basePath: string, _steps?: unknown): FlowMetadata | undefined {
  return flowRegistry[_basePath];
}

export function registerFlowMetadata(basePath: string, metadata: FlowMetadata) {
  flowRegistry[basePath] = metadata;
}
