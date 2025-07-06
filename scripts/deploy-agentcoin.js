const hre = require("hardhat");

async function main() {
    console.log("Deploying AgentCoin contract...");
    
    // Get the deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());
    
    // Set the fee collector address (can be updated later)
    const feeCollector = deployer.address; // For testnet, use deployer as fee collector
    
    // Deploy AgentCoin
    const AgentCoin = await hre.ethers.getContractFactory("AgentCoin");
    const agentCoin = await AgentCoin.deploy(feeCollector);
    await agentCoin.deployed();
    
    console.log("AgentCoin deployed to:", agentCoin.address);
    console.log("Fee collector address:", feeCollector);
    
    // Wait for block confirmations
    console.log("Waiting for block confirmations...");
    await agentCoin.deployTransaction.wait(5);
    
    // Verify contract on Etherscan (if not on localhost)
    if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
        console.log("Verifying contract on Etherscan...");
        try {
            await hre.run("verify:verify", {
                address: agentCoin.address,
                constructorArguments: [feeCollector],
            });
            console.log("Contract verified successfully");
        } catch (error) {
            console.error("Error verifying contract:", error);
        }
    }
    
    // Display initial configuration
    console.log("\n=== Initial Configuration ===");
    console.log("Token name:", await agentCoin.name());
    console.log("Token symbol:", await agentCoin.symbol());
    console.log("Total supply:", hre.ethers.utils.formatEther(await agentCoin.totalSupply()));
    console.log("Max supply:", hre.ethers.utils.formatEther(await agentCoin.MAX_SUPPLY()));
    console.log("Minting rate:", (await agentCoin.mintingRate()).toString(), "basis points");
    console.log("Burn rate:", (await agentCoin.burnRate()).toString(), "basis points");
    
    // Grant roles to specific addresses if needed (example)
    if (process.env.MINTER_ADDRESS) {
        const MINTER_ROLE = await agentCoin.MINTER_ROLE();
        await agentCoin.grantRole(MINTER_ROLE, process.env.MINTER_ADDRESS);
        console.log("Minter role granted to:", process.env.MINTER_ADDRESS);
    }
    
    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        agentCoin: agentCoin.address,
        feeCollector: feeCollector,
        deployer: deployer.address,
        deploymentBlock: agentCoin.deployTransaction.blockNumber,
        timestamp: new Date().toISOString()
    };
    
    const fs = require("fs");
    const path = require("path");
    const deploymentsDir = path.join(__dirname, "../deployments");
    
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    fs.writeFileSync(
        path.join(deploymentsDir, `${hre.network.name}-agentcoin.json`),
        JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log("\nDeployment info saved to:", `deployments/${hre.network.name}-agentcoin.json`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });