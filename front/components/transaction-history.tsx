"use client"

import { useAccount } from "wagmi"
import { Card } from "@/components/ui/card"
import { useEffect, useState } from "react"

interface Transaction {
  id: string
  hash: string
  recipients: number
  amount: string
  status: "success" | "failed"
  timestamp: number
}

export default function TransactionHistory() {
  const { address } = useAccount()
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Cargar transacciones desde localStorage
  useEffect(() => {
    if (!address) return

    const key = `transactions_${address.toLowerCase()}`
    const stored = localStorage.getItem(key)
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTransactions(JSON.parse(stored))
      } catch (err) {
        console.error("[v0] Error loading transactions:", err)
      }
    }
  }, [address])

  const openExplorer = (hash: string) => {
    // Ajusta según tu red (Mainnet, Sepolia, etc.)
    window.open(`https://etherscan.io/tx/${hash}`, "_blank")
  }

  return (
    <Card className="h-full">
      <div className="p-6 space-y-4 flex flex-col h-full">
        <div>
          <h3 className="text-xl font-bold mb-1">Recent Payments</h3>
          <p className="text-xs text-muted-foreground">Your transaction history</p>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto pr-2">
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                onClick={() => openExplorer(tx.hash)}
                className="p-3 bg-muted/30 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-xs font-mono text-muted-foreground">{tx.hash.slice(0, 10)}...</span>
                  </div>
                  <span className="text-xs font-semibold text-accent">+{tx.recipients}</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm font-semibold">{tx.amount} ETH</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.timestamp).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  )
}
