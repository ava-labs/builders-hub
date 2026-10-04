export type VerifyOTPResult = {
    isValid: boolean;
    reason?: "INVALID" | "EXPIRED" | "NOT_FOUND" | "TOO_MANY_ATTEMPTS" | "BUSY";
  };