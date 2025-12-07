import { UrlRequiredError } from "viem";

export interface AllocationEntry {
  id: string;
  address: string;
  amount: number;
  error?: string;
  requiredReason?: string;
}
