/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from "react";
import { formatEther, parseEther } from "viem/utils";

// Wagmi & Config
import { config } from "@/config/index";
import { getWalletClient, readContract } from "@wagmi/core";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

// Utils
import { getAccountWithRetry } from "@/utils/getAccountWithRetry";
import { generateRandomNumber } from "@/utils/mersenneTwister";

// EVVM Library
import {
  EVVMSignatureBuilder,
  PayInputData,
  EvvmABI,
  GenericSignatureBuilder,
} from "@evvm/viem-signature-library";

// Local Components & Data
import address from "@/constant/address.json";
import { Ticket } from "@/components/kitchen/Ticket";
import { VisualExecution } from "@/components/kitchen/VisualExecution";

// UI Icons
import { ShoppingBag, ChefHat, Plus, Minus, Wallet, X, Settings, ArrowRight } from 'lucide-react';

// --- TYPES ---
type CafeData = {
  coffeeType: string;
  quantity: bigint;
  totalPrice: bigint;
  nonce: bigint;
  signature: string;
};

type orderCoffeeInputData = {
  clientAddress: `0x${string}`;
  menuItem: string;
  quantity: bigint;
  totalPrice: bigint;
  nonce: bigint;
  signature: string;
  priorityFee_EVVM: bigint;
  nonce_EVVM: bigint;
  priorityFlag_EVVM: boolean;
  signature_EVVM: string;
};

// --- MENU DATA CONFIGURATION ---
// Maps IDs to Pricing logic
const MENU_ITEMS = [
  { id: "Cheese Burguer", name: "Cheese Burguer", priceWei: BigInt(1000000000000000), emoji: "🍔" },
  { id: "Fries Chips", name: "Fries Chips", priceWei: BigInt(2000000000000000), emoji: "🍟" },
  { id: "Donnuts", name: "Donnuts", priceWei: BigInt(3000000000000000), emoji: "🍩" },
  { id: "Cola", name: "Cola", priceWei: BigInt(6700000000000000), emoji: "🥤" },
];

