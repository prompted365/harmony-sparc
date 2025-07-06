// Multi-asset wallet system exports

// Core wallet components
export { WalletManager } from './wallet-manager';
export { KeyManager } from './key-manager';
export { TransactionManager } from './transaction-manager';
export { BalanceTracker } from './balance-tracker';
export { RecoveryManager } from './recovery-manager';
export { WalletAPI } from './wallet-api';

// Types and interfaces
export * from './types';
export type {
  RecoveryConfig,
  RecoveryAttempt,
  ShamirShare,
  SocialRecoveryRequest
} from './recovery-manager';

// Factory function for easy wallet system setup
import { ethers } from 'ethers';
import { WalletManager } from './wallet-manager';
import { WalletAPI } from './wallet-api';
import { RecoveryManager } from './recovery-manager';
import { SecurityConfig } from './types';

/**
 * Create a complete wallet system instance
 */
export function createWalletSystem(config: {
  rpcUrl: string;
  networkId?: number;
  security?: Partial<SecurityConfig>;
}): {
  manager: WalletManager;
  api: WalletAPI;
  recovery: RecoveryManager;
  provider: ethers.Provider;
} {
  // Create provider
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  
  // Create wallet manager
  const manager = new WalletManager(provider, config.security);
  
  // Create API interface
  const api = new WalletAPI(provider, config.security);
  
  // Create recovery manager
  const recovery = new RecoveryManager(manager['keyManager']);
  
  return {
    manager,
    api,
    recovery,
    provider
  };
}

/**
 * Default configuration for different networks
 */
export const NetworkConfigs = {
  mainnet: {
    rpcUrl: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
    networkId: 1,
    security: {
      requireBiometric: true,
      require2FA: true,
      quantumResistant: true
    }
  },
  polygon: {
    rpcUrl: 'https://polygon-rpc.com',
    networkId: 137,
    security: {
      requireBiometric: false,
      require2FA: true,
      quantumResistant: false
    }
  },
  arbitrum: {
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    networkId: 42161,
    security: {
      requireBiometric: false,
      require2FA: false,
      quantumResistant: true
    }
  },
  optimism: {
    rpcUrl: 'https://mainnet.optimism.io',
    networkId: 10,
    security: {
      requireBiometric: false,
      require2FA: false,
      quantumResistant: true
    }
  },
  testnet: {
    rpcUrl: 'https://goerli.infura.io/v3/YOUR_PROJECT_ID',
    networkId: 5,
    security: {
      requireBiometric: false,
      require2FA: false,
      quantumResistant: false
    }
  }
};

/**
 * Quick setup for common use cases
 */
export class WalletSystemBuilder {
  private config: any = {};
  
  network(network: keyof typeof NetworkConfigs): this {
    this.config = { ...NetworkConfigs[network] };
    return this;
  }
  
  rpcUrl(url: string): this {
    this.config.rpcUrl = url;
    return this;
  }
  
  security(security: Partial<SecurityConfig>): this {
    this.config.security = { ...this.config.security, ...security };
    return this;
  }
  
  quantumResistant(enabled: boolean = true): this {
    this.config.security = { ...this.config.security, quantumResistant: enabled };
    return this;
  }
  
  biometric(enabled: boolean = true): this {
    this.config.security = { ...this.config.security, requireBiometric: enabled };
    return this;
  }
  
  twoFactor(enabled: boolean = true): this {
    this.config.security = { ...this.config.security, require2FA: enabled };
    return this;
  }
  
  build() {
    if (!this.config.rpcUrl) {
      throw new Error('RPC URL is required');
    }
    return createWalletSystem(this.config);
  }
}

/**
 * Example usage:
 * 
 * ```typescript
 * // Simple setup
 * const walletSystem = new WalletSystemBuilder()
 *   .network('mainnet')
 *   .quantumResistant()
 *   .biometric()
 *   .build();
 * 
 * // Custom setup
 * const walletSystem = createWalletSystem({
 *   rpcUrl: 'https://my-custom-node.com',
 *   networkId: 1337,
 *   security: {
 *     requireBiometric: true,
 *     quantumResistant: true
 *   }
 * });
 * 
 * // Create a wallet
 * const wallet = await walletSystem.manager.createWallet(
 *   {
 *     id: 'my-wallet',
 *     name: 'My Wallet',
 *     type: 'hot',
 *     encryptionMethod: 'quantum-resistant',
 *     networkId: 1,
 *     rpcUrl: 'https://mainnet.infura.io/v3/key'
 *   },
 *   'secure-password'
 * );
 * 
 * // Send a transaction
 * const tx = await walletSystem.manager.sendTransaction(
 *   wallet.id,
 *   'secure-password',
 *   {
 *     from: '0x...',
 *     to: '0x...',
 *     value: '1000000000000000000', // 1 ETH
 *     tokenType: TokenType.ETH
 *   }
 * );
 * ```
 */