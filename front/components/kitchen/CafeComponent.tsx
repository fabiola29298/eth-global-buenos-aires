/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React from "react";

// Wagmi configuration and utilities for wallet interactions
import { config } from "@/config/index";
import { getWalletClient, readContract } from "@wagmi/core";

// Custom UI components for form inputs and displays

// Utility functions for wallet and transaction handling
import { getAccountWithRetry } from "@/utils/getAccountWithRetry";

// EVVM library for creating and handling signatures
import {
  EVVMSignatureBuilder,
  PayInputData,
  EvvmABI,
  GenericSignatureBuilder,
} from "@evvm/viem-signature-library";

import address from "@/constant/address.json";

import styles from "./CafeComponent.module.css";
import { formatEther } from "viem/utils";
import { generateRandomNumber } from "@/utils/mersenneTwister";
import { Ticket } from "./Ticket";
import { VisualExecution } from "./VisualExecution";

// Component props interface - defines what data this component needs

type CafeData = {
  coffeeType: string;
  quantity: bigint;
  totalPrice: bigint;
  nonce: bigint;
  signature: string;
};

type orderCoffeeInputData = {
  clientAddress: `0x${string}`;
  coffeeType: string;
  quantity: bigint;
  totalPrice: bigint;
  nonce: bigint;
  signature: string;
  priorityFee_EVVM: bigint;
  nonce_EVVM: bigint;
  priorityFlag_EVVM: boolean;
  signature_EVVM: string;
};

const coffePriceMap: { [key: string]: bigint } = {
  "Fisher Espresso": BigInt(1000000000000000), // 0.001 ETH
  "Virtual Cappuccino": BigInt(2000000000000000), // 0.002 ETH
  "Decentralized Latte": BigInt(3000000000000000), // 0.003 ETH
  "Nonce Mocha": BigInt(6700000000000000), // 0.0067 ETH
};

