const hre = require("hardhat");

/**
 * Setup and test script for AgentCoin contract
 * This script demonstrates basic functionality after deployment
 */
async function main() {
    console.log("🚀 AgentCoin Setup and Test Script");
    console.log("================================");
    
    // Get signers
    const [owner, user1, user2, feeCollector] = await hre.ethers.getSigners();
    console.log("👤 Owner:", owner.address);
    console.log("👤 User1:", user1.address);
    console.log("👤 User2:", user2.address);
    console.log("👤 Fee Collector:", feeCollector.address);
    
    // Deploy contract
    console.log("\n📦 Deploying AgentCoin...");
    const AgentCoin = await hre.ethers.getContractFactory("AgentCoin");
    const agentCoin = await AgentCoin.deploy(feeCollector.address);
    await agentCoin.deployed();
    console.log("✅ AgentCoin deployed at:", agentCoin.address);
    
    // Test basic token info
    console.log("\n📊 Token Information:");
    console.log("Name:", await agentCoin.name());
    console.log("Symbol:", await agentCoin.symbol());
    console.log("Decimals:", await agentCoin.decimals());
    console.log("Total Supply:", hre.ethers.utils.formatEther(await agentCoin.totalSupply()));
    console.log("Max Supply:", hre.ethers.utils.formatEther(await agentCoin.MAX_SUPPLY()));
    
    // Test basic transfers
    console.log("\n💸 Testing Basic Transfers...");
    const transferAmount = hre.ethers.utils.parseEther("1000");
    await agentCoin.transfer(user1.address, transferAmount);
    console.log("✅ Transferred 1000 AGC to user1");
    console.log("User1 balance:", hre.ethers.utils.formatEther(await agentCoin.balanceOf(user1.address)));
    
    // Test staking
    console.log("\n🏦 Testing Staking...");
    const stakeAmount = hre.ethers.utils.parseEther("500");
    await agentCoin.connect(user1).stake(stakeAmount);
    console.log("✅ User1 staked 500 AGC");
    console.log("User1 staking balance:", hre.ethers.utils.formatEther(await agentCoin.stakingBalance(user1.address)));
    
    // Test reward calculation (after some time)
    console.log("\n⏰ Testing Reward Calculation...");
    // Advance time by 30 days
    await hre.network.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
    await hre.network.provider.send("evm_mine");
    
    const rewards = await agentCoin.calculateRewards(user1.address);
    console.log("📈 Rewards after 30 days:", hre.ethers.utils.formatEther(rewards));
    
    // Test reward claiming
    if (rewards.gt(0)) {
        const balanceBefore = await agentCoin.balanceOf(user1.address);
        await agentCoin.connect(user1).claimRewards();
        const balanceAfter = await agentCoin.balanceOf(user1.address);
        console.log("✅ Rewards claimed:", hre.ethers.utils.formatEther(balanceAfter.sub(balanceBefore)));
    }
    
    // Test minting (as minter)
    console.log("\n🏭 Testing Minting...");
    const MINTER_ROLE = await agentCoin.MINTER_ROLE();
    await agentCoin.grantRole(MINTER_ROLE, owner.address);
    
    const mintAmount = hre.ethers.utils.parseEther("10000");
    await agentCoin.mint(user2.address, mintAmount);
    console.log("✅ Minted 10000 AGC to user2");
    console.log("User2 balance:", hre.ethers.utils.formatEther(await agentCoin.balanceOf(user2.address)));
    
    // Test burning
    console.log("\n🔥 Testing Burning...");
    const burnAmount = hre.ethers.utils.parseEther("100");
    const supplyBefore = await agentCoin.totalSupply();
    await agentCoin.connect(user2).burn(burnAmount);
    const supplyAfter = await agentCoin.totalSupply();
    console.log("✅ Burned 100 AGC");
    console.log("Supply reduction:", hre.ethers.utils.formatEther(supplyBefore.sub(supplyAfter)));
    
    // Test pause functionality
    console.log("\n⏸️ Testing Pause Functionality...");
    await agentCoin.pause();
    console.log("✅ Contract paused");
    
    try {
        await agentCoin.connect(user1).transfer(user2.address, hre.ethers.utils.parseEther("1"));
        console.log("❌ Transfer should have failed");
    } catch (error) {
        console.log("✅ Transfer correctly blocked while paused");
    }
    
    await agentCoin.unpause();
    console.log("✅ Contract unpaused");
    
    // Test fee accumulation
    console.log("\n💰 Testing Fee Accumulation...");
    const feesBefore = await agentCoin.accumulatedFees();
    await agentCoin.connect(user1).transfer(user2.address, hre.ethers.utils.parseEther("100"));
    const feesAfter = await agentCoin.accumulatedFees();
    console.log("Fees accumulated:", hre.ethers.utils.formatEther(feesAfter.sub(feesBefore)));
    
    // Test fee distribution
    if (feesAfter.gt(0)) {
        const collectorBefore = await agentCoin.balanceOf(feeCollector.address);
        await agentCoin.distributeFees();
        const collectorAfter = await agentCoin.balanceOf(feeCollector.address);
        console.log("✅ Fees distributed to collector:", hre.ethers.utils.formatEther(collectorAfter.sub(collectorBefore)));
    }
    
    // Test unstaking
    console.log("\n🏧 Testing Unstaking...");
    const unstakeAmount = hre.ethers.utils.parseEther("250");
    const balanceBefore = await agentCoin.balanceOf(user1.address);
    await agentCoin.connect(user1).unstake(unstakeAmount);
    const balanceAfter = await agentCoin.balanceOf(user1.address);
    console.log("✅ Unstaked 250 AGC with rewards");
    console.log("Balance increase:", hre.ethers.utils.formatEther(balanceAfter.sub(balanceBefore)));
    
    // Final status
    console.log("\n📈 Final Status:");
    console.log("Total Supply:", hre.ethers.utils.formatEther(await agentCoin.totalSupply()));
    console.log("Total Staked:", hre.ethers.utils.formatEther(await agentCoin.totalStaked()));
    console.log("Owner Balance:", hre.ethers.utils.formatEther(await agentCoin.balanceOf(owner.address)));
    console.log("User1 Balance:", hre.ethers.utils.formatEther(await agentCoin.balanceOf(user1.address)));
    console.log("User2 Balance:", hre.ethers.utils.formatEther(await agentCoin.balanceOf(user2.address)));
    console.log("Fee Collector Balance:", hre.ethers.utils.formatEther(await agentCoin.balanceOf(feeCollector.address)));
    
    console.log("\n🎉 All tests completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });