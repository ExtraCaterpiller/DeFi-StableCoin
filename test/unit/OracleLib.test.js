const { deployments, ethers, network } = require('hardhat')
const assert = require('assert')
const { expect } = require('chai')
const { developmentChains, DECIMALS } = require('../../helper-hardhat-config')
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("OracleLib", () => {
        let oracleLibTest, deployer, mockAggregatorV3, oracleLib
        const TIMEOUT = 3*60*60

        beforeEach(async () => {
            const accounts = await ethers.getSigners()
            deployer = accounts[0]

            await deployments.fixture(['all'])

            const oracleLibDeployment = await deployments.get("OracleLib")
            oracleLib = await ethers.getContractAt("OracleLib", oracleLibDeployment.address)

            const MockAggregatorV3 = await deployments.get('MockV3Aggregator_ETH')
            mockAggregatorV3 = await ethers.getContractAt("MockV3Aggregator", MockAggregatorV3.address)

            const OracleLibTest = await ethers.getContractFactory('OracleLibTest', {libraries: {OracleLib: oracleLib.target}})
            oracleLibTest = await OracleLibTest.deploy()
        })

        describe('staleCheckLatestRoundData', () => {
            it('should revert on bad answer in round', async () => {
                const _roundId = 0
                const _answer = 0
                const _startedAt = 0
                const _timestamp = 0
    
                await mockAggregatorV3.updateRoundData(_roundId, _answer, _startedAt, _timestamp)
                
                try {
                    await oracleLibTest.staleCheckLatestRoundData(mockAggregatorV3.target)
                    assert.fail("Price check should have failed")
                } catch (error) {
                    assert(error.message.includes("OracleLib__StalePrice"), `Expected revert reason ${error.message}`)
                }
            })
    
            it("should revert if price data is stale", async () => {
                const _roundId = 1
                const _answer = ethers.parseEther("2000")
                const _startedAt = (await time.latest()) - TIMEOUT - 1
                const _timestamp = (await time.latest()) - TIMEOUT - 1

                await mockAggregatorV3.updateRoundData(_roundId, _answer, _startedAt, _timestamp)
                
                try {
                    await oracleLibTest.staleCheckLatestRoundData(mockAggregatorV3.target)
                    assert.fail("Price check should have failed")
                } catch (error) {
                    assert(error.message.includes("OracleLib__StalePrice"), `Expected revert reason ${error.message}`)
                }
            })
        })
    })