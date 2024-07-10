const { network, ethers } = require('hardhat')
const { developmentChains } = require('../helper-hardhat-config')
const verify = require('../utils/verify')

module.exports = async({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    log("----------------------------------")
    log("deploying DSC coin")
    const dscCoin = await deploy("DecentralizedStableCoin", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmation: network.config.blockConfirmations || 1
    })

    if(!developmentChains.includes(network.name)) {
        await verify(dscCoin.address, [])
    }

    log("----------------------------------")
}

module.exports.tags = ["all", "DSCCoin"]