import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';
import { deployContract, setupTestContext, expandTo18Decimals } from '../utils/test-helpers';

export interface TokenFixture {
  sparcToken: Contract;
  governanceToken: Contract;
  stakingToken: Contract;
  owner: SignerWithAddress;
  addr1: SignerWithAddress;
  addr2: SignerWithAddress;
  treasury: SignerWithAddress;
  team: SignerWithAddress;
}

export async function tokenFixture(): Promise<TokenFixture> {
  const { owner, addr1, addr2, addrs } = await setupTestContext();
  const [treasury, team] = addrs;

  // Deploy mock SPARC token
  const MockToken = await ethers.getContractFactory('MockERC20');
  const sparcToken = await MockToken.deploy('SPARC Token', 'SPARC', expandTo18Decimals(1000000));
  await sparcToken.deployed();

  // Deploy governance token
  const governanceToken = await MockToken.deploy('Governance Token', 'GOV', expandTo18Decimals(1000000));
  await governanceToken.deployed();

  // Deploy staking token
  const stakingToken = await MockToken.deploy('Staking Token', 'STAKE', expandTo18Decimals(1000000));
  await stakingToken.deployed();

  // Distribute tokens
  await sparcToken.transfer(addr1.address, expandTo18Decimals(10000));
  await sparcToken.transfer(addr2.address, expandTo18Decimals(10000));
  await sparcToken.transfer(treasury.address, expandTo18Decimals(100000));
  await sparcToken.transfer(team.address, expandTo18Decimals(50000));

  await governanceToken.transfer(addr1.address, expandTo18Decimals(5000));
  await governanceToken.transfer(addr2.address, expandTo18Decimals(5000));

  await stakingToken.transfer(addr1.address, expandTo18Decimals(5000));
  await stakingToken.transfer(addr2.address, expandTo18Decimals(5000));

  return {
    sparcToken,
    governanceToken,
    stakingToken,
    owner,
    addr1,
    addr2,
    treasury,
    team
  };
}

export async function createMockToken(
  name: string,
  symbol: string,
  initialSupply: number = 1000000
): Promise<Contract> {
  const MockToken = await ethers.getContractFactory('MockERC20');
  const token = await MockToken.deploy(name, symbol, expandTo18Decimals(initialSupply));
  await token.deployed();
  return token;
}

export async function createTokenPair(): Promise<{ tokenA: Contract; tokenB: Contract }> {
  const tokenA = await createMockToken('Token A', 'TKA');
  const tokenB = await createMockToken('Token B', 'TKB');
  return { tokenA, tokenB };
}

export async function setupTokenBalances(
  token: Contract,
  recipients: { address: string; amount: number }[]
): Promise<void> {
  for (const { address, amount } of recipients) {
    await token.transfer(address, expandTo18Decimals(amount));
  }
}

export async function approveTokens(
  token: Contract,
  owner: SignerWithAddress,
  spender: string,
  amount: number
): Promise<void> {
  await token.connect(owner).approve(spender, expandTo18Decimals(amount));
}

export const MOCK_ORACLE_PRICES = {
  SPARC: expandTo18Decimals(10), // $10 per SPARC
  ETH: expandTo18Decimals(3000), // $3000 per ETH
  BTC: expandTo18Decimals(60000), // $60000 per BTC
  USDC: expandTo18Decimals(1), // $1 per USDC
  DAI: expandTo18Decimals(1), // $1 per DAI
};

export function createMockPriceFeed(token: string): Contract {
  // This would be replaced with actual price feed mock in real implementation
  return {
    latestRoundData: async () => ({
      roundId: 1,
      answer: MOCK_ORACLE_PRICES[token] || expandTo18Decimals(1),
      startedAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
      answeredInRound: 1
    })
  } as any;
}