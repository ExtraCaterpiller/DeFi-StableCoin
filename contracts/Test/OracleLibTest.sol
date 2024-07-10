// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.20;

import {OracleLib} from "../Libraries/OracleLib.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/*
 * @notice This is a wrapper contract for OracleLib for testing
 */

contract OracleLibTest {
    function staleCheckLatestRoundData(
        AggregatorV3Interface priceFeed
    ) external view returns (uint80, int256, uint256, uint256, uint80) {
        return OracleLib.staleCheckLatestRoundData(priceFeed);
    }
}
