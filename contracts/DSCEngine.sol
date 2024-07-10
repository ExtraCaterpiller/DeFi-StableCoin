// Layout of Contract:
// version
// imports
// errors
// interfaces, libraries, contracts
// Type declarations
// State variables
// Events
// Modifiers
// Functions

// Layout of Functions:
// constructor
// receive function (if exists)
// fallback function (if exists)
// external
// public
// internal
// private
// internal & private view & pure functions
// external & public view & pure functions

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OracleLib, AggregatorV3Interface} from "./Libraries/OracleLib.sol";
import {DecentralizedStableCoin} from "./DecentralizedStableCoin.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

//import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/*
 * @title DSCEngine
 * @author Atiq Ishrak
 *
 * The system is designed to be as minimal as possible, and have the tokens maintain a 1 token == $1 peg at all times.
 * This is a stablecoin with the properties:
 * - Exogenously Collateralized
 * - Dollar Pegged
 * - Algorithmically Stable
 *
 * It is similar to DAI if DAI had no governance, no fees and was backed by only WETH and WBTC.
 *
 * Our DSC system should always be "overcollateralized". At no point, should the value of
 * all collateral < the $ backed value of all the DSC.
 *
 * @notice This contract is the core of the Decentralized Stablecoin system. It handles all the logic
 * for minting and redeeming DSC, as well as depositing and withdrawing collateral.
 * @notice This contract is based on the MakerDAO DSS system
 */

