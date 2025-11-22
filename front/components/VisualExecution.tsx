import React from "react";
import EVVMCafe from "@/constant/EVVMCafe.json";
import address from "@/constant/address.json";
import styles from "./VisualExecution.module.css";
import { writeContract } from "viem/actions";
import { config } from "@/config/index";
import { executeTransactionData } from "@/utils/executeTransactionData";

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

interface TicketProps {
  orderCoffeeInputData: OrderCoffeeInputData;
}

export const VisualExecution: React.FC<TicketProps> = ({
  orderCoffeeInputData,
}) => {
  const jsonData = {
    transactionType: "orderCoffee",
    clientAddress: orderCoffeeInputData.clientAddress,
    coffeeType: orderCoffeeInputData.coffeeType,
    quantity: orderCoffeeInputData.quantity.toString(),
    totalPrice: orderCoffeeInputData.totalPrice.toString(),
    nonce: orderCoffeeInputData.nonce.toString(),
    signature: orderCoffeeInputData.signature,
    priorityFee_EVVM: orderCoffeeInputData.priorityFee_EVVM.toString(),
    nonce_EVVM: orderCoffeeInputData.nonce_EVVM.toString(),
    priorityFlag_EVVM: orderCoffeeInputData.priorityFlag_EVVM,
    signature_EVVM: orderCoffeeInputData.signature_EVVM,
  };


  return (
    <>
    <div className={styles.terminalContainer}>
      <div className={styles.terminalHeader}>
        <span className={styles.terminalTitle}>Order Data</span>
      </div>

      <pre className={styles.jsonContainer}>
        {JSON.stringify(jsonData, null, 2)}
      </pre>

      
    </div>
    <button onClick={() => executeTransactionData(orderCoffeeInputData)}>Execute Transaction</button>
    </>
    
  );
};
