// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PriceOracle
 * @dev Centralized price oracle for NEXUS AI DeFi platform
 */
contract PriceOracle is AccessControl, ReentrancyGuard {
    bytes32 public constant ORACLE_UPDATER_ROLE = keccak256("ORACLE_UPDATER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    struct PriceData {
        uint256 price;
        uint256 timestamp;
        uint256 confidence;
        bool isActive;
    }

    struct PriceFeed {
        address token;
        uint256 price;
        uint256 lastUpdate;
        uint256 heartbeat; // Max time between updates
        uint8 decimals;
        bool isActive;
        string description;
    }

    mapping(address => PriceData) public prices;
    mapping(address => PriceFeed) public priceFeeds;
    mapping(address => bool) public supportedAssets;
    address[] public assetList;
    
    uint256 public constant PRICE_PRECISION = 1e8;
    uint256 public defaultHeartbeat = 3600; // 1 hour default
    uint256 public maxPriceDeviation = 1000; // 10% max deviation
    
    bool public emergencyMode;
    mapping(address => uint256) public emergencyPrices;
    
    event PriceUpdated(address indexed asset, uint256 price, uint256 timestamp, uint256 confidence);
    event AssetAdded(address indexed asset, string description);
    event AssetRemoved(address indexed asset);
    event EmergencyModeActivated();
    event EmergencyPriceSet(address indexed asset, uint256 price);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_UPDATER_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
    }

    /**
     * @dev Add supported asset
     */
    function addAsset(
        address asset,
        uint8 decimals,
        uint256 heartbeat,
        string calldata description
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(asset != address(0), "Invalid asset address");
        require(!supportedAssets[asset], "Asset already supported");
        
        supportedAssets[asset] = true;
        assetList.push(asset);
        
        priceFeeds[asset] = PriceFeed({
            token: asset,
            price: 0,
            lastUpdate: 0,
            heartbeat: heartbeat > 0 ? heartbeat : defaultHeartbeat,
            decimals: decimals,
            isActive: true,
            description: description
        });
        
        emit AssetAdded(asset, description);
    }

    /**
     * @dev Update price for an asset
     */
    function updatePrice(
        address asset,
        uint256 price,
        uint256 confidence
    ) external onlyRole(ORACLE_UPDATER_ROLE) {
        require(supportedAssets[asset], "Asset not supported");
        require(price > 0, "Invalid price");
        require(confidence >= 50 && confidence <= 100, "Invalid confidence");
        
        PriceFeed storage feed = priceFeeds[asset];
        PriceData storage priceData = prices[asset];
        
        // Check price deviation if previous price exists
        if (priceData.price > 0) {
            uint256 deviation = price > priceData.price ?
                ((price - priceData.price) * 10000) / priceData.price :
                ((priceData.price - price) * 10000) / priceData.price;
                
            require(deviation <= maxPriceDeviation, "Price deviation too high");
        }
        
        priceData.price = price;
        priceData.timestamp = block.timestamp;
        priceData.confidence = confidence;
        priceData.isActive = true;
        
        feed.price = price;
        feed.lastUpdate = block.timestamp;
        
        emit PriceUpdated(asset, price, block.timestamp, confidence);
    }

    /**
     * @dev Batch update multiple prices
     */
    function updatePrices(
        address[] calldata assets,
        uint256[] calldata priceList,
        uint256[] calldata confidenceList
    ) external onlyRole(ORACLE_UPDATER_ROLE) {
        require(
            assets.length == priceList.length && 
            priceList.length == confidenceList.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < assets.length; i++) {
            if (supportedAssets[assets[i]] && priceList[i] > 0) {
                _updatePriceInternal(assets[i], priceList[i], confidenceList[i]);
            }
        }
    }

    /**
     * @dev Get latest price for an asset
     */
    function getPrice(address asset) external view returns (uint256 price, uint256 timestamp) {
        require(supportedAssets[asset], "Asset not supported");
        
        if (emergencyMode && emergencyPrices[asset] > 0) {
            return (emergencyPrices[asset], block.timestamp);
        }
        
        PriceData memory priceData = prices[asset];
        require(priceData.isActive, "Price feed inactive");
        require(priceData.price > 0, "No price available");
        
        // Check if price is stale
        PriceFeed memory feed = priceFeeds[asset];
        require(
            block.timestamp <= priceData.timestamp + feed.heartbeat,
            "Price data stale"
        );
        
        return (priceData.price, priceData.timestamp);
    }

    /**
     * @dev Get price with confidence score
     */
    function getPriceWithConfidence(address asset) 
        external 
        view 
        returns (uint256 price, uint256 timestamp, uint256 confidence) 
    {
        require(supportedAssets[asset], "Asset not supported");
        
        if (emergencyMode && emergencyPrices[asset] > 0) {
            return (emergencyPrices[asset], block.timestamp, 100);
        }
        
        PriceData memory priceData = prices[asset];
        require(priceData.isActive, "Price feed inactive");
        require(priceData.price > 0, "No price available");
        
        return (priceData.price, priceData.timestamp, priceData.confidence);
    }

    /**
     * @dev Check if price is fresh
     */
    function isPriceFresh(address asset) external view returns (bool) {
        if (!supportedAssets[asset]) return false;
        
        PriceData memory priceData = prices[asset];
        PriceFeed memory feed = priceFeeds[asset];
        
        return priceData.isActive && 
               priceData.price > 0 && 
               block.timestamp <= priceData.timestamp + feed.heartbeat;
    }

    /**
     * @dev Get all supported assets
     */
    function getSupportedAssets() external view returns (address[] memory) {
        return assetList;
    }

    /**
     * @dev Get price feed information
     */
    function getPriceFeed(address asset) external view returns (PriceFeed memory) {
        require(supportedAssets[asset], "Asset not supported");
        return priceFeeds[asset];
    }

    /**
     * @dev Internal price update function
     */
    function _updatePriceInternal(
        address asset,
        uint256 price,
        uint256 confidence
    ) internal {
        PriceData storage priceData = prices[asset];
        PriceFeed storage feed = priceFeeds[asset];
        
        priceData.price = price;
        priceData.timestamp = block.timestamp;
        priceData.confidence = confidence;
        priceData.isActive = true;
        
        feed.price = price;
        feed.lastUpdate = block.timestamp;
        
        emit PriceUpdated(asset, price, block.timestamp, confidence);
    }

    /**
     * @dev Activate emergency mode
     */
    function activateEmergencyMode() external onlyRole(EMERGENCY_ROLE) {
        emergencyMode = true;
        emit EmergencyModeActivated();
    }

    /**
     * @dev Set emergency price
     */
    function setEmergencyPrice(
        address asset,
        uint256 price
    ) external onlyRole(EMERGENCY_ROLE) {
        require(emergencyMode, "Emergency mode not active");
        require(supportedAssets[asset], "Asset not supported");
        require(price > 0, "Invalid price");
        
        emergencyPrices[asset] = price;
        emit EmergencyPriceSet(asset, price);
    }

    /**
     * @dev Deactivate emergency mode
     */
    function deactivateEmergencyMode() external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyMode = false;
        
        // Clear emergency prices
        for (uint256 i = 0; i < assetList.length; i++) {
            delete emergencyPrices[assetList[i]];
        }
    }

    /**
     * @dev Update oracle parameters
     */
    function updateParameters(
        uint256 _defaultHeartbeat,
        uint256 _maxPriceDeviation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_defaultHeartbeat >= 300, "Heartbeat too short"); // Min 5 minutes
        require(_maxPriceDeviation <= 5000, "Max deviation too high"); // Max 50%
        
        defaultHeartbeat = _defaultHeartbeat;
        maxPriceDeviation = _maxPriceDeviation;
    }

    /**
     * @dev Remove asset support
     */
    function removeAsset(address asset) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(supportedAssets[asset], "Asset not supported");
        
        supportedAssets[asset] = false;
        priceFeeds[asset].isActive = false;
        prices[asset].isActive = false;
        
        // Remove from asset list
        for (uint256 i = 0; i < assetList.length; i++) {
            if (assetList[i] == asset) {
                assetList[i] = assetList[assetList.length - 1];
                assetList.pop();
                break;
            }
        }
        
        emit AssetRemoved(asset);
    }
}