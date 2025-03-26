"use client"

import { useToolboxStore, useWalletStore } from "../../utils/store"
import { useErrorBoundary } from "react-error-boundary"
import type { AbiEvent } from "viem"
import { useEffect, useState } from "react"
import ValidatorManagerABI from "../../../../contracts/icm-contracts/compiled/ValidatorManager.json"
import { Button } from "../../../components/button"
import { Input } from "../../../components/input"
import { RequireChainL1 } from "../../ui/RequireChain"
import { Container } from "../../../components/container"
import { ChevronDown, ChevronRight } from "lucide-react"

type ViewData = {
  [key: string]: any
}

const serializeValue = (value: any): any => {
  if (typeof value === "bigint") {
    return value.toString()
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue)
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serializeValue(v)]))
  }
  return value
}

export default function ReadContract() {
  const { showBoundary } = useErrorBoundary()
  const { proxyAddress, setProxyAddress } = useToolboxStore()
  const [viewData, setViewData] = useState<ViewData>({})
  const [isReading, setIsReading] = useState(false)
  const [eventLogs, setEventLogs] = useState<Record<string, any[]>>({})
  const { publicClient } = useWalletStore()
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({})

  async function readContractData() {
    if (!proxyAddress) {
      return
    }
    setIsReading(true)
    setEventLogs({})

    if (!proxyAddress || !window.avalanche) return

    try {
      // Read all view functions
      const viewFunctions = ValidatorManagerABI.abi.filter(
        (item: any) => item.type === "function" && (item.stateMutability === "view" || item.stateMutability === "pure"),
      )

      const data: ViewData = {}

      for (const func of viewFunctions) {
        if (!func.name) continue
        if (func.inputs.length > 0) continue

        try {
          const result = await publicClient.readContract({
            address: proxyAddress as `0x${string}`,
            abi: [func],
            functionName: func.name,
          })
          data[func.name] = serializeValue(result)
        } catch (error) {
          console.error(`Error reading ${func.name}:`, error)
          data[func.name] = "Error reading value:\n" + (error as Error)?.message || "Unknown error"
        }
      }

      setViewData(data)

      // Get all events
      const events = ValidatorManagerABI.abi.filter((item: any) => item.type === "event")

      const logs: Record<string, any[]> = {}
      for (const event of events) {
        if (!event.name) continue
        try {
          const eventLogs = await publicClient.getLogs({
            address: proxyAddress as `0x${string}`,
            event: event as AbiEvent,
            fromBlock: 0n,
            toBlock: "latest",
          })

          logs[event.name] = eventLogs.map((log) => serializeValue(log))
        } catch (error) {
          console.error(`Error getting logs for ${event.name}:`, error)
        }
      }
      console.log("Event logs:", logs)
      setEventLogs(logs)
    } catch (error) {
      console.error("Main error:", error)
      showBoundary(error)
    } finally {
      setIsReading(false)
    }
  }

  useEffect(() => {
    readContractData()
  }, [proxyAddress])

  const toggleEventExpansion = (eventName: string) => {
    setExpandedEvents((prev) => ({
      ...prev,
      [eventName]: !prev[eventName],
    }))
  }

  return (
    <RequireChainL1>
      <Container
        title="Read Proxy Contract"
        description="This will read the data from the ValidatorManager contract."
      >
        <div className="space-y-4">
          <Input
            label="Proxy Address"
            value={proxyAddress || ""}
            placeholder="0x..."
            onChange={(value) => setProxyAddress(value)}
            button={
              <Button variant="secondary" onClick={readContractData} loading={isReading} disabled={isReading}>
                Refresh
              </Button>
            }
          />
        </div>

        {Object.keys(viewData).length > 0 && (
          <div className="mt-6">
            <h3 className="text-base font-semibold mb-3 text-zinc-800 dark:text-zinc-200">Contract Data</h3>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-1/3"
                    >
                      Function
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-2/3"
                    >
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
                  {Object.entries(viewData).map(([key, value], index) => (
                    <tr
                      key={key}
                      className={index % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-800/20"}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="font-mono">{key}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">
                        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-md p-2.5 overflow-x-auto">
                          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                            {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {Object.keys(eventLogs).length > 0 && (
          <div className="mt-8">
            <h3 className="text-base font-semibold mb-3 text-zinc-800 dark:text-zinc-200">Events</h3>
            <div className="space-y-3">
              {Object.entries(eventLogs).map(([eventName, logs]) => (
                <div
                  key={eventName}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm"
                >
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 cursor-pointer"
                    onClick={() => toggleEventExpansion(eventName)}
                  >
                    <h4 className="font-medium text-zinc-800 dark:text-zinc-200 flex items-center">
                      {expandedEvents[eventName] ? (
                        <ChevronDown className="w-4 h-4 mr-2" />
                      ) : (
                        <ChevronRight className="w-4 h-4 mr-2" />
                      )}
                      {eventName}
                      <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        {logs.length}
                      </span>
                    </h4>
                  </div>

                  {expandedEvents[eventName] && (
                    <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
                      {logs.length > 0 ? (
                        <div className="space-y-3">
                          {logs.map((log, index) => (
                            <div key={index} className="bg-zinc-50 dark:bg-zinc-800 rounded-md p-3 overflow-x-auto">
                              <pre className="text-xs font-mono leading-relaxed text-zinc-800 dark:text-zinc-200">
                                {JSON.stringify(log, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">No events found</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Container>
    </RequireChainL1>
  )
}

