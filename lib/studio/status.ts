/** Status vocabularies for Studio records. Stored as plain text so adding one needs no migration. */

export const PROJECT_STAGES = ["testnet", "production"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const DEPLOYMENT_STATUSES = ["proposed", "running", "succeeded", "failed", "cancelled"] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

export const STEP_STATUSES = ["sent", "done", "skipped", "failed"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const PROMOTION_STATUSES = ["ready", "deploying", "completed", "failed", "cancelled"] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export const isFinalDeployment = (status: string) => status === "succeeded" || status === "failed" || status === "cancelled";
