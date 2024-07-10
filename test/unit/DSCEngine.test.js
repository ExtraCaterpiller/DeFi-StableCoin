const { deployments, ethers, network } = require('hardhat')
const assert = require('assert')
const { expect } = require('chai')
const { developmentChains, ETH_INITIAL_PRICE } = require('../../helper-hardhat-config')

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("DScEngine", () => {
        let dscEngine, dsc, wethMock, deployer, wbtcMock, wethPriceFeed, user, liquidator
        const collateral = ethers.parseEther("10")
        const mintedDsc = ethers.parseEther("7")
        const lowerDebt = 500e8
        const startingERC20Balance = ethers.parseEther("10")

        beforeEach(async () => {
            const accounts = await ethers.getSigners()
            deployer = accounts[0]
            user = accounts[1]
            liquidator = accounts[2]

            await deployments.fixture(["all"])
            const dscEngineDeployment = await deployments.get("DSCEngine")
            dscEngine = await ethers.getContractAt("DSCEngine", dscEngineDeployment.address)

            const dscDeployment = await deployments.get("DecentralizedStableCoin")
            dsc = await ethers.getContractAt("DecentralizedStableCoin", dscDeployment.address)

            const wethDeployment = await deployments.get("ERC20Mock_WETH")
            wethMock = await ethers.getContractAt("ERC20Mock", wethDeployment.address)

            const wbtcDeployment = await deployments.get("ERC20Mock_WBTC")
            wbtcMock = await ethers.getContractAt("ERC20Mock", wbtcDeployment.address)

            const ethPriceFeedDeployment = await deployments.get("MockV3Aggregator_ETH")
            wethPriceFeed = await ethers.getContractAt("MockV3Aggregator", ethPriceFeedDeployment.address)

            await wethMock.mint(deployer.address, startingERC20Balance)
            await wbtcMock.mint(deployer.address, startingERC20Balance)
            await wethMock.mint(user.address, startingERC20Balance)
            await wethMock.mint(liquidator.address, startingERC20Balance)
        })

        describe("depositCollateral test", () => {
            it("reverts if collateral is zero", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                try {
                    await dscEngine.depositCollateral(wethMock.target, 0)
                    assert.fail("Deposit should have failed")
                } catch (error) {
                    assert(error.message.includes("DSCEngine__DepositMoreThanZero"), `Expected revert reason ${error.message}`)
                }
            })
            it("reverts if token not allowed", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                try {
                    await dscEngine.depositCollateral(wethPriceFeed.target, collateral)
                    assert.fail("Deposit should have failed")
                } catch (error) {
                    assert(error.message.includes("DSCEngine_NotAllowedToken"), `Expected revert reason: ${error.message}`)
                }
            })
            it("emits event on deposit success", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                await expect(dscEngine.depositCollateral(wethMock.target, collateral)).to.emit(dscEngine, "CollateralDeposited")
            })
        })

        describe("redeemCollateralForDsc", () => {
            it("should revert if amount is zero", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                await dscEngine.depositCollateralAndMintDSC(wethMock.target, collateral, mintedDsc)
                try {
                    await dscEngine.redeemCollateralForDsc(wethMock.target, 0, mintedDsc)
                    assert.fail("Redeem should have failed")
                } catch (error) {
                    assert(error.message.includes("DSCEngine__DepositMoreThanZero"), `Expected revert reason: ${error.message}`)
                }
            })
            it("should revert if token not allowed", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                await dscEngine.depositCollateralAndMintDSC(wethMock.target, collateral, mintedDsc)
                try {
                    await dscEngine.redeemCollateralForDsc(wethPriceFeed.target, collateral, mintedDsc)
                    assert.fail("Redeem should have failed")
                } catch (error) {
                    assert(error.message.includes("DSCEngine_NotAllowedToken"), `Expected revert reason: ${error.message}`)
                }
            })
            it("emits event on redeem success", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                await dscEngine.depositCollateralAndMintDSC(wethMock.target, collateral, mintedDsc)
                await dsc.approve(dscEngine.target, mintedDsc)
                
                expect(await dscEngine.redeemCollateralForDsc(wethMock.target, collateral, mintedDsc)).to.emit(dscEngine, "CollateralRedeemed")
                assert.equal(await wethMock.balanceOf(deployer.address), collateral)
            })
        })

        describe("redeemCollateral", () => {
            it("should revert if amount is zero", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                await dscEngine.depositCollateralAndMintDSC(wethMock.target, collateral, mintedDsc)
                try {
                    await dscEngine.redeemCollateral(wethMock.target, 0)
                    assert.fail("Redeem should have failed")
                } catch (error) {
                    assert(error.message.includes("DSCEngine__DepositMoreThanZero"), `Expected revert reason: ${error.message}`)
                }
            })
            it("should revert if token not allowed", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                await dscEngine.depositCollateralAndMintDSC(wethMock.target, collateral, mintedDsc)
                try {
                    await dscEngine.redeemCollateral(wethPriceFeed.target, collateral)
                    assert.fail("Redeem should have failed")
                } catch (error) {
                    assert(error.message.includes("DSCEngine_NotAllowedToken"), `Expected revert reason: ${error.message}`)
                }
            })
            it("emits event on redeem success", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                await dscEngine.depositCollateralAndMintDSC(wethMock.target, collateral, mintedDsc)
                await dsc.approve(dscEngine.target, mintedDsc)
                
                await dscEngine.burnDsc(mintedDsc)
                expect(await dscEngine.redeemCollateral(wethMock.target, collateral)).to.emit(dscEngine, "CollateralRedeemed")
                assert.equal(await wethMock.balanceOf(deployer.address), collateral)
            })
        })

        describe("mintDsc", () => {
            it("should revert if amount is zero", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                dscEngine.depositCollateral(wethMock.target, collateral)
                try {
                    await dscEngine.mintDsc(0)
                    assert.fail("Mint should have failed")
                } catch (error) {
                    assert(error.message.includes("DSCEngine__DepositMoreThanZero"), `Expected revert reason: ${error.message}`)
                }
            })
            it("balance should be equal to mintedDsc after minting", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                await dscEngine.depositCollateral(wethMock.target, collateral)
                await dscEngine.mintDsc(mintedDsc)
                assert.equal(await dsc.balanceOf(deployer.address), mintedDsc)
            })
        })

        describe("getAccountCollateralValue", () => {
            it("collateral value in usd", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                await dscEngine.depositCollateral(wethMock.target, collateral)

                await wbtcMock.approve(dscEngine.target, collateral)
                await dscEngine.depositCollateral(wbtcMock.target, collateral)

                assert.equal(await dscEngine.getAccountCollateralValue(deployer.address), collateral*BigInt(1000) + collateral*BigInt(2000))
            })
        })

        describe("getAccountInfo", () => {
            it("mintedDsc and collateral value should be equal to returned value", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                await dscEngine.depositCollateralAndMintDSC(wethMock.target, collateral, mintedDsc)

                const res = await dscEngine.getAccountInfo(deployer.address)

                assert.equal(res[0], mintedDsc)
                assert.equal(res[1], collateral*BigInt(1000))
            })
        })

        describe("calculateHealthFactor", () => {
            it("correctly claculate health factor", async () => {
                const collateralValue = 10000
                const mintedDscValue = 1000
                const expectedHealthFactor = (((collateralValue * 50) / 100) * 1e18) / mintedDscValue
                assert.equal(await dscEngine.calculateHealthFactor(mintedDscValue, collateralValue), expectedHealthFactor)
            })
        })

        describe("getUsdValue test", () => {
            it("should convert usd value correctly", async () => {
                const ethAmount = ethers.parseEther("15")
                const expectedUsd = ethers.parseEther("15000")
                assert.equal(await dscEngine.getUsdValue(wethMock.target, ethAmount), expectedUsd)
            })
        })

        describe("getTokenAmountFromUsd", () => {
            it("correcltly returns the amount of token from usd", async () => {
                const usdAmountInWei = ethers.parseEther("30")
                const currentPrice = BigInt(2000)
                assert.equal(await dscEngine.getTokenAmountFromUsd(wbtcMock.target, usdAmountInWei), usdAmountInWei/currentPrice)
            })
        })

        describe("getCollateralBalance", () => {
            it("correctly returns the collateral balance of a token", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                await dscEngine.depositCollateral(wethMock.target, collateral)
                assert.equal(await dscEngine.getCollateralBalance(deployer.address, wethMock.target), collateral)
            })
        })

        describe("getHealthFactor", () => {
            it("should return the health factor correctly", async () => {
                await wethMock.approve(dscEngine.target, collateral)
                await dscEngine.depositCollateralAndMintDSC(wethMock.target, collateral, mintedDsc)
                const expectedHealthFactor = await dscEngine.calculateHealthFactor(mintedDsc, collateral*BigInt(1000))
                assert.equal(await dscEngine.getHealthFactor(deployer.address), expectedHealthFactor)
            })
        })

        describe("Getters", () => {
            it("should not revert", async () => {
                await dscEngine.getPrecision()
                await dscEngine.getAdditionalFeedPrecision()
                await dscEngine.getLiquidationThreshold()
                await dscEngine.getLiquidationBonus()
                await dscEngine.getLiquidationPrecision()
                await dscEngine.getLiquidationPrecision()
                await dscEngine.getMinHealthFactor()
                await dscEngine.getCollateralTokens()
                await dscEngine.getDsc()
                await dscEngine.getCollateralTokenPriceFeed(wethMock.target)
            })
        })

        describe("liquidate", () => {
            beforeEach(async () => {
                await wethMock.connect(user).approve(dscEngine.target, collateral)
                await dscEngine.connect(user).depositCollateralAndMintDSC(wethMock.target, collateral, mintedDsc)
            })

            it("reverts if health factor is ok", async () => {
                try {
                    await dscEngine.connect(liquidator).liquidate(wethMock.target, user.address, ethers.parseEther("10000"))
                    assert.fail("Should have reverted")
                } catch (error) {
                    assert(error.message.includes("DSCEngine__HealthFactorOk"), `Expected revert reason: ${error.message}`)
                }
            })
            it("should successfully liquidate if health factor is below minimum", async () => {
                await dscEngine.connect(user).mintDsc(ethers.parseEther("2500"))

                // Update the price feed to a lower value
                await wethPriceFeed.updateAnswer(lowerDebt)

                // Liquidator deposits collateral and mints DSC
                await wethMock.connect(liquidator).approve(dscEngine.target, collateral)
                await dscEngine.connect(liquidator).depositCollateralAndMintDSC(wethMock.target, collateral, ethers.parseEther("2000"))

                // Liquidator use the DSC to cover the debt of user
                await dsc.connect(liquidator).approve(dscEngine.target, ethers.parseEther("2000"))
                await expect(dscEngine.connect(liquidator).liquidate(wethMock.target, user.address, ethers.parseEther("2000"))).to.emit(dscEngine, 'CollateralRedeemed')
            })
            it("should revert if health factor does not improve after liquidation", async () => {
                await dscEngine.connect(user).mintDsc(ethers.parseEther("2500"))

                // Update the price feed to a lower value
                await wethPriceFeed.updateAnswer(lowerDebt)

                // Liquidator deposits collateral and mints DSC
                await wethMock.connect(liquidator).approve(dscEngine.target, collateral)
                await dscEngine.connect(liquidator).depositCollateralAndMintDSC(wethMock.target, collateral, ethers.parseEther("2000"))

                // Liquidator use the DSC to cover the debt of user
                await dsc.connect(liquidator).approve(dscEngine.target, ethers.parseEther("5"))
                try {
                    await dscEngine.connect(liquidator).liquidate(wethMock.target, user.address, ethers.parseEther("5"))
                    assert.fail("Should have reverted")
                } catch (error) {
                    assert(error.message.includes("DSCEngine__HealthFactorNotImproved"), `Expected revert reason: ${error.message}`)
                }
            })
            /* 
            * @notice we assume the following
            * A user mints 2500+7 DSC with 10 WETH as collateral, suddenly the price of WETH falls
            * The user is not undercollateralized
            * A liquidator uses his minted DSC to pay off a certain percent of the debt of user
            * In return the liquidator gets the equivalent WETH at that DSC price with 10% bonus from user
            * The user loses equivalent amount of WETH plus the bonus
            */
            it("should correctly calculate and transfer bonus collateral", async () => {
                await dscEngine.connect(user).mintDsc(ethers.parseEther("2500")) // mint 2500 DSC, requires more than 2493 DSC to be undercollateralized

                // Update the price feed to a lower value
                await wethPriceFeed.updateAnswer(lowerDebt) // 1 WETH = 500 usd

                // Liquidator deposits collateral and mints DSC
                await wethMock.connect(liquidator).approve(dscEngine.target, collateral)
                await dscEngine.connect(liquidator).depositCollateralAndMintDSC(wethMock.target, collateral, ethers.parseEther("2000"))

                const liquidatorStartingBalance = await wethMock.balanceOf(liquidator.address)
            
                // Liquidator use his DSC to cover the debt of user
                await dsc.connect(liquidator).approve(dscEngine.target, ethers.parseEther("2000"))
                await dscEngine.connect(liquidator).liquidate(wethMock.target, user.address, ethers.parseEther("2000"))
                
                const liquidatorEndingBalance = await wethMock.balanceOf(liquidator.address)
                const liquidationBonus = ((ethers.parseEther("2000")/BigInt(500)) * BigInt(10)) / BigInt(100)
                
                const userEndingCollateral = await dscEngine.getCollateralBalance(user.address, wethMock.target)
                
                assert.equal(userEndingCollateral, collateral-(liquidatorEndingBalance - liquidatorStartingBalance))
                assert.equal(liquidatorEndingBalance - liquidatorStartingBalance, ethers.parseEther("2000")/BigInt(500) + liquidationBonus)
            })
        })
    })