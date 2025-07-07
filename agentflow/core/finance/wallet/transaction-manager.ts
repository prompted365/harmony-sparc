// Transaction signing and broadcasting

import { ethers, Provider, Wallet, Transaction as EthersTransaction, parseUnits, parseEther, Interface, TransactionRequest as EthersTransactionRequest } from 'ethers';
import { EventEmitter } from 'events';
import {
  Transaction,
  TransactionRequest,
  SignedTransaction,
  TokenType,
  EncryptedWallet
} from './types';
import { KeyManager } from './key-manager';

export class TransactionManager extends EventEmitter {
  private provider: Provider;
  private keyManager: KeyManager;
  private gasOracle: GasOracle;
  private pendingTransactions: Map<string, Transaction> = new Map();

  constructor(
    provider: Provider,
    keyManager: KeyManager
  ) {
    super();
    this.provider = provider;
    this.keyManager = keyManager;
    this.gasOracle = new GasOracle(provider);
    
    // Monitor pending transactions
    this.startTransactionMonitoring();
  }

  /**
   * Prepare and sign a transaction
   */
  async prepareTransaction(
    request: TransactionRequest,
    encryptedWallet: EncryptedWallet,
    password: string
  ): Promise<SignedTransaction> {
    try {
      // Decrypt wallet
      const privateKey = await this.keyManager.decryptKey(
        encryptedWallet.encryptedSeed,
        password,
        encryptedWallet.salt,
        encryptedWallet.iv,
        encryptedWallet.authTag
      );

      const wallet = new Wallet(privateKey, this.provider);

      // Build transaction based on token type
      const tx = await this.buildTransaction(request, wallet);
      
      // Sign transaction
      const signedTx = await wallet.signTransaction(tx);
      const parsedTx = EthersTransaction.from(signedTx);

      this.emit('transaction:signed', {
        hash: parsedTx.hash,
        from: request.from,
        to: request.to,
        tokenType: request.tokenType
      });

      return {
        rawTransaction: signedTx,
        hash: parsedTx.hash!,
        signature: parsedTx.signature ? {
          v: parsedTx.signature!.v.toString(),
          r: parsedTx.signature!.r,
          s: parsedTx.signature!.s
        } : {
          v: '0',
          r: '0x0000000000000000000000000000000000000000000000000000000000000000',
          s: '0x0000000000000000000000000000000000000000000000000000000000000000'
        }
      };
    } catch (error) {
      this.emit('error', { type: 'signing', error, request });
      throw error;
    }
  }

  /**
   * Broadcast a signed transaction
   */
  async broadcastTransaction(
    signedTx: SignedTransaction,
    metadata?: any
  ): Promise<Transaction> {
    try {
      // Send transaction
      const txResponse = await this.provider.broadcastTransaction(signedTx.rawTransaction);
      
      // Create transaction record
      const transaction: Transaction = {
        id: crypto.randomUUID(),
        walletId: metadata?.walletId || '',
        hash: txResponse.hash,
        from: txResponse.from,
        to: txResponse.to!,
        value: txResponse.value.toString(),
        tokenType: metadata?.tokenType || TokenType.ETH,
        contractAddress: metadata?.contractAddress,
        tokenId: metadata?.tokenId,
        nonce: txResponse.nonce,
        gasPrice: txResponse.gasPrice?.toString() || '0',
        gasLimit: txResponse.gasLimit.toString(),
        status: 'pending',
        timestamp: new Date(),
        metadata
      };

      // Track pending transaction
      this.pendingTransactions.set(transaction.hash, transaction);

      this.emit('transaction:broadcasted', transaction);

      // Wait for confirmation
      this.waitForConfirmation(transaction);

      return transaction;
    } catch (error) {
      this.emit('error', { type: 'broadcast', error });
      throw error;
    }
  }

  /**
   * Build transaction based on token type
   */
  private async buildTransaction(
    request: TransactionRequest,
    wallet: Wallet
  ): Promise<EthersTransactionRequest> {
    const baseTransaction: EthersTransactionRequest = {
      from: request.from,
      to: request.to,
      chainId: request.chainId || (await this.provider.getNetwork()).chainId,
      nonce: request.nonce || await this.provider.getTransactionCount(request.from)
    };

    // Get gas price if not provided
    if (!request.gasPrice) {
      const gasData = await this.gasOracle.getOptimalGasPrice();
      baseTransaction.gasPrice = gasData.standard;
    } else {
      baseTransaction.gasPrice = parseUnits(request.gasPrice, 'gwei');
    }

    switch (request.tokenType) {
      case TokenType.ETH:
        return {
          ...baseTransaction,
          value: parseEther(request.value || '0'),
          gasLimit: request.gasLimit || 21000
        };

      case TokenType.AGC:
      case TokenType.RUV:
      case TokenType.ERC20:
        return this.buildERC20Transaction(baseTransaction, request);

      case TokenType.TASK_NFT:
      case TokenType.ERC721:
        return this.buildERC721Transaction(baseTransaction, request);

      case TokenType.ERC1155:
        return this.buildERC1155Transaction(baseTransaction, request);

      default:
        throw new Error(`Unsupported token type: ${request.tokenType}`);
    }
  }

  /**
   * Build ERC20 token transfer transaction
   */
  private async buildERC20Transaction(
    baseTx: EthersTransactionRequest,
    request: TransactionRequest
  ): Promise<EthersTransactionRequest> {
    if (!request.contractAddress) {
      throw new Error('Contract address required for ERC20 transfer');
    }

    const erc20Interface = new Interface([
      'function transfer(address to, uint256 amount) returns (bool)',
      'function approve(address spender, uint256 amount) returns (bool)'
    ]);

    const data = erc20Interface.encodeFunctionData('transfer', [
      request.to,
      parseUnits(request.value || '0', 18) // Assuming 18 decimals
    ]);

    return {
      ...baseTx,
      to: request.contractAddress,
      data,
      gasLimit: request.gasLimit || 100000
    };
  }

