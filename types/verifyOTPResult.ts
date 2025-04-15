export type VerifyOTPResult = {
    isValid: boolean;
    reason?: "INVALID" | "EXPIRED" | "NOT_FOUND";
  };