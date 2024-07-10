# Decentralized StableCoin (DSC)
Decentralized StableCoin (DSC) is a decentralized cryptocurrency designed to maintain a stable value. This project includes smart contracts for minting, burning and collateralizing the stablecoin, as well as a robust testing suite to ensure the stability and security of the system.

Table of Contents
- [Overview](#Overview)
- [Features](#Features)
- [Architecture](#Architecture)
- [Contracts](#Contracts)
- [Installation](#Installation)
- [Usage](#Usage)
- [Testing](#Testing)
- [Contributing](#Contributing)
- [License](#License)

## Overview
DSC aims to provide a decentralized, collateral-backed stablecoin that can be used across various decentralized applications (dApps). The project utilizes the DSCEngine to manage collateral deposits, stablecoin minting and collateral liquidation.

## Features
- Minting: Users can mint DSC by depositing approved collateral assets.
- Burning: Users can burn DSC to redeem their collateral.
- Collateral Management: The system supports multiple collateral types and price feeds.
- Liquidation: Automated liquidation of under-collateralized positions.
- Invariant Testing: Comprehensive testing suite to ensure protocol security and stability.

## Architecture
The DSC system comprises the following key components:

1. DSCEngine: Manages collateral deposits, DSC minting, and liquidation.
2. DecentralizedStableCoin: The stablecoin contract.
3. ERC20Mock: Mock ERC20 tokens used for testing collateral assets.
4. MockV3Aggregator: Mock price feed aggregator for testing purposes.

## Contracts
- DSCEngine.sol: Core logic for managing collateral and minting/burning DSC.
- DecentralizedStableCoin.sol: Implementation of the DSC token.
- ERC20Mock.sol: Mock ERC20 tokens for testing.
- MockV3Aggregator.sol: Mock price feed aggregator for testing.

## Installation
To set up the project locally, follow these steps:
1. Clone the repository:
```
git clone https://github.com/ExtraCaterpiller/DeFi-StableCoin.git
cd decentralized-stablecoin
```
2. install dependencies:
```
npm install
```
3. Create a .env file in root folder of the project and set the following environment variables:
```
ALCHEMY_ETH_RPC_URL
SEPOLIA_RPC_URl
SEPOLIA_PRIVATE_KEY
ETHERSCAN_API_KEY
COINMARKETCAP_API_KEY
SEPOLIA_ETHUSD_PRICEFEED_ADDRESS
SEPOLIA_BTCUSD_PRICEFEED_ADDRESS
SEPOLIA_WETH_ADDRESS
SEPOLIA_WBTC_ADDRESS
```

## Usage
### Deploying the Contracts
run the following command to deploy locally:
```
npx hardhat deploy
```

## Testing
The project includes a comprehensive suite of tests to ensure the functionality and security of the contracts. To run the tests, use the following command:
1. To run hardhat tests:
```
npx hardhat test
```
2. To run foundry invariant tests:
```
forge test
```

## Contributing
Contributions are welcome! Please fork the repository and create a pull request with your changes. Ensure that your code adheres to the project's coding standards and passes all tests.

1. Fork the repository
2. Create a new branch (git checkout -b feature/your-feature)
3. Commit your changes (git commit -am 'Add new feature')
4. Push to the branch (git push origin feature/your-feature)
5. Create a new Pull Request

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
