import { encodeAbiParameters, keccak256, type Address } from 'viem';
export const SOCIAL_SPLIT_ADDRESS = "0x891d4747a526D68F04b8c4f3F2c66b0D3cF5CeAf"; // Tu contrato desplegado en Sepolia
export const EVVM_ID = "1"; 

export type PaymentInstruction = {
  amount: bigint;
  to_identity: string;
  to_address: Address;
};

export const buildSocialSplitMessage = (
  instructions: PaymentInstruction[],
  totalAmount: bigint,
  serviceNonce: bigint
): string => {
  
  const instructionSchema = [
    {
      components: [
        { name: 'amount', type: 'uint256' },
        { name: 'to_identity', type: 'string' },
        { name: 'to_address', type: 'address' }
      ],
      name: 'instructions',
      type: 'tuple[]'
    }
  ] as const;

  const encodedInstructions = encodeAbiParameters(instructionSchema, [instructions]);
  const instructionsHash = keccak256(encodedInstructions);

  return [
    EVVM_ID,
    "executeSplitPayment",
    instructionsHash,
    totalAmount.toString(),
    serviceNonce.toString()
  ].join(",");
};