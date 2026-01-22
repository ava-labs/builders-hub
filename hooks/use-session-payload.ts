import { useState } from "react"

export function useSessionPayload() {
  const [sessionPayload, setSessionPayload] = useState<{id: string}>()

  return {sessionPayload, setSessionPayload} 
}