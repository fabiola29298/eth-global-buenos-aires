"use client"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { injected } from "wagmi/connectors"
import PaymentForm from "./payment-form"
import TransactionHistory from "./transaction-history"
import { Card } from "@/components/ui/card"

export default function PaymentApp() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <div className="md:hidden bg-primary text-primary-foreground p-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PayStream</h1>
            <p className="text-xs opacity-90">Web3 Multi-Payment</p>
          </div>
          {isConnected && (
            <div className="text-right text-sm">
              <p className="text-xs opacity-75">Connected</p>
              <p className="font-mono truncate max-w-[120px]">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-primary text-primary-foreground p-6 min-h-screen border-r border-primary/20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tighter mb-1">PayStream</h1>
          <p className="text-sm opacity-80">Multi-Payment Protocol</p>
        </div>

        <div className="flex-1 flex flex-col justify-between">
          <div>
            {isConnected ? (
              <div className="bg-primary-foreground/10 rounded-lg p-4 mb-6 border border-primary-foreground/20">
                <p className="text-xs opacity-75 mb-2">Connected Wallet</p>
                <p className="font-mono text-sm break-all">{address}</p>
                <button
                  onClick={() => disconnect()}
                  className="mt-3 w-full bg-destructive hover:bg-destructive/80 text-destructive-foreground text-xs font-medium py-2 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => connect({ connector: injected() })}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-medium py-3 rounded-lg mb-6 transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-auto">
        {!isConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8">
            <Card className="w-full max-w-sm">
              <div className="p-6 text-center space-y-6">
                <div>
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
                  <p className="text-muted-foreground text-sm">
                    To send multi-payments, please connect your Web3 wallet first
                  </p>
                </div>

                <button
                  onClick={() => connect({ connector: injected() })}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 rounded-lg transition-colors"
                >
                  Connect MetaMask
                </button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 p-4 md:p-8">
            <div className="flex-1">
              <PaymentForm />
            </div>
            <div className="w-full md:w-96">
              <TransactionHistory />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
