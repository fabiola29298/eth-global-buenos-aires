"use client"

import { useState } from "react"
import { useAccount, usePublicClient, useWalletClient } from "wagmi"
import { parseEther, encodeFunctionData, getAddress, isAddress } from "viem"

// Multi-Payment Contract ABI - Reemplaza con tu ABI real
const MULTI_PAYMENT_ABI = [
  {
    type: "function",
    name: "multiPay",
    inputs: [
      {
        name: "recipients",
        type: "address[]",
      },
      {
        name: "amounts",
        type: "uint256[]",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const

interface Recipient {
  address: string
  amount: string
}

interface MultiPaymentResult {
  hash: string
  recipients: number
  amount: string
  status: "success" | "failed"
  timestamp: number
}

export function useMultiPayment() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastTransaction, setLastTransaction] = useState<MultiPaymentResult | null>(null)
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const executeMultiPayment = async (recipients: Recipient[]) => {
    if (!address || !walletClient || !publicClient) {
      setError("Wallet not connected or provider unavailable")
      return false
    }

    setIsPending(true)
    setError(null)

    try {
      // Validaciones
      if (recipients.length === 0) {
        throw new Error("No recipients provided")
      }

      // Validar direcciones
      const validRecipients = recipients.filter((r) => {
        if (!isAddress(r.address)) {
          throw new Error(`Invalid address: ${r.address}`)
        }
        const amount = Number.parseFloat(r.amount)
        if (isNaN(amount) || amount <= 0) {
          throw new Error(`Invalid amount: ${r.amount}`)
        }
        return true
      })

      const recipientAddresses = validRecipients.map((r) => getAddress(r.address as `0x${string}`))
      const amounts = validRecipients.map((r) => parseEther(r.amount))

      // Calcular monto total
      const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0n)

      // IMPORTANTE: Reemplaza con tu dirección de contrato
      const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000" as const

      // Validar que el contrato esté configurado
      if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
        throw new Error("Contract address not configured. Update CONTRACT_ADDRESS in use-multi-payment.ts")
      }

      // Preparar datos de la transacción
      const data = encodeFunctionData({
        abi: MULTI_PAYMENT_ABI,
        functionName: "multiPay",
        args: [recipientAddresses, amounts],
        
      })

      // Enviar transacción
      const txHash = await walletClient.sendTransaction({
        account: address,
        to: CONTRACT_ADDRESS,
        data,
        value: totalAmount,
      })

      console.log("[v0] Transaction sent:", txHash)

      // Esperar confirmación
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60_000,
      })

      if (receipt.status === "success") {
        const result: MultiPaymentResult = {
          hash: txHash,
          recipients: recipients.length,
          amount: validRecipients.reduce((sum, r) => sum + Number.parseFloat(r.amount), 0).toFixed(4),
          status: "success",
          timestamp: Date.now(),
        }

        saveTransactionHistory(address, result)
        setLastTransaction(result)
        setIsPending(false)
        return true
      } else {
        throw new Error("Transaction reverted")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      setError(errorMessage)
      console.error("[v0] Multi-payment error:", err)
      setIsPending(false)
      return false
    }
  }

  return {
    executeMultiPayment,
    isPending,
    error,
    lastTransaction,
  }
}

// Guardar historial de transacciones en localStorage
function saveTransactionHistory(address: string, transaction: MultiPaymentResult) {
  try {
    const key = `transactions_${address.toLowerCase()}`
    const existing = localStorage.getItem(key)
    const transactions = existing ? JSON.parse(existing) : []

    transactions.unshift({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...transaction,
    })

    // Mantener solo las últimas 10 transacciones
    if (transactions.length > 10) {
      transactions.pop()
    }

    localStorage.setItem(key, JSON.stringify(transactions))
  } catch (err) {
    console.error("[v0] Error saving transaction history:", err)
  }
}