export const CafeComponent = () => {
  // State variables to manage form behavior and data
  const [coffeeReceipt, setCoffeeReceipt] = React.useState<CafeData | null>(
    null
  ); // Stores the coffee order receipt
  const [payReceipt, setPayReceipt] = React.useState<PayInputData | null>(null); // Stores the payment receipt
  const [orderCoffeeData, setOrderCoffeeData] =
    React.useState<orderCoffeeInputData | null>(null); // Stores the order coffee data for contract call
  const [coffeeType, setCoffeeType] = React.useState<string>("Fisher Espresso"); // Selected coffee type
  const [quantityCoffee, setQuantityCoffee] = React.useState<number>(1); // Quantity of coffee
  const [syncNonce, setSyncNonce] = React.useState<bigint | null>(null); // Auto-fetched nonce value

  const [priorityFlagOnEvvm, setPriorityFlagOnEvvm] =
    React.useState<string>("false");

  const [progressHistory, setProgressHistory] = React.useState<string>("begin"); // Order confirmation state

  const readEVVMId = async (): Promise<bigint | undefined> => {
    try {
      // Read the next nonce from the smart contract
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
      if (!walletData) {
        console.error("Wallet not connected");
        return;
      }
      readContract(config, {
        abi: EvvmABI,
        address: address.EVVMAddress as `0x${string}`,
        functionName: "getNextCurrentSyncNonce",
        args: [walletData.address as `0x${string}`],
      }).then((nonce) => {
        setSyncNonce(nonce as bigint);
      });
    } catch (error) {
      console.error("Error getting EVVM sync nonce:", error);
    }
  };

  const generateRandomCoffeeNonce = () => {
    const number = generateRandomNumber();
    (document.getElementById("nonceInput_Cafe") as HTMLInputElement).value =
      number.toString();
  };

  const generateRandomPaymentAsyncNonce = () => {
    const number = generateRandomNumber();
    (document.getElementById("nonceAsyncInput_Pay") as HTMLInputElement).value =
      number.toString();
  };

  // Main function to create a cryptographic signature for the payment
  const makeSig = async () => {
    // Get the current wallet connection
    const walletData = await getAccountWithRetry(config);
    const walletClient = await getWalletClient(config);
    if (!walletData || !walletClient) {
      console.error("Wallet not connected");
      return;
    }

    const evvmSignatureBuilder = new (EVVMSignatureBuilder as any)(
      walletClient,
      walletData
    );
    const genericSignatureBuilder = new (GenericSignatureBuilder as any)(
      walletClient,
      walletData
    );

    // Helper function to get values from form inputs
    const getValue = (id: string) =>
      (document.getElementById(id) as HTMLInputElement).value;

    readEVVMId().then((evvmID) => {
      // Collect all form data into an object
      const coffeShopFormData = {
        coffeeType: coffeeType,
        quantity: BigInt(quantityCoffee),
        totalPrice: coffePriceMap[coffeeType] * BigInt(quantityCoffee),
        nonce: BigInt(getValue("nonceInput_Cafe")),
      };
      const formData = {
        evvmID: evvmID,
        to: address.EVVMAddress as `0x${string}`,
        tokenAddress:
          "0x0000000000000000000000000000000000000000" as `0x${string}`, // Using native token (ETH)
        amount: coffePriceMap[coffeeType] * BigInt(quantityCoffee),
        priorityFee: coffePriceMap[coffeeType] / BigInt(1000),
        nonce:
          priorityFlagOnEvvm === "false"
            ? syncNonce?.toString() || "0"
            : getValue("nonceAsyncInput_Pay"),
        priorityFlag: priorityFlagOnEvvm === "true",
        executor: address.EVVMAddress as `0x${string}`,
      };

      genericSignatureBuilder
        .signGenericMessage(
          formData.evvmID,
          "orderCoffee",
          coffeShopFormData.coffeeType +
            "," +
            coffeShopFormData.quantity.toString() +
            "," +
            coffeShopFormData.totalPrice.toString() +
            "," +
            coffeShopFormData.nonce.toString()
        )
        .then((signature: any) => {
          setCoffeeReceipt({
            coffeeType: coffeShopFormData.coffeeType,
            quantity: coffeShopFormData.quantity,
            totalPrice: coffeShopFormData.totalPrice,
            nonce: coffeShopFormData.nonce,
            signature: signature,
          });
          evvmSignatureBuilder
            .signPay(
              formData.evvmID,
              formData.to,
              formData.tokenAddress as `0x${string}`,
              BigInt(formData.amount),
              BigInt(formData.priorityFee),
              BigInt(formData.nonce),
              formData.priorityFlag,
              formData.executor as `0x${string}`
            )
            .then((paySignatire: any) => {
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
                signature: paySignatire,
              });
              // Prepare the order coffee data for contract call
              setOrderCoffeeData({
                clientAddress: walletData.address as `0x${string}`,
                coffeeType: coffeShopFormData.coffeeType,
                quantity: coffeShopFormData.quantity,
                totalPrice: coffeShopFormData.totalPrice,
                nonce: coffeShopFormData.nonce,
                signature: signature,
                priorityFee_EVVM: BigInt(formData.priorityFee),
                nonce_EVVM: BigInt(formData.nonce),
                priorityFlag_EVVM: formData.priorityFlag,
                signature_EVVM: paySignatire,
              });

              setProgressHistory("signed");
            });
        });
    });
  };

  return (
    <div>
      {progressHistory === "begin" && (
        <>
          <p>Select Coffee Type:</p>
          <select
            className={styles.cafeSelect}
            value={coffeeType}
            onChange={(e) => setCoffeeType(e.target.value)}
          >
            <option value="Fisher Espresso">Fisher Espresso</option>
            <option value="Virtual Cappuccino">Virtual Cappuccino</option>
            <option value="Decentralized Latte">Decentralized Latte</option>
            <option value="Nonce Mocha">Nonce Mocha</option>
          </select>

          <p>Quantity:</p>
          <select
            className={styles.cafeSelect}
            value={quantityCoffee}
            onChange={(e) => setQuantityCoffee(Number(e.target.value))}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>

          <p>
            Total Price:{" "}
            {formatEther(coffePriceMap[coffeeType] * BigInt(quantityCoffee))}{" "}
            ETH
          </p>

          <button onClick={() => setProgressHistory("confirming")}>
            Confirm Order and Pay
          </button>
        </>
      )}

      {progressHistory === "confirming" && (
        <>
          <p>
            Price:{" "}
            {formatEther(coffePriceMap[coffeeType] * BigInt(quantityCoffee))}{" "}
            ETH
          </p>

          <div>
            Service nonce:{" "}
            <input
              type="number"
              id="nonceInput_Cafe"
              placeholder="Enter nonce"
            />
            <button onClick={generateRandomCoffeeNonce}>
              Generate Random Nonce
            </button>
          </div>

          <p>
            Priority fee for the transaction:{" "}
            {formatEther(coffePriceMap[coffeeType] / BigInt(1000))} ETH
          </p>

          <div>
            Using{" "}
            <select
              value={priorityFlagOnEvvm}
              onChange={(e) => setPriorityFlagOnEvvm(e.target.value)}
            >
              <option value="false">Sync nonces</option>
              <option value="true">Async nonces</option>
            </select>
            {priorityFlagOnEvvm === "false" ? (
              <div>
                {syncNonce ? (
                  <p>Current Sync Nonce: {syncNonce?.toString()}</p>
                ) : (
                  <button onClick={getEvvmSyncNonce}>
                    Fetch Current Sync Nonce from EVVM
                  </button>
                )}
              </div>
            ) : (
              <div>
                <input
                  type="number"
                  id="nonceAsyncInput_Pay"
                  placeholder="Enter nonce"
                />
                <button onClick={generateRandomPaymentAsyncNonce}>
                  Generate Random Nonce
                </button>
              </div>
            )}
          </div>
          <button onClick={makeSig}>Make Signature and Pay</button>
        </>
      )}

      {coffeeReceipt && payReceipt && progressHistory === "signed" && (
        <>
          <Ticket coffeeReceipt={coffeeReceipt} payReceipt={payReceipt} />

          <button onClick={() => setProgressHistory("fishing")}>
            Send this to the fishing spot
          </button>
        </>
      )}

      {orderCoffeeData && progressHistory === "fishing" && (
        <div>
          <VisualExecution orderCoffeeInputData={orderCoffeeData} />
        </div>
      )}
    </div>
  );
};
