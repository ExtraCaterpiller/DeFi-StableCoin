// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.20;

import {Test} from "../../../lib/forge-std/src/Test.sol";
import {StdInvariant} from "../../../lib/forge-std/src/StdInvariant.sol";
import {DSCEngine} from "../../../contracts/DSCEngine.sol";
import {DecentralizedStableCoin} from "../../../contracts/DecentralizedStableCoin.sol";
import {ERC20Mock} from "../../../contracts/Mocks/ERC20Mock.sol";
import {MockV3Aggregator} from "../../../contracts/Mocks/MockV3Aggregator.sol";
import {ContinueOnRevertHandler} from "./ContinueOnRevertHandler.t.sol";
import {console} from "../../../lib/forge-std/src/console.sol";

contract ContinueOnRevertInvariants is StdInvariant, Test {
    DSCEngine public dscEngine;
    DecentralizedStableCoin public dsc;
    ERC20Mock public weth;
    ERC20Mock public wbtc;
    MockV3Aggregator public wethPriceFeed;
    MockV3Aggregator public wbtcPriceFeed;

    //address public ethUsdPriceFeed;
    //address public btcUsdPriceFeed;
    //address public weth;
    //address public wbtc;

    uint256 amountCollateral = 10 ether;
    uint256 amountToMint = 100 ether;

    uint256 public constant STARTING_USER_BALANCE = 10 ether;
    address public constant USER = address(1);
    uint256 public constant MIN_HEALTH_FACTOR = 1e18;
    uint256 public constant LIQUIDATION_THRESHOLD = 50;

    // Liquidation
    address public liquidator = makeAddr("liquidator");
    uint256 public collateralToCover = 20 ether;

    ContinueOnRevertHandler public handler;
    address deployer;

    function setUp() public {
        deployer = address(this);

        dsc = new DecentralizedStableCoin();

        weth = new ERC20Mock("WETH", "WETH", deployer, 1e24);
        wbtc = new ERC20Mock("WBTC", "WBTC", deployer, 1e24);

        wethPriceFeed = new MockV3Aggregator(8, 1000e18); // 1000 USD per WETH
        wbtcPriceFeed = new MockV3Aggregator(8, 20000e8); // 2000 USD per WBTC

        // Deploy the DSCEngine contract
        address[] memory allowedTokens = new address[](2);
        allowedTokens[0] = address(weth);
        allowedTokens[1] = address(wbtc);

        address[] memory priceFeeds = new address[](2);
        priceFeeds[0] = address(wethPriceFeed);
        priceFeeds[1] = address(wbtcPriceFeed);

        dscEngine = new DSCEngine(priceFeeds, allowedTokens, address(dsc));
        dsc.transferOwnership(address(dscEngine));
        handler = new ContinueOnRevertHandler(dscEngine, dsc);
        targetContract(address(handler));
    }

    function invariant_protocolMustHaveMoreValueThatTotalSupplyDollars()
        public
        view
    {
        uint256 totalSupply = dsc.totalSupply();
        uint256 wethDeposited = ERC20Mock(weth).balanceOf(address(dscEngine));
        uint256 wbtcDeposited = ERC20Mock(wbtc).balanceOf(address(dscEngine));

        uint256 wethValue = dscEngine.getUsdValue(address(weth), wethDeposited);
        uint256 wbtcValue = dscEngine.getUsdValue(address(wbtc), wbtcDeposited);

        console.log("wethValue: %s", wethValue);
        console.log("wbtcValue: %s", wbtcValue);

        assert(wethValue + wbtcValue >= totalSupply);
    }

    function invariant_callSummary() public view {
        handler.callSummary();
    }
}
