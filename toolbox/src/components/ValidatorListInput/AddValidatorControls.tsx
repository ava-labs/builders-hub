"use client"

import { useState } from "react"
import { Button } from "../Button"
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock'
import { cn } from "../utils"
import type { ConvertToL1Validator } from "../ValidatorListInput"

interface Props {
  defaultAddress?: string
  canAddMore: boolean
  onAddValidator: (validator: ConvertToL1Validator) => void
}

export function AddValidatorControls({ defaultAddress = "", canAddMore, onAddValidator }: Props) {
  const [addMode, setAddMode] = useState<"json" | "manual">("json")
  const [jsonInput, setJsonInput] = useState("")
  const [manualNodeID, setManualNodeID] = useState("")
  const [manualPublicKey, setManualPublicKey] = useState("")
  const [manualProof, setManualProof] = useState("")
  const [error, setError] = useState<string | null>(null)

  const rpcCommand = `curl -X POST --data '{"jsonrpc":"2.0","id":1,"method":"info.getNodeID"}' -H "content-type:application/json;" 127.0.0.1:9650/ext/info`

  const handleAddFromJson = () => {
    try {
      if (!jsonInput.trim()) {
        setError("Please enter a valid JSON response")
        return
      }
      const parsed = JSON.parse(jsonInput)
      const { nodeID, nodePOP } = parsed.result ? parsed.result : parsed
      if (!nodeID || !nodePOP?.publicKey || !nodePOP?.proofOfPossession) {
        setError("Invalid JSON format. Missing nodeID or nodePOP.")
        return
      }
      const validator: ConvertToL1Validator = {
        nodeID,
        nodePOP,
        validatorWeight: BigInt(100),
        validatorBalance: BigInt(100000000),
        remainingBalanceOwner: {
          addresses: defaultAddress ? [defaultAddress] : [],
          threshold: 1,
        },
        deactivationOwner: {
          addresses: defaultAddress ? [defaultAddress] : [],
          threshold: 1,
        },
      }
      onAddValidator(validator)
      setJsonInput("")
      setError(null)
    } catch (e) {
      setError(`Error parsing JSON: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const handleAddManual = () => {
    const nodeID = manualNodeID.trim()
    const publicKey = manualPublicKey.trim()
    const proofOfPossession = manualProof.trim()
    if (!nodeID || !publicKey || !proofOfPossession) {
      setError("Please provide NodeID, BLS Public Key, and Proof of Possession")
      return
    }
    const validator: ConvertToL1Validator = {
      nodeID,
      nodePOP: { publicKey, proofOfPossession },
      validatorWeight: BigInt(100),
      validatorBalance: BigInt(100000000),
      remainingBalanceOwner: {
        addresses: defaultAddress ? [defaultAddress] : [],
        threshold: 1,
      },
      deactivationOwner: {
        addresses: defaultAddress ? [defaultAddress] : [],
        threshold: 1,
      },
    }
    onAddValidator(validator)
    setManualNodeID("")
    setManualPublicKey("")
    setManualProof("")
    setError(null)
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-700">
        <span className="text-base font-medium text-zinc-800 dark:text-zinc-200">Add Validator</span>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddMode("json")}
          className={cn(
            "!w-auto",
            addMode === "json"
              ? "border-blue-400 text-blue-700 dark:text-blue-300 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
              : ""
          )}
        >
          Paste info.getNodeID API Response
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddMode("manual")}
          className={cn(
            "!w-auto",
            addMode === "manual"
              ? "border-blue-400 text-blue-700 dark:text-blue-300 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/20"
              : ""
          )}
        >
          Enter NodeID and BLS PoP Manually
        </Button>
      </div>

      {addMode === "json" && (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
           Click the copy button to copy the command and run it in your node's terminal to get the node credentials.
          </p>
          <DynamicCodeBlock
            code={rpcCommand}
            lang="zsh"
          />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
           Paste the JSON response below:
          </p>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{"jsonrpc":"2.0","result":{"nodeID":"...","nodePOP":{"publicKey":"...",  "proofOfPossession":"..."}},"id":1}'
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
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400">{error}</div>}
          <div className="pt-2">
            <Button
              onClick={handleAddFromJson}
              icon={undefined}
              variant="primary"
              className="w-full sm:w-auto"
              disabled={!canAddMore}
            >
              Add Validator
            </Button>
          </div>
        </>
      )}

      {addMode === "manual" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Node ID</label>
            <input
              type="text"
              value={manualNodeID}
              onChange={(e) => setManualNodeID(e.target.value)}
              className={cn(
                "w-full rounded p-2",
                "bg-white dark:bg-zinc-900",
                "border border-zinc-300 dark:border-zinc-700",
                "text-zinc-900 dark:text-zinc-100",
                "font-mono text-sm",
              )}
              placeholder="NodeID-…"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">BLS Public Key</label>
            <input
              type="text"
              value={manualPublicKey}
              onChange={(e) => setManualPublicKey(e.target.value)}
              className={cn(
                "w-full rounded p-2",
                "bg-white dark:bg-zinc-900",
                "border border-zinc-300 dark:border-zinc-700",
                "text-zinc-900 dark:text-zinc-100",
                "font-mono text-sm",
              )}
              placeholder="0x…"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">BLS Proof of Possession</label>
            <input
              type="text"
              value={manualProof}
              onChange={(e) => setManualProof(e.target.value)}
              className={cn(
                "w-full rounded p-2",
                "bg-white dark:bg-zinc-900",
                "border border-zinc-300 dark:border-zinc-700",
                "text-zinc-900 dark:text-zinc-100",
                "font-mono text-sm",
              )}
              placeholder="0x…"
            />
          </div>
          <div>
            <Button
              onClick={handleAddManual}
              variant="primary"
              className="w-full sm:w-auto"
              disabled={!canAddMore}
            >
              Add Validator (Manual)
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}


