"use client"

import { WagmiProvider, createConfig, http } from "wagmi"
import { mainnet, sepolia } from "wagmi/chains"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import PaymentApp from "@/components/payment-app"

const config = createConfig({
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})

const queryClient = new QueryClient()

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <div className="min-h-screen bg-gradient-to-br from-background to-background/95">
          <PaymentApp />
        </div>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
