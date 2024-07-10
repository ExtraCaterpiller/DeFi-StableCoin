const networkConfig = {
    11155111: {
        name: "sepolia",
        ethUsdPriceFeed: process.env.SEPOLIA_ETHUSD_PRICEFEED_ADDRESS,
        btcUsdPriceFeed: process.env.SEPOLIA_BTCUSD_PRICEFEED_ADDRES,
        wethAddress: process.env.SEPOLIA_WETH_ADDRESS,
        wbtcAddress: process.env.SEPOLIA_WBTC_ADDRESS
    },
}

const developmentChains = ["hardhat", "localhost"]

const DECIMALS = 8

const ETH_INITIAL_PRICE = 1000e8
const BTC_INITIAL_PRICE = 2000e8

module.exports = {
    networkConfig,
    developmentChains,
    DECIMALS,
    ETH_INITIAL_PRICE,
    BTC_INITIAL_PRICE
}