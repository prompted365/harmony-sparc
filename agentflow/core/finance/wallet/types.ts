// Wallet system types and interfaces

export enum TokenType {
  AGC = 'AGC',           // Agent Coordination Token
  RUV = 'RUV',           // rUv tokens
  TASK_NFT = 'TASK_NFT', // Task completion NFTs
  ETH = 'ETH',           // Native ETH
  ERC20 = 'ERC20',       // Generic ERC20 tokens
  ERC721 = 'ERC721',     // NFTs
  ERC1155 = 'ERC1155'    // Multi-token standard
}

export interface WalletConfig {
  id: string;
  name: string;
  type: 'hot' | 'cold' | 'hardware';
  encryptionMethod: 'aes-256-gcm' | 'quantum-resistant';
  derivationPath?: string;
  networkId: number;
  rpcUrl: string;
}

export interface AssetBalance {
  tokenType: TokenType;
  contractAddress?: string;
  tokenId?: string; // For NFTs
  balance: string;
  decimals: number;
  symbol: string;
  name: string;
  usdValue?: number;
  lastUpdated: Date;
}

export interface Transaction {
  id: string;
  walletId: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenType: TokenType;
  contractAddress?: string;
  tokenId?: string;
  nonce: number;
  gasPrice: string;
  gasLimit: string;
  gasUsed?: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  blockHash?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SignedTransaction {
  rawTransaction: string;
  hash: string;
  signature: {
    v: string;
    r: string;
    s: string;
  };
}

export interface KeyPair {
  publicKey: string;
  privateKey: string; // Encrypted
  address: string;
  derivationPath?: string;
}

export interface EncryptedWallet {
  id: string;
  encryptedSeed: string;
  encryptedKeys: string;
  salt: string;
  iv: string;
  authTag: string;
  algorithm: string;
  iterations: number;
  keyDerivationFunction: 'pbkdf2' | 'scrypt' | 'argon2';
}

export interface WalletRecovery {
  mnemonic?: string;
  privateKey?: string;
  keystore?: string;
  recoveryShares?: string[]; // For Shamir's secret sharing
}

export interface TransactionRequest {
  from: string;
  to: string;
  value?: string;
  data?: string;
  gasPrice?: string;
  gasLimit?: string;
  nonce?: number;
  tokenType: TokenType;
  contractAddress?: string;
  tokenId?: string;
  chainId?: number;
}

export interface WalletStats {
  totalTransactions: number;
  totalVolume: Record<TokenType, string>;
  lastActivity: Date;
  activeAssets: number;
  totalUsdValue: number;
}

export interface SecurityConfig {
  requireBiometric: boolean;
  require2FA: boolean;
  sessionTimeout: number;
  maxFailedAttempts: number;
  quantumResistant: boolean;
  multisigThreshold?: number;
  multisigSigners?: string[];
}

export interface WalletEvent {
  type: 'created' | 'imported' | 'exported' | 'transaction' | 'balance_update' | 'security_update';
  walletId: string;
  timestamp: Date;
  data: any;
}