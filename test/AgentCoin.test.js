const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AgentCoin", function () {
    let agentCoin;
    let owner;
    let addr1;
    let addr2;
    let feeCollector;
    let minter;
    let burner;
    
    const INITIAL_SUPPLY = ethers.utils.parseEther("1000000000"); // 1 billion
    const MAX_SUPPLY = ethers.utils.parseEther("10000000000"); // 10 billion
    const BASIS_POINTS = 10000;
    
    beforeEach(async function () {
        [owner, addr1, addr2, feeCollector, minter, burner] = await ethers.getSigners();
        
        const AgentCoin = await ethers.getContractFactory("AgentCoin");
        agentCoin = await AgentCoin.deploy(feeCollector.address);
        await agentCoin.deployed();
        
        // Grant roles
        const MINTER_ROLE = await agentCoin.MINTER_ROLE();
        const BURNER_ROLE = await agentCoin.BURNER_ROLE();
        await agentCoin.grantRole(MINTER_ROLE, minter.address);
        await agentCoin.grantRole(BURNER_ROLE, burner.address);
    });
    
    describe("Deployment", function () {
        it("Should set the right token name and symbol", async function () {
            expect(await agentCoin.name()).to.equal("AgentCoin");
            expect(await agentCoin.symbol()).to.equal("AGC");
        });
        
        it("Should mint initial supply to owner", async function () {
            expect(await agentCoin.totalSupply()).to.equal(INITIAL_SUPPLY);
            expect(await agentCoin.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
        });
        
        it("Should set correct max supply", async function () {
            expect(await agentCoin.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
        });
        
        it("Should set correct initial rates", async function () {
            expect(await agentCoin.mintingRate()).to.equal(200); // 2%
            expect(await agentCoin.burnRate()).to.equal(10); // 0.1%
        });
        
        it("Should assign roles correctly", async function () {
            const DEFAULT_ADMIN_ROLE = await agentCoin.DEFAULT_ADMIN_ROLE();
            const MINTER_ROLE = await agentCoin.MINTER_ROLE();
            
            expect(await agentCoin.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await agentCoin.hasRole(MINTER_ROLE, minter.address)).to.be.true;
        });
    });
    
    describe("Minting", function () {
        it("Should allow minter to mint tokens", async function () {
            const mintAmount = ethers.utils.parseEther("1000");
            await agentCoin.connect(minter).mint(addr1.address, mintAmount);
            expect(await agentCoin.balanceOf(addr1.address)).to.equal(mintAmount);
        });
        
        it("Should not allow non-minter to mint", async function () {
            const mintAmount = ethers.utils.parseEther("1000");
            await expect(
                agentCoin.connect(addr1).mint(addr1.address, mintAmount)
            ).to.be.reverted;
        });
        
        it("Should not exceed max supply", async function () {
            const excessAmount = MAX_SUPPLY.sub(INITIAL_SUPPLY).add(1);
            await expect(
                agentCoin.connect(minter).mint(addr1.address, excessAmount)
            ).to.be.revertedWith("Max supply exceeded");
        });
        
        it("Should emit Minted event", async function () {
            const mintAmount = ethers.utils.parseEther("1000");
            await expect(agentCoin.connect(minter).mint(addr1.address, mintAmount))
                .to.emit(agentCoin, "Minted")
                .withArgs(addr1.address, mintAmount);
        });
    });
    
    describe("Burning", function () {
        beforeEach(async function () {
            // Transfer some tokens to addr1
            await agentCoin.transfer(addr1.address, ethers.utils.parseEther("10000"));
        });
        
        it("Should allow users to burn their own tokens", async function () {
            const burnAmount = ethers.utils.parseEther("1000");
            const initialBalance = await agentCoin.balanceOf(addr1.address);
            
            await agentCoin.connect(addr1).burn(burnAmount);
            
            expect(await agentCoin.balanceOf(addr1.address)).to.equal(
                initialBalance.sub(burnAmount)
            );
        });
        
        it("Should reduce total supply when burning", async function () {
            const burnAmount = ethers.utils.parseEther("1000");
            const initialSupply = await agentCoin.totalSupply();
            
            await agentCoin.connect(addr1).burn(burnAmount);
            
            expect(await agentCoin.totalSupply()).to.equal(
                initialSupply.sub(burnAmount)
            );
        });
        
        it("Should emit Burned event", async function () {
            const burnAmount = ethers.utils.parseEther("1000");
            await expect(agentCoin.connect(addr1).burn(burnAmount))
                .to.emit(agentCoin, "Burned")
                .withArgs(addr1.address, burnAmount);
        });
    });
    
    describe("Staking", function () {
        const stakeAmount = ethers.utils.parseEther("1000");
        
        beforeEach(async function () {
            // Transfer tokens to addr1 for staking
            await agentCoin.transfer(addr1.address, ethers.utils.parseEther("10000"));
        });
        
        it("Should allow users to stake tokens", async function () {
            await agentCoin.connect(addr1).stake(stakeAmount);
            
            expect(await agentCoin.stakingBalance(addr1.address)).to.equal(stakeAmount);
            expect(await agentCoin.balanceOf(addr1.address)).to.equal(
                ethers.utils.parseEther("9000")
            );
        });
        
        it("Should enforce minimum stake amount", async function () {
            const lowAmount = ethers.utils.parseEther("50"); // Below 100 AGC minimum
            await expect(
                agentCoin.connect(addr1).stake(lowAmount)
            ).to.be.revertedWith("Below minimum stake amount");
        });
        
        it("Should update total staked amount", async function () {
            const initialTotal = await agentCoin.totalStaked();
            await agentCoin.connect(addr1).stake(stakeAmount);
            expect(await agentCoin.totalStaked()).to.equal(initialTotal.add(stakeAmount));
        });
        
        it("Should emit Staked event", async function () {
            await expect(agentCoin.connect(addr1).stake(stakeAmount))
                .to.emit(agentCoin, "Staked")
                .withArgs(addr1.address, stakeAmount);
        });
    });
    
    describe("Unstaking", function () {
        const stakeAmount = ethers.utils.parseEther("1000");
        
        beforeEach(async function () {
            await agentCoin.transfer(addr1.address, ethers.utils.parseEther("10000"));
            await agentCoin.connect(addr1).stake(stakeAmount);
        });
        
        it("Should allow users to unstake tokens", async function () {
            const unstakeAmount = ethers.utils.parseEther("500");
            await agentCoin.connect(addr1).unstake(unstakeAmount);
            
            expect(await agentCoin.stakingBalance(addr1.address)).to.equal(
                stakeAmount.sub(unstakeAmount)
            );
        });
        
        it("Should return unstaked tokens to user", async function () {
            const balanceBefore = await agentCoin.balanceOf(addr1.address);
            const unstakeAmount = ethers.utils.parseEther("500");
            
            await agentCoin.connect(addr1).unstake(unstakeAmount);
            
            const balanceAfter = await agentCoin.balanceOf(addr1.address);
            expect(balanceAfter.sub(balanceBefore)).to.be.gte(unstakeAmount);
        });
        
        it("Should not allow unstaking more than staked", async function () {
            const excessAmount = stakeAmount.add(1);
            await expect(
                agentCoin.connect(addr1).unstake(excessAmount)
            ).to.be.revertedWith("Insufficient staked balance");
        });
        
        it("Should emit Unstaked event with rewards", async function () {
            // Advance time to accrue rewards
            await time.increase(365 * 24 * 60 * 60); // 1 year
            
            await expect(agentCoin.connect(addr1).unstake(stakeAmount))
                .to.emit(agentCoin, "Unstaked");
        });
    });
    
    describe("Rewards", function () {
        const stakeAmount = ethers.utils.parseEther("1000");
        
        beforeEach(async function () {
            await agentCoin.transfer(addr1.address, ethers.utils.parseEther("10000"));
            await agentCoin.connect(addr1).stake(stakeAmount);
        });
        
        it("Should calculate rewards correctly", async function () {
            // Advance time by 1 year
            await time.increase(365 * 24 * 60 * 60);
            
            const rewards = await agentCoin.calculateRewards(addr1.address);
            const expectedRewards = stakeAmount.mul(500).div(BASIS_POINTS); // 5% APY
            
            // Allow for small rounding differences
            expect(rewards).to.be.closeTo(expectedRewards, ethers.utils.parseEther("1"));
        });
        
        it("Should allow claiming rewards", async function () {
            await time.increase(30 * 24 * 60 * 60); // 30 days
            
            const balanceBefore = await agentCoin.balanceOf(addr1.address);
            await agentCoin.connect(addr1).claimRewards();
            const balanceAfter = await agentCoin.balanceOf(addr1.address);
            
            expect(balanceAfter).to.be.gt(balanceBefore);
        });
        
        it("Should not allow claiming zero rewards", async function () {
            await expect(
                agentCoin.connect(addr2).claimRewards()
            ).to.be.revertedWith("No rewards to claim");
        });
    });
    
    describe("Transfer with burn fee", function () {
        beforeEach(async function () {
            await agentCoin.transfer(addr1.address, ethers.utils.parseEther("10000"));
        });
        
        it("Should apply burn fee on transfers", async function () {
            const transferAmount = ethers.utils.parseEther("1000");
            const burnRate = await agentCoin.burnRate();
            const expectedBurn = transferAmount.mul(burnRate).div(BASIS_POINTS);
            
            const initialSupply = await agentCoin.totalSupply();
            await agentCoin.connect(addr1).transfer(addr2.address, transferAmount);
            const finalSupply = await agentCoin.totalSupply();
            
            // Check that supply decreased by burn amount
            expect(initialSupply.sub(finalSupply)).to.be.closeTo(
                expectedBurn,
                ethers.utils.parseEther("0.01")
            );
        });
        
        it("Should accumulate fees for distribution", async function () {
            const transferAmount = ethers.utils.parseEther("1000");
            
            await agentCoin.connect(addr1).transfer(addr2.address, transferAmount);
            
            expect(await agentCoin.accumulatedFees()).to.be.gt(0);
        });
    });
    
    describe("Admin functions", function () {
        it("Should allow rate admin to update minting rate", async function () {
            const newRate = 300; // 3%
            await agentCoin.updateMintingRate(newRate);
            expect(await agentCoin.mintingRate()).to.equal(newRate);
        });
        
        it("Should not allow excessive minting rate", async function () {
            const excessiveRate = 1001; // > 10%
            await expect(
                agentCoin.updateMintingRate(excessiveRate)
            ).to.be.revertedWith("Rate too high");
        });
        
        it("Should allow rate admin to update burn rate", async function () {
            const newRate = 20; // 0.2%
            await agentCoin.updateBurnRate(newRate);
            expect(await agentCoin.burnRate()).to.equal(newRate);
        });
        
        it("Should emit rate update events", async function () {
            const newMintRate = 300;
            await expect(agentCoin.updateMintingRate(newMintRate))
                .to.emit(agentCoin, "MintingRateUpdated")
                .withArgs(200, newMintRate);
        });
    });
    
    describe("Pausable", function () {
        it("Should allow pauser to pause contract", async function () {
            await agentCoin.pause();
            expect(await agentCoin.paused()).to.be.true;
        });
        
        it("Should prevent transfers when paused", async function () {
            await agentCoin.pause();
            await expect(
                agentCoin.transfer(addr1.address, ethers.utils.parseEther("100"))
            ).to.be.revertedWith("Pausable: paused");
        });
        
        it("Should allow unpausing", async function () {
            await agentCoin.pause();
            await agentCoin.unpause();
            expect(await agentCoin.paused()).to.be.false;
        });
    });
    
    describe("Fee distribution", function () {
        beforeEach(async function () {
            await agentCoin.transfer(addr1.address, ethers.utils.parseEther("10000"));
            // Make transfers to accumulate fees
            for (let i = 0; i < 5; i++) {
                await agentCoin.connect(addr1).transfer(addr2.address, ethers.utils.parseEther("100"));
            }
        });
        
        it("Should distribute accumulated fees to collector", async function () {
            const fees = await agentCoin.accumulatedFees();
            expect(fees).to.be.gt(0);
            
            const collectorBalanceBefore = await agentCoin.balanceOf(feeCollector.address);
            await agentCoin.distributeFees();
            const collectorBalanceAfter = await agentCoin.balanceOf(feeCollector.address);
            
            expect(collectorBalanceAfter.sub(collectorBalanceBefore)).to.equal(fees);
            expect(await agentCoin.accumulatedFees()).to.equal(0);
        });
        
        it("Should not distribute if no fees accumulated", async function () {
            // Clear any accumulated fees first
            if ((await agentCoin.accumulatedFees()).gt(0)) {
                await agentCoin.distributeFees();
            }
            
            await expect(
                agentCoin.distributeFees()
            ).to.be.revertedWith("No fees to distribute");
        });
    });
});