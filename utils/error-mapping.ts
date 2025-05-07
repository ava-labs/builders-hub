/* eslint-disable @typescript-eslint/no-explicit-any */
import { AxiosError } from "axios";
import toast from "react-hot-toast";
const errors = new Map<string, string>([
  ["Unauthorized", "Unauthorized Credentials"],
]);

export type DEFAULT_STATUS_TYPE = "loading" | "idle" | "succeeded" | "failed";

export const DEFAULT_ERROR_MESSAGE = "An error occurred, please try later";

export default function mapCodeToErrorText(code?: string): string {
  if (!code) return DEFAULT_ERROR_MESSAGE;
  const text = errors.get(code);
  return text || DEFAULT_ERROR_MESSAGE;
}

export function errorMsg(err: any) {
  if (err?.response?.status === 401 || err?.statusCode === 401) return;
  const error_ = err as AxiosError<{ message: string }>;
  const msg = error_.response?.data?.message || DEFAULT_ERROR_MESSAGE;
  toast.remove();
  toast.error(msg);
}
