import React from "react";
import EVVMCafe from "@/constant/EVVMCafe.json";
import address from "@/constant/address.json";
import { writeContract } from "@wagmi/core";
import { config } from "@/config/index";
import { getAccountWithRetry } from "@/utils/getAccountWithRetry";

type OrderCoffeeInputData = {
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


const executeTransactionData = async (
  InputData: OrderCoffeeInputData
) => {
  if (!InputData) {
    return Promise.reject("No data to execute payment");
  }

  try {
    // Obtener la cuenta del wallet conectado
    const walletData = await getAccountWithRetry(config);
    if (!walletData) {
      return Promise.reject("Wallet not connected");
    }

    return writeContract(config, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      abi: EVVMCafe.abi as any,
      address: address.CafeAddress as `0x${string}`, // Cambiado de EVVMAddress a CafeAddress
      functionName: "orderCoffee",
      args: [
        InputData.clientAddress,
        InputData.coffeeType,
        InputData.quantity,
        InputData.totalPrice,
        InputData.nonce,
        InputData.signature,
        InputData.priorityFee_EVVM,
        InputData.nonce_EVVM,
        InputData.priorityFlag_EVVM,
        InputData.signature_EVVM,
      ],
    })
      .then(() => {
        return Promise.resolve();
      })
      .catch((error) => {
        return Promise.reject(error);
      });
  } catch (error) {
    return Promise.reject(error);
  }
};

export { executeTransactionData };
