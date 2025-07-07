// Balance tracking and history management

import { ethers, Provider, Contract, formatUnits } from 'ethers';
import { EventEmitter } from 'events';
import { AssetBalance, TokenType, Transaction, WalletStats } from './types';

export class BalanceTracker extends EventEmitter {
  private provider: Provider;
  private balances: Map<string, Map<string, AssetBalance>> = new Map();
  private priceOracle: PriceOracle;
  private updateInterval: NodeJS.Timeout | null = null;
  private trackedAddresses: Set<string> = new Set();

  constructor(provider: Provider) {
    super();
    this.provider = provider;
    this.priceOracle = new PriceOracle();
  }

  /**
   * Start tracking balances for an address
   */
  async trackAddress(address: string, tokens: Array<{
    type: TokenType;
    contractAddress?: string;
    symbol: string;
    decimals: number;
  }>): Promise<void> {
    this.trackedAddresses.add(address);
    
    if (!this.balances.has(address)) {
      this.balances.set(address, new Map());
    }

    // Initial balance fetch
    await this.updateBalances(address, tokens);

    // Start periodic updates if not already running
    if (!this.updateInterval) {
      this.startPeriodicUpdates();
    }

    this.emit('tracking:started', { address, tokens: tokens.length });
  }

  /**
   * Stop tracking an address
   */
  stopTracking(address: string): void {
    this.trackedAddresses.delete(address);
    this.balances.delete(address);
    
    if (this.trackedAddresses.size === 0 && this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.emit('tracking:stopped', { address });
  }

  /**
   * Get current balances for an address
   */
  getBalances(address: string): AssetBalance[] {
    const addressBalances = this.balances.get(address);
    if (!addressBalances) {
      return [];
    }
    return Array.from(addressBalances.values());
  }

  /**
   * Get balance for a specific token
   */
  getTokenBalance(address: string, tokenKey: string): AssetBalance | undefined {
    return this.balances.get(address)?.get(tokenKey);
  }

  /**
   * Update balances for an address
   */
  private async updateBalances(address: string, tokens: Array<{
    type: TokenType;
    contractAddress?: string;
    symbol: string;
    decimals: number;
  }>): Promise<void> {
    const addressBalances = this.balances.get(address) || new Map();
    const updatePromises: Promise<void>[] = [];

    // Always check ETH balance
    updatePromises.push(this.updateETHBalance(address, addressBalances));

    // Check token balances
    for (const token of tokens) {
      if (token.type === TokenType.ETH) continue;
      
      updatePromises.push(
        this.updateTokenBalance(address, token, addressBalances)
      );
    }

    await Promise.all(updatePromises);
    
    // Update USD values
    await this.updateUSDValues(addressBalances);
    
    this.balances.set(address, addressBalances);
    this.emit('balances:updated', { address, count: addressBalances.size });
  }

  /**
   * Update ETH balance
   */
  private async updateETHBalance(
    address: string,
    balances: Map<string, AssetBalance>
  ): Promise<void> {
    try {
      const balance = await this.provider.getBalance(address);
      
      balances.set('ETH', {
        tokenType: TokenType.ETH,
        balance: balance.toString(),
        decimals: 18,
        symbol: 'ETH',
        name: 'Ethereum',
        lastUpdated: new Date()
      });
    } catch (error) {
      this.emit('error', { type: 'eth_balance', address, error });
    }
  }

  /**
   * Update token balance
   */
  private async updateTokenBalance(
    address: string,
    token: {
      type: TokenType;
      contractAddress?: string;
      symbol: string;
      decimals: number;
    },
    balances: Map<string, AssetBalance>
  ): Promise<void> {
    if (!token.contractAddress) return;

    try {
      let balance: string;
      let tokenId: string | undefined;

      switch (token.type) {
        case TokenType.AGC:
        case TokenType.RUV:
        case TokenType.ERC20:
          balance = await this.getERC20Balance(address, token.contractAddress);
          break;

        case TokenType.TASK_NFT:
        case TokenType.ERC721:
          const nftData = await this.getERC721Balance(address, token.contractAddress);
          balance = nftData.balance;
          tokenId = nftData.tokenIds?.[0]; // Store first token ID
          break;

        case TokenType.ERC1155:
          // For ERC1155, we'd need specific token IDs to check
          // This is a simplified implementation
          balance = '0';
          break;

        default:
          return;
      }

      const key = `${token.symbol}-${token.contractAddress}`;
      balances.set(key, {
        tokenType: token.type,
        contractAddress: token.contractAddress,
        tokenId,
        balance,
        decimals: token.decimals,
        symbol: token.symbol,
        name: token.symbol, // Would fetch from contract in production
        lastUpdated: new Date()
      });
    } catch (error) {
      this.emit('error', { type: 'token_balance', address, token, error });
    }
  }

  /**
   * Get ERC20 token balance
   */
  private async getERC20Balance(
    address: string,
    contractAddress: string
  ): Promise<string> {
    const contract = new Contract(
      contractAddress,
      ['function balanceOf(address) view returns (uint256)'],
      this.provider
    );
    
    const balance = await contract.balanceOf(address);
    return balance.toString();
  }

  /**
   * Get ERC721 NFT balance
   */
  private async getERC721Balance(
    address: string,
    contractAddress: string
  ): Promise<{ balance: string; tokenIds?: string[] }> {
    const contract = new Contract(
      contractAddress,
      [
        'function balanceOf(address) view returns (uint256)',
        'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)'
      ],
      this.provider
    );
    
    const balance = await contract.balanceOf(address);
    const tokenIds: string[] = [];
    
    // Get first few token IDs (limit to 10 for performance)
    const count = Math.min(Number(balance), 10);
    for (let i = 0; i < count; i++) {
      try {
        const tokenId = await contract.tokenOfOwnerByIndex(address, i);
        tokenIds.push(tokenId.toString());
      } catch {
        // Some contracts might not implement tokenOfOwnerByIndex
        break;
      }
    }
    
    return { balance: balance.toString(), tokenIds };
  }

  /**
   * Update USD values for all balances
   */
  private async updateUSDValues(
    balances: Map<string, AssetBalance>
  ): Promise<void> {
    const prices = await this.priceOracle.getPrices(
      Array.from(balances.values()).map(b => b.symbol)
    );

    for (const balance of balances.values()) {
      const price = prices[balance.symbol];
      if (price) {
        const amount = formatUnits(balance.balance, balance.decimals);
        balance.usdValue = parseFloat(amount) * price;
      }
    }
  }

  /**
   * Start periodic balance updates
   */
  private startPeriodicUpdates(): void {
    this.updateInterval = setInterval(async () => {
      for (const address of this.trackedAddresses) {
        const tokens = this.getTrackedTokensForAddress(address);
        await this.updateBalances(address, tokens);
      }
    }, 30000); // Update every 30 seconds
  }

  /**
   * Get tracked tokens for an address
   */
  private getTrackedTokensForAddress(address: string): Array<{
    type: TokenType;
    contractAddress?: string;
    symbol: string;
    decimals: number;
  }> {
    const balances = this.balances.get(address);
    if (!balances) return [];

    return Array.from(balances.values()).map(b => ({
      type: b.tokenType,
      contractAddress: b.contractAddress,
      symbol: b.symbol,
      decimals: b.decimals
    }));
  }

  /**
   * Calculate wallet statistics
   */
  calculateStats(address: string, transactions: Transaction[]): WalletStats {
    const balances = this.getBalances(address);
    const totalVolume: Record<TokenType, string> = {} as any;
    
    // Calculate volumes by token type
    for (const tx of transactions) {
      const current = BigInt(totalVolume[tx.tokenType] || '0');
      totalVolume[tx.tokenType] = (current + BigInt(tx.value)).toString();
    }

    // Calculate total USD value
    const totalUsdValue = balances.reduce(
      (sum, balance) => sum + (balance.usdValue || 0),
      0
    );

    // Find last activity
    const lastActivity = transactions.length > 0
      ? new Date(Math.max(...transactions.map(tx => tx.timestamp.getTime())))
      : new Date();

    return {
      totalTransactions: transactions.length,
      totalVolume,
      lastActivity,
      activeAssets: balances.filter(b => BigInt(b.balance) > 0n).length,
      totalUsdValue
    };
  }

  /**
   * Export balance snapshot
   */
  exportSnapshot(address: string): {
    address: string;
    timestamp: Date;
    balances: AssetBalance[];
    totalUsdValue: number;
  } {
    const balances = this.getBalances(address);
    const totalUsdValue = balances.reduce(
      (sum, balance) => sum + (balance.usdValue || 0),
      0
    );

    return {
      address,
      timestamp: new Date(),
      balances,
      totalUsdValue
    };
  }
}

/**
 * Simple price oracle for USD conversions
 */
class PriceOracle {
  private cache: Map<string, { price: number; timestamp: number }> = new Map();
  private cacheLifetime = 300000; // 5 minutes

  async getPrices(symbols: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    const symbolsToFetch: string[] = [];

    // Check cache first
    for (const symbol of symbols) {
      const cached = this.cache.get(symbol);
      if (cached && Date.now() - cached.timestamp < this.cacheLifetime) {
        prices[symbol] = cached.price;
      } else {
        symbolsToFetch.push(symbol);
      }
    }

    // Fetch missing prices
    if (symbolsToFetch.length > 0) {
      // In production, this would call a price API like CoinGecko or Chainlink
      const mockPrices: Record<string, number> = {
        ETH: 2500,
        AGC: 0.15,
        RUV: 0.05,
        TASK_NFT: 10
      };

      for (const symbol of symbolsToFetch) {
        const price = mockPrices[symbol] || 0;
        prices[symbol] = price;
        this.cache.set(symbol, { price, timestamp: Date.now() });
      }
    }

    return prices;
  }
}