/**
 * Escrow Smart Contract Interface
 * Handles on-chain escrow operations
 */

import { ethers } from 'ethers';
import { EscrowAccount, EscrowStatus } from '../types';

// Escrow contract ABI
const ESCROW_ABI = [
  'function createEscrow(address payee, uint256 amount, uint256 releaseTime, bytes32 conditionHash) external payable returns (uint256)',
  'function releaseEscrow(uint256 escrowId) external',
  'function refundEscrow(uint256 escrowId) external',
  'function getEscrow(uint256 escrowId) external view returns (address, address, uint256, uint256, uint8)',
  'function updateCondition(uint256 escrowId, bytes32 conditionHash, bool met) external',
  'event EscrowCreated(uint256 indexed escrowId, address indexed payer, address indexed payee, uint256 amount)',
  'event EscrowReleased(uint256 indexed escrowId, address indexed payee, uint256 amount)',
  'event EscrowRefunded(uint256 indexed escrowId, address indexed payer, uint256 amount)'
];

export class EscrowContract {
  private contract: ethers.Contract;
  private provider: ethers.Provider;

  constructor(contractAddress: string, provider: ethers.Provider) {
    this.provider = provider;
    this.contract = new ethers.Contract(contractAddress, ESCROW_ABI, provider);
  }

  /**
   * Create escrow on-chain
   */
  async createEscrow(
    wallet: ethers.Wallet,
    payee: string,
    amount: bigint,
    releaseTime: number,
    conditionHash: string = ethers.ZeroHash
  ): Promise<{ escrowId: number; transactionHash: string }> {
    const connectedContract = this.contract.connect(wallet);
    
    const tx = await connectedContract.createEscrow(
      payee,
      amount,
      releaseTime,
      conditionHash,
      { value: amount }
    );

    const receipt = await tx.wait();
    
    // Parse escrow ID from logs
    const escrowCreatedEvent = receipt.logs.find(
      (log: any) => log.topics[0] === ethers.id('EscrowCreated(uint256,address,address,uint256)')
    );
    
    const escrowId = escrowCreatedEvent ? parseInt(escrowCreatedEvent.topics[1], 16) : 0;

    return {
      escrowId,
      transactionHash: tx.hash
    };
  }

  /**
   * Release escrow funds
   */
  async releaseEscrow(
    wallet: ethers.Wallet,
    escrowId: number
  ): Promise<string> {
    const connectedContract = this.contract.connect(wallet);
    const tx = await connectedContract.releaseEscrow(escrowId);
    await tx.wait();
    return tx.hash;
  }

  /**
   * Refund escrow funds
   */
  async refundEscrow(
    wallet: ethers.Wallet,
    escrowId: number
  ): Promise<string> {
    const connectedContract = this.contract.connect(wallet);
    const tx = await connectedContract.refundEscrow(escrowId);
    await tx.wait();
    return tx.hash;
  }

  /**
   * Get escrow details from contract
   */
  async getEscrow(escrowId: number): Promise<{
    payer: string;
    payee: string;
    amount: bigint;
    releaseTime: number;
    status: number;
  }> {
    const result = await this.contract.getEscrow(escrowId);
    return {
      payer: result[0],
      payee: result[1],
      amount: result[2],
      releaseTime: Number(result[3]),
      status: result[4]
    };
  }

  /**
   * Update escrow condition
   */
  async updateCondition(
    wallet: ethers.Wallet,
    escrowId: number,
    conditionHash: string,
    met: boolean
  ): Promise<string> {
    const connectedContract = this.contract.connect(wallet);
    const tx = await connectedContract.updateCondition(escrowId, conditionHash, met);
    await tx.wait();
    return tx.hash;
  }

  /**
   * Listen for escrow events
   */
  onEscrowCreated(callback: (escrowId: number, payer: string, payee: string, amount: bigint) => void): void {
    this.contract.on('EscrowCreated', callback);
  }

