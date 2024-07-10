const { network } = require('hardhat')
const { developmentChains, DECIMALS, ETH_INITIAL_PRICE, BTC_INITIAL_PRICE } = require('../helper-hardhat-config')

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    if(developmentChains.includes(network.name)){
        log("Local network detected, deploying mocks...")
        await deploy("MockV3Aggregator_ETH", {
            contract: "MockV3Aggregator",
            from: deployer,
            log: true,
            args: [DECIMALS, ETH_INITIAL_PRICE]
        })

        await deploy("MockV3Aggregator_BTC", {
            contract: "MockV3Aggregator",
            from: deployer,
            log: true,
            args: [DECIMALS, BTC_INITIAL_PRICE]
        })

        await deploy("ERC20Mock_WETH", {
            contract: "ERC20Mock",
            from: deployer,
            log: true,
            args: ["WETH", "WETH", deployer, 0]
        })

        await deploy("ERC20Mock_WBTC", {
            contract: "ERC20Mock",
            from: deployer,
            log: true,
            args: ["WBTC", "WBTC", deployer, 0]
        })

        log("Mocks deployed")
        log("-----------------------------------")
    } else {
        log("Not deploying mocks as network is not local");
    }
}

module.exports.tags = ["all", "mocks"]