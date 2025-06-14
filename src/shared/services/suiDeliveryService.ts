// Sui Delivery Service
// Version: 2024-01-23-16:00 - Updated to match suiCrossyRobotService pattern
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// Using the same package ID for delivery demo (you can change this to a delivery-specific contract)
const PACKAGE_ID = '0xaa4fbd2d5507be23930ee1d1febba86ba0fdd438d8167b5629114c2bc548d76f';

export interface DeliveryState {
  userAddress: string | null;
  signAndExecuteTransaction?: (transaction: Transaction) => Promise<any>;
  isInitialized: boolean;
  balance: { user: number; robot: number; } | null;
  deliveryObjectId: string | null;
  lastTransactionId: string | null;
  deliveryCreated: boolean;
  robotConnected: boolean;
  deliveryCompleted: boolean;
  cost: number;
  robotAddress: string | null;
  deliveryId: string | null;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  deliveryObjectId?: string;
  gasUsed?: number;
  error?: string;
  effects?: any;
  objectChanges?: Array<{
    type: string;
    objectType?: string;
    objectId?: string;
  }>;
  message?: string;
}

interface SuiDeliveryServiceConfig {
  packageId: string;
  network: 'testnet' | 'mainnet';
  suiClient: SuiClient;
  userAddress?: string;
  signAndExecuteTransaction?: (transaction: Transaction) => Promise<any>;
}

export class SuiDeliveryService {
  private packageId: string;
  private network: 'testnet' | 'mainnet';
  private suiClient: SuiClient;
  private deliveryState: DeliveryState;
  private demoMode: boolean = false;

  constructor(config: SuiDeliveryServiceConfig) {
    this.packageId = config.packageId;
    this.network = config.network;
    this.suiClient = config.suiClient;
    
    this.deliveryState = {
      userAddress: config.userAddress || null,
      signAndExecuteTransaction: config.signAndExecuteTransaction,
      isInitialized: false,
      balance: null,
      deliveryObjectId: null,
      lastTransactionId: null,
      deliveryCreated: false,
      robotConnected: false,
      deliveryCompleted: false,
      cost: 0.05, // Default cost in SUI
      robotAddress: '0xa357b80237666757d6c60b35cfe4d1c979a457f8e5bb958fbfecc33fda73f5fc', // Mock robot address
      deliveryId: null
    };

    if (config.signAndExecuteTransaction) {
      console.log('💰 Standard transactions enabled for delivery service');
    }
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
        return { user: 0, robot: 0 };
      }

      console.log('💰 Checking wallet balance for:', this.deliveryState.userAddress);
      
      // Initialize balance object if it's null
      if (!this.deliveryState.balance) {
        this.deliveryState.balance = { user: 0, robot: 1.0 };
      }
      
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
   * Create a new delivery order with standard transaction
   * This calls the smart contract to create a delivery order
   */
  async createDeliveryOrder(cost: number = 0.05): Promise<TransactionResult> {
    if (!this.deliveryState.signAndExecuteTransaction || !this.deliveryState.userAddress) {
      throw new Error('Wallet not connected - user must be authenticated');
    }

    console.log('📦 Creating delivery order with standard transaction...');
    console.log('🔧 Service version: 2024-01-23-16:00 - Updated to match suiCrossyRobotService pattern');

    try {
      console.log('📦 Step 1: User creating delivery order on blockchain...');
      console.log('📦 Using package ID:', this.packageId);
      console.log(`💰 Delivery cost: ${cost} SUI`);
      
      const transaction = new Transaction();
      
      // Delivery payment (default 0.05 SUI) - matching working examples
      const deliveryPayment = transaction.splitCoins(transaction.gas, [transaction.pure.u64(cost * 1_000_000_000)]); // Convert SUI to MIST
      
      // Call the create_game function (reusing for delivery order) - match exact arguments
      transaction.moveCall({
        target: `${this.packageId}::crossy_robot::create_game`,
        arguments: [
          deliveryPayment,
          transaction.object('0x6'), // Clock object
        ],
      });

      // Execute transaction
      const result = await this.deliveryState.signAndExecuteTransaction(transaction);
      
      console.log('🔍 Delivery order transaction result:', result);

      if (!result?.digest) {
        throw new Error('No transaction digest received');
      }

      // Extract delivery object ID from transaction result
      let deliveryObjectId: string | null = null;
      
      if (result.objectChanges) {
        const createdObject = result.objectChanges.find((change: any) => 
          change.type === 'created' && 
          change.objectType?.includes('crossy_robot::Game')
        );
        
        if (createdObject) {
          deliveryObjectId = createdObject.objectId;
          console.log('✅ Found delivery object ID from transaction:', deliveryObjectId);
        }
      }

      // Update delivery state
      this.deliveryState.deliveryObjectId = deliveryObjectId || null;
      this.deliveryState.lastTransactionId = result.digest;
      this.deliveryState.deliveryCreated = true;
      this.deliveryState.cost = cost;
      this.deliveryState.deliveryId = result.digest;
        
      console.log('✅ Delivery order created successfully!');
      console.log(`   📦 Delivery Object ID: ${deliveryObjectId}`);
      console.log(`   📝 Transaction: ${result.digest}`);
      console.log(`   💰 Gas paid by user wallet`);
        
      return {
        success: true,
        transactionId: result.digest,
        deliveryObjectId: deliveryObjectId || undefined,
        gasUsed: result.effects?.gasUsed?.computationCost || 0,
        message: 'Delivery order created successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to create delivery order:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in transaction'
      };
    }
  }