export default function EVVMGhostKitchenComponent ()  {
  // --- WAGMI HOOKS ---
  const { address: userAddress, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  // --- STATE ---
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  
  // Logic State from original component
  const [coffeeReceipt, setCoffeeReceipt] = useState<CafeData | null>(null);
  const [payReceipt, setPayReceipt] = useState<PayInputData | null>(null);
  const [orderCoffeeData, setOrderCoffeeData] = useState<orderCoffeeInputData | null>(null);
  
  const [syncNonce, setSyncNonce] = useState<bigint | null>(null);
  const [priorityFlagOnEvvm, setPriorityFlagOnEvvm] = useState<string>("false");
  
  // Progress: 'begin' (Menu) -> 'confirming' (Settings) -> 'signed' (Ticket) -> 'fishing' (Execution)
  const [progressHistory, setProgressHistory] = useState<string>("begin"); 

  // --- INPUT REFS (For Nonces) ---
  // We keep the input IDs logic for compatibility with the generate functions
  const [manualNonceCafe, setManualNonceCafe] = useState<string>("");
  const [manualNonceAsync, setManualNonceAsync] = useState<string>("");

  // --- CALCULATIONS ---
  const totalWei = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = MENU_ITEMS.find(i => i.id === id);
    return item ? sum + (item.priceWei * BigInt(qty)) : sum;
  }, BigInt(0));

  const totalQuantity = Object.values(cart).reduce((a, b) => a + b, 0);

  // Helper to generate the "Menu Item" string for the contract (Concatenation)
  const getOrderDescription = () => {
    return Object.entries(cart).map(([id, qty]) => {
      const item = MENU_ITEMS.find(i => i.id === id);
      return `${item?.name} (x${qty})`;
    }).join(", ");
  };

  // --- HANDLERS ---
  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  const handleConnect = () => {
    if (isConnected) disconnect();
    else connect({ connector: injected() });
  };

  // --- EVVM LOGIC ---

  const readEVVMId = async (): Promise<bigint | undefined> => {
    try {
      const evvmID = await readContract(config, {
        abi: EvvmABI,
        address: address.EVVMAddress as `0x${string}`,
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
        address: address.EVVMAddress as `0x${string}`,
        functionName: "getNextCurrentSyncNonce",
        args: [walletData.address as `0x${string}`], 
      });
      setSyncNonce(nonce as bigint);
    } catch (error) {
      console.error("Error getting EVVM sync nonce:", error);
    }
  };

  const generateRandomCoffeeNonce = () => {
    const number = generateRandomNumber();
    setManualNonceCafe(number.toString());
  };

  const generateRandomPaymentAsyncNonce = () => {
    const number = generateRandomNumber();
    setManualNonceAsync(number.toString());
  };

  // --- CORE SIGNING FUNCTION ---
  const makeSig = async () => {
    const walletData = await getAccountWithRetry(config);
    const walletClient = await getWalletClient(config);
    if (!walletData || !walletClient) {
      alert("Wallet not connected");
      return;
    }

    const evvmSignatureBuilder = new (EVVMSignatureBuilder as any)(walletClient, walletData);
    const genericSignatureBuilder = new (GenericSignatureBuilder as any)(walletClient, walletData);

    const evvmID = await readEVVMId();
    if (evvmID === undefined) return;

    // 1. Prepare Data
    const orderDesc = getOrderDescription(); // Replaces "coffeeType"
    const finalNonceCafe = manualNonceCafe || generateRandomNumber().toString();
    const finalNoncePay = priorityFlagOnEvvm === "true" 
        ? (manualNonceAsync || generateRandomNumber().toString())
        : (syncNonce?.toString() || "0");

    const coffeShopFormData = {
      coffeeType: orderDesc, // Using the combined string
      quantity: BigInt(totalQuantity),
      totalPrice: totalWei,
      nonce: BigInt(finalNonceCafe),
    };

    const formData = {
      evvmID: evvmID,
      to: address.EVVMAddress as `0x${string}`,
      tokenAddress: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      amount: totalWei,
      priorityFee: totalWei / BigInt(1000), // 0.1% Priority Fee
      nonce: finalNoncePay,
      priorityFlag: priorityFlagOnEvvm === "true",
      executor: address.EVVMAddress as `0x${string}`,
    };

    // 2. Sign "Order Food" (Generic)
    // Note: Verify the string construction matches Contract EXACTLY: "<coffeeType>,<qty>,<price>,<nonce>"
    const genericMsg = 
        coffeShopFormData.coffeeType + "," +
        coffeShopFormData.quantity.toString() + "," +
        coffeShopFormData.totalPrice.toString() + "," +
        coffeShopFormData.nonce.toString();

    // IMPORTANT: Contract expects function name "orderFood" now (based on previous prompt)
    // But if using the old contract use "orderCoffee". Assuming updated contract: "orderFood"
    const functionName = "orderFood"; 

    try {
        const signature = await genericSignatureBuilder.signGenericMessage(
            formData.evvmID,
            functionName, 
            genericMsg
        );

        setCoffeeReceipt({
            coffeeType: coffeShopFormData.coffeeType,
            quantity: coffeShopFormData.quantity,
            totalPrice: coffeShopFormData.totalPrice,
            nonce: coffeShopFormData.nonce,
            signature: signature,
        });

        // 3. Sign EVVM Payment
        const paySignature = await evvmSignatureBuilder.signPay(
            formData.evvmID,
            formData.to,
            formData.tokenAddress as `0x${string}`,
            BigInt(formData.amount),
            BigInt(formData.priorityFee),
            BigInt(formData.nonce),
            formData.priorityFlag,
            formData.executor as `0x${string}`
        );

        setPayReceipt({
            from: walletData.address as `0x${string}`,
            to_address: formData.to,
            to_identity: "",
            token: formData.tokenAddress as `0x${string}`,
            amount: BigInt(formData.amount),
            priorityFee: BigInt(formData.priorityFee),
            nonce: BigInt(formData.nonce),
            priority: formData.priorityFlag,
            executor: formData.executor as `0x${string}`,
            signature: paySignature,
        });

        setOrderCoffeeData({
            clientAddress: walletData.address as `0x${string}`,
            menuItem: coffeShopFormData.coffeeType,
            quantity: coffeShopFormData.quantity,
            totalPrice: coffeShopFormData.totalPrice,
            nonce: coffeShopFormData.nonce,
            signature: signature,
            priorityFee_EVVM: BigInt(formData.priorityFee),
            nonce_EVVM: BigInt(formData.nonce),
            priorityFlag_EVVM: formData.priorityFlag,
            signature_EVVM: paySignature,
        });

        setProgressHistory("signed");

    } catch (e) {
        console.error("Signing failed", e);
    }
  };

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans pb-24 relative overflow-hidden">
      
      {/* 1. HEADER */}
      <div className="bg-gray-900/80 backdrop-blur-md p-4 sticky top-0 z-20 border-b border-gray-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-orange-600 p-2 rounded-lg shadow-lg shadow-orange-900/20">
            <ChefHat size={20} className="text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-white">Ghost Kitchen</h1>
        </div>
        <button 
          onClick={handleConnect}
          className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 transition-all ${
            isConnected ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-orange-600 text-white hover:bg-orange-500'
          }`}
        >
          <Wallet size={14} />
          {isConnected && userAddress 
            ? `${userAddress.slice(0, 4)}...${userAddress.slice(-4)}` 
            : 'Connect'}
        </button>
      </div>

      {/* 2. MAIN CONTENT AREA */}
      <div className="max-w-md mx-auto p-4">
        
        {/* VIEW: MENU (Begin) */}
        {progressHistory === "begin" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Available Items</h2>
             
             {MENU_ITEMS.map(item => {
               const qty = cart[item.id] || 0;
               return (
                 <div key={item.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex justify-between items-center shadow-sm">
                   <div className="flex items-center gap-3">
                     <span className="text-2xl filter grayscale-[0.3]">{item.emoji}</span>
                     <div>
                       <h3 className="font-bold text-gray-200">{item.name}</h3>
                       <p className="text-orange-500/80 text-xs font-mono">{formatEther(item.priceWei)} ETH</p>
                     </div>
                   </div>
                   
                   <div className="flex items-center gap-3 bg-gray-950 rounded-lg p-1 border border-gray-800">
                     <button 
                       onClick={() => updateQuantity(item.id, -1)}
                       className="p-2 hover:bg-gray-800 rounded-md text-gray-500 hover:text-white transition disabled:opacity-30"
                       disabled={qty === 0}
                     >
                       <Minus size={14} />
                     </button>
                     <span className="font-bold w-4 text-center text-sm">{qty}</span>
                     <button 
                       onClick={() => updateQuantity(item.id, 1)}
                       className="p-2 bg-orange-700 hover:bg-orange-600 rounded-md text-white transition shadow-lg"
                     >
                       <Plus size={14} />
                     </button>
                   </div>
                 </div>
               );
             })}
          </div>
        )}

        {/* VIEW: CONFIRMATION / SETTINGS */}
        {progressHistory === "confirming" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Settings size={20} className="text-orange-500" /> 
                    Configuration
                </h2>
                <button onClick={() => setProgressHistory("begin")} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700">
                    <X size={16} />
                </button>
            </div>

            <div className="space-y-4">
                {/* Order Nonce */}
                <div className="space-y-2">
                    <label className="text-xs uppercase text-gray-500 font-bold">Service Nonce</label>
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                            placeholder="Enter nonce"
                            value={manualNonceCafe}
                            onChange={(e) => setManualNonceCafe(e.target.value)}
                        />
                        <button onClick={generateRandomCoffeeNonce} className="text-xs bg-gray-800 px-3 rounded-lg hover:bg-gray-700 border border-gray-700">
                            Auto
                        </button>
                    </div>
                </div>

                {/* Priority Fee Info */}
                <div className="bg-orange-900/10 border border-orange-900/30 p-3 rounded-lg flex justify-between items-center">
                    <span className="text-xs text-orange-400">Priority Fee (0.1%)</span>
                    <span className="text-sm font-mono text-orange-300">{formatEther(totalWei / BigInt(1000))} ETH</span>
                </div>

                {/* Async/Sync Toggle */}
                <div className="space-y-2">
                    <label className="text-xs uppercase text-gray-500 font-bold">Nonce Type</label>
                    <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-700">
                        <button 
                            onClick={() => setPriorityFlagOnEvvm("false")}
                            className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${priorityFlagOnEvvm === "false" ? 'bg-gray-800 text-white shadow' : 'text-gray-500'}`}
                        >
                            Sync (Sequential)
                        </button>
                        <button 
                            onClick={() => setPriorityFlagOnEvvm("true")}
                            className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${priorityFlagOnEvvm === "true" ? 'bg-gray-800 text-white shadow' : 'text-gray-500'}`}
                        >
                            Async (Priority)
                        </button>
                    </div>
                </div>

                {/* Payment Nonce Logic */}
                <div className="space-y-2">
                    <label className="text-xs uppercase text-gray-500 font-bold">Payment Nonce</label>
                    {priorityFlagOnEvvm === "false" ? (
                        <div className="flex gap-2 items-center justify-between bg-gray-950 border border-gray-700 rounded-lg p-3">
                            <span className="text-sm font-mono text-gray-300">
                                {syncNonce ? syncNonce.toString() : "Not fetched"}
                            </span>
                            {!syncNonce && (
                                <button onClick={getEvvmSyncNonce} className="text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-500">
                                    Fetch
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                                placeholder="Async Nonce"
                                value={manualNonceAsync}
                                onChange={(e) => setManualNonceAsync(e.target.value)}
                            />
                            <button onClick={generateRandomPaymentAsyncNonce} className="text-xs bg-gray-800 px-3 rounded-lg hover:bg-gray-700 border border-gray-700">
                                Auto
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <button 
                onClick={makeSig}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-900/40 transition-all active:scale-95"
            >
                Sign Order & Pay
            </button>
          </div>
        )}

        {/* VIEW: TICKET (Signed) */}
        {progressHistory === "signed" && coffeeReceipt && payReceipt && (
            <div className="space-y-6 animate-in slide-in-from-bottom-10 duration-500">
                <Ticket coffeeReceipt={coffeeReceipt} payReceipt={payReceipt} />
                
                <button 
                    onClick={() => setProgressHistory("fishing")}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/50"
                >
                    Send to Fishing Spot <ArrowRight size={18} />
                </button>
            </div>
        )}

        {/* VIEW: FISHING (Execution) */}
        {progressHistory === "fishing" && orderCoffeeData && (
            <div className="animate-in fade-in duration-700">
                <h2 className="text-center text-xl font-bold mb-4 text-white">Broadcasting...</h2>
                 <VisualExecution orderFoodInputData={orderCoffeeData} />
                
                <div className="mt-8 text-center">
                    <button 
                        onClick={() => {
                            setCart({});
                            setProgressHistory("begin");
                        }}
                        className="text-sm text-gray-500 underline hover:text-white"
                    >
                        Start New Order
                    </button>
                </div>
            </div>
        )}

      </div>

      {/* 3. STICKY FOOTER (Only for Begin Stage) */}
      {progressHistory === "begin" && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900/90 border-t border-gray-800 p-4 shadow-2xl backdrop-blur-lg">
          <div className="max-w-md mx-auto flex justify-between items-center gap-4">
            <div>
              <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Total Est.</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white tracking-tight">{formatEther(totalWei)}</span>
                <span className="text-xs text-orange-400 font-mono">ETH</span>
              </div>
            </div>
            
            <button 
              onClick={() => {
                  if(!isConnected) {
                      handleConnect();
                  } else {
                      setProgressHistory("confirming");
                  }
              }}
              disabled={totalQuantity === 0 && isConnected}
              className={`flex-1 py-3 px-6 rounded-xl font-bold flex justify-center items-center gap-2 transition-all transform active:scale-95 ${
                (totalQuantity === 0 && isConnected)
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                  : 'bg-white text-black hover:bg-gray-200'
              }`}
            >
                <ShoppingBag size={18} />
                {!isConnected ? "Connect Wallet" : `Checkout (${totalQuantity})`}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};