"use client"

import { useState } from "react"
import { Container } from "../../../components/container"
import { cn } from "../../../../lib/utils"
import { Input } from "../../../components/input"
import { Button } from "../../../components/button"

export default function ChangeWeight() {
  const [nodeID, setNodeID] = useState("")
  const [weight, setWeight] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleChangeWeight = async () => {
    if (!nodeID.trim()) {
      setError("Node ID is required")
      return
    }

    if (!weight.trim()) {
      setError("Weight is required")
      return
    }

    // Validate weight is a number
    const weightNum = Number(weight)
    if (isNaN(weightNum) || weightNum <= 0) {
      setError("Weight must be a positive number")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Mock success for demo purposes
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setSuccess(`Validator with Node ID ${nodeID} weight has been changed to ${weight} successfully`)
      setNodeID("")
      setWeight("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change validator weight")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container title="Change Validator Weight" description="Modify a validator's weight on an Avalanche L1">
      <div className="space-y-4">
        <div className="space-y-2">
          <Input
            id="nodeID"
            type="text"
            value={nodeID}
            onChange={(e) => setNodeID(e)}
            placeholder="Enter validator Node ID"
            className={cn(
              "w-full px-3 py-2 border rounded-md",
              "text-zinc-900 dark:text-zinc-100",
              "bg-white dark:bg-zinc-800",
              "border-zinc-300 dark:border-zinc-700",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
              "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
            )}
            label="Node ID"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Enter the Node ID of the validator you want to modify
          </p>
        </div>

        <div className="space-y-2">
          <Input
            id="weight"
            type="text"
            value={weight}
            onChange={(e) => setWeight(e)}
            placeholder="Enter new weight"
            className={cn(
              "w-full px-3 py-2 border rounded-md",
              "text-zinc-900 dark:text-zinc-100",
              "bg-white dark:bg-zinc-800",
              "border-zinc-300 dark:border-zinc-700",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
              "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
            )}
            label="Weight"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Enter the new weight for this validator</p>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm">
            {success}
          </div>
        )}

        <Button onClick={handleChangeWeight} disabled={isLoading}>
          {isLoading ? "Changing Weight..." : "Change Weight"}
        </Button>
      </div>
    </Container>
  )
}

