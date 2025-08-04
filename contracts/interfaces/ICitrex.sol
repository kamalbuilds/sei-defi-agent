// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ICitrex
 * @dev Interface for Citrex derivatives platform integration
 */
interface ICitrex {
    enum OrderType {
        MARKET,
        LIMIT,
        STOP_MARKET,
        STOP_LIMIT
    }
    
    enum OrderSide {
        BUY,
        SELL
    }
    
    enum OrderStatus {
        PENDING,
        FILLED,
        PARTIALLY_FILLED,
        CANCELLED,
        EXPIRED
    }
    
    enum PositionSide {
        LONG,
        SHORT
    }
    
    struct Market {
        string symbol;
        address baseAsset;
        address quoteAsset;
        uint256 minOrderSize;
        uint256 maxOrderSize;
        uint256 tickSize;
        uint256 makerFee;
        uint256 takerFee;
        uint256 maxLeverage;
        bool isActive;
    }
    
    struct Order {
        uint256 id;
        address user;
        string market;
        OrderType orderType;
        OrderSide side;
        uint256 size;
        uint256 price;
        uint256 stopPrice;
        uint256 filledSize;
        OrderStatus status;
        uint256 timestamp;
        uint256 expiryTime;
    }
    
    struct Position {
        string market;
        PositionSide side;
        uint256 size;
        uint256 entryPrice;
        uint256 markPrice;
        uint256 pnl;
        uint256 margin;
        uint256 leverage;
        uint256 liquidationPrice;
        uint256 timestamp;
    }
    
    struct AccountInfo {
        uint256 equity;
        uint256 freeCollateral;
        uint256 totalCollateral;
        uint256 initialMargin;
        uint256 maintenanceMargin;
        uint256 marginRatio;
        uint256 leverage;
        bool canTrade;
    }
    
    // Trading functions
    function placeOrder(
        string calldata market,
        OrderType orderType,
        OrderSide side,
        uint256 size,
        uint256 price,
        uint256 stopPrice,
        uint256 expiryTime
    ) external returns (uint256 orderId);
    
    function cancelOrder(uint256 orderId) external;
    function cancelAllOrders(string calldata market) external;
    function modifyOrder(
        uint256 orderId,
        uint256 newSize,
        uint256 newPrice
    ) external;
    
    // Position management
    function closePosition(
        string calldata market,
        uint256 size
    ) external;
    
    function closeAllPositions() external;
    
    function addMargin(
        string calldata market,
        uint256 amount
    ) external;
    
    function removeMargin(
        string calldata market,
        uint256 amount
    ) external;
    
    function setLeverage(
        string calldata market,
        uint256 leverage
    ) external;
    
    // Margin and collateral
    function deposit(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount) external;
    function withdrawAll(address token) external;
    
    // View functions
    function getOrder(uint256 orderId) external view returns (Order memory);
    function getOpenOrders(address user) external view returns (Order[] memory);
    function getOrderHistory(address user, uint256 limit) external view returns (Order[] memory);
    
    function getPosition(address user, string calldata market) external view returns (Position memory);
    function getPositions(address user) external view returns (Position[] memory);
    
    function getAccountInfo(address user) external view returns (AccountInfo memory);
    function getBalance(address user, address token) external view returns (uint256);
    function getMarginRequirement(string calldata market, uint256 size, uint256 price) external view returns (uint256);
    
    // Market data
    function getMarket(string calldata symbol) external view returns (Market memory);
    function getAllMarkets() external view returns (Market[] memory);
    function getMarkPrice(string calldata market) external view returns (uint256);
    function getIndexPrice(string calldata market) external view returns (uint256);
    function getOrderBook(string calldata market, uint256 depth) 
        external 
        view 
        returns (
            uint256[] memory bidPrices,
            uint256[] memory bidSizes,
            uint256[] memory askPrices,
            uint256[] memory askSizes
        );
    
    function getTrades(string calldata market, uint256 limit) 
        external 
        view 
        returns (
            uint256[] memory prices,
            uint256[] memory sizes,
            uint256[] memory timestamps,
            OrderSide[] memory sides
        );
    
    function get24hStats(string calldata market) 
        external 
        view 
        returns (
            uint256 volume,
            uint256 high,
            uint256 low,
            uint256 change
        );
    
    // Liquidation
    function liquidatePosition(
        address user,
        string calldata market
    ) external;
    
    function isLiquidatable(address user, string calldata market) external view returns (bool);
    function getLiquidationPrice(address user, string calldata market) external view returns (uint256);
    
    // Funding
    function getFundingRate(string calldata market) external view returns (int256);
    function getNextFundingTime(string calldata market) external view returns (uint256);
    function getFundingPayment(address user, string calldata market) external view returns (int256);
    
    // Insurance fund
    function getInsuranceFundBalance() external view returns (uint256);
    function contributeTo InsuranceFund(uint256 amount) external;
    
    // Fee discounts and rewards
    function getFeeDiscount(address user) external view returns (uint256);
    function getTradingRewards(address user) external view returns (uint256);
    function claimTradingRewards() external;
    
    // Risk management
    function setRiskParameters(
        string calldata market,
        uint256 maxLeverage,
        uint256 initialMarginRate,
        uint256 maintenanceMarginRate
    ) external;
    
    function pauseTrading(string calldata market) external;
    function resumeTrading(string calldata market) external;
    
    // Events
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed user,
        string market,
        OrderType orderType,
        OrderSide side,
        uint256 size,
        uint256 price
    );
    
    event OrderFilled(
        uint256 indexed orderId,
        address indexed user,
        string market,
        uint256 filledSize,
        uint256 filledPrice,
        uint256 fee
    );
    
    event OrderCancelled(
        uint256 indexed orderId,
        address indexed user,
        string market
    );
    
    event PositionOpened(
        address indexed user,
        string market,
        PositionSide side,
        uint256 size,
        uint256 entryPrice,
        uint256 leverage
    );
    
    event PositionClosed(
        address indexed user,
        string market,
        PositionSide side,
        uint256 size,
        uint256 exitPrice,
        int256 pnl
    );
    
    event PositionLiquidated(
        address indexed user,
        string market,
        uint256 size,
        uint256 liquidationPrice,
        uint256 liquidationFee
    );
    
    event MarginAdded(
        address indexed user,
        string market,
        uint256 amount
    );
    
    event MarginRemoved(
        address indexed user,
        string market,
        uint256 amount
    );
    
    event FundingPayment(
        address indexed user,
        string market,
        int256 amount
    );
}