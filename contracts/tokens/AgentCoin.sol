// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IAgentCoin.sol";

/**
 * @title AgentCoin
 * @dev Implementation of the AgentCoin (AGC) token with staking, minting, and burning functionality
 */
contract AgentCoin is IAgentCoin, ERC20, ERC20Burnable, Pausable, AccessControl, ReentrancyGuard {
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion AGC
    uint256 public constant MAX_SUPPLY = 10_000_000_000 * 10**18; // 10 billion AGC
    uint256 public constant BASIS_POINTS = 10000; // 100% = 10000 basis points
    
    // Role definitions
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant RATE_ADMIN_ROLE = keccak256("RATE_ADMIN_ROLE");
    
    // State variables
    uint256 public mintingRate = 200; // 2% annual inflation (200 basis points)
    uint256 public burnRate = 10; // 0.1% per transaction (10 basis points)
    uint256 public lastMintTimestamp;
    
    // Staking variables
    mapping(address => StakeInfo) private stakes;
    uint256 public totalStaked;
    uint256 public stakingRewardRate = 500; // 5% APY (500 basis points)
    uint256 public minimumStakeAmount = 100 * 10**18; // 100 AGC minimum stake
    
    // Fee distribution
    address public feeCollector;
    uint256 public accumulatedFees;
    
    constructor(address _feeCollector) ERC20("AgentCoin", "AGC") {
        require(_feeCollector != address(0), "Invalid fee collector");
        
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(RATE_ADMIN_ROLE, msg.sender);
        
        // Initialize state
        feeCollector = _feeCollector;
        lastMintTimestamp = block.timestamp;
        
        // Mint initial supply
        _mint(msg.sender, INITIAL_SUPPLY);
    }
    
    /**
     * @dev Mint new tokens
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external override onlyRole(MINTER_ROLE) whenNotPaused {
        require(to != address(0), "Mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        
        _mint(to, amount);
        emit Minted(to, amount);
    }
    
    /**
     * @dev Burn tokens
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) public override(ERC20Burnable, IAgentCoin) whenNotPaused {
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }
    
    /**
     * @dev Stake tokens
     * @param amount Amount of tokens to stake
     */
    function stake(uint256 amount) external override nonReentrant whenNotPaused {
        require(amount >= minimumStakeAmount, "Below minimum stake amount");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Calculate and distribute pending rewards before updating stake
        if (stakes[msg.sender].amount > 0) {
            uint256 pendingRewards = calculateRewards(msg.sender);
            if (pendingRewards > 0) {
                _mint(msg.sender, pendingRewards);
                stakes[msg.sender].rewardsClaimed += pendingRewards;
            }
        }
        
        // Update stake
        _transfer(msg.sender, address(this), amount);
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].timestamp = block.timestamp;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    /**
     * @dev Unstake tokens
     * @param amount Amount of tokens to unstake
     */
    function unstake(uint256 amount) external override nonReentrant whenNotPaused {
        require(amount > 0, "Invalid amount");
        require(stakes[msg.sender].amount >= amount, "Insufficient staked balance");
        
        // Calculate rewards
        uint256 rewards = calculateRewards(msg.sender);
        
        // Update stake
        stakes[msg.sender].amount -= amount;
        totalStaked -= amount;
        
        // Transfer unstaked amount back to user
        _transfer(address(this), msg.sender, amount);
        
        // Mint and transfer rewards
        if (rewards > 0) {
            _mint(msg.sender, rewards);
            stakes[msg.sender].rewardsClaimed += rewards;
        }
        
        // Update timestamp
        stakes[msg.sender].timestamp = block.timestamp;
        
        emit Unstaked(msg.sender, amount, rewards);
    }
    
    /**
     * @dev Calculate staking rewards for a user
     * @param user Address of the user
     * @return rewards Amount of rewards earned
     */
    function calculateRewards(address user) public view override returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        if (userStake.amount == 0) {
            return 0;
        }
        
        uint256 timeStaked = block.timestamp - userStake.timestamp;
        uint256 rewards = (userStake.amount * stakingRewardRate * timeStaked) / (BASIS_POINTS * 365 days);
        
        return rewards;
    }
    
    /**
     * @dev Claim staking rewards
     */
    function claimRewards() external override nonReentrant whenNotPaused {
        uint256 rewards = calculateRewards(msg.sender);
        require(rewards > 0, "No rewards to claim");
        
        // Update timestamp and claimed rewards
        stakes[msg.sender].timestamp = block.timestamp;
        stakes[msg.sender].rewardsClaimed += rewards;
        
        // Mint rewards
        _mint(msg.sender, rewards);
        
        emit Transfer(address(0), msg.sender, rewards);
    }
    
    /**
     * @dev Get staking balance for a user
     * @param user Address of the user
     * @return Staked balance
     */
    function stakingBalance(address user) external view override returns (uint256) {
        return stakes[user].amount;
    }
    
    /**
     * @dev Get stake info for a user
     * @param user Address of the user
     * @return StakeInfo struct
     */
    function getStakeInfo(address user) external view override returns (StakeInfo memory) {
        return stakes[user];
    }
    
    /**
     * @dev Update minting rate
     * @param newRate New minting rate in basis points
     */
    function updateMintingRate(uint256 newRate) external override onlyRole(RATE_ADMIN_ROLE) {
        require(newRate <= 1000, "Rate too high"); // Max 10% inflation
        uint256 oldRate = mintingRate;
        mintingRate = newRate;
        emit MintingRateUpdated(oldRate, newRate);
    }
    
    /**
     * @dev Update burn rate
     * @param newRate New burn rate in basis points
     */
    function updateBurnRate(uint256 newRate) external override onlyRole(RATE_ADMIN_ROLE) {
        require(newRate <= 100, "Rate too high"); // Max 1% burn rate
        uint256 oldRate = burnRate;
        burnRate = newRate;
        emit BurnRateUpdated(oldRate, newRate);
    }
    
    /**
     * @dev Update staking reward rate
     * @param newRate New staking reward rate in basis points
     */
    function updateStakingRewardRate(uint256 newRate) external onlyRole(RATE_ADMIN_ROLE) {
        require(newRate <= 2000, "Rate too high"); // Max 20% APY
        stakingRewardRate = newRate;
    }
    
    /**
     * @dev Update fee collector address
     * @param newCollector New fee collector address
     */
    function updateFeeCollector(address newCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newCollector != address(0), "Invalid collector address");
        feeCollector = newCollector;
    }
    
    /**
     * @dev Distribute accumulated fees
     */
    function distributeFees() external {
        require(accumulatedFees > 0, "No fees to distribute");
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        _transfer(address(this), feeCollector, amount);
    }
    
    /**
     * @dev Pause the contract
     */
    function pause() external override onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause the contract
     */
    function unpause() external override onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Hook that is called before any transfer of tokens
     * Implements burn fee mechanism
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
        
        // Apply burn fee on transfers (excluding minting and burning)
        if (from != address(0) && to != address(0) && burnRate > 0) {
            uint256 burnAmount = (amount * burnRate) / BASIS_POINTS;
            if (burnAmount > 0) {
                _burn(from, burnAmount);
                
                // Send half of burn fee to fee collector
                uint256 feeAmount = burnAmount / 2;
                if (feeAmount > 0) {
                    _mint(address(this), feeAmount);
                    accumulatedFees += feeAmount;
                }
            }
        }
    }
    
    /**
     * @dev Returns the maximum supply constant
     */
    function MAX_SUPPLY() external pure override returns (uint256) {
        return MAX_SUPPLY;
    }
    
    /**
     * @dev Returns the current minting rate
     */
    function mintingRate() external view override returns (uint256) {
        return mintingRate;
    }
    
    /**
     * @dev Returns the current burn rate
     */
    function burnRate() external view override returns (uint256) {
        return burnRate;
    }
}