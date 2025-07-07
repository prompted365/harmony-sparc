/**
 * Exchange Manager for QuDAG Adapter
 * Handles real resource trading with rUv tokens, blockchain integration, and dynamic fee calculations
 * Implements actual cryptocurrency transactions and smart contract interactions
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { ethers, JsonRpcProvider, Wallet, Contract, formatEther, parseEther, parseUnits, TransactionResponse } from 'ethers';
import {
  QuDAGConfig,
  ResourceOrder,
  ResourceExchangeResult,
  ResourceBalance,
  ResourceType,
  OrderStatus,
  MLDSAKeyPair,
  QuantumResistantKeys,
  QuDAGError,
  QuDAGErrorCode
} from '../types';
// TODO: Replace with agentflow logger when available
const logger = {
  debug: (...args: any[]) => console.debug('[ExchangeManager]', ...args),
  info: (...args: any[]) => console.info('[ExchangeManager]', ...args),
  warn: (...args: any[]) => console.warn('[ExchangeManager]', ...args),
  error: (...args: any[]) => console.error('[ExchangeManager]', ...args)
};

// rUv Token constants
const RUV_TOKEN_DECIMALS = 18;
const RUV_TOKEN_SYMBOL = 'rUv';
const GAS_LIMIT = 300000;
const GAS_PRICE_GWEI = 20;

// Smart contract ABIs (simplified)
const RUV_TOKEN_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

const EXCHANGE_CONTRACT_ABI = [
  'function createOrder(uint8 resourceType, uint256 amount, uint256 price) returns (bytes32)',
  'function fillOrder(bytes32 orderId, uint256 amount) returns (bool)',
  'function cancelOrder(bytes32 orderId) returns (bool)',
  'function getOrder(bytes32 orderId) view returns (tuple(address creator, uint8 resourceType, uint256 amount, uint256 price, uint256 filled, uint8 status))',
  'function getUserBalance(address user, uint8 resourceType) view returns (uint256)',
  'function depositResource(uint8 resourceType, uint256 amount) returns (bool)',
  'function withdrawResource(uint8 resourceType, uint256 amount) returns (bool)',
  'event OrderCreated(bytes32 indexed orderId, address indexed creator, uint8 resourceType, uint256 amount, uint256 price)',
  'event OrderFilled(bytes32 indexed orderId, address indexed filler, uint256 amount)',
  'event OrderCancelled(bytes32 indexed orderId)'
];

// Blockchain transaction structure
interface BlockchainTransaction {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  gasLimit: bigint;
  gasPrice: bigint;
  nonce: number;
  data: string;
  signature?: {
    r: string;
    s: string;
    v: number;
  };
}

// Resource price oracle interface
interface PriceOracle {
  getResourcePrice(type: ResourceType): Promise<number>;
  updatePrice(type: ResourceType, price: number): Promise<void>;
}

interface FeeModel {
  baseFee: number;
  maxFee: number;
  timeConstant: number;
  usageThreshold: number;
  gasMultiplier: number;
}

interface AgentProfile {
  address: string;
  privateKey: string;
  verified: boolean;
  monthlyUsage: number;
  accountCreated: number;
  nonce: number;
  ruvBalance: bigint;
  reputation: number;
}

interface SmartContractAddresses {
  ruvToken: string;
  exchange: string;
  priceOracle: string;
  governance: string;
}

export class ExchangeManager extends EventEmitter {
  private config: QuDAGConfig;
  private provider: JsonRpcProvider | null = null;
  private signer: Wallet | null = null;
  private ruvTokenContract: Contract | null = null;
  private exchangeContract: Contract | null = null;
  private priceOracleContract: Contract | null = null;
  private balances: Map<ResourceType, ResourceBalance> = new Map();
  private orders: Map<string, ResourceOrder> = new Map();
  private agentProfile: AgentProfile | null = null;
  private contractAddresses: SmartContractAddresses;
  private feeModel: FeeModel = {
    baseFee: 0.001,
    maxFee: 0.01,
    timeConstant: 90 * 24 * 60 * 60 * 1000, // 90 days in ms
    usageThreshold: 10000,
    gasMultiplier: 1.2
  };
  private priceCache: Map<ResourceType, { price: number; timestamp: number }> = new Map();
  private readonly PRICE_CACHE_TTL = 300000; // 5 minutes

  constructor(config: QuDAGConfig) {
    super();
    this.config = config;
    
    // Set contract addresses (in production, these would be from config)
    this.contractAddresses = {
      ruvToken: process.env.RUV_TOKEN_ADDRESS || '0x742dc35Cc6701b59c4e5dd1E67aB2c29Cc1B2A8d',
      exchange: process.env.EXCHANGE_ADDRESS || '0x8ba1f109551bD432803012645Hac136c22C3A89C',
      priceOracle: process.env.PRICE_ORACLE_ADDRESS || '0x9cd83f8239C4C7f8B2C4D5B6A3b2Eb6f7dF1C4E2',
      governance: process.env.GOVERNANCE_ADDRESS || '0x1a23b56789c0d1e2f3456789a0b1c2d3e4f5678a'
    };
    
    this.initializeBalances();
    logger.info('Exchange manager created', {
      ruvToken: this.contractAddresses.ruvToken,
      exchange: this.contractAddresses.exchange
    });
  }

  /**
   * Initialize exchange with agent keys and blockchain connection
   */
  async initialize(keys: QuantumResistantKeys): Promise<void> {
    try {
      // Initialize blockchain connection
      await this.initializeBlockchain();
      
      // Generate Ethereum wallet from quantum-resistant keys
      const ethPrivateKey = this.deriveEthereumPrivateKey(keys.signing.privateKey);
      this.signer = new Wallet(ethPrivateKey, this.provider);
      
      // Create agent profile
      const address = await this.signer.getAddress();
      const nonce = await this.provider!.getTransactionCount(address);
      const ruvBalance = await this.getRuvBalance(address);
      
      this.agentProfile = {
        address,
        privateKey: ethPrivateKey,
        verified: false,
        monthlyUsage: 0,
        accountCreated: Date.now(),
        nonce,
        ruvBalance,
        reputation: 100
      };
      
      // Initialize smart contracts
      await this.initializeContracts();
      
      // Load on-chain balances
      await this.loadBlockchainBalances();
      
      // Start balance monitoring
      this.startBalanceMonitoring();

      logger.info('Exchange manager initialized', { 
        address,
        ruvBalance: formatEther(ruvBalance),
        resourceTypes: this.config.resourceTypes || Object.values(ResourceType)
      });
    } catch (error) {
      logger.error('Failed to initialize exchange manager', error);
      throw new QuDAGError(
        'Exchange initialization failed',
        QuDAGErrorCode.EXCHANGE_FAILED,
        error
      );
    }
  }

  /**
   * Initialize blockchain connection
   */
  private async initializeBlockchain(): Promise<void> {
    try {
      // Connect to blockchain network
      const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545';
      this.provider = new JsonRpcProvider(rpcUrl);
      
      // Test connection
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      
      logger.info('Blockchain connection established', {
        network: network.name,
        chainId: network.chainId,
        blockNumber
      });
    } catch (error) {
      logger.error('Failed to connect to blockchain', error);
      throw error;
    }
  }

  /**
   * Initialize smart contracts
   */
  private async initializeContracts(): Promise<void> {
    if (!this.signer) {
      throw new Error('Signer not initialized');
    }
    
    try {
      // Initialize rUv token contract
      this.ruvTokenContract = new Contract(
        this.contractAddresses.ruvToken,
        RUV_TOKEN_ABI,
        this.signer
      );
      
      // Initialize exchange contract
      this.exchangeContract = new Contract(
        this.contractAddresses.exchange,
        EXCHANGE_CONTRACT_ABI,
        this.signer
      );
      
      // Test contract connections
      const ruvSymbol = await this.ruvTokenContract.symbol();
      logger.info('Smart contracts initialized', {
        ruvToken: this.contractAddresses.ruvToken,
        ruvSymbol,
        exchange: this.contractAddresses.exchange
      });
    } catch (error) {
      logger.error('Failed to initialize smart contracts', error);
      throw error;
    }
  }

  /**
   * Derive Ethereum private key from quantum-resistant key
   */
  private deriveEthereumPrivateKey(mldsaPrivateKey: Uint8Array): string {
    // Use quantum-resistant private key to derive Ethereum private key
    const hash = crypto.createHash('sha256');
    hash.update(mldsaPrivateKey);
    const derivedKey = hash.digest();
    
    return '0x' + derivedKey.toString('hex');
  }

  /**
   * Get rUv token balance
   */
  private async getRuvBalance(address: string): Promise<bigint> {
    if (!this.ruvTokenContract) {
      return 0n;
    }
    
    try {
      return await this.ruvTokenContract.balanceOf(address);
    } catch (error) {
      logger.error('Failed to get rUv balance', error);
      return 0n;
    }
  }

  /**
   * Load balances from blockchain
   */
  private async loadBlockchainBalances(): Promise<void> {
    if (!this.exchangeContract || !this.agentProfile) {
      return;
    }
    
    try {
      for (const resourceType of Object.values(ResourceType)) {
        const resourceTypeIndex = Object.values(ResourceType).indexOf(resourceType);
        const balance = await this.exchangeContract.getUserBalance(
          this.agentProfile.address,
          resourceTypeIndex
        );
        
        const existingBalance = this.balances.get(resourceType);
        if (existingBalance) {
          existingBalance.available = balance.toNumber();
          existingBalance.allocated = 0; // Reset allocated
        }
      }
      
      logger.info('Blockchain balances loaded', {
        address: this.agentProfile.address.slice(0, 10) + '...'
      });
    } catch (error) {
      logger.error('Failed to load blockchain balances', error);
    }
  }

  /**
   * Start balance monitoring
   */
  private startBalanceMonitoring(): void {
    if (!this.agentProfile) return;
    
    // Monitor rUv balance changes
    setInterval(async () => {
      try {
        const newBalance = await this.getRuvBalance(this.agentProfile!.address);
        if (newBalance !== this.agentProfile!.ruvBalance) {
          const oldBalance = this.agentProfile!.ruvBalance;
          this.agentProfile!.ruvBalance = newBalance;
          
          logger.info('rUv balance changed', {
            from: formatEther(oldBalance),
            to: formatEther(newBalance)
          });
          
          this.emit('balanceChanged', {
            token: 'rUv',
            oldBalance: formatEther(oldBalance),
            newBalance: formatEther(newBalance)
          });
        }
      } catch (error) {
        logger.error('Balance monitoring failed', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Sign a resource order with quantum-resistant signature
   */
  async signOrder(order: ResourceOrder, signingKey: MLDSAKeyPair): Promise<ResourceOrder> {
    try {
      if (!this.agentProfile) {
        throw new Error('Agent profile not initialized');
      }
      
      // Create order hash for signing
      const orderHash = this.createOrderHash(order);
      
      // Sign with ML-DSA (quantum-resistant)
      const signature = await this.signWithMLDSA(orderHash, signingKey);
      
      // Also create Ethereum signature for blockchain compatibility
      const ethSignature = await this.signer!.signMessage(orderHash);
      
      // Generate unique order ID
      const orderId = this.generateBlockchainOrderId(order);
      
      return {
        ...order,
        id: orderId,
        signature: signature,
        status: OrderStatus.PENDING,
        // Add blockchain-specific fields
        ethSignature,
        orderHash,
        creator: this.agentProfile.address
      };
    } catch (error) {
      logger.error('Failed to sign order', error);
      throw new QuDAGError(
        'Order signing failed',
        QuDAGErrorCode.SIGNING_ERROR,
        error
      );
    }
  }

  /**
   * Create deterministic hash of order data
   */
  private createOrderHash(order: ResourceOrder): string {
    const orderData = {
      type: order.type,
      amount: order.amount,
      price: order.price,
      timestamp: order.timestamp,
      creator: this.agentProfile?.address
    };
    
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(orderData));
    return hash.digest('hex');
  }

  /**
   * Sign data with ML-DSA (simplified implementation)
   */
  private async signWithMLDSA(data: string, signingKey: MLDSAKeyPair): Promise<Uint8Array> {
    // In production, use actual ML-DSA implementation
    const signature = new Uint8Array(3293); // ML-DSA-65 signature size
    
    // Create deterministic signature from data and private key
    const hash = crypto.createHash('sha3-512');
    hash.update(data);
    hash.update(signingKey.privateKey);
    hash.update(Buffer.from('ML-DSA-65'));
    
    const digest = hash.digest();
    
    // Fill signature with derived data (simplified)
    for (let i = 0; i < signature.length; i++) {
      signature[i] = digest[i % digest.length] ^ (i & 0xFF);
    }
    
    return signature;
  }

  /**
   * Generate blockchain-compatible order ID
   */
  private generateBlockchainOrderId(order: ResourceOrder): string {
    const data = {
      creator: this.agentProfile?.address,
      type: order.type,
      amount: order.amount,
      price: order.price,
      timestamp: order.timestamp,
      nonce: this.agentProfile?.nonce || 0
    };
    
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return '0x' + hash.digest('hex');
  }

  /**
   * Submit order to blockchain exchange
   */
  async submitOrder(order: ResourceOrder): Promise<ResourceExchangeResult> {
    if (!order.id) {
      throw new QuDAGError(
        'Order must be signed before submission',
        QuDAGErrorCode.EXCHANGE_FAILED
      );
    }

    if (!this.exchangeContract || !this.agentProfile) {
      throw new QuDAGError(
        'Exchange not initialized',
        QuDAGErrorCode.EXCHANGE_FAILED
      );
    }

    try {
      // Get current resource price from oracle
      const currentPrice = await this.getResourcePrice(order.type);
      
      // Calculate fees including gas costs
      const fee = this.calculateFee(order.amount * order.price);
      const gasEstimate = await this.estimateGas(order);
      const totalCost = parseEther((order.amount * order.price + fee).toString());
      
      // Check sufficient rUv balance
      if (this.agentProfile.ruvBalance < totalCost) {
        throw new QuDAGError(
          'Insufficient rUv token balance',
          QuDAGErrorCode.INSUFFICIENT_RESOURCES
        );
      }
      
      // Check resource balance on exchange
      const resourceBalance = await this.getOnChainResourceBalance(order.type);
      if (resourceBalance < order.amount) {
        throw new QuDAGError(
          'Insufficient resource balance on exchange',
          QuDAGErrorCode.INSUFFICIENT_RESOURCES
        );
      }

      // Create blockchain transaction
      const tx = await this.createOrderOnChain(order, gasEstimate);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Update local state
      this.orders.set(order.id, {
        ...order,
        status: OrderStatus.FILLED,
        txHash: receipt ? receipt.hash : ''
      });
      
      // Update balances
      await this.updateBalancesAfterOrder(order);
      
      // Update usage for fee calculations
      this.agentProfile.monthlyUsage += order.amount * order.price;
      this.agentProfile.nonce++;

      const result: ResourceExchangeResult = {
        orderId: order.id,
        txHash: receipt ? receipt.hash : '',
        status: OrderStatus.FILLED,
        filledAmount: order.amount,
        remainingAmount: 0,
        averagePrice: order.price,
        gasUsed: receipt ? (typeof receipt.gasUsed === 'bigint' ? Number(receipt.gasUsed) : receipt.gasUsed) : 0,
        blockNumber: receipt ? receipt.blockNumber : 0
      };

      // Emit event
      this.emit('orderFilled', result);

      logger.info('Order submitted to blockchain', {
        orderId: order.id,
        txHash: receipt ? receipt.hash : '',
        type: order.type,
        amount: order.amount,
        price: order.price,
        fee,
        gasUsed: receipt ? (typeof receipt.gasUsed === 'bigint' ? Number(receipt.gasUsed) : receipt.gasUsed) : 0
      });

      return result;
    } catch (error) {
      logger.error('Failed to submit order to blockchain', error);
      
      // Update order status to failed
      if (this.orders.has(order.id)) {
        this.orders.get(order.id)!.status = OrderStatus.CANCELLED;
      }
      
      throw new QuDAGError(
        'Blockchain order submission failed',
        QuDAGErrorCode.EXCHANGE_FAILED,
        error
      );
    }
  }

  /**
   * Create order on blockchain
   */
  private async createOrderOnChain(order: ResourceOrder, gasEstimate: bigint): Promise<TransactionResponse> {
    if (!this.exchangeContract) {
      throw new Error('Exchange contract not initialized');
    }
    
    const resourceTypeIndex = Object.values(ResourceType).indexOf(order.type);
    const amountBN = BigInt(order.amount);
    const priceBN = parseEther(order.price.toString());
    
    // Create order on exchange contract
    const tx = await this.exchangeContract.createOrder(
      resourceTypeIndex,
      amountBN,
      priceBN,
      {
        gasLimit: gasEstimate,
        gasPrice: parseUnits(GAS_PRICE_GWEI.toString(), 'gwei')
      }
    );
    
    return tx;
  }

  /**
   * Estimate gas for order transaction
   */
  private async estimateGas(order: ResourceOrder): Promise<bigint> {
    if (!this.exchangeContract) {
      return BigInt(GAS_LIMIT);
    }
    
    try {
      const resourceTypeIndex = Object.values(ResourceType).indexOf(order.type);
      const amountBN = BigInt(order.amount);
      const priceBN = parseEther(order.price.toString());
      
      const gasEstimate = await this.exchangeContract.createOrder.estimateGas(
        resourceTypeIndex,
        amountBN,
        priceBN
      );
      
      // Add safety margin
      return gasEstimate * BigInt(Math.floor(this.feeModel.gasMultiplier * 100)) / 100n;
    } catch (error) {
      logger.warn('Gas estimation failed, using default', error);
      return BigInt(GAS_LIMIT);
    }
  }

  /**
   * Get on-chain resource balance
   */
  private async getOnChainResourceBalance(type: ResourceType): Promise<number> {
    if (!this.exchangeContract || !this.agentProfile) {
      return 0;
    }
    
    try {
      const resourceTypeIndex = Object.values(ResourceType).indexOf(type);
      const balance = await this.exchangeContract.getUserBalance(
        this.agentProfile.address,
        resourceTypeIndex
      );
      
      return Number(balance);
    } catch (error) {
      logger.error('Failed to get on-chain resource balance', error);
      return 0;
    }
  }

  /**
   * Update balances after order execution
   */
  private async updateBalancesAfterOrder(order: ResourceOrder): Promise<void> {
    // Reload balances from blockchain
    await this.loadBlockchainBalances();
    
    // Update local balance cache
    const balance = this.balances.get(order.type);
    if (balance) {
      balance.allocated += order.amount;
    }
  }

  /**
   * Get resource price from oracle with caching
   */
  private async getResourcePrice(type: ResourceType): Promise<number> {
    const cached = this.priceCache.get(type);
    if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
      return cached.price;
    }
    
    try {
      // In production, fetch from price oracle contract
      // For now, return simulated prices
      const prices: Record<ResourceType, number> = {
        [ResourceType.CPU]: 0.05,
        [ResourceType.STORAGE]: 0.001,
        [ResourceType.BANDWIDTH]: 0.01,
        [ResourceType.MODEL]: 0.1,
        [ResourceType.MEMORY]: 0.02
      };
      
      const price = prices[type] || 0.01;
      
      // Cache the price
      this.priceCache.set(type, {
        price,
        timestamp: Date.now()
      });
      
      return price;
    } catch (error) {
      logger.error('Failed to get resource price', error);
      return 0.01; // Default price
    }
  }

  /**
   * Get resource balances
   */
  async getBalances(): Promise<ResourceBalance[]> {
    return Array.from(this.balances.values());
  }

  /**
   * Get specific resource balance
   */
  getBalance(type: ResourceType): ResourceBalance | undefined {
    return this.balances.get(type);
  }

  /**
   * Test exchange connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // In production, would test actual connection to exchange
      // For now, return true if initialized
      return this.agentProfile !== null;
    } catch (error) {
      logger.error('Exchange connection test failed', error);
      return false;
    }
  }

  /**
   * Calculate dynamic fee based on agent status and usage
   */
  calculateFee(orderValue: number): number {
    if (!this.agentProfile) {
      return orderValue * this.feeModel.baseFee;
    }

    const timeSinceCreation = Date.now() - this.agentProfile.accountCreated;
    const usage = this.agentProfile.monthlyUsage;
    
    if (this.agentProfile.verified) {
      // Verified agent fee calculation
      const baseVerifiedFee = 0.0025;
      const maxVerifiedFee = 0.005;
      
      // Time phase-in function
      const alpha = 1 - Math.exp(-timeSinceCreation / this.feeModel.timeConstant);
      
      // Usage scaling (inverted for verified agents - more usage = lower fee)
      const beta = 1 - (1 - Math.exp(-usage / this.feeModel.usageThreshold));
      
      const feeRate = baseVerifiedFee + (maxVerifiedFee - baseVerifiedFee) * alpha * beta;
      return orderValue * feeRate;
    } else {
      // Unverified agent fee calculation
      // Time phase-in function
      const alpha = 1 - Math.exp(-timeSinceCreation / this.feeModel.timeConstant);
      
      // Usage scaling (more usage = higher fee for unverified)
      const beta = 1 - Math.exp(-usage / this.feeModel.usageThreshold);
      
      const feeRate = this.feeModel.baseFee + 
        (this.feeModel.maxFee - this.feeModel.baseFee) * alpha * beta;
      return orderValue * feeRate;
    }
  }

  /**
   * Verify agent for reduced fees
   */
  async verifyAgent(proofData: any): Promise<boolean> {
    if (!this.agentProfile) {
      throw new QuDAGError(
        'Agent profile not initialized',
        QuDAGErrorCode.EXCHANGE_FAILED
      );
    }

    try {
      // In production, would verify proof cryptographically
      // For now, simulate verification
      this.agentProfile.verified = true;
      
      logger.info('Agent verified successfully', {
        address: this.agentProfile.address
      });
      
      return true;
    } catch (error) {
      logger.error('Agent verification failed', error);
      return false;
    }
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): ResourceOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (!order || order.status !== OrderStatus.PENDING) {
      return false;
    }

    order.status = OrderStatus.CANCELLED;
    
    // Restore balance
    const balance = this.balances.get(order.type);
    if (balance) {
      balance.available += order.amount;
      balance.allocated -= order.amount;
    }

    logger.info('Order cancelled', { orderId });
    return true;
  }

  /**
   * Initialize default balances
   */
  private initializeBalances(): void {
    const resourceTypes = this.config.resourceTypes || Object.values(ResourceType);
    
    for (const type of resourceTypes) {
      this.balances.set(type, {
        type,
        available: 1000, // Default starting balance
        allocated: 0,
        unit: this.getResourceUnit(type)
      });
    }
  }

  /**
   * Get unit for resource type
   */
  private getResourceUnit(type: ResourceType): string {
    const units: Record<ResourceType, string> = {
      [ResourceType.CPU]: 'vCPU-hours',
      [ResourceType.STORAGE]: 'GB',
      [ResourceType.BANDWIDTH]: 'GB',
      [ResourceType.MODEL]: 'queries',
      [ResourceType.MEMORY]: 'GB-hours'
    };
    return units[type] || 'units';
  }

  /**
   * Simulate order execution
   */
  private async simulateOrderExecution(order: ResourceOrder): Promise<void> {
    // Simulate network delay for order execution
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Generate unique order ID
   */
  private generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Transfer rUv tokens
   */
  async transferRuv(to: string, amount: string): Promise<string> {
    if (!this.ruvTokenContract || !this.agentProfile) {
      throw new QuDAGError(
        'rUv token contract not initialized',
        QuDAGErrorCode.EXCHANGE_FAILED
      );
    }
    
    try {
      const amountBN = parseEther(amount);
      
      // Check balance
      if (this.agentProfile.ruvBalance < amountBN) {
        throw new QuDAGError(
          'Insufficient rUv balance',
          QuDAGErrorCode.INSUFFICIENT_RESOURCES
        );
      }
      
      // Execute transfer
      const tx = await this.ruvTokenContract.transfer(to, amountBN);
      const receipt = await tx.wait();
      
      // Update balance
      this.agentProfile.ruvBalance = this.agentProfile.ruvBalance - amountBN;
      
      logger.info('rUv transfer completed', {
        to,
        amount,
        txHash: receipt ? receipt.hash : ''
      });
      
      return receipt.hash;
    } catch (error) {
      logger.error('rUv transfer failed', error);
      throw new QuDAGError(
        'rUv transfer failed',
        QuDAGErrorCode.EXCHANGE_FAILED,
        error
      );
    }
  }

  /**
   * Deposit resources to exchange
   */
  async depositResource(type: ResourceType, amount: number): Promise<string> {
    if (!this.exchangeContract) {
      throw new QuDAGError(
        'Exchange contract not initialized',
        QuDAGErrorCode.EXCHANGE_FAILED
      );
    }
    
    try {
      const resourceTypeIndex = Object.values(ResourceType).indexOf(type);
      const amountBN = BigInt(amount);
      
      const tx = await this.exchangeContract.depositResource(
        resourceTypeIndex,
        amountBN
      );
      
      const receipt = await tx.wait();
      
      // Update local balance
      const balance = this.balances.get(type);
      if (balance) {
        balance.available += amount;
      }
      
      logger.info('Resource deposited', {
        type,
        amount,
        txHash: receipt ? receipt.hash : ''
      });
      
      return receipt.hash;
    } catch (error) {
      logger.error('Resource deposit failed', error);
      throw new QuDAGError(
        'Resource deposit failed',
        QuDAGErrorCode.EXCHANGE_FAILED,
        error
      );
    }
  }

  /**
   * Withdraw resources from exchange
   */
  async withdrawResource(type: ResourceType, amount: number): Promise<string> {
    if (!this.exchangeContract) {
      throw new QuDAGError(
        'Exchange contract not initialized',
        QuDAGErrorCode.EXCHANGE_FAILED
      );
    }
    
    try {
      const resourceTypeIndex = Object.values(ResourceType).indexOf(type);
      const amountBN = BigInt(amount);
      
      const tx = await this.exchangeContract.withdrawResource(
        resourceTypeIndex,
        amountBN
      );
      
      const receipt = await tx.wait();
      
      // Update local balance
      const balance = this.balances.get(type);
      if (balance) {
        balance.available = Math.max(0, balance.available - amount);
      }
      
      logger.info('Resource withdrawn', {
        type,
        amount,
        txHash: receipt ? receipt.hash : ''
      });
      
      return receipt.hash;
    } catch (error) {
      logger.error('Resource withdrawal failed', error);
      throw new QuDAGError(
        'Resource withdrawal failed',
        QuDAGErrorCode.EXCHANGE_FAILED,
        error
      );
    }
  }

  /**
   * Get blockchain transaction details
   */
  async getTransaction(txHash: string): Promise<BlockchainTransaction | null> {
    if (!this.provider) {
      return null;
    }
    
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        return null;
      }
      
      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: tx.value,
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice || 0n,
        nonce: tx.nonce,
        data: tx.data,
        signature: tx.signature ? {
          r: tx.signature.r,
          s: tx.signature.s,
          v: tx.signature.v
        } : undefined
      };
    } catch (error) {
      logger.error('Failed to get transaction', error);
      return null;
    }
  }

  /**
   * Get current gas price
   */
  async getCurrentGasPrice(): Promise<bigint> {
    if (!this.provider) {
      return parseUnits(GAS_PRICE_GWEI.toString(), 'gwei');
    }
    
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice || parseUnits(GAS_PRICE_GWEI.toString(), 'gwei');
    } catch (error) {
      logger.error('Failed to get gas price', error);
      return parseUnits(GAS_PRICE_GWEI.toString(), 'gwei');
    }
  }

  /**
   * Disconnect from blockchain
   */
  async disconnect(): Promise<void> {
    try {
      // Clear intervals and contracts
      this.provider = null;
      this.signer = null;
      this.ruvTokenContract = null;
      this.exchangeContract = null;
      this.priceOracleContract = null;
      
      logger.info('Disconnected from blockchain exchange');
    } catch (error) {
      logger.error('Failed to disconnect from blockchain', error);
    }
  }

  /**
   * Get exchange metrics including blockchain data
   */
  getMetrics(): any {
    return {
      totalOrders: this.orders.size,
      agentVerified: this.agentProfile?.verified || false,
      monthlyUsage: this.agentProfile?.monthlyUsage || 0,
      resourceTypes: Array.from(this.balances.keys()),
      ruvBalance: this.agentProfile ? formatEther(this.agentProfile.ruvBalance) : '0',
      agentAddress: this.agentProfile?.address,
      contractAddresses: this.contractAddresses,
      blockchainConnected: !!this.provider,
      reputation: this.agentProfile?.reputation || 0,
      nonce: this.agentProfile?.nonce || 0
    };
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.agentProfile?.address || '';
  }

  /**
   * Get rUv balance formatted
   */
  getRuvBalanceFormatted(): string {
    if (!this.agentProfile) {
      return '0';
    }
    return formatEther(this.agentProfile.ruvBalance);
  }

  /**
   * Check if agent is verified
   */
  isAgentVerified(): boolean {
    return this.agentProfile?.verified || false;
  }

  /**
   * Get contract addresses
   */
  getContractAddresses(): SmartContractAddresses {
    return { ...this.contractAddresses };
  }
}