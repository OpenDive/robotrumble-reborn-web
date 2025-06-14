// Sui Crossy Robot Service
// Version: 2024-01-23-16:00 - Simplified without sponsored transactions
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';

// Your deployed contract package ID on testnet
const PACKAGE_ID = '0xaa4fbd2d5507be23930ee1d1febba86ba0fdd438d8167b5629114c2bc548d76f';

export interface GameState {
  userAddress: string | null;
  signAndExecuteTransaction?: (transaction: Transaction) => Promise<any>;
  isInitialized: boolean;
  balance: { user: number; robot: number; } | null;
  gameObjectId: string | null;
  lastTransactionId: string | null;
  gameCreated: boolean;
  gameStarted: boolean;
  gameEnded: boolean;
  score: number;
  lives: number;
  position: { x: number; y: number };
  direction: string;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  gameObjectId?: string;
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

interface SuiCrossyRobotServiceConfig {
  packageId: string;
  network: 'testnet' | 'mainnet';
  suiClient: SuiClient;
  userAddress?: string;
  signAndExecuteTransaction?: (transaction: Transaction) => Promise<any>;
}

class SuiCrossyRobotService {
  private packageId: string;
  private network: 'testnet' | 'mainnet';
  private suiClient: SuiClient;
  private gameState: GameState;

  constructor(config: SuiCrossyRobotServiceConfig) {
    this.packageId = config.packageId;
    this.network = config.network;
    this.suiClient = config.suiClient;
    
    this.gameState = {
      userAddress: config.userAddress || null,
      signAndExecuteTransaction: config.signAndExecuteTransaction,
      isInitialized: false,
      balance: null,
      gameObjectId: null,
      lastTransactionId: null,
      gameCreated: false,
      gameStarted: false,
      gameEnded: false,
      score: 0,
      lives: 3,
      position: { x: 0, y: 0 },
      direction: 'up'
    };

    if (config.signAndExecuteTransaction) {
      console.log('💰 Standard transactions enabled');
    }
  }

  /**
   * Get current game state
   */
  getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Check wallet balances
   */
  async checkBalances(): Promise<{ user: number; robot: number }> {
    try {
      if (!this.gameState.userAddress) {
        console.log('💰 No wallet connected, using default balances');
        return { user: 0, robot: 0 };
      }

      console.log('💰 Checking wallet balance for:', this.gameState.userAddress);
      
      // Initialize balance object if it's null
      if (!this.gameState.balance) {
        this.gameState.balance = { user: 0, robot: 0 };
      }
      
      // Get user's SUI balance
      const balance = await this.suiClient.getBalance({
        owner: this.gameState.userAddress,
      });
      
      const userBalance = parseFloat(balance.totalBalance) / 1_000_000_000; // Convert from MIST to SUI
      this.gameState.balance.user = userBalance;
      
      console.log(`💰 User balance: ${userBalance} SUI`);
      return this.gameState.balance;
    } catch (error) {
      console.error('Failed to check balances:', error);
      return { user: 0, robot: 0 };
    }
  }