  /**
   * Build ERC721 NFT transfer transaction
   */
  private async buildERC721Transaction(
    baseTx: EthersTransactionRequest,
    request: TransactionRequest
  ): Promise<EthersTransactionRequest> {
    if (!request.contractAddress || !request.tokenId) {
      throw new Error('Contract address and token ID required for NFT transfer');
    }

    const erc721Interface = new Interface([
      'function safeTransferFrom(address from, address to, uint256 tokenId) external',
      'function transferFrom(address from, address to, uint256 tokenId) external'
    ]);

    const data = erc721Interface.encodeFunctionData('safeTransferFrom', [
      request.from,
      request.to,
      request.tokenId
    ]);

    return {
      ...baseTx,
      to: request.contractAddress,
      data,
      gasLimit: request.gasLimit || 150000
    };
  }

  /**
   * Build ERC1155 multi-token transfer transaction
   */
  private async buildERC1155Transaction(
    baseTx: EthersTransactionRequest,
    request: TransactionRequest
  ): Promise<EthersTransactionRequest> {
    if (!request.contractAddress || !request.tokenId) {
      throw new Error('Contract address and token ID required for ERC1155 transfer');
    }

    const erc1155Interface = new Interface([
      'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external'
    ]);

    const data = erc1155Interface.encodeFunctionData('safeTransferFrom', [
      request.from,
      request.to,
      request.tokenId,
      request.value || '1',
      '0x'
    ]);

    return {
      ...baseTx,
      to: request.contractAddress,
      data,
      gasLimit: request.gasLimit || 200000
    };
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForConfirmation(transaction: Transaction): Promise<void> {
    try {
      const receipt = await this.provider.waitForTransaction(transaction.hash, 1);
      
      if (receipt) {
        transaction.status = receipt.status === 1 ? 'confirmed' : 'failed';
        transaction.blockNumber = receipt.blockNumber;
        transaction.blockHash = receipt.blockHash;
        transaction.gasUsed = receipt.gasUsed.toString();

        this.pendingTransactions.delete(transaction.hash);
        this.emit('transaction:confirmed', transaction);
      }
    } catch (error) {
      transaction.status = 'failed';
      this.pendingTransactions.delete(transaction.hash);
      this.emit('transaction:failed', { transaction, error });
    }
  }

  /**
   * Monitor pending transactions
   */
  private startTransactionMonitoring(): void {
    setInterval(async () => {
      for (const [hash, tx] of this.pendingTransactions) {
        try {
          const receipt = await this.provider.getTransactionReceipt(hash);
          if (receipt) {
            tx.status = receipt.status === 1 ? 'confirmed' : 'failed';
            tx.blockNumber = receipt.blockNumber;
            tx.gasUsed = receipt.gasUsed.toString();
            
            this.pendingTransactions.delete(hash);
            this.emit('transaction:update', tx);
          }
        } catch (error) {
          // Transaction might not be found yet
        }
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Cancel a pending transaction by sending a new one with same nonce
   */
  async cancelTransaction(
    txHash: string,
    encryptedWallet: EncryptedWallet,
    password: string
  ): Promise<SignedTransaction> {
    const pendingTx = this.pendingTransactions.get(txHash);
    if (!pendingTx) {
      throw new Error('Transaction not found or already confirmed');
    }

    // Create a cancel transaction with same nonce but higher gas price
    const cancelRequest: TransactionRequest = {
      from: pendingTx.from,
      to: pendingTx.from, // Send to self
      value: '0',
      nonce: pendingTx.nonce,
      gasPrice: (BigInt(pendingTx.gasPrice) * 150n / 100n).toString(), // 50% higher
      gasLimit: '21000',
      tokenType: TokenType.ETH
    };

    return this.prepareTransaction(cancelRequest, encryptedWallet, password);
  }

  /**
   * Get transaction history for an address
   */
  async getTransactionHistory(
    address: string,
    tokenType?: TokenType,
    limit: number = 100
  ): Promise<Transaction[]> {
    // In production, this would query a transaction indexer or blockchain explorer API
    // For now, return empty array
    this.emit('history:requested', { address, tokenType, limit });
    return [];
  }
}

/**
 * Gas price oracle for optimal gas pricing
 */
class GasOracle {
  private provider: Provider;
  private cache: {
    timestamp: number;
    data: any;
  } | null = null;
  private cacheLifetime = 30000; // 30 seconds

  constructor(provider: Provider) {
    this.provider = provider;
  }

  async getOptimalGasPrice(): Promise<{
    slow: bigint;
    standard: bigint;
    fast: bigint;
    instant: bigint;
  }> {
    // Check cache
    if (this.cache && Date.now() - this.cache.timestamp < this.cacheLifetime) {
      return this.cache.data;
    }

    try {
      const feeData = await this.provider.getFeeData();
      const basePrice = feeData.gasPrice || parseUnits('20', 'gwei');

      const data = {
        slow: basePrice * 80n / 100n,      // 80% of base
        standard: basePrice,                // 100% of base
        fast: basePrice * 120n / 100n,      // 120% of base
        instant: basePrice * 150n / 100n    // 150% of base
      };

      this.cache = {
        timestamp: Date.now(),
        data
      };

      return data;
    } catch (error) {
      // Fallback prices
      return {
        slow: parseUnits('10', 'gwei'),
        standard: parseUnits('20', 'gwei'),
        fast: parseUnits('30', 'gwei'),
        instant: parseUnits('50', 'gwei')
      };
    }
  }
}