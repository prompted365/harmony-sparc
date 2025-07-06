# AgentCoin Smart Contract

This directory contains the implementation of the AgentCoin (AGC) ERC20 token smart contract with advanced features for the AgentFlow platform.

## Overview

AgentCoin is the primary utility token for the AgentFlow ecosystem, designed to facilitate value exchange between humans and AI agents. The contract implements:

- **ERC20 Standard**: Full compliance with ERC20 interface
- **Minting & Burning**: Controlled token supply management
- **Staking System**: Earn rewards for holding and staking AGC
- **Fee Distribution**: Automatic fee collection and distribution
- **Role-Based Access Control**: Secure admin functions
- **Pausable**: Emergency stop functionality

## Contract Architecture

### Core Features

1. **Token Basics**
   - Name: AgentCoin
   - Symbol: AGC
   - Decimals: 18
   - Initial Supply: 1,000,000,000 AGC
   - Max Supply: 10,000,000,000 AGC

2. **Economic Parameters**
   - Minting Rate: 2% annually (200 basis points)
   - Burn Rate: 0.1% per transaction (10 basis points)
   - Staking APY: 5% (500 basis points)
   - Minimum Stake: 100 AGC

3. **Roles & Permissions**
   - `DEFAULT_ADMIN_ROLE`: Contract administration
   - `MINTER_ROLE`: Can mint new tokens
   - `BURNER_ROLE`: Can burn tokens
   - `PAUSER_ROLE`: Can pause/unpause contract
   - `RATE_ADMIN_ROLE`: Can update economic parameters

### Security Features

- **Reentrancy Protection**: Guards against reentrancy attacks
- **Pausable**: Can be paused in emergency situations
- **Access Control**: Role-based permissions for sensitive functions
- **Safe Math**: Built-in overflow protection (Solidity 0.8+)
- **Fee Limits**: Maximum rate limits to prevent economic attacks

## Deployment

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

### Deploy to Local Network

1. Start local Hardhat node:
   ```bash
   npm run node
   ```

2. Deploy contract:
   ```bash
   npm run deploy:local
   ```

### Deploy to Testnets

- **Goerli**: `npm run deploy:goerli`
- **Sepolia**: `npm run deploy:sepolia`
- **Mumbai**: `npm run deploy:mumbai`

### Contract Verification

The deployment script automatically verifies contracts on Etherscan and other block explorers using the configured API keys.

## Testing

### Run All Tests

```bash
npm run test:contracts
```

### Test Coverage

```bash
npm run coverage
```

### Test Categories

- **Deployment Tests**: Initial state and configuration
- **Minting Tests**: Token creation with role permissions
- **Burning Tests**: Token destruction and supply reduction
- **Staking Tests**: Stake, unstake, and reward calculations
- **Transfer Tests**: Fee application and burning mechanism
- **Admin Tests**: Rate updates and role management
- **Security Tests**: Pause functionality and access control

## Usage Examples

### Basic Token Operations

```solidity
// Transfer tokens
agentCoin.transfer(recipient, amount);

// Approve spending
agentCoin.approve(spender, amount);

// Check balance
uint256 balance = agentCoin.balanceOf(account);
```

### Staking Operations

```solidity
// Stake tokens
agentCoin.stake(1000 * 10**18); // Stake 1000 AGC

// Calculate rewards
uint256 rewards = agentCoin.calculateRewards(account);

// Claim rewards
agentCoin.claimRewards();

// Unstake tokens
agentCoin.unstake(500 * 10**18); // Unstake 500 AGC
```

### Admin Operations

```solidity
// Update minting rate (admin only)
agentCoin.updateMintingRate(300); // 3% annual

// Update burn rate (admin only)
agentCoin.updateBurnRate(20); // 0.2% per transaction

// Pause contract (pauser only)
agentCoin.pause();

// Unpause contract (pauser only)
agentCoin.unpause();
```

## Integration with AgentFlow

### Fee Distribution

The contract automatically collects fees from transactions and distributes them to the fee collector address. This supports the platform's economic model by:

- Funding development and maintenance
- Providing liquidity incentives
- Supporting agent rewards pool

### Staking Integration

Staking provides additional utility by:

- Earning passive income for holders
- Reducing circulating supply
- Increasing token value through scarcity
- Providing governance weight (future feature)

## Security Considerations

### Auditing

Before mainnet deployment, the contract should undergo:

1. **Static Analysis**: Using tools like Slither or Mythril
2. **Formal Verification**: Mathematical proof of correctness
3. **Professional Audit**: Third-party security review
4. **Bug Bounty**: Community-driven security testing

### Risk Mitigation

- **Rate Limits**: Economic parameters have maximum values
- **Emergency Pause**: Can stop contract operations if needed
- **Upgrade Path**: Consider using proxy patterns for upgrades
- **Monitoring**: Track contract metrics and unusual activity

## Gas Optimization

The contract is optimized for gas efficiency:

- **Batch Operations**: Multiple stakes/unstakes in single transaction
- **Packed Structs**: Efficient storage layout
- **View Functions**: Off-chain calculations where possible
- **Event Optimization**: Minimal data in events

## Deployment Addresses

After deployment, addresses will be recorded in:
- `deployments/localhost-agentcoin.json`
- `deployments/goerli-agentcoin.json`
- `deployments/sepolia-agentcoin.json`
- `deployments/mumbai-agentcoin.json`

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## License

MIT License - see LICENSE file for details.