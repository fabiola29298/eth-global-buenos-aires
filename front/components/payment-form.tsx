"use client"

import type React from "react"

import { useState } from "react"
import { useAccount } from "wagmi"
import { useMultiPayment } from "@/hooks/use-multi-payment"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

interface Recipient {
  id: string
  address: string
  amount: string
}

export default function PaymentForm() {
  const { address } = useAccount()
  const { executeMultiPayment, isPending, error } = useMultiPayment()
  const [recipients, setRecipients] = useState<Recipient[]>([{ id: "1", address: "", amount: "" }])
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const addRecipient = () => {
    setRecipients([
      ...recipients,
      {
        id: Date.now().toString(),
        address: "",
        amount: "",
      },
    ])
  }

  const removeRecipient = (id: string) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((r) => r.id !== id))
    }
  }

  const updateRecipient = (id: string, field: string, value: string) => {
    setRecipients(recipients.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const totalAmount = recipients.reduce((sum, r) => {
    const amount = Number.parseFloat(r.amount) || 0
    return sum + amount
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage(null)

    const validRecipients = recipients.filter((r) => r.address && r.amount && Number.parseFloat(r.amount) > 0)

    if (validRecipients.length === 0) {
      alert("Please add at least one valid recipient")
      return
    }

    const success = await executeMultiPayment(validRecipients)
    if (success) {
      setSuccessMessage(`Successfully sent ${totalAmount.toFixed(4)} ETH to ${validRecipients.length} recipient(s)`)
      setRecipients([{ id: "1", address: "", amount: "" }])
      setTimeout(() => setSuccessMessage(null), 5000)
    }
  }

  return (
    <Card className="h-full">
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Send Payments</h2>
          <p className="text-sm text-muted-foreground">Send ETH to multiple recipients at once</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {recipients.map((recipient, index) => (
              <div key={recipient.id} className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Recipient {index + 1}</label>
                  {recipients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRecipient(recipient.id)}
                      className="text-xs text-destructive hover:text-destructive/80 font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="0x..."
                  value={recipient.address}
                  onChange={(e) => updateRecipient(recipient.id, "address", e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />

                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.0"
                    value={recipient.amount}
                    onChange={(e) => updateRecipient(recipient.id, "amount", e.target.value)}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="flex items-center px-3 bg-background border border-border rounded-lg text-sm font-medium text-muted-foreground">
                    ETH
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRecipient}
            className="w-full py-2 px-4 border border-dashed border-primary text-primary hover:bg-primary/5 font-medium text-sm rounded-lg transition-colors"
          >
            + Add Recipient
          </button>

          <div className="bg-accent/10 rounded-lg p-4 border border-accent/20">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Total Amount:</span>
              <span className="text-2xl font-bold text-accent">{totalAmount.toFixed(4)} ETH</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Recipients: {recipients.filter((r) => r.address && r.amount).length}/{recipients.length}
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-accent/10 text-accent text-sm p-3 rounded-lg border border-accent/20">
              {successMessage}
            </div>
          )}

          <Button
            type="submit"
            disabled={isPending || recipients.every((r) => !r.address || !r.amount)}
            className="w-full h-12 text-base font-semibold"
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <Spinner className="w-4 h-4" />
                Processing...
              </div>
            ) : (
              "Send Multi-Payment"
            )}
          </Button>
        </form>
      </div>
    </Card>
  )
}