  onEscrowReleased(callback: (escrowId: number, payee: string, amount: bigint) => void): void {
    this.contract.on('EscrowReleased', callback);
  }

  onEscrowRefunded(callback: (escrowId: number, payer: string, amount: bigint) => void): void {
    this.contract.on('EscrowRefunded', callback);
  }

  /**
   * Generate condition hash
   */
  static generateConditionHash(conditions: Record<string, any>): string {
    const encoder = new ethers.AbiCoder();
    const encoded = encoder.encode(
      ['string'],
      [JSON.stringify(conditions)]
    );
    return ethers.keccak256(encoded);
  }

  /**
   * Deploy escrow contract
   */
  static async deploy(
    wallet: ethers.Wallet,
    contractBytecode: string
  ): Promise<{ contract: ethers.Contract; address: string }> {
    const factory = new ethers.ContractFactory(ESCROW_ABI, contractBytecode, wallet);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    
    return {
      contract,
      address: await contract.getAddress()
    };
  }
}

/**
 * Escrow contract Solidity source (for reference)
 */
export const ESCROW_CONTRACT_SOURCE = `
pragma solidity ^0.8.0;

contract EscrowContract {
    struct Escrow {
        address payer;
        address payee;
        uint256 amount;
        uint256 releaseTime;
        bytes32 conditionHash;
        bool conditionMet;
        EscrowStatus status;
    }
    
    enum EscrowStatus { Active, Released, Refunded }
    
    mapping(uint256 => Escrow) public escrows;
    uint256 public nextEscrowId;
    
    event EscrowCreated(uint256 indexed escrowId, address indexed payer, address indexed payee, uint256 amount);
    event EscrowReleased(uint256 indexed escrowId, address indexed payee, uint256 amount);
    event EscrowRefunded(uint256 indexed escrowId, address indexed payer, uint256 amount);
    
    function createEscrow(
        address payee,
        uint256 amount,
        uint256 releaseTime,
        bytes32 conditionHash
    ) external payable returns (uint256) {
        require(msg.value == amount, "Amount mismatch");
        require(payee != address(0), "Invalid payee");
        
        uint256 escrowId = nextEscrowId++;
        escrows[escrowId] = Escrow({
            payer: msg.sender,
            payee: payee,
            amount: amount,
            releaseTime: releaseTime,
            conditionHash: conditionHash,
            conditionMet: conditionHash == bytes32(0),
            status: EscrowStatus.Active
        });
        
        emit EscrowCreated(escrowId, msg.sender, payee, amount);
        return escrowId;
    }
    
    function releaseEscrow(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(
            block.timestamp >= escrow.releaseTime || escrow.conditionMet,
            "Release conditions not met"
        );
        
        escrow.status = EscrowStatus.Released;
        payable(escrow.payee).transfer(escrow.amount);
        
        emit EscrowReleased(escrowId, escrow.payee, escrow.amount);
    }
    
    function refundEscrow(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Active, "Escrow not active");
        require(msg.sender == escrow.payer, "Only payer can refund");
        
        escrow.status = EscrowStatus.Refunded;
        payable(escrow.payer).transfer(escrow.amount);
        
        emit EscrowRefunded(escrowId, escrow.payer, escrow.amount);
    }
    
    function updateCondition(
        uint256 escrowId,
        bytes32 conditionHash,
        bool met
    ) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.conditionHash == conditionHash, "Invalid condition hash");
        escrow.conditionMet = met;
    }
    
    function getEscrow(uint256 escrowId) external view returns (
        address payer,
        address payee,
        uint256 amount,
        uint256 releaseTime,
        EscrowStatus status
    ) {
        Escrow storage escrow = escrows[escrowId];
        return (
            escrow.payer,
            escrow.payee,
            escrow.amount,
            escrow.releaseTime,
            escrow.status
        );
    }
}
`;