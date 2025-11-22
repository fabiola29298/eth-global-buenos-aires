/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { getWalletClient, readContract } from "@wagmi/core";
import { parseEther, formatEther } from "viem";

// Config & Utils
import { config } from "@/config/index";
import { getAccountWithRetry } from "@/utils/getAccountWithRetry";
import { generateRandomNumber } from "@/utils/mersenneTwister";
import addressList from "@/constant/address.json";

// EVVM Libs
import {
  EVVMSignatureBuilder,
  PayInputData,
  EvvmABI,
  GenericSignatureBuilder,
} from "@evvm/viem-signature-library";

// Components
import { Card } from "@/components/ui/card"; // Asumiendo que tienes estos componentes UI
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Ticket } from "./Ticket";
import { VisualExecution } from "./VisualExecution";

// --- Tipos ---

interface Recipient {
  id: string;
  address: string;
  amount: string;
}

// Adaptamos los tipos para que coincidan con lo que espera VisualExecution/Ticket
// o definimos nuevos tipos genéricos
type MultiPaymentReceipt = {
  recipients: Recipient[];
  totalAmount: bigint;
  nonce: bigint;
  signature: string;
};

type OrderInputData = {
  clientAddress: `0x${string}`;
  coffeeType: string;       // Requerido por VisualExecution
  quantity: bigint;         // Requerido por VisualExecution
  totalPrice: bigint;
  nonce: bigint;
  signature: string;
  priorityFee_EVVM: bigint;
  nonce_EVVM: bigint;
  priorityFlag_EVVM: boolean;
  signature_EVVM: string;
};

