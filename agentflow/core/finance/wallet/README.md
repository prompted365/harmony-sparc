# Multi-Asset Wallet System

A comprehensive wallet system built for the harmony-sparc project supporting multiple token types including AGC, rUv tokens, and TASK NFTs.

## 🚀 Features

### Core Wallet Management
- **Multi-Asset Support**: ETH, ERC20 (AGC, rUv), ERC721 (TASK NFTs), ERC1155
- **Secure Key Management**: AES-256-GCM encryption with optional quantum-resistant features
- **HD Wallet Support**: Hierarchical Deterministic wallets with BIP44 derivation
- **Transaction Signing**: Support for all major token standards
- **Balance Tracking**: Real-time balance monitoring with USD conversion

### Security Features
- **Encrypted Storage**: All private keys encrypted with user passwords
- **QuDAG Integration**: Quantum-resistant signature support
- **Session Management**: Secure session handling with timeouts
- **Biometric Support**: Optional biometric authentication
- **2FA Support**: Two-factor authentication capability

### Recovery Mechanisms
- **Shamir's Secret Sharing**: Distribute recovery across multiple shares
- **Social Recovery**: Guardian-based recovery system
- **Time Locks**: Delayed recovery for security
- **Multisig Recovery**: Multiple signature requirements

### API Interface
- **REST API**: Complete HTTP API for wallet operations
- **WebSocket Support**: Real-time transaction and balance updates
- **Session Management**: Secure authentication and session handling
- **Gas Estimation**: Automatic gas price optimization

## 📁 File Structure

```
wallet/
├── types.ts              # Type definitions and interfaces
├── key-manager.ts        # Secure key management and encryption
├── transaction-manager.ts # Transaction signing and broadcasting
├── balance-tracker.ts    # Balance monitoring and history
├── wallet-manager.ts     # Main wallet orchestrator
├── wallet-api.ts         # REST API endpoints
├── recovery-manager.ts   # Recovery and backup systems
├── index.ts              # Main exports and factory functions
└── README.md             # This documentation
```

## 🔧 Quick Setup

```typescript
import { WalletSystemBuilder, TokenType } from './wallet';

// Simple setup for mainnet with quantum resistance
const walletSystem = new WalletSystemBuilder()
  .network('mainnet')
  .quantumResistant()
  .biometric()
  .build();

// Create a new wallet
const wallet = await walletSystem.manager.createWallet(
  {
    id: 'my-wallet',
    name: 'My Wallet',
    type: 'hot',
    encryptionMethod: 'quantum-resistant',
    networkId: 1,
    rpcUrl: 'https://mainnet.infura.io/v3/your-key'
  },
  'secure-password'
);

// Send AGC tokens
const tx = await walletSystem.manager.sendTransaction(
  wallet.id,
  'secure-password',
  {
    from: '0x...',
    to: '0x...',
    value: '1000000000000000000', // 1 AGC
    tokenType: TokenType.AGC,
    contractAddress: '0x...' // AGC contract address
  }
);
```

## 🔐 Security Implementation

### Key Management
- **AES-256-GCM**: Industry-standard encryption
- **PBKDF2**: Key derivation with 100,000 iterations
- **Salt & IV**: Unique salt and initialization vector per encryption
- **Auth Tags**: Authenticated encryption for integrity

### Recovery Systems
- **Shamir (k,n)**: Split secrets into n shares, require k to recover
- **Social Recovery**: Trusted guardians with threshold approval
- **Time Locks**: Delays to prevent immediate unauthorized access
- **Multisig**: Multiple signatures required for recovery

### QuDAG Integration
- **Quantum Signatures**: Post-quantum cryptographic signatures
- **Hybrid Mode**: Classical + quantum-resistant signatures
- **Future-Proof**: Ready for quantum computing threats

## 🌐 API Endpoints

### Wallet Management
- `POST /api/wallet/create` - Create new wallet
- `POST /api/wallet/import` - Import existing wallet
- `GET /api/wallet/list` - List all wallets
- `DELETE /api/wallet/:id` - Remove wallet

### Transactions
- `POST /api/wallet/:id/send` - Send transaction
- `GET /api/wallet/:id/transactions` - Get transaction history
- `POST /api/wallet/estimate-gas` - Estimate gas costs

### Balances
- `GET /api/wallet/:id/balances` - Get current balances
- `GET /api/wallet/:id/stats` - Get wallet statistics

### Recovery
- `POST /api/wallet/:id/export` - Export wallet for backup
- `POST /api/wallet/:id/recovery` - Initiate recovery process

## 🎯 Token Support

### Native Tokens
- **ETH**: Native Ethereum
- **MATIC**: Polygon native token
- **Other**: Any EVM-compatible native token

### AGC Ecosystem
- **AGC**: Agent Coordination Token (ERC20)
- **rUv**: rUv utility tokens (ERC20)
- **TASK**: Task completion NFTs (ERC721)

### Standards
- **ERC20**: Standard fungible tokens
- **ERC721**: Non-fungible tokens (NFTs)
- **ERC1155**: Multi-token standard

## 📊 Performance Features

### Optimization
- **Gas Oracle**: Dynamic gas price optimization
- **Batch Operations**: Multiple operations in single transaction
- **Caching**: Balance and price caching
- **Parallel Processing**: Concurrent transaction processing

### Monitoring
- **Real-time Updates**: Live balance and transaction updates
- **Health Checks**: System health monitoring
- **Error Handling**: Comprehensive error management
- **Event Logging**: Detailed event tracking

## 🛠️ Integration Guide

### Smart Contract Integration
The wallet system is designed to work with the Smart Contract Developer's token implementations:
- AGC token contract integration
- rUv token staking mechanisms
- TASK NFT minting and transfers
- Multi-signature wallet contracts

### QuDAG Integration
Quantum-resistant signatures are implemented through:
- Key generation with quantum-safe algorithms
- Signature verification with post-quantum cryptography
- Hybrid classical + quantum-resistant modes
- Future-proof cryptographic primitives

## 🔄 Recovery Scenarios

### Shamir's Secret Sharing
```typescript
// Create 5 shares, require 3 to recover
const shares = await recovery.createRecoveryBackup(walletId, wallet, {
  enableShamirShares: true,
  totalShares: 5,
  sharesThreshold: 3
}, password);

// Recover with 3 shares
const recoveredSeed = await recovery.recoverFromShamirShares(
  walletId,
  [share1, share2, share3],
  password
);
```

### Social Recovery
```typescript
// Setup guardians
const guardians = ['0x123...', '0x456...', '0x789...'];
const requestId = await recovery.initiateSocialRecovery(
  walletId,
  requester,
  guardians
);

// Guardians approve
const result = await recovery.approveSocialRecovery(
  requestId,
  guardianAddress,
  true
);
```

## 📈 Future Enhancements

### Planned Features
- **Hardware Wallet Integration**: Ledger, Trezor support
- **Mobile SDK**: React Native wallet library
- **Browser Extension**: Chrome/Firefox wallet extension
- **DeFi Integration**: Lending, staking, DEX integration
- **Cross-Chain Support**: Bridge to other blockchains

### Research Areas
- **Zero-Knowledge Proofs**: Privacy-preserving transactions
- **Layer 2 Integration**: Optimistic rollups, zk-rollups
- **MEV Protection**: Flashbots integration
- **Advanced Recovery**: Distributed key generation

## 🧪 Testing

```bash
# Run wallet tests
npm test wallet

# Run security tests
npm test wallet:security

# Run integration tests
npm test wallet:integration
```

## 📝 License

This wallet system is part of the harmony-sparc project and follows the project's licensing terms.