contract DSCEngine is ReentrancyGuard {
    // Errors
    error DSCEngine__DepositMoreThanZero();
    error DSCEngine__TokenAddressAndPriceFeedsAddressesMustBeSameLength();
    error DSCEngine_NotAllowedToken();
    error DSCEngine_TransferFailed();
    error DSCEngine__HealthFactorBelowThreshold(uint256 healthFactor);
    error DSCEngine__MintFailed();
    error DSCEngine__TransferFailed();
    error DSCEngine__HealthFactorOk();
    error DSCEngine__HealthFactorNotImproved();

    // Library
    using OracleLib for AggregatorV3Interface;

    // State variables
    DecentralizedStableCoin private immutable i_dsc;

    uint256 private constant ADDITIONAL_FEED_PRECISION = 1e10;
    uint256 private constant PRECISION = 1e18;
    uint256 private constant LIQUIDATION_THRESHOLD = 50; // 200% overcollateralization
    uint256 private constant LIQUIDATION_PRECISION = 100;
    uint256 private constant LIQUIDATION_BONUS = 10;
    uint256 private constant MIN_HEALTH_FACTOR = 1e18;

    mapping(address token => address priceFeed) private s_priceFeeds;
    mapping(address user => mapping(address token => uint256 amount))
        private s_collateralDeposited;
    mapping(address user => uint256 amountDscMinted) private s_dscMinted;
    address[] private s_tokenCollateral;

    // Events
    event CollateralDeposited(
        address indexed user,
        address indexed token,
        uint256 indexed amount
    );
    event CollateralRedeemed(
        address indexed from,
        address indexed to,
        address token,
        uint256 amount
    );

    // Modifiers
    modifier moreThanZero(uint256 _amount) {
        if (_amount <= 0) {
            revert DSCEngine__DepositMoreThanZero();
        }
        _;
    }

    modifier isAllowedToken(address _token) {
        if (s_priceFeeds[_token] == address(0)) {
            revert DSCEngine_NotAllowedToken();
        }
        _;
    }

    // Constructor

    constructor(
        address[] memory _priceFeeds,
        address[] memory _token,
        address _dscAddress
    ) {
        if (_priceFeeds.length != _token.length) {
            revert DSCEngine__TokenAddressAndPriceFeedsAddressesMustBeSameLength();
        }

        for (uint256 i = 0; i < _token.length; i++) {
            s_priceFeeds[_token[i]] = _priceFeeds[i];
            s_tokenCollateral.push(_token[i]);
        }

        i_dsc = DecentralizedStableCoin(_dscAddress);
    }

    // External Functions

    /* * @param _token: The address of the collateral token
     * @param _amountCollateral: The address of the collateral token
     * @param _amountToMint: The amount of DSC to mint
     * @notice Deposits collateral and mints DSC in one transaction
     */
    function depositCollateralAndMintDSC(
        address _token,
        uint256 _amountCollateral,
        uint256 _amountToMint
    ) external {
        depositCollateral(_token, _amountCollateral);
        mintDsc(_amountToMint);
    }

    /*
     * @param _token: The ERC20 token address of the collateral user is depositing
     * @param _amountCollateral: The amount of collateral
     * @param _amountDscToBurn: The amount of DSC user wants to burn
     * @notice This function will withdraw collateral and burn DSC in one transaction
     */
    function redeemCollateralForDsc(
        address _token,
        uint256 _amountCollateral,
        uint256 _amountDscToBurn
    ) external moreThanZero(_amountCollateral) isAllowedToken(_token) {
        _burnDsc(_amountDscToBurn, msg.sender, msg.sender);
        _redeemCollateral(_token, _amountCollateral, msg.sender, msg.sender);
        _revertIfHealthFactorIsBroken(msg.sender);
    }

    /*
     * @param _token: The ERC20 token address of the collateral
     * @param amountCollateral: The amount of collateral user is redeeming
     * @notice This function will redeem collateral.
     * @notice If you have DSC minted, you will not be able to redeem until you burn your DSC
     */
    function redeemCollateral(
        address _token,
        uint256 _amountToRedeem
    )
        external
        moreThanZero(_amountToRedeem)
        nonReentrant
        isAllowedToken(_token)
    {
        _redeemCollateral(_token, _amountToRedeem, msg.sender, msg.sender);
        _revertIfHealthFactorIsBroken(msg.sender);
    }

    /*
     * @param _amount: The amount of DSC to burn
     * @dev you might want to use this if you're nervous you might get liquidated and want to just burn you DSC but keep your collateral in.
     */
    function burnDsc(uint256 _amount) external moreThanZero(_amount) {
        _burnDsc(_amount, msg.sender, msg.sender);
        _revertIfHealthFactorIsBroken(msg.sender);
    }

    /*
     * @param _collateral: The ERC20 token address of the collateral you're using to make the protocol solvent again.
     * This is collateral that you're going to take from the user who is insolvent.
     * In return, you have to burn your DSC to pay off their debt, but you don't pay off your own.
     * @param _user: The user who is insolvent. They have to have a _healthFactor below MIN_HEALTH_FACTOR
     * @param _debtToCover: The amount of DSC you want to burn to cover the user's debt.
     *
     * @notice: You can partially liquidate a user.
     * @notice: You will get a 10% LIQUIDATION_BONUS for taking the users funds.
    * @notice: This function working assumes that the protocol will be roughly 200% overcollateralized in order for this
    to work.
    * @notice: A known bug would be if the protocol was only 100% collateralized, we wouldn't be able to liquidate
    anyone.
     * For example, if the price of the collateral plummeted before anyone could be liquidated.
     */
    function liquidate(
        address _collateral,
        address _user,
        uint256 _debtToCover
    ) external moreThanZero(_debtToCover) nonReentrant {
        uint256 startingHealthFactor = _healthFactor(_user);
        if (startingHealthFactor >= MIN_HEALTH_FACTOR) {
            revert DSCEngine__HealthFactorOk();
        }

        uint256 tokenAmountFromDebtCovered = getTokenAmountFromUsd(
            _collateral,
            _debtToCover
        );

        uint256 bonusCollateral = (tokenAmountFromDebtCovered *
            LIQUIDATION_BONUS) / LIQUIDATION_PRECISION;

        _redeemCollateral(
            _collateral,
            tokenAmountFromDebtCovered + bonusCollateral,
            _user,
            msg.sender
        );
        _burnDsc(_debtToCover, _user, msg.sender);

        uint256 endingUserHealthFactor = _healthFactor(_user);
        if (endingUserHealthFactor <= MIN_HEALTH_FACTOR) {
            revert DSCEngine__HealthFactorNotImproved();
        }
        _revertIfHealthFactorIsBroken(msg.sender);
    }

    // Public Functions

    /* * @param _tokenCollateral The address of the collateral token
     * @param _amountCollateral The address of the collateral token
     */
    function depositCollateral(
        address _tokenCollateral,
        uint256 _amountCollateral
    )
        public
        moreThanZero(_amountCollateral)
        isAllowedToken(_tokenCollateral)
        nonReentrant
    {
        s_collateralDeposited[msg.sender][
            _tokenCollateral
        ] += _amountCollateral;
        emit CollateralDeposited(
            msg.sender,
            _tokenCollateral,
            _amountCollateral
        );
        bool success = IERC20(_tokenCollateral).transferFrom(
            msg.sender,
            address(this),
            _amountCollateral
        );
        if (!success) {
            revert DSCEngine_TransferFailed();
        }
    }

    /*
     * @param _amountToMint The amount of DSC to mint
     * @notice They must have more collateral than the minimum threshold to mint
     */
    function mintDsc(
        uint256 _amountToMint
    ) public moreThanZero(_amountToMint) nonReentrant {
        s_dscMinted[msg.sender] += _amountToMint;
        _revertIfHealthFactorIsBroken(msg.sender);
        bool minted = i_dsc.mint(msg.sender, _amountToMint);
        if (!minted) {
            revert DSCEngine__MintFailed();
        }
    }

    // Private Functions

    function _redeemCollateral(
        address _token,
        uint256 _amount,
        address _from,
        address _to
    ) private {
        s_collateralDeposited[_from][_token] -= _amount;
        emit CollateralRedeemed(_from, _to, _token, _amount);
        bool success = IERC20(_token).transfer(_to, _amount);
        if (!success) {
            revert DSCEngine__TransferFailed();
        }
    }

    function _burnDsc(
        uint256 _amount,
        address _onBehalfOf,
        address _dscFrom
    ) private {
        s_dscMinted[_onBehalfOf] -= _amount;

        bool success = i_dsc.transferFrom(_dscFrom, address(this), _amount);

        if (!success) {
            revert DSCEngine__TransferFailed();
        }

        i_dsc.burn(_amount);
    }

    // Private, internal, view Functions

    function _getAccountInfo(
        address user
    )
        private
        view
        returns (uint256 totalDscMinted, uint256 collateralValueInUsd)
    {
        totalDscMinted = s_dscMinted[user];
        collateralValueInUsd = getAccountCollateralValue(user);
    }

    /*
     * Returns how close to liquidation a user is
     * If a user goes below 1, they get liquidated
     */
    function _healthFactor(address user) private view returns (uint256) {
        (
            uint256 totalDscMinted,
            uint256 collateralValueInUsd
        ) = _getAccountInfo(user);
        return _calculateHealthFactor(totalDscMinted, collateralValueInUsd);
    }

    function _revertIfHealthFactorIsBroken(address user) internal view {
        uint256 userHealthFactor = _healthFactor(user);
        if (userHealthFactor < MIN_HEALTH_FACTOR) {
            revert DSCEngine__HealthFactorBelowThreshold(userHealthFactor);
        }
    }

    function _calculateHealthFactor(
        uint256 _totalDscMinted,
        uint256 _collateralValueInUsd
    ) internal pure returns (uint256) {
        if (_totalDscMinted == 0) {
            return type(uint256).max;
        }
        uint256 collateralAdjustedForThreshold = (_collateralValueInUsd *
            LIQUIDATION_THRESHOLD) / LIQUIDATION_PRECISION;
        return ((collateralAdjustedForThreshold * PRECISION) / _totalDscMinted);
    }

    function _getUsdValue(
        address _token,
        uint256 _amount
    ) private view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            s_priceFeeds[_token]
        );

        (, int256 answer, , , ) = priceFeed.staleCheckLatestRoundData();

        return
            ((uint256(answer) * ADDITIONAL_FEED_PRECISION) * _amount) /
            PRECISION;
    }

    // Public, view Functions

    function getAccountCollateralValue(
        address _user
    ) public view returns (uint256 totalCollateralValueInUsd) {
        for (uint256 i = 0; i < s_tokenCollateral.length; i++) {
            address token = s_tokenCollateral[i];
            uint256 amount = s_collateralDeposited[_user][token];
            totalCollateralValueInUsd += _getUsdValue(token, amount);
        }
        return totalCollateralValueInUsd;
    }

    function getAccountInfo(
        address _user
    )
        public
        view
        returns (uint256 totalDscMinted, uint256 collateralValueInUsd)
    {
        return _getAccountInfo(_user);
    }

    function calculateHealthFactor(
        uint256 _totalDscMinted,
        uint256 _collateralValueInUsd
    ) public pure returns (uint256) {
        return _calculateHealthFactor(_totalDscMinted, _collateralValueInUsd);
    }

    function getUsdValue(
        address _token,
        uint256 _amount
    ) public view returns (uint256) {
        return _getUsdValue(_token, _amount);
    }

    function getTokenAmountFromUsd(
        address _token,
        uint256 _usdAmountInWei
    ) public view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(
            s_priceFeeds[_token]
        );
        (, int256 answer, , , ) = priceFeed.staleCheckLatestRoundData();

        return
            (_usdAmountInWei * PRECISION) /
            (uint256(answer) * ADDITIONAL_FEED_PRECISION);
    }

    function getHealthFactor(address user) external view returns (uint256) {
        return _healthFactor(user);
    }

    function getCollateralBalance(
        address _user,
        address _token
    ) public view returns (uint256) {
        return s_collateralDeposited[_user][_token];
    }

    function getPrecision() external pure returns (uint256) {
        return PRECISION;
    }

    function getAdditionalFeedPrecision() external pure returns (uint256) {
        return ADDITIONAL_FEED_PRECISION;
    }

    function getLiquidationThreshold() external pure returns (uint256) {
        return LIQUIDATION_THRESHOLD;
    }

    function getLiquidationBonus() external pure returns (uint256) {
        return LIQUIDATION_BONUS;
    }

    function getLiquidationPrecision() external pure returns (uint256) {
        return LIQUIDATION_PRECISION;
    }

    function getMinHealthFactor() external pure returns (uint256) {
        return MIN_HEALTH_FACTOR;
    }

    function getCollateralTokens() external view returns (address[] memory) {
        return s_tokenCollateral;
    }

    function getDsc() external view returns (address) {
        return address(i_dsc);
    }

    function getCollateralTokenPriceFeed(
        address token
    ) external view returns (address) {
        return s_priceFeeds[token];
    }
}
