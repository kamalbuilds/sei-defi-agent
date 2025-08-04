// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ISilo
 * @dev Interface for Silo isolated lending protocol integration
 */
interface ISilo {
    enum AssetStatus {
        ACTIVE,
        PAUSED,
        DEPRECATED
    }
    
    struct AssetStorage {
        address token;
        address collateralToken;
        address collateralOnlyToken;
        address debtToken;
        uint256 totalDeposits;
        uint256 collateralOnlyDeposits;
        uint256 totalBorrowAmount;
    }
    
    struct InterestRateModel {
        uint256 baseRate;
        uint256 optimalUtilization;
        uint256 slopeBeforeOptimal;
        uint256 slopeAfterOptimal;
    }
    
    struct SiloConfig {
        address silo;
        string name;
        address[] assets;
        uint256 maxLTV;
        uint256 liquidationThreshold;
        uint256 liquidationPenalty;
        bool isActive;
        uint256 creationTimestamp;
    }
    
    struct UserDeposit {
        uint256 amount;
        uint256 collateralAmount;
        uint256 collateralOnlyAmount;
        uint256 borrowAmount;
        uint256 lastInterestUpdate;
    }
    
    struct LiquidationData {
        address user;
        address asset;
        uint256 maxAmountToLiquidate;
        uint256 collateralToLiquidate;
        bool isHealthy;
    }
    
    // Core silo operations
    function deposit(
        address asset,
        uint256 amount,
        bool collateralOnly
    ) external returns (uint256 collateralAmount, uint256 collateralOnlyAmount);
    
    function withdraw(
        address asset,
        uint256 amount,
        bool collateralOnly
    ) external returns (uint256 withdrawnAmount);
    
    function borrow(
        address asset,
        uint256 amount
    ) external returns (uint256 debtAmount, uint256 borrowedAmount);
    
    function repay(
        address asset,
        uint256 amount
    ) external returns (uint256 repaidAmount, uint256 repaidShare);
    
    // Flash loans
    function flashLiquidate(
        address[] calldata users,
        bytes calldata flashReceiverData
    ) external;
    
    function flashLoan(
        address asset,
        uint256 amount,
        bytes calldata data
    ) external;
    
    // Liquidation functions
    function liquidate(
        address user,
        address asset,
        uint256 maxAmountToLiquidate,
        bool receiveCollateralToken
    ) external returns (
        uint256 actualAmountLiquidated,
        uint256 collateralToLiquidate
    );
    
    function isSolvent(address user) external view returns (bool);
    function getUserLTV(address user) external view returns (uint256);
    
    // Interest rate functions
    function accrueInterest(address asset) external returns (uint256 interest);
    function getCurrentInterestRates(address asset)
        external
        view
        returns (
            uint256 depositAPY,
            uint256 variableBorrowAPY
        );
    
    function utilizationRate(address asset) external view returns (uint256);
    
    // Asset management
    function getAssets() external view returns (address[] memory assets);
    function getAssetStorage(address asset) external view returns (AssetStorage memory);
    function assetTotalDeposits(address asset) external view returns (uint256);
    function assetTotalBorrowAmount(address asset) external view returns (uint256);
    
    // User account information
    function getUserDeposit(address asset, address user) 
        external 
        view 
        returns (UserDeposit memory);
    
    function balanceOfUnderlying(address user, address asset) 
        external 
        view 
        returns (uint256);
    
    function borrowBalanceOfUnderlying(address user, address asset) 
        external 
        view 
        returns (uint256);
    
    function getUserCollateralValue(address user) 
        external 
        view 
        returns (uint256 totalCollateralValue);
    
    function getUserBorrowValue(address user) 
        external 
        view 
        returns (uint256 totalBorrowValue);
    
    function getUserLiquidationData(address user, address asset) 
        external 
        view 
        returns (LiquidationData memory);
    
    // Silo configuration
    function getSiloConfig() external view returns (SiloConfig memory);
    function getMaxLTV() external view returns (uint256);
    function getLiquidationThreshold() external view returns (uint256);
    function getLiquidationPenalty() external view returns (uint256);
    
    // Token addresses
    function collateralToken(address asset) external view returns (address);
    function collateralOnlyToken(address asset) external view returns (address);
    function debtToken(address asset) external view returns (address);
    
    // Price oracle
    function getPriceProvider() external view returns (address);
    function getPrice(address asset) external view returns (uint256);
    function getLiquidationReward(address asset, uint256 amount) external view returns (uint256);
    
    // Incentives and rewards
    function claimRewards(address[] calldata assets) external returns (uint256 rewardAmount);
    function getUserRewards(address user, address[] calldata assets) external view returns (uint256);
    function getRewardToken() external view returns (address);
    
    // Share token functions
    function getShareToken(address asset) external view returns (address);
    function convertToShares(address asset, uint256 amount) external view returns (uint256 shares);
    function convertToAssets(address asset, uint256 shares) external view returns (uint256 assets);
    
    // Hooks and callbacks
    function beforeTokenTransfer(
        address asset,
        address from,
        address to,
        uint256 amount
    ) external;
    
    function afterTokenTransfer(
        address asset,
        address from,
        address to,
        uint256 amount
    ) external;
    
    // Administrative functions
    function setAssetStatus(address asset, AssetStatus status) external;
    function setInterestRateModel(address asset, InterestRateModel calldata model) external;
    function setMaxLTV(uint256 newMaxLTV) external;
    function setLiquidationThreshold(uint256 newThreshold) external;
    function pause() external;
    function unpause() external;
    
    // Bridge and cross-silo functions
    function bridgeAsset(
        address asset,
        address targetSilo,
        uint256 amount
    ) external;
    
    function crossSiloBorrow(
        address borrowAsset,
        address collateralSilo,
        uint256 amount
    ) external;
    
    // View functions for integrations
    function getVersion() external pure returns (string memory);
    function getSiloRepository() external view returns (address);
    function getNotificationReceiver() external view returns (address);
    
    // Events
    event Deposit(
        address indexed asset,
        address indexed depositor,
        uint256 amount,
        bool collateralOnly
    );
    
    event Withdraw(
        address indexed asset,
        address indexed depositor,
        uint256 amount,
        bool collateralOnly
    );
    
    event Borrow(
        address indexed asset,
        address indexed borrower,
        uint256 amount
    );
    
    event Repay(
        address indexed asset,
        address indexed borrower,
        uint256 amount
    );
    
    event Liquidate(
        address indexed asset,
        address indexed borrower,
        address indexed liquidator,
        uint256 amountLiquidated,
        uint256 collateralSeized
    );
    
    event FlashLoan(
        address indexed asset,
        address indexed receiver,
        uint256 amount,
        uint256 fee
    );
    
    event InterestAccrued(
        address indexed asset,
        uint256 totalDeposits,
        uint256 totalBorrowAmount,
        uint256 interest
    );
    
    event AssetStatusChanged(
        address indexed asset,
        AssetStatus oldStatus,
        AssetStatus newStatus
    );
    
    event RewardsClaimed(
        address indexed user,
        address[] assets,
        uint256 rewardAmount
    );
}