  /**
   * Connect robot to delivery order (Robot action)
   * This would typically be called by the robot's wallet
   */
  async connectRobotToDelivery(): Promise<TransactionResult> {
    if (!this.deliveryState.deliveryObjectId) {
      return { 
        success: false, 
        error: 'No valid delivery object ID available - please create a delivery order first' 
      };
    }

    // Check if we're using the hardcoded demo delivery object ID
    const isDemoMode = this.deliveryState.deliveryObjectId === "0x3fbe01871af92ae00f9e201d82cb9fdbd1507fd5b9355e2cb50b161933b00c07";
    
    if (isDemoMode) {
      console.log('🤖 Step 2: Robot connecting to delivery (using real testnet delivery object)...');
      console.log('🎯 Using real testnet delivery object ID:', this.deliveryState.deliveryObjectId);
      console.log('🔗 This will make a REAL blockchain transaction to connect to existing delivery');
    } else {
      console.log('🤖 Step 2: Robot connecting to delivery...');
      console.log('🎯 Using delivery object ID:', this.deliveryState.deliveryObjectId);
    }

    // Validate object ID format for real blockchain calls
    if (!this.deliveryState.deliveryObjectId.startsWith('0x') || this.deliveryState.deliveryObjectId.length < 60) {
      return { 
        success: false, 
        error: `Invalid delivery object ID format: ${this.deliveryState.deliveryObjectId}. Expected 0x followed by 64 hex characters.` 
      };
    }

    try {
      if (!this.deliveryState.signAndExecuteTransaction || !this.deliveryState.userAddress) {
        throw new Error('Wallet not connected');
      }

      console.log('🤖 Step 2: Robot connecting to delivery...');
      console.log('🎯 Using delivery object ID:', this.deliveryState.deliveryObjectId);
      console.log('🔍 Object ID length:', this.deliveryState.deliveryObjectId.length);
      console.log('🔍 Object ID format valid:', this.deliveryState.deliveryObjectId.startsWith('0x'));
      
      // Create transaction to connect robot
      const transaction = new Transaction();
      
      // Connect robot and capture the returned payment coin
      const [receivedCoin] = transaction.moveCall({
        target: `${this.packageId}::crossy_robot::connect_robot`,
        arguments: [
          transaction.object(this.deliveryState.deliveryObjectId), // Use delivery object ID
          transaction.object('0x6'), // Clock object
        ],
      });
      
      // Transfer the payment coin to the user (simulating robot receiving payment)
      transaction.transferObjects([receivedCoin], transaction.pure.address(this.deliveryState.userAddress));
      
      const result = await this.deliveryState.signAndExecuteTransaction(transaction);
      
      console.log('🔍 Robot connection result:', {
        digest: result.digest,
        effects: result.effects,
        deliveryObjectId: this.deliveryState.deliveryObjectId,
        fullResult: result
      });
      
      const isSuccessful = result.digest && (
        !result.effects || 
        result.effects?.status?.status === 'success' ||
        result.effects?.status === 'success' ||
        !result.effects?.status?.error
      );
      
      if (isSuccessful) {
        this.deliveryState.robotConnected = true;
        this.deliveryState.lastTransactionId = result.digest;
        
        console.log('✅ Robot connected to delivery!');
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
      console.error('❌ Failed to connect robot:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Send delivery command (User action)
   */
  async executeDelivery(destination: string): Promise<TransactionResult> {
    // Check if we have a valid delivery object ID (this means delivery was created and robot connected)
    if (!this.deliveryState.deliveryObjectId) {
      return { 
        success: false, 
        error: 'Delivery not ready - missing delivery object ID. Please create delivery and connect robot first.' 
      };
    }
    
    // Check if delivery was created and robot connected
    if (!this.deliveryState.deliveryCreated) {
      return { 
        success: false, 
        error: 'Delivery not ready - delivery not created. Please create delivery first.' 
      };
    }

    if (!this.deliveryState.robotConnected) {
      return { 
        success: false, 
        error: 'Delivery not ready - robot not connected. Please connect robot first.' 
      };
    }

    console.log(`📦 Step 3: User executing delivery to: ${destination}...`);
    console.log(`🎯 Using delivery object ID: ${this.deliveryState.deliveryObjectId}`);

    try {
      if (!this.deliveryState.signAndExecuteTransaction || !this.deliveryState.userAddress) {
        throw new Error('Wallet not connected');
      }

      console.log(`📦 Step 3: User executing delivery to: ${destination}...`);
      console.log(`🎯 Using delivery object ID: ${this.deliveryState.deliveryObjectId}`);
      
      // Create transaction for delivery execution
      const transaction = new Transaction();
      
      // Call the move function from contract (reusing for delivery execution)
      transaction.moveCall({
        target: `${this.packageId}::crossy_robot::move_robot`,
        arguments: [
          transaction.object(this.deliveryState.deliveryObjectId), // Use the actual delivery object ID
          transaction.pure.u8(1), // Delivery direction/command as u8
          transaction.object('0x6'), // Clock object
        ],
      });
      
      const result = await this.deliveryState.signAndExecuteTransaction(transaction);
      
      // Add logging and robust status checking
      console.log('🔍 Delivery execution result:', {
        digest: result.digest,
        effects: result.effects,
        destination: destination,
        deliveryObjectId: this.deliveryState.deliveryObjectId,
        fullResult: result
      });
      
      const isSuccessful = result.digest && (
        !result.effects || 
        result.effects?.status?.status === 'success' ||
        result.effects?.status === 'success' ||
        !result.effects?.status?.error
      );
      
      if (isSuccessful) {
        this.deliveryState.deliveryCompleted = true;
        this.deliveryState.lastTransactionId = result.digest;
        
        console.log(`✅ Delivery executed to: ${destination}`);
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
        throw new Error(`Delivery execution failed: ${errorMessage}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to execute delivery to ${destination}:`, error);
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
      console.log('🚀 Starting Delivery Blockchain Integration...');
      console.log('📦 Package ID:', this.packageId);
      console.log('🌐 Network:', this.network);
      
      if (this.deliveryState.userAddress) {
        await this.checkBalances();
        console.log('👤 User balance:', this.deliveryState.balance?.user || 0, 'SUI');
      } else {
        console.log('⚠️ No wallet connected yet');
      }
      
      this.deliveryState.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Delivery service:', error);
      return false;
    }
  }

  /**
   * Reset delivery state
   */
  resetDelivery(): void {
    this.deliveryState.deliveryId = null;
    this.deliveryState.deliveryObjectId = null;
    this.deliveryState.robotConnected = false;
    this.deliveryState.deliveryCreated = false;
    this.deliveryState.deliveryCompleted = false;
    this.deliveryState.cost = 0.05;
    this.deliveryState.lastTransactionId = null;
    console.log('🔄 Delivery state reset');
  }

  /**
   * Get transaction URL for explorer
   */
  getTransactionUrl(transactionId: string): string {
    return `https://suiexplorer.com/txblock/${transactionId}?network=${this.network}`;
  }

  /**
   * Get short transaction ID for display
   */
  getShortTransactionId(transactionId: string): string {
    return transactionId.length > 10 ? `${transactionId.substring(0, 6)}...${transactionId.substring(-4)}` : transactionId;
  }

  /**
   * Set wallet connection for transactions
   */
  setWalletConnection(
    userAddress: string,
    signAndExecuteTransaction: (transaction: Transaction) => Promise<any>
  ) {
    this.deliveryState.userAddress = userAddress;
    this.deliveryState.signAndExecuteTransaction = signAndExecuteTransaction;
    console.log('🔗 Wallet connected to delivery service:', userAddress);
  }
}

// Export singleton instance
export const suiDeliveryService = new SuiDeliveryService({
  packageId: PACKAGE_ID,
  network: 'testnet',
  suiClient: new SuiClient({ url: getFullnodeUrl('testnet') })
}); 