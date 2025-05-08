"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useWalletStore } from "../lib/walletStore"

export function RemountOnWalletChange({ children }: { children: React.ReactNode }) {
  const isTestnet = useWalletStore(s => s.isTestnet)
  const walletChainId = useWalletStore(s => s.walletChainId)
  const walletEVMAddress = useWalletStore(s => s.walletEVMAddress)

  // previous snapshot of the wallet state
  const prevRef = useRef<{
    isTestnet: boolean | undefined
    chainId: number
    address: string
  }>({ isTestnet: undefined, chainId: 0, address: "" })

  // changing this key forces React to unmount/mount the children
  const [key, setKey] = useState(0)

  useEffect(() => {
    const prev = prevRef.current
    if (
      prev.isTestnet !== isTestnet ||
      prev.chainId !== walletChainId ||
      prev.address !== walletEVMAddress
    ) {
      // store the new snapshot and remount the subtree
      prevRef.current = { isTestnet, chainId: walletChainId, address: walletEVMAddress }
      setKey(k => k + 1)
    }
  }, [isTestnet, walletChainId, walletEVMAddress])

  return (
    <div
      key={key}
    >
      {children}
    </div>
  )
} 
