/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { useAccount, useSignMessage, useWalletClient } from "wagmi"; // Importante: useSignMessage nativo
import { getWalletClient, readContract, writeContract } from "@wagmi/core";
import { parseEther, formatEther, isAddress } from "viem";

// Config & Utils
import { config } from "@/config/index";
import { getAccountWithRetry } from "@/utils/getAccountWithRetry";
import { generateRandomNumber } from "@/utils/mersenneTwister";
import addressList from "@/constant/address.json"; // Asegúrate de tener NameService aquí
import { buildSocialSplitMessage, SOCIAL_SPLIT_ADDRESS, PaymentInstruction } from "@/utils/SocialSplitSigner";

// EVVM Libs
import { EVVMSignatureBuilder, EvvmABI } from "@evvm/viem-signature-library";
import NameServiceABI from "@/constant/abi/NameService.json"; // Necesitas este ABI
import SocialSplitPayABI from "@/constant/abi/SocialSplitPay.json"; // Y este

// UI Components
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, User } from "lucide-react"; // Iconos para UX

interface RecipientUI {
  id: string;
  input: string; // Puede ser address o username
  amount: string;
  isValidIdentity?: boolean; // Para feedback visual
  isAddress?: boolean;
}

export default function MultiPaymentComponent() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();  
  const [progressHistory, setProgressHistory] = useState<"input" | "confirming" | "signed" | "executed">("input");
  const [recipients, setRecipients] = useState<RecipientUI[]>([{ id: "1", input: "", amount: "" }]);
  const [nonceType, setNonceType] = useState<"sync" | "async">("async"); // Async por defecto para velocidad
  const [customNonce, setCustomNonce] = useState<string>("");
  
  const [isSigning, setIsSigning] = useState(false);
  const [txHash, setTxHash] = useState<string>("");

  // --- Helpers ---
  const totalAmountEth = recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  
  // --- Validaciones de Identidad en Tiempo Real ---
  const validateIdentity = async (input: string, id: string) => {
    if (!input) return;
    
    // Si es address, es válido por definición de formato
    if (isAddress(input)) {
        updateRecipientState(id, { isAddress: true, isValidIdentity: true });
        return;
    }

    // Si es texto, consultamos al NameService
    try {
        // Dirección de NameService en Sepolia (Hardcoded o de constants)
        const NAME_SERVICE_ADDR = "0x7F41487e77D092BA53c980171C4ebc71d68DC5AE"; 
        const exists = await readContract(config, {
            abi: NameServiceABI,
            address: NAME_SERVICE_ADDR,
            functionName: "verifyIfIdentityExists",
            args: [input]
        });
        updateRecipientState(id, { isAddress: false, isValidIdentity: exists as boolean });
    } catch (e) {
        console.error("NameService check failed", e);
        updateRecipientState(id, { isAddress: false, isValidIdentity: false });
    }
  };

  const updateRecipientState = (id: string, updates: Partial<RecipientUI>) => {
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleInputChange = (id: string, value: string) => {
    updateRecipientState(id, { input: value, isValidIdentity: undefined });
    // Debounce simple para no saturar RPC
    const timeoutId = setTimeout(() => validateIdentity(value, id), 500);
    return () => clearTimeout(timeoutId);
  };

  // --- Core Logic: Sign & Execute ---
  const handleSignAndExecute = async () => {
    setIsSigning(true);
    try { 
     if (!address || !walletClient) {
          console.error("Wallet not ready");
          return;
      }

      // 1. Preparar Datos
      const totalWei = parseEther(totalAmountEth.toFixed(18));
      const serviceNonce = nonceType === "async" 
        ? (customNonce ? BigInt(customNonce) : BigInt(Date.now())) 
        : BigInt(0); // TODO: Fetch sync nonce if needed

      // Mapear UI a Structs del Contrato
      const instructions: PaymentInstruction[] = recipients.map(r => ({
        amount: parseEther(r.amount || "0"),
        to_identity: r.isAddress ? "" : r.input,
        to_address: r.isAddress ? (r.input as `0x${string}`) : "0x0000000000000000000000000000000000000000"
      }));
    console.log("1. Signing Service Message...");
      
      // 2. FIRMA 1: Autorización del Servicio (Service Logic)
      // El usuario firma: "Quiero que este contrato divida mi dinero así"
      const serviceMessage = buildSocialSplitMessage(instructions, totalWei, serviceNonce);
      const clientSignature = await signMessageAsync({ message: serviceMessage });

      // 3. FIRMA 2: Pago EVVM (Funding)
      // El usuario firma: "Autorizo mover X ETH de mi wallet al contrato SocialSplitPay"
      
      const evvmBuilder = new EVVMSignatureBuilder(walletClient, walletClient.account);
      
      // Obtenemos nonce EVVM (usamos async aleatorio para demo rápida)
      const evvmNonce = BigInt(generateRandomNumber()); 

      const signature_EVVM = await evvmBuilder.signPay(
        BigInt(1), // EVVM ID (1 para Sepolia)
        SOCIAL_SPLIT_ADDRESS, // DESTINO: El contrato, no los usuarios finales
        "0x0000000000000000000000000000000000000000", // Token Nativo
        totalWei,
        BigInt(0), // Priority Fee 0 (El servicio paga al fisher)
        evvmNonce,
        true, // Async
        address as `0x${string}` // Executor: Nosotros mismos por ahora (o dejar en 0x0 para open fisher)
      );

      // 4. EJECUCIÓN (Somos el Fisher en este momento)
      // Enviamos la transacción al contrato
    const hash = await walletClient.writeContract({
        address: SOCIAL_SPLIT_ADDRESS,
        abi: SocialSplitPayABI,
        functionName: "executeSplitPayment",
        args: [
            address,            // client
            instructions,       // instructions
            totalWei,           // totalAmount
            serviceNonce,       // serviceNonce
            clientSignature,    // clientSignature
            BigInt(0),          // priorityFee_EVVM
            evvmNonce,          // nonce_EVVM
            true,               // priorityFlag_EVVM
            signature_EVVM      // signature_EVVM
        ],
        chain: undefined, // Opcional, walletClient ya sabe la chain
        account: address,  // Explícito para evitar dudas
        
      });

      setTxHash(hash);
      setProgressHistory("executed");

    } catch (error) {
      console.error("Execution failed:", error);
      
    } finally {
      setIsSigning(false);
    }
  };

  // --- Renders ---
  return (
    <Card className="h-full max-w-xl mx-auto shadow-2xl border-primary/10 bg-background">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                    <User className="w-6 h-6" /> Social Split
                </h2>
                <p className="text-xs text-muted-foreground">Gasless Payroll & Bill Splitting</p>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Fisher Powered 🎣
            </Badge>
        </div>

        <div className="flex justify-between items-center">
            <div>
                 
                <p className="text-xs text-muted-foreground">0x52edcea0112e49cd0cebdb16c4b57b60589046d0</p>
            </div>
             
        </div>

        {progressHistory === "input" && (
          <div className="space-y-4">
            {recipients.map((recipient, index) => (
              <div key={recipient.id} className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2">
                <div className="flex-1 space-y-1">
                    <div className="relative">
                        <Input
                            placeholder="@username or 0xAddress"
                            value={recipient.input}
                            onChange={(e) => handleInputChange(recipient.id, e.target.value)}
                            className={recipient.isValidIdentity === false ? "border-red-300 focus-visible:ring-red-200" : ""}
                        />
                        <div className="absolute right-3 top-2.5">
                            {recipient.input && (
                                recipient.isValidIdentity ? 
                                <CheckCircle2 className="w-5 h-5 text-green-500" /> : 
                                (recipient.isValidIdentity === false ? <XCircle className="w-5 h-5 text-red-500" /> : <Spinner className="w-4 h-4" />)
                            )}
                        </div>
                    </div>
                    {recipient.isValidIdentity === false && (
                        <p className="text-xs text-red-500">Username not found in NameService</p>
                    )}
                </div>
                <div className="w-32">
                    <Input
                        type="number"
                        placeholder="0.0"
                        value={recipient.amount}
                        onChange={(e) => updateRecipientState(recipient.id, { amount: e.target.value })}
                    />
                </div>
                {recipients.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setRecipients(prev => prev.filter(r => r.id !== recipient.id))}>
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                    </Button>
                )}
              </div>
            ))}
            
            <Button 
                variant="outline" 
                className="w-full border-dashed" 
                onClick={() => setRecipients([...recipients, { id: Date.now().toString(), input: "", amount: "" }])}
            >
                + Add Recipient
            </Button>

            <div className="pt-4 border-t">
                <div className="flex justify-between items-end mb-4">
                    <span className="text-sm font-medium">Total to Pay</span>
                    <span className="text-2xl font-bold">{totalAmountEth.toFixed(4)} ETH</span>
                </div>
                <Button 
                    className="w-full h-12 text-lg" 
                    onClick={() => setProgressHistory("confirming")}
                    disabled={totalAmountEth <= 0 || recipients.some(r => !r.isValidIdentity)}
                >
                    Review Payment
                </Button>
            </div>
          </div>
        )}

        {progressHistory === "confirming" && (
            <div className="space-y-6 text-center">
                <div className="bg-secondary/30 p-6 rounded-xl space-y-4">
                    <h3 className="font-semibold text-lg">Payment Summary</h3>
                    {recipients.map(r => (
                        <div key={r.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{r.input}</span>
                            <span className="font-mono">{r.amount} ETH</span>
                        </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Total</span>
                        <span>{totalAmountEth} ETH</span>
                    </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 flex justify-between items-center">
                    <span>Gas Fee (User):</span>
                    <span className="font-bold">$0.00 (Sponsored)</span>
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setProgressHistory("input")}>
                        Edit
                    </Button>
                    <Button className="flex-1" 
                        onClick={handleSignAndExecute} 
                        disabled={isSigning || !walletClient} >
                        {isSigning ? <Spinner className="mr-2" /> : "Sign & Pay"}
                    </Button>
                </div>
            </div>
        )}

        {progressHistory === "executed" && (
            <div className="text-center space-y-4 py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-green-700">Payment Successful!</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Your split payment has been processed. The contract used its own MATE rewards to pay the gas.
                </p>
                {txHash && (
                    <a 
                        href={`https://sepolia.etherscan.io/tx/${txHash}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-primary hover:underline text-sm block mt-2"
                    >
                        View Transaction
                    </a>
                )}
                <Button onClick={() => {
                    setRecipients([{ id: Date.now().toString(), input: "", amount: "" }]);
                    setProgressHistory("input");
                }}>
                    Make Another Payment
                </Button>
            </div>
        )}
      </div>
    </Card>
  );
}