  /**
   * Create a new game with standard transaction
   * This calls your deployed smart contract
   */
  async createGame(): Promise<TransactionResult> {
    if (!this.gameState.signAndExecuteTransaction || !this.gameState.userAddress) {
      throw new Error('Wallet not connected - user must be authenticated');
    }

    console.log('🎮 Creating game with standard transaction...');
    console.log('🔧 Service version: 2024-01-23-16:00 - Simplified without sponsored transactions');

    try {
      const transaction = new Transaction();
      
      // Game payment (0.05 SUI) - matching working examples
      const gamePayment = transaction.splitCoins(transaction.gas, [50_000_000]); // 0.05 SUI in MIST
      
      // Call the create_game function with payment and clock
      transaction.moveCall({
        target: `${this.packageId}::crossy_robot::create_game`,
        arguments: [
          gamePayment,
          transaction.object('0x6') // Clock object
        ]
      });

      // Execute transaction
      const result = await this.gameState.signAndExecuteTransaction(transaction);
      
      console.log('🔍 Transaction result:', result);

      if (!result?.digest) {
        throw new Error('No transaction digest received');
      }

      // Extract game object ID from transaction result
      let gameObjectId: string | null = null;
      
      if (result.objectChanges) {
        const createdObject = result.objectChanges.find((change: any) => 
          change.type === 'created' && 
          change.objectType?.includes('crossy_robot::Game')
        );
        
        if (createdObject) {
          gameObjectId = createdObject.objectId;
          console.log('✅ Found game object ID from transaction:', gameObjectId);
        }
      }

      // Update game state
      this.gameState.gameObjectId = gameObjectId;
      this.gameState.lastTransactionId = result.digest;
      this.gameState.gameCreated = true;
        
        console.log('✅ Game created successfully!');
      console.log(`   🎮 Game Object ID: ${gameObjectId}`);
      console.log(`   📝 Transaction: ${result.digest}`);
      console.log(`   💰 Gas paid by user wallet`);
        
        return {
          success: true,
          transactionId: result.digest,
        gameObjectId: gameObjectId,
        gasUsed: result.effects?.gasUsed?.computationCost || 0,
        message: 'Game created successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to create game:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in transaction'
      };
    }
  }

  /**
   * Connect robot to game (Robot action)
   * This would typically be called by the robot's wallet
   */
  async connectRobot(): Promise<TransactionResult> {
    if (!this.gameState.gameObjectId) {
      return { success: false, error: 'No valid game object ID available - please create a game first' };
    }

    // Check if we're using the hardcoded demo game object ID
    const isDemoMode = this.gameState.gameObjectId === "0x3fbe01871af92ae00f9e201d82cb9fdbd1507fd5b9355e2cb50b161933b00c07";
    
    if (isDemoMode) {
      console.log('🤖 Step 2: Robot connecting to game (using real testnet game object)...');
      console.log('🎯 Using real testnet game object ID:', this.gameState.gameObjectId);
      console.log('🔗 This will make a REAL blockchain transaction to connect to existing game');
    } else {
      console.log('🤖 Step 2: Robot connecting to game...');
      console.log('🎯 Using game object ID:', this.gameState.gameObjectId);
    }

    // Validate object ID format for real blockchain calls
    if (!this.gameState.gameObjectId.startsWith('0x') || this.gameState.gameObjectId.length < 60) {
      return { 
        success: false, 
        error: `Invalid game object ID format: ${this.gameState.gameObjectId}. Expected 0x followed by 64 hex characters.` 
      };
    }

    try {
      if (!this.gameState.signAndExecuteTransaction || !this.gameState.userAddress) {
        throw new Error('Wallet not connected');
      }

      console.log('🤖 Step 2: Robot connecting to game...');
      console.log('🎯 Using game object ID:', this.gameState.gameObjectId);
      console.log('🔍 Object ID length:', this.gameState.gameObjectId.length);
      console.log('🔍 Object ID format valid:', this.gameState.gameObjectId.startsWith('0x'));
      
      // Create transaction to connect robot
      const transaction = new Transaction();
      
      // Connect robot and capture the returned payment coin
      const [receivedCoin] = transaction.moveCall({
        target: `${this.packageId}::crossy_robot::connect_robot`,
        arguments: [
          transaction.object(this.gameState.gameObjectId), // Use game object ID instead of game ID
          transaction.object('0x6'), // Clock object
        ],
      });
      
      // Transfer the payment coin to the user (simulating robot receiving payment)
      transaction.transferObjects([receivedCoin], transaction.pure.address(this.gameState.userAddress));
      
      const result = await this.gameState.signAndExecuteTransaction(transaction);
      
      // Add logging and robust status checking
      console.log('🔍 Robot connection result:', {
        digest: result.digest,
        effects: result.effects,
        gameObjectId: this.gameState.gameObjectId,
        fullResult: result
      });
      
      const isSuccessful = result.digest && (
        !result.effects || 
        result.effects?.status?.status === 'success' ||
        result.effects?.status === 'success' ||
        !result.effects?.status?.error
      );
      
      if (isSuccessful) {
        this.gameState.isConnected = true;
        
        console.log('✅ Robot connected to game!');
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
   * Send movement command (User action)
   */
  async sendMovement(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'): Promise<TransactionResult> {
    // Check if we have a valid game object ID (this means game was created and robot connected)
    if (!this.gameState.gameObjectId) {
      return { 
        success: false, 
        error: 'Game not ready - missing game object ID. Please create game and connect robot first.' 
      };
    }
    
    // Check if game was created and robot connected
    if (!this.gameState.gameCreated) {
      return { 
        success: false, 
        error: 'Game not ready - game not created. Please create game first.' 
      };
    }

    console.log(`👤 Step 3: User sending movement: ${direction}...`);
    console.log(`🎯 Using game object ID: ${this.gameState.gameObjectId}`);

    try {
      if (!this.gameState.signAndExecuteTransaction || !this.gameState.userAddress) {
        throw new Error('Wallet not connected');
      }

      console.log(`👤 Step 3: User sending movement: ${direction}...`);
      console.log(`🎯 Using game object ID: ${this.gameState.gameObjectId}`);
      
      // Create transaction for movement
      const transaction = new Transaction();
      
      // Call the move function from your contract using the actual game object ID
      transaction.moveCall({
        target: `${this.packageId}::crossy_robot::move_robot`,
        arguments: [
          transaction.object(this.gameState.gameObjectId), // Use the actual game object ID
          transaction.pure.u8(this.getDirectionValue(direction)), // Direction as u8
          transaction.object('0x6'), // Clock object
        ],
      });
      
      const result = await this.gameState.signAndExecuteTransaction(transaction);
      
      // Add logging and robust status checking
      console.log('🔍 Movement command result:', {
        digest: result.digest,
        effects: result.effects,
        direction: direction,
        gameObjectId: this.gameState.gameObjectId,
        fullResult: result
      });
      
      const isSuccessful = result.digest && (
        !result.effects || 
        result.effects?.status?.status === 'success' ||
        result.effects?.status === 'success' ||
        !result.effects?.status?.error
      );
      
      if (isSuccessful) {
        console.log(`✅ Movement command sent: ${direction}`);
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
        throw new Error(`Movement command failed: ${errorMessage}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to send movement ${direction}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Convert direction string to u8 value for smart contract (0-7 directions according to contract)
   */
  private getDirectionValue(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'): number {
    switch (direction) {
      case 'UP': return 0;
      case 'DOWN': return 1;
      case 'LEFT': return 2;
      case 'RIGHT': return 3;
      default: return 0;
    }
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🚀 Starting Crossy Robot Blockchain Integration...');
      console.log('📦 Package ID:', this.packageId);
      console.log('🌐 Network:', this.network);
      
      if (this.gameState.userAddress) {
        await this.checkBalances();
        console.log('👤 User balance:', this.gameState.balance?.user || 0, 'SUI');
      } else {
        console.log('⚠️ No wallet connected yet');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Sui service:', error);
      return false;
    }
  }

  /**
   * Reset game state
   */
  resetGame(): void {
    this.gameState.gameId = null;
    this.gameState.gameObjectId = null;
    this.gameState.isConnected = false;
    this.gameState.gameCreated = false;
    this.gameState.gameStarted = false;
    this.gameState.gameEnded = false;
    this.gameState.score = 0;
    this.gameState.lives = 3;
    this.gameState.position = { x: 0, y: 0 };
    this.gameState.direction = 'up';
    this.gameState.lastTransactionId = null;
    console.log('🔄 Game state reset');
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
    this.gameState.userAddress = userAddress;
    this.gameState.signAndExecuteTransaction = signAndExecuteTransaction;
    console.log('🔗 Wallet connected to service:', userAddress);
  }
}

// Export singleton instance
export const suiCrossyRobotService = new SuiCrossyRobotService({
  packageId: PACKAGE_ID,
  network: 'testnet',
  suiClient: new SuiClient({ url: 'https://fullnode.testnet.sui.io' })
});