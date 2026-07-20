import { addValidatorFlow } from "./add-validator";
import type { FlowDefinition, FlowId } from "./types";

export const flows: Readonly<Record<FlowId, FlowDefinition>> = {
  "add-validator": addValidatorFlow,
};
