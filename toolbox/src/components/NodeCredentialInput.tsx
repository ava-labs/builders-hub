"use client"

import { useState } from "react"
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock'
import { cn } from "./utils"

export type NodeCredentials = {
  nodeID: string
  publicKey: string
  proofOfPossession: string
}

interface NodeCredentialInputProps {
  onCredentialsChange: (credentials: NodeCredentials | null) => void
  className?: string
}

export function NodeCredentialInput({ onCredentialsChange, className }: NodeCredentialInputProps) {
  const [jsonInput, setJsonInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  const rpcCommand = `curl -X POST --data '{"jsonrpc":"2.0","id":1,"method":"info.getNodeID"}' -H "content-type:application/json;" 127.0.0.1:9650/ext/info`

  const handleJsonInput = (value: string) => {
    setJsonInput(value)
    setError(null)

    if (!value.trim()) {
      onCredentialsChange(null)
      return
    }

    try {
      const parsed = JSON.parse(value)
      const result = parsed.result || parsed
      
      if (!result.nodeID || !result.nodePOP || !result.nodePOP.publicKey || !result.nodePOP.proofOfPossession) {
        setError("Invalid JSON format. Missing nodeID or nodePOP fields.")
        onCredentialsChange(null)
        return
      }

      onCredentialsChange({
        nodeID: result.nodeID,
        publicKey: result.nodePOP.publicKey,
        proofOfPossession: result.nodePOP.proofOfPossession
      })
      setError(null)
    } catch (err) {
      setError(`Error parsing JSON: ${err instanceof Error ? err.message : String(err)}`)
      onCredentialsChange(null)
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Run this command on your validator node to get the node credentials:
      </p>

      <DynamicCodeBlock
        code={rpcCommand}
        lang="bash"
      />

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Paste the JSON response below:
      </p>

      <textarea
        value={jsonInput}
        onChange={(e) => handleJsonInput(e.target.value)}
        placeholder='{"jsonrpc":"2.0","result":{"nodeID":"NodeID-...","nodePOP":{"publicKey":"0x...",  "proofOfPossession":"0x..."}},"id":1}'
        rows={4}
        className={cn(
          "w-full rounded-md p-3 font-mono text-sm",
          "bg-white dark:bg-zinc-900",
          "border border-zinc-300 dark:border-zinc-600",
          "text-zinc-900 dark:text-zinc-100",
          "shadow-sm focus:ring focus:ring-primary/20 focus:border-primary/60 focus:outline-none",
          "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
        )}
      />

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
