const { ethers } = require('hardhat')

module.exports = async ({ deployments }) => {
    const { log, get } = deployments

    const DSCCoinDeployment = await get("DecentralizedStableCoin")
    const DSCCoin = await ethers.getContractAt("DecentralizedStableCoin", DSCCoinDeployment.address)

    const DSCEngineDeployment = await get("DSCEngine")
    const DSCEngine = await ethers.getContractAt("DSCEngine", DSCEngineDeployment.address)

    log("transferring ownership of DSCCoin to DSCEngine...")
    await DSCCoin.transferOwnership(DSCEngine.target)
    log("Ownership of DSCCoin transferred to DSCEngine")
}

module.exports.tags = ["all", "setup"]