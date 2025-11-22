import React from "react";
import { formatEther } from "viem/utils";
import styles from "./Ticket.module.css";

type CafeData = {
  coffeeType: string;
  quantity: bigint;
  totalPrice: bigint;
  nonce: bigint;
  signature: string;
};

type PayInputData = {
  from: string;
  to_address: string;
  to_identity: string;
  token: string;
  amount: bigint;
  priorityFee: bigint;
  nonce: bigint;
  priority: boolean;
  executor: string;
  signature: string;
};

interface TicketProps {
  coffeeReceipt: CafeData;
  payReceipt: PayInputData;
}

export const Ticket: React.FC<TicketProps> = ({ coffeeReceipt, payReceipt }) => {
  return (
    <div className={styles.receiptContainer}>
      <div className={styles.receiptSection}>
        <h3 className={styles.receiptTitle}>EVVM Cafe Receipt</h3>
        
        <div className={styles.receiptLine}>
          <span className={styles.receiptLabel}>Coffee:</span>
          <span className={styles.receiptValue}>{coffeeReceipt.coffeeType}</span>
        </div>
        
        <div className={styles.receiptLine}>
          <span className={styles.receiptLabel}>Qty:</span>
          <span className={styles.receiptValue}>{coffeeReceipt.quantity.toString()}</span>
        </div>
        
        <div className={styles.receiptLine}>
          <span className={styles.receiptLabel}>Total:</span>
          <span className={`${styles.receiptValue} ${styles.receiptHighlight}`}>
            {formatEther(coffeeReceipt.totalPrice)} ETH
          </span>
        </div>
        
        <div className={styles.receiptLine}>
          <span className={styles.receiptLabel}>Order #:</span>
          <span className={styles.receiptValue}>{coffeeReceipt.nonce.toString()}</span>
        </div>
        
        <div>
          <div className={styles.receiptLine}>
            <span className={styles.receiptLabel}>Order Sig:</span>
          </div>
          <div className={styles.receiptSignatureFull}>
            {coffeeReceipt.signature}
          </div>
        </div>
      </div>

      <div className={styles.receiptSection}>
        <h3 className={styles.receiptTitle}>Payment Details</h3>
        
        <div className={styles.receiptLine}>
          <span className={styles.receiptLabel}>From:</span>
          <span className={styles.receiptSignature}>
            {payReceipt.from.slice(0, 10)}...{payReceipt.from.slice(-8)}
          </span>
        </div>
        
        <div className={styles.receiptLine}>
          <span className={styles.receiptLabel}>To:</span>
          <span className={styles.receiptSignature}>
            {payReceipt.to_address.slice(0, 10)}...{payReceipt.to_address.slice(-8)}
          </span>
        </div>
        
        <div className={styles.receiptLine}>
          <span className={styles.receiptLabel}>Amount:</span>
          <span className={styles.receiptValue}>
            {formatEther(payReceipt.amount)} ETH
          </span>
        </div>
        
        <div className={styles.receiptLine}>
          <span className={styles.receiptLabel}>Priority Fee:</span>
          <span className={styles.receiptValue}>
            {formatEther(payReceipt.priorityFee)} ETH
          </span>
        </div>
        
        <div className={styles.receiptLine}>
          <span className={styles.receiptLabel}>Nonce:</span>
          <span className={styles.receiptValue}>{payReceipt.nonce.toString()}</span>
        </div>
        
        <div className={styles.receiptLine}>
          <span className={styles.receiptLabel}>Priority:</span>
          <span className={styles.receiptValue}>
            {payReceipt.priority ? "Async" : "Sync"}
          </span>
        </div>
        
        <div className={styles.receiptLine}>
          <span className={styles.receiptLabel}>Executor:</span>
          <span className={styles.receiptSignature}>
            {payReceipt.executor.slice(0, 10)}...{payReceipt.executor.slice(-8)}
          </span>
        </div>
        
        <div>
          <div className={styles.receiptLine}>
            <span className={styles.receiptLabel}>Pay Sig:</span>
          </div>
          <div className={styles.receiptSignatureFull}>
            {payReceipt.signature}
          </div>
        </div>
      </div>
      
      <div style={{ textAlign: 'center', fontSize: '10px', color: '#888', marginTop: '15px' }}>
        Thank you for visiting EVVM Cafe {"(˶ᵔ ᵕ ᵔ˶)"}
      </div>
    </div>
  );
};