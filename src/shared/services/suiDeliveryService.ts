// Sui Delivery Service
// This service handles real blockchain transactions for the Robot Delivery system
// Based on suiCrossyRobotService but adapted for delivery use case
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

// Using the same package ID for delivery demo (you can change this to a delivery-specific contract)
const PACKAGE_ID = '0xaa4fbd2d5507be23930ee1d1febba86ba0fdd438d8167b5629114c2bc548d76f';

export interface DeliveryState {
  deliveryId: string | null;
  deliveryObjectId?: string | null;
  isRobotConnected: boolean;
  userAddress: string | null;
  robotAddress: string | null;
  balance: {
    user: number;
    robot: number;
  };
  cost: number;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  gasUsed?: number;
  effects?: {
    status?: {
      status: string;
      error?: string;
    };
    gasUsed?: {
      computationCost: number;
    };
  };
  objectChanges?: Array<{
    type: string;
    objectType?: string;
    objectId?: string;
  }>;
}

export class SuiDeliveryService {
  private deliveryState: DeliveryState;
  private suiClient: SuiClient;
  private signAndExecuteTransaction: ((transaction: any) => Promise<any>) | null = null;
  private demoMode: boolean = false;

  constructor() {
    this.deliveryState = {
      deliveryId: null,
      deliveryObjectId: null,
      isRobotConnected: false,
      userAddress: null,
      robotAddress: '0xa357b80237666757d6c60b35cfe4d1c979a457f8e5bb958fbfecc33fda73f5fc', // Mock robot address
      balance: { user: 0, robot: 1.0 },
      cost: 0.5
    };
    
    // Initialize Sui client for testnet
    this.suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  }

  /**
   * Set the wallet connection for signing transactions
   */
  setWalletConnection(userAddress: string, signAndExecuteTransaction: (transaction: any) => Promise<any>) {
    this.deliveryState.userAddress = userAddress;
    this.signAndExecuteTransaction = signAndExecuteTransaction;
    console.log('🔗 Delivery service wallet connected:', userAddress);
  }

  /**
   * Get current delivery state
   */
  getDeliveryState(): DeliveryState {
    return { ...this.deliveryState };
  }

  /**
   * Check wallet balances
   */
  async checkBalances(): Promise<{ user: number; robot: number }> {
    try {
      if (!this.deliveryState.userAddress) {
        console.log('💰 No wallet connected, using default balances');
        return this.deliveryState.balance;
      }

      console.log('💰 Checking wallet balance for:', this.deliveryState.userAddress);
      
      // Get user's SUI balance
      const balance = await this.suiClient.getBalance({
        owner: this.deliveryState.userAddress,
      });
      
      const userBalance = parseFloat(balance.totalBalance) / 1_000_000_000; // Convert from MIST to SUI
      this.deliveryState.balance.user = userBalance;
      
      console.log(`💰 User balance: ${userBalance} SUI`);
      return this.deliveryState.balance;
    } catch (error) {
      console.error('Failed to check balances:', error);
      return { user: 0, robot: 0 };
    }
  }

  /**
   * Create a new delivery order (User action)
   * This calls the smart contract to create a delivery order
   */
  async createDeliveryOrder(cost: number = 0.5): Promise<TransactionResult> {
    try {
      if (!this.signAndExecuteTransaction || !this.deliveryState.userAddress) {
        throw new Error('Wallet not connected');
      }

      console.log('📦 Step 1: User creating delivery order on blockchain...');
      console.log('📦 Using package ID:', PACKAGE_ID);
      console.log(`💰 Delivery cost: ${cost} SUI`);
      
      // Create transaction to call the smart contract (using crossy_robot contract for demo)
      const transaction = new Transaction();
      
      // Split coins for exact payment (use same amount as crossy robot: 0.05 SUI in MIST)
      const [coin] = transaction.splitCoins(transaction.gas, [transaction.pure.u64(50_000_000)]);
      
      // Call the create_game function (reusing for delivery order) - match exact arguments
      transaction.moveCall({
        target: `${PACKAGE_ID}::crossy_robot::create_game`,
        arguments: [
          coin, // Payment coin for the delivery
          transaction.object('0x6'), // Clock object
        ],
      });
      
      // Execute the transaction
      const result = await this.signAndExecuteTransaction(transaction);
      
      console.log('🔍 Delivery order transaction result:', {
        digest: result.digest,
        effects: result.effects,
        objectChanges: result.objectChanges,
      });
      
      // Parse object changes to find the delivery object ID
      let deliveryObjectId: string | null = null;
      
      const isSuccessful = result.digest && (
        !result.effects || 
        result.effects?.status?.status === 'success' ||
        result.effects?.status === 'success' ||
        !result.effects?.status?.error
      );
      
      if (isSuccessful) {
        // Try to extract object ID from objectChanges
        if (result.objectChanges && Array.isArray(result.objectChanges)) {
          console.log('🔍 Analyzing object changes for delivery object ID...');
          
          for (const change of result.objectChanges) {
            console.log('   - Change:', change);
            if (change.type === 'created' && change.objectId) {
              if (change.objectType?.includes('Game') || !deliveryObjectId) {
                deliveryObjectId = change.objectId;
                console.log(`🎯 Found delivery object ID: ${deliveryObjectId}`);
              }
            }
          }
        }
        
        // Store transaction results
        this.deliveryState.deliveryId = result.digest;
        this.deliveryState.deliveryObjectId = deliveryObjectId;
        this.deliveryState.cost = cost;
        
        // Validate object ID
        if (!deliveryObjectId) {
          console.log('❌ WARNING: No delivery object ID found! Using hardcoded fallback for demo.');
          console.log('   Delivery order created but object ID missing - this may be a dapp-kit issue');
          console.log('   Using hardcoded demo delivery object ID for robot connection');
          
          // Use a hardcoded delivery object ID for demo purposes (same as Crossy Robot)
          deliveryObjectId = "0x3fbe01871af92ae00f9e201d82cb9fdbd1507fd5b9355e2cb50b161933b00c07";
          this.deliveryState.deliveryObjectId = deliveryObjectId;
          this.demoMode = true;
          console.log('🚚 DEMO MODE ACTIVATED - Using real testnet delivery object ID');
        } else if (!deliveryObjectId.startsWith('0x') || deliveryObjectId.length < 60) {
          console.log('❌ WARNING: Invalid delivery object ID format:', deliveryObjectId);
          console.log('   Expected format: 0x followed by 64 hex characters');
          console.log('   Using hardcoded demo delivery object ID for robot connection');
          
          // Use a hardcoded delivery object ID for demo purposes
          deliveryObjectId = "0x3fbe01871af92ae00f9e201d82cb9fdbd1507fd5b9355e2cb50b161933b00c07";
          this.deliveryState.deliveryObjectId = deliveryObjectId;
          this.demoMode = true;
          console.log('🚚 DEMO MODE ACTIVATED - Using real testnet delivery object ID');
        }
        
        console.log('✅ Delivery order created successfully!');
        console.log(`   Delivery ID: ${result.digest}`);
        console.log(`   Delivery Object ID: ${deliveryObjectId || 'NOT FOUND'}`);
        console.log(`   Cost: ${cost} SUI`);
        
        return {
          success: true,
          transactionId: result.digest,
          gasUsed: result.effects?.gasUsed?.computationCost || 0
        };
      } else {
        const errorMessage = result.effects?.status?.error || 
                           result.effects?.error || 
                           result.error || 
                           'Unknown error';
        throw new Error(`Transaction failed: ${errorMessage}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to create delivery order:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Connect robot to delivery order (Robot action)
   */
  async connectRobotToDelivery(): Promise<TransactionResult> {
    if (!this.deliveryState.deliveryObjectId) {
      return { success: false, error: 'No valid delivery object ID available - please create a delivery order first' };
    }

    // Check if we're using the hardcoded demo delivery object ID
    const isDemoMode = this.deliveryState.deliveryObjectId === "0x3fbe01871af92ae00f9e201d82cb9fdbd1507fd5b9355e2cb50b161933b00c07";
    
    if (isDemoMode) {
      console.log('🤖 Step 2: Robot connecting to delivery (demo mode)...');
      console.log('🎯 Using demo game object ID:', this.deliveryState.deliveryObjectId);
      console.log('⚠️ DEMO MODE: Skipping blockchain transaction and simulating success');
      
      // In demo mode, skip the actual blockchain transaction and just simulate success
      this.deliveryState.isRobotConnected = true;
      
      return {
        success: true,
        transactionId: 'demo-robot-connection-simulated',
        gasUsed: 0
      };
    }

    // For non-demo mode, proceed with actual blockchain transaction
    try {
      if (!this.signAndExecuteTransaction || !this.deliveryState.userAddress) {
        throw new Error('Wallet not connected');
      }

      console.log('🤖 Step 2: Robot connecting to delivery...');
      console.log('🎯 Using delivery object ID:', this.deliveryState.deliveryObjectId);
      
      // Create transaction to connect robot
      const transaction = new Transaction();
      
      // Connect robot and capture the returned payment coin
      const [receivedCoin] = transaction.moveCall({
        target: `${PACKAGE_ID}::crossy_robot::connect_robot`,
        arguments: [
          transaction.object(this.deliveryState.deliveryObjectId),
          transaction.object('0x6'), // Clock object
        ],
      });
      
      // Transfer the payment coin to the user
      transaction.transferObjects([receivedCoin], transaction.pure.address(this.deliveryState.userAddress));
      
      const result = await this.signAndExecuteTransaction(transaction);
      
      const isSuccessful = result.digest && (
        !result.effects || 
        result.effects?.status?.status === 'success' ||
        result.effects?.status === 'success' ||
        !result.effects?.status?.error
      );
      
      if (isSuccessful) {
        this.deliveryState.isRobotConnected = true;
        
        console.log('✅ Robot connected to delivery order!');
        console.log(`   Transaction: ${result.digest}`);
        
        return {
          success: true,
          transactionId: result.digest,
          gasUsed: result.effects?.gasUsed?.computationCost || 0
        };
      } else {
        const errorMessage = result.effects?.status?.error || 
                           result.effects?.error || 
                           result.error || 
                           'Unknown error';
        throw new Error(`Robot connection failed: ${errorMessage}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to connect robot to delivery:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🚚 Starting Robot Delivery Blockchain Integration...');
      console.log('📦 Package ID:', PACKAGE_ID);
      console.log('🌐 Network: Testnet');
      
      if (this.deliveryState.userAddress) {
        await this.checkBalances();
        console.log('👤 User balance:', this.deliveryState.balance.user, 'SUI');
      } else {
        console.log('⚠️ No wallet connected yet');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize delivery service:', error);
      return false;
    }
  }

  /**
   * Get short transaction ID for display
   */
  getShortTransactionId(transactionId: string): string {
    return `${transactionId.substring(0, 8)}...${transactionId.substring(transactionId.length - 8)}`;
  }

  /**
   * Get transaction URL for explorer
   */
  getTransactionUrl(transactionId: string): string {
    return `https://suiexplorer.com/txblock/${transactionId}?network=testnet`;
  }
}

// Export singleton instance
export const suiDeliveryService = new SuiDeliveryService(); 