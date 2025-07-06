// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IAgentCoin
 * @dev Interface for the AgentCoin (AGC) token with additional functionality
 */
interface IAgentCoin is IERC20 {
    // Events
    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount, uint256 rewards);
    event MintingRateUpdated(uint256 oldRate, uint256 newRate);
    event BurnRateUpdated(uint256 oldRate, uint256 newRate);

    // Structs
    struct StakeInfo {
        uint256 amount;
        uint256 timestamp;
        uint256 rewardsClaimed;
    }

    // Functions
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
    function calculateRewards(address user) external view returns (uint256);
    function claimRewards() external;
    
    // View functions
    function MAX_SUPPLY() external view returns (uint256);
    function mintingRate() external view returns (uint256);
    function burnRate() external view returns (uint256);
    function stakingBalance(address user) external view returns (uint256);
    function getStakeInfo(address user) external view returns (StakeInfo memory);
    
    // Admin functions
    function updateMintingRate(uint256 newRate) external;
    function updateBurnRate(uint256 newRate) external;
    function pause() external;
    function unpause() external;
}