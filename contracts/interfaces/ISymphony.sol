// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ISymphony
 * @dev Interface for Symphony protocol integration
 */
interface ISymphony {
    struct Market {
        address asset;
        address sToken; // Symphony token (collateral)
        address dToken; // Debt token
        uint256 totalSupply;
        uint256 totalBorrows;
        uint256 supplyRate;
        uint256 borrowRate;
        uint256 collateralFactor;
        uint256 liquidationThreshold;
        bool isActive;
    }
    
    struct UserAccount {
        uint256 totalCollateralETH;
        uint256 totalDebtETH;
        uint256 availableBorrowsETH;
        uint256 currentLiquidationThreshold;
        uint256 ltv;
        uint256 healthFactor;
    }
    
    struct ReserveData {
        uint256 liquidityRate;
        uint256 variableBorrowRate;
        uint256 stableBorrowRate;
        uint256 utilizationRate;
        uint256 totalSupply;
        uint256 availableLiquidity;
        uint256 totalStableDebt;
        uint256 totalVariableDebt;
        bool borrowingEnabled;
        bool usageAsCollateralEnabled;
        bool isActive;
    }
    
    // Core lending functions
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;
    
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
    
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;
    
    function repay(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) external returns (uint256);
    
    function swapBorrowRateMode(
        address asset,
        uint256 rateMode
    ) external;
    
    function rebalanceStableBorrowRate(
        address asset,
        address user
    ) external;
    
    function setUserUseReserveAsCollateral(
        address asset,
        bool useAsCollateral
    ) external;
    
    // Liquidation
    function liquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external;
    
    // Flash loans
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
    
    // View functions
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralETH,
            uint256 totalDebtETH,
            uint256 availableBorrowsETH,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
    
    function getUserReserveData(address asset, address user)
        external
        view
        returns (
            uint256 currentATokenBalance,
            uint256 currentStableDebt,
            uint256 currentVariableDebt,
            uint256 principalStableDebt,
            uint256 scaledVariableDebt,
            uint256 stableBorrowRate,
            uint256 liquidityRate,
            uint40 stableRateLastUpdated,
            bool usageAsCollateralEnabled
        );
    
    function getReserveData(address asset)
        external
        view
        returns (ReserveData memory);
    
    function getReservesList()
        external
        view
        returns (address[] memory);
    
    function paused() external view returns (bool);
    
    // Interest rate functions
    function getSupplyRate(address asset) external view returns (uint256);
    function getBorrowRate(address asset, uint256 mode) external view returns (uint256);
    function getUtilizationRate(address asset) external view returns (uint256);
    
    // Rewards and incentives
    function claimRewards(
        address[] calldata assets,
        uint256 amount,
        address to
    ) external returns (uint256);
    
    function getUserUnclaimedRewards(address user) external view returns (uint256);
    function getRewardsBalance(address[] calldata assets, address user) external view returns (uint256);
    
    // Governance and configuration
    function configureReserveAsCollateral(
        address asset,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    ) external;
    
    function enableBorrowingOnReserve(
        address asset,
        bool stableBorrowRateEnabled
    ) external;
    
    function freezeReserve(address asset) external;
    function unfreezeReserve(address asset) external;
    
    // Price oracle
    function getPriceOracle() external view returns (address);
    function getAssetPrice(address asset) external view returns (uint256);
    
    // Events
    event Supply(
        address indexed reserve,
        address user,
        address indexed onBehalfOf,
        uint256 amount,
        uint16 indexed referral
    );
    
    event Withdraw(
        address indexed reserve,
        address indexed user,
        address indexed to,
        uint256 amount
    );
    
    event Borrow(
        address indexed reserve,
        address user,
        address indexed onBehalfOf,
        uint256 amount,
        uint256 borrowRateMode,
        uint256 borrowRate,
        uint16 indexed referral
    );
    
    event Repay(
        address indexed reserve,
        address indexed user,
        address indexed repayer,
        uint256 amount
    );
    
    event LiquidationCall(
        address indexed collateralAsset,
        address indexed debtAsset,
        address indexed user,
        uint256 debtToCover,
        uint256 liquidatedCollateralAmount,
        address liquidator,
        bool receiveAToken
    );
    
    event RewardsClaimded(
        address indexed user,
        address indexed to,
        uint256 amount
    );
}