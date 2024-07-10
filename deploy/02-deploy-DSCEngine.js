const { network, ethers } = require('hardhat')
const { developmentChains, networkConfig } = require('../helper-hardhat-config')
const verify = require('../utils/verify')

module.exports = async({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    let priceFeed, tokenAddress 

    log("----------------------------------")

    if(developmentChains.includes(network.name)){
        const ethUsdAggregator = await deployments.get("MockV3Aggregator_ETH")
        const btcUsdAggregator = await deployments.get("MockV3Aggregator_BTC")
        
        const weth = await deployments.get("ERC20Mock_WETH")
        const wbtc = await deployments.get("ERC20Mock_WBTC")
        
        priceFeed = [ethUsdAggregator.address, btcUsdAggregator.address]
        tokenAddress = [weth.address, wbtc.address]
    } else {
        priceFeed = [
            networkConfig[chainId].ethUsdPriceFeed,
            networkConfig[chainId].btcUsdPriceFeed
        ]
        tokenAddress = [
            networkConfig[chainId].wethAddress,
            networkConfig[chainId].wbtcAddress
        ]
    }

    const oracleLib = await deploy("OracleLib", {
        from: deployer,
        log: true,
        waitConfirmation: network.config.blockConfirmations || 1
    })

    const dscCoin = await deployments.get("DecentralizedStableCoin")

    log("deploying DSC Engine")
    const dscEngine = await deploy("DSCEngine", {
        from: deployer,
        args: [priceFeed, tokenAddress, dscCoin.address],
        libraries: {
            OracleLib: oracleLib.address
        },
        log: true,
        waitConfirmation: network.config.blockConfirmations || 1
    })

    if(!developmentChains.includes(network.name)) {
        await verify(dscEngine.address, [priceFeed, tokenAddress, dscCoin.address], {OracleLib: oracleLib.address})
    }

    log("----------------------------------")
}

module.exports.tags = ["all", "DSCEngine"]