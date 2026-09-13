import "server-only";

import { statsApi } from "@/lib/stats-api";
import { normalizeMessageId, type IcmMessage } from "@/lib/icm-message";

export async function fetchIcmMessage(messageId: string): Promise<IcmMessage | null> {
  const id = normalizeMessageId(messageId);
  if (!id) return null;
  return statsApi<IcmMessage>(`/icm-api/message/${id}`);
}
