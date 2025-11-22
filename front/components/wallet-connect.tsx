"use client"

import { useAccount, useConnect, useDisconnect } from "wagmi"
import { injected } from "wagmi/connectors"
import { Button } from "@/components/ui/button"

export default function WalletConnect() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  if (!isConnected) {
    return (
      <Button onClick={() => connect({ connector: injected() })} className="w-full">
        Connect Wallet
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </span>
      <Button onClick={() => disconnect()} variant="outline" size="sm">
        Disconnect
      </Button>
    </div>
  )
}
