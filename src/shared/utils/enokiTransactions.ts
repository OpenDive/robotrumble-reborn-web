import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

/**
 * Enoki Transaction Handler
 * 
 * This replaces the custom zkLogin transaction signing with Enoki's built-in handling.
 * Enoki automatically manages zkLogin proofs, ephemeral keys, and network compatibility.
 */

export interface EnokiTransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/**
 * Hook for executing transactions with Enoki
 * This replaces the custom zkLoginSignAndExecuteTransaction function
 */
export function useEnokiTransactions() {
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const executeTransaction = async (transaction: Transaction): Promise<EnokiTransactionResult> => {
    try {
      console.log('🔐 Executing transaction with Enoki...');
      
      // Enoki handles all the zkLogin complexity internally
      const result = await signAndExecuteTransaction({
        transaction,
      });

      console.log('✅ Transaction executed successfully:', result.digest);
      
      return {
        success: true,
        transactionId: result.digest,
      };
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  return { executeTransaction };
}

/**
 * Legacy wrapper for existing code that expects the old zkLogin signature
 * This allows gradual migration from custom zkLogin to Enoki
 */
export function createEnokiTransactionSigner(executeTransaction: (tx: Transaction) => Promise<EnokiTransactionResult>) {
  return async (transaction: Transaction): Promise<any> => {
    const result = await executeTransaction(transaction);
    
    if (!result.success) {
      throw new Error(result.error || 'Transaction failed');
    }
    
    return {
      digest: result.transactionId,
      // Add other properties that your existing code might expect
    };
  };
} 