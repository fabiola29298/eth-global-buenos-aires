# 🍔 EVVM Ghost Kitchen

A decentralized, mobile-first Ghost Kitchen application built on the **EVVM (Ethereum Virtual Virtual Machine)** protocol. This dApp demonstrates how to decouple service logic from payment logic using virtual blockchain settlements.

## 📱 Features

*   **Mobile-First Design:** Responsive, dark-mode UI optimized for mobile ordering.
*   **EVVM Integration:** Uses Virtual VM logic for internal ETH/Token settlements.
*   **Cryptographic Security:** Implements dual-signature logic (Order Intent + Payment Authorization).
*   **Dual Nonce System:** Supports both **Sync** (sequential) and **Async** (priority) nonces.
*   **Visual Terminal:** Real-time JSON visualization of the transaction payload before broadcasting.

## 🛠 Tech Stack

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **Blockchain:** Wagmi v2, Viem
*   **Styling:** Tailwind CSS & Lucide Icons
*   **Smart Contract:** Solidity (Foundry)
*   **EVVM Libs:** `@evvm/viem-signature-library`

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/your-repo/evvm-ghost-kitchen.git
cd evvm-ghost-kitchen
npm install
---

## 🛠 Development & Testing

To contribute to this project, clone the repository and install the dependencies.

```bash
git clone https://github.com/[your-username]/[your-repo].git
cd [your-repo]
npm install
```
