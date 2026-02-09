export type Status = "ok" | "info" | "warning" | "error";

export interface CheckResult {
    method: string;
    expectedValue: string;
    actualValue: string;
    status: Status;
}