export default function MultiPaymentComponent() {
  // --- States ---
  const { address } = useAccount();
  
  // Flujo: input -> confirming -> signed -> fishing
  const [progressHistory, setProgressHistory] = useState<"input" | "confirming" | "signed" | "fishing">("input");
  
  // Data
  const [recipients, setRecipients] = useState<Recipient[]>([{ id: "1", address: "", amount: "" }]);
  const [nonceType, setNonceType] = useState<"sync" | "async">("sync");
  const [customNonce, setCustomNonce] = useState<string>("");
  const [syncNonce, setSyncNonce] = useState<bigint | null>(null);
  
  // Receipts & Execution Data
  const [genericReceipt, setGenericReceipt] = useState<MultiPaymentReceipt | null>(null);
  const [payReceipt, setPayReceipt] = useState<PayInputData | null>(null);
  const [executionData, setExecutionData] = useState<OrderInputData | null>(null);

  // Loading states
  const [isSigning, setIsSigning] = useState(false);

  // --- Helpers de Cálculo ---
  const totalAmountEth = recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const totalAmountWei = parseEther(totalAmountEth.toFixed(18));
  // Ejemplo: Fee es el 0.1% del total o mínimo hardcoded
  const priorityFeeWei = totalAmountWei / BigInt(1000); 

  // --- Funciones de Recipientes ---
  const addRecipient = () => {
    setRecipients([...recipients, { id: Date.now().toString(), address: "", amount: "" }]);
  };

  const removeRecipient = (id: string) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((r) => r.id !== id));
    }
  };

  const updateRecipient = (id: string, field: keyof Recipient, value: string) => {
    setRecipients(recipients.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  // --- Funciones EVVM ---

  const readEVVMId = async (): Promise<bigint | undefined> => {
    try {
      const evvmID = await readContract(config, {
        abi: EvvmABI,
        address: addressList.EVVMAddress as `0x${string}`,
        functionName: "getEvvmID",
        args: [],
      });
      return evvmID as bigint;
    } catch (error) {
      console.error("Error reading EVVM ID:", error);
      return undefined;
    }
  };

  const getEvvmSyncNonce = async () => {
    try {
      const walletData = await getAccountWithRetry(config);
      if (!walletData) return;
      
      const nonce = await readContract(config, {
        abi: EvvmABI,
        address: addressList.EVVMAddress as `0x${string}`,
        functionName: "getNextCurrentSyncNonce",
        args: [walletData.address as `0x${string}`],
      });
      setSyncNonce(nonce as bigint);
    } catch (error) {
      console.error("Error getting EVVM sync nonce:", error);
    }
  };

  const generateRandomNonce = () => {
    const number = generateRandomNumber();
    setCustomNonce(number.toString());
  };

  // --- Core Logic: Make Signature ---
  const makeSig = async () => {
    setIsSigning(true);
    try {
      const walletData = await getAccountWithRetry(config);
      const walletClient = await getWalletClient(config);

      if (!walletData || !walletClient) {
        console.error("Wallet not connected");
        return;
      }

      const evvmID = await readEVVMId();
      if (evvmID === undefined) throw new Error("Cannot read EVVM ID");

      // Builders
      const evvmSignatureBuilder = new (EVVMSignatureBuilder as any)(walletClient, walletData);
      const genericSignatureBuilder = new (GenericSignatureBuilder as any)(walletClient, walletData);

      // Preparar datos
      // 1. Mensaje Genérico: Serializamos los recipientes para firmar "QUÉ" estamos pagando
      const serializedDetails = recipients.map(r => `${r.address}:${r.amount}`).join("|");
      
      // 2. Determinamos el nonce final
      const finalNonce = nonceType === "sync" 
        ? (syncNonce || BigInt(0)) 
        : BigInt(customNonce || "0");

      // 3. Datos para EVVM Pay (Token Nativo = Address 0x0)
      const payData = {
        evvmID: evvmID,
        to: addressList.CafeAddress as `0x${string}`, // O la dirección del contrato MultiPayment
        tokenAddress: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        amount: totalAmountWei,
        priorityFee: priorityFeeWei,
        nonce: finalNonce,
        priorityFlag: nonceType === "async", // true si es async
        executor: addressList.CafeAddress as `0x${string}`,
      };

      // Firma 1: Generic (Detalles del multipago)
      // Usamos "multiPaymentOrder" como nombre de función lógica
      const genericSig = await genericSignatureBuilder.signGenericMessage(
        payData.evvmID,
        "multiPaymentOrder", 
        serializedDetails + "," + totalAmountWei.toString() + "," + finalNonce.toString()
      );

      // Firma 2: EVVM Pay (Autorización de fondos)
      const paySig = await evvmSignatureBuilder.signPay(
        payData.evvmID,
        payData.to,
        payData.tokenAddress,
        payData.amount,
        payData.priorityFee,
        payData.nonce,
        payData.priorityFlag,
        payData.executor
      );

      // Guardar recibos
      setGenericReceipt({
        recipients: recipients,
        totalAmount: totalAmountWei,
        nonce: finalNonce,
        signature: genericSig,
      });

      setPayReceipt({
        from: walletData.address as `0x${string}`,
        to_address: payData.to,
        to_identity: "MultiPayment Contract",
        token: payData.tokenAddress,
        amount: payData.amount,
        priorityFee: payData.priorityFee,
        nonce: payData.nonce,
        priority: payData.priorityFlag,
        executor: payData.executor,
        signature: paySig,
      });

      // Datos para ejecución visual
      setExecutionData({
        clientAddress: walletData.address as `0x${string}`,
        details: serializedDetails,
        coffeeType: "MultiPayment Batch", // Adaptador para VisualExecution si espera este campo
        quantity: BigInt(recipients.length), // Adaptador
        totalPrice: totalAmountWei,
        nonce: finalNonce,
        signature: genericSig,
        priorityFee_EVVM: payData.priorityFee,
        nonce_EVVM: payData.nonce,
        priorityFlag_EVVM: payData.priorityFlag,
        signature_EVVM: paySig,
      } as any); // Cast 'as any' si VisualExecution es estricto con tipos de Cafe

      setProgressHistory("signed");

    } catch (error) {
      console.error("Error signing:", error);
    } finally {
      setIsSigning(false);
    }
  };

  // --- Renders ---

  return (
    <Card className="h-full max-w-2xl mx-auto shadow-lg">
      <div className="p-6 space-y-6">
        
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold mb-1 text-primary">EVVM MultiPayment</h2>
          <p className="text-sm text-muted-foreground">
            Batch transactions powered by EVVM Intents
          </p>
        </div>

        {/* --- STAGE 1: INPUT --- */}
        {progressHistory === "input" && (
          <div className="space-y-6">
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
                    placeholder="0xAddress..."
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
              onClick={addRecipient}
              className="w-full py-2 px-4 border border-dashed border-primary text-primary hover:bg-primary/5 font-medium text-sm rounded-lg transition-colors"
            >
              + Add Recipient
            </button>

            <div className="bg-accent/10 rounded-lg p-4 border border-accent/20 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Amount:</span>
              <span className="text-2xl font-bold text-accent">{totalAmountEth.toFixed(4)} ETH</span>
            </div>

            <Button
              onClick={() => setProgressHistory("confirming")}
              disabled={totalAmountEth <= 0 || recipients.some(r => !r.address)}
              className="w-full h-12 text-base font-semibold"
            >
              Proceed to Confirmation
            </Button>
          </div>
        )}

        {/* --- STAGE 2: CONFIRMING & NONCE --- */}
        {progressHistory === "confirming" && (
          <div className="space-y-6">
             <div className="bg-secondary/20 p-4 rounded-md space-y-2">
                <div className="flex justify-between">
                    <span>Recipients:</span>
                    <span className="font-bold">{recipients.length}</span>
                </div>
                <div className="flex justify-between">
                    <span>Total Transfer:</span>
                    <span className="font-bold">{totalAmountEth.toFixed(4)} ETH</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Priority Fee (EVVM):</span>
                    <span>{formatEther(priorityFeeWei)} ETH</span>
                </div>
             </div>

            {/* Nonce Selection Section */}
            <div className="space-y-4 border-t pt-4">
                <h3 className="font-medium">Transaction Settings</h3>
                
                <div className="flex items-center gap-4">
                    <label className="text-sm">Nonce Strategy:</label>
                    <select 
                        className="p-2 border rounded-md bg-background"
                        value={nonceType}
                        onChange={(e) => setNonceType(e.target.value as "sync" | "async")}
                    >
                        <option value="sync">Sync (Sequential)</option>
                        <option value="async">Async (Parallel)</option>
                    </select>
                </div>

                {nonceType === "sync" ? (
                    <div className="flex items-center gap-3 bg-muted p-3 rounded-md">
                        <span className="text-sm">Current Sync Nonce:</span>
                        <span className="font-mono font-bold">{syncNonce !== null ? syncNonce.toString() : "..."}</span>
                        <Button size="sm" variant="outline" onClick={getEvvmSyncNonce}>
                            Fetch Nonce
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={customNonce}
                                onChange={(e) => setCustomNonce(e.target.value)}
                                placeholder="Enter random nonce"
                                className="flex-1 p-2 border rounded-md"
                            />
                            <Button variant="outline" onClick={generateRandomNonce}>
                                Generate Random
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            
              <p>  1. Service nonce  </p>
              <p>  2. Priority fee for the transaction </p>
              <p>  3. Using Sync nonce </p>
              <p>  Button </p>
              <p>  Fetch Current Sync Nonce from EVVM </p>
            <p>  Make Signuature and Pay </p>
            

            <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setProgressHistory("input")}>
                    Back
                </Button>
                <Button 
                    className="flex-1" 
                    onClick={makeSig} 
                    disabled={isSigning || (nonceType === 'async' && !customNonce)}
                >
                    {isSigning ? <Spinner className="mr-2" /> : null}
                    Sign & Pay
                </Button>
            </div>
          </div>
        )}

        {/* --- STAGE 3: SIGNED (TICKET) --- */}
        {progressHistory === "signed" && genericReceipt && payReceipt && (
          <div className="space-y-6">
            {/* Aquí reutilizamos el componente Ticket pasando los datos adaptados */}
            {/* Nota: Si Ticket espera props estrictas de CafeData, tendrás que adaptar el componente Ticket o pasarle 'any' temporalmente */}
            <div className="border rounded-lg p-4 bg-green-50/50 border-green-200">
                <h3 className="text-green-800 font-bold mb-2">Signature Generated Successfully!</h3>
                <div className="text-xs break-all font-mono text-muted-foreground">
                    Sig: {payReceipt.signature.substring(0, 60)}...
                </div>
            </div>
            
            <Ticket 
                // Pasamos datos simulando ser CafeData para compatibilidad visual, o puedes crear un TicketMultiPayment
                coffeeReceipt={{
                    coffeeType: "MultiPayment Bundle",
                    quantity: BigInt(recipients.length),
                    totalPrice: totalAmountWei,
                    nonce: genericReceipt.nonce,
                    signature: genericReceipt.signature
                }} 
                payReceipt={payReceipt} 
            />

            <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => setProgressHistory("fishing")}
            >
                Send to Fishing Spot (Execute)
            </Button>
          </div>
        )}

        {/* --- STAGE 4: EXECUTION --- */}
        {progressHistory === "fishing" && executionData && (
          <div>
            <VisualExecution orderCoffeeInputData={executionData} />
            <Button 
                variant="outline" 
                className="mt-4 w-full"
                onClick={() => {
                    setRecipients([{ id: Date.now().toString(), address: "", amount: "" }]);
                    setProgressHistory("input");
                }}
            >
                Start New Payment
            </Button>
          </div>
        )}

      </div>
    </Card>
  );
}