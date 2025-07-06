import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, BigNumber } from 'ethers';
import { expect } from 'chai';

export interface TestContext {
  owner: SignerWithAddress;
  addr1: SignerWithAddress;
  addr2: SignerWithAddress;
  addrs: SignerWithAddress[];
}

export async function setupTestContext(): Promise<TestContext> {
  const [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
  return { owner, addr1, addr2, addrs };
}

export async function deployContract<T extends Contract>(
  contractName: string,
  args: any[] = []
): Promise<T> {
  const Contract = await ethers.getContractFactory(contractName);
  const contract = await Contract.deploy(...args);
  await contract.deployed();
  return contract as T;
}

export async function advanceTime(seconds: number): Promise<void> {
  await ethers.provider.send('evm_increaseTime', [seconds]);
  await ethers.provider.send('evm_mine', []);
}

export async function advanceBlocks(numberOfBlocks: number): Promise<void> {
  for (let i = 0; i < numberOfBlocks; i++) {
    await ethers.provider.send('evm_mine', []);
  }
}

export async function getBlockTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock('latest');
  return block.timestamp;
}

export async function takeSnapshot(): Promise<string> {
  const snapshotId = await ethers.provider.send('evm_snapshot', []);
  return snapshotId;
}

export async function revertToSnapshot(snapshotId: string): Promise<void> {
  await ethers.provider.send('evm_revert', [snapshotId]);
}

export function expandTo18Decimals(n: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}

export function expandToDecimals(n: number, decimals: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(decimals));
}

export async function mineBlock(): Promise<void> {
  await ethers.provider.send('evm_mine', []);
}

export async function setBalance(address: string, balance: BigNumber): Promise<void> {
  await ethers.provider.send('hardhat_setBalance', [
    address,
    ethers.utils.hexStripZeros(balance.toHexString())
  ]);
}

export async function impersonateAccount(address: string): Promise<SignerWithAddress> {
  await ethers.provider.send('hardhat_impersonateAccount', [address]);
  return await ethers.getSigner(address);
}

export async function stopImpersonatingAccount(address: string): Promise<void> {
  await ethers.provider.send('hardhat_stopImpersonatingAccount', [address]);
}

export function expectEvent(
  receipt: any,
  eventName: string,
  expectedArgs?: { [key: string]: any }
): void {
  const event = receipt.events?.find((e: any) => e.event === eventName);
  expect(event).to.exist;
  
  if (expectedArgs) {
    Object.keys(expectedArgs).forEach(key => {
      expect(event.args[key]).to.equal(expectedArgs[key]);
    });
  }
}

export async function expectRevert(
  promise: Promise<any>,
  expectedError: string
): Promise<void> {
  try {
    await promise;
    expect.fail('Expected transaction to revert');
  } catch (error: any) {
    expect(error.message).to.include(expectedError);
  }
}

export function compareBigNumbers(
  actual: BigNumber,
  expected: BigNumber,
  tolerance: number = 1
): void {
  const diff = actual.sub(expected).abs();
  expect(diff.lte(tolerance)).to.be.true;
}

export async function getCurrentBlock(): Promise<number> {
  return await ethers.provider.getBlockNumber();
}

export async function getTransactionGasCost(txHash: string): Promise<BigNumber> {
  const tx = await ethers.provider.getTransaction(txHash);
  const receipt = await ethers.provider.getTransactionReceipt(txHash);
  return tx.gasPrice!.mul(receipt.gasUsed);
}

export class TestFixture<T> {
  private snapshot: string | null = null;
  private fixture: T | null = null;

  constructor(private setupFn: () => Promise<T>) {}

  async setup(): Promise<T> {
    if (this.snapshot) {
      await revertToSnapshot(this.snapshot);
      this.snapshot = await takeSnapshot();
      return this.fixture!;
    }

    this.fixture = await this.setupFn();
    this.snapshot = await takeSnapshot();
    return this.fixture;
  }
}

export function createTestSuite(name: string, tests: () => void): void {
  describe(name, () => {
    let snapshotId: string;

    beforeEach(async () => {
      snapshotId = await takeSnapshot();
    });

    afterEach(async () => {
      await revertToSnapshot(snapshotId);
    });

    tests();
  });
}