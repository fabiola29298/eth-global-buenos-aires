"use client";
import React from "react";
import styles from "./VisualExecution.module.css";
import address from "@/constant/address.json";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Loader2, Send, CheckCircle, AlertCircle } from "lucide-react";

// 1. Define the ABI for the Ghost Kitchen (orderFood)
const GhostKitchenABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "clientAddress", "type": "address" },
      { "internalType": "string", "name": "menuItem", "type": "string" },
      { "internalType": "uint256", "name": "quantity", "type": "uint256" },
      { "internalType": "uint256", "name": "totalPrice", "type": "uint256" },
      { "internalType": "uint256", "name": "nonce", "type": "uint256" },
      { "internalType": "bytes", "name": "signature", "type": "bytes" },
      { "internalType": "uint256", "name": "priorityFee_EVVM", "type": "uint256" },
      { "internalType": "uint256", "name": "nonce_EVVM", "type": "uint256" },
      { "internalType": "bool", "name": "priorityFlag_EVVM", "type": "bool" },
      { "internalType": "bytes", "name": "signature_EVVM", "type": "bytes" }
    ],
    "name": "orderFood",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// 2. Updated Type Definition (coffeeType -> menuItem)
type OrderFoodInputData = {
  clientAddress: `0x${string}`;
  menuItem: string; // Updated to match Contract
  quantity: bigint;
  totalPrice: bigint;
  nonce: bigint;
  signature: string;
  priorityFee_EVVM: bigint;
  nonce_EVVM: bigint;
  priorityFlag_EVVM: boolean;
  signature_EVVM: string;
};

interface VisualExecutionProps {
  orderFoodInputData: OrderFoodInputData;
}

export const VisualExecution: React.FC<VisualExecutionProps> = ({
  orderFoodInputData,
}) => {
  // 3. Wagmi Hooks for Execution
  const { data: hash, isPending, writeContract, error } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // 4. JSON Data for Display
  const jsonData = {
    contractFunction: "orderFood",
    clientAddress: orderFoodInputData.clientAddress,
    menuItem: orderFoodInputData.menuItem,
    quantity: orderFoodInputData.quantity.toString(),
    totalPrice: orderFoodInputData.totalPrice.toString(),
    nonce: orderFoodInputData.nonce.toString(),
    signature: orderFoodInputData.signature.substring(0, 20) + "...",
    priorityFee: orderFoodInputData.priorityFee_EVVM.toString(),
    paymentNonce: orderFoodInputData.nonce_EVVM.toString(),
    isAsync: orderFoodInputData.priorityFlag_EVVM,
  };

  // 5. Execution Handler
  const handleExecute = () => {
    writeContract({
      address: address.EVVMAddress as `0x${string}`, // Ensure this points to GhostKitchen address
      abi: GhostKitchenABI,
      functionName: "orderFood",
      args: [
        orderFoodInputData.clientAddress,
        orderFoodInputData.menuItem,
        orderFoodInputData.quantity,
        orderFoodInputData.totalPrice,
        orderFoodInputData.nonce,
        orderFoodInputData.signature as `0x${string}`,
        orderFoodInputData.priorityFee_EVVM,
        orderFoodInputData.nonce_EVVM,
        orderFoodInputData.priorityFlag_EVVM,
        orderFoodInputData.signature_EVVM as `0x${string}`,
      ],
      gas: BigInt(5000000), // Manual Gas Limit to prevent simulation errors
    });
  };

  return (
    <div className="w-full max-w-md mx-auto mt-6">
      
      {/* Terminal / JSON View */}
      <div className={styles.terminalContainer}>
        <div className={styles.terminalHeader}>
          <span className={styles.terminalTitle}>Payload Data</span>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
          </div>
        </div>
        <pre className={styles.jsonContainer}>
          {JSON.stringify(jsonData, null, 2)}
        </pre>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-start gap-2 text-red-400 text-xs">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span className="break-all">{error.message.split("\n")[0]}</span>
        </div>
      )}

      {/* Transaction Hash Link */}
      {hash && (
        <div className="mt-4 p-3 bg-gray-900 border border-gray-800 rounded-lg text-center">
           <p className="text-xs text-gray-500 mb-1">Transaction Hash:</p>
           <a 
             href={`https://sepolia.etherscan.io/tx/${hash}`} 
             target="_blank" 
             rel="noreferrer"
             className="text-blue-400 text-xs font-mono hover:underline break-all"
           >
             {hash}
           </a>
        </div>
      )}

      {/* Action Button */}
      {!isConfirmed && (
        <button 
            onClick={handleExecute}
            disabled={isPending || isConfirming}
            className={`
                mt-4 w-full py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                ${isPending || isConfirming
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed" 
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 transform active:scale-95"
                }
            `}
        >
            {isPending || isConfirming ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            {isPending ? "Confirm in Wallet..." : isConfirming ? "Processing..." : "Execute Transaction"}
        </button>
      )}

      {/* Success State */}
      {isConfirmed && (
        <div className="mt-4 p-4 bg-green-900/20 border border-green-900/50 rounded-xl flex flex-col items-center text-green-400 animate-in zoom-in duration-300">
            <CheckCircle size={32} className="mb-2" />
            <span className="font-bold">Order Successfully Placed!</span>
        </div>
      )}
    </div>
  );
};