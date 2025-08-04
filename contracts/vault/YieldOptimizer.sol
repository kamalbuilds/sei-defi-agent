// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title YieldOptimizer
 * @dev AI-driven yield optimization across multiple DeFi protocols
 */
contract YieldOptimizer is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;
    using Math for uint256;

    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    enum ProtocolType {
        LENDING,
        YIELD_FARMING,
        LIQUIDITY_MINING,
        STAKING,
        ARBITRAGE,
        DERIVATIVES
    }

    enum StrategyStatus {
        ACTIVE,
        PAUSED,
        DEPRECATED,
        EMERGENCY
    }

    struct Protocol {
        address protocolAddress;
        ProtocolType protocolType;
        string name;
        uint256 currentAPY;
        uint256 tvl;
        uint256 riskScore; // 1-10 scale
        uint256 lastUpdate;
        bool isActive;
        uint256 maxAllocation; // Maximum percentage of funds
        uint256 minDeposit;
        uint256 withdrawalTime; // Time to withdraw
    }

    struct Strategy {
        uint256 protocolId;
        uint256 allocation; // Current allocation in basis points
        uint256 targetAllocation; // AI-determined target allocation
        uint256 depositedAmount;
        uint256 earnedYield;
        uint256 lastRebalance;
        StrategyStatus status;
        uint256 performanceScore; // Historical performance
    }

    struct OptimizationParams {
        uint256 maxRiskScore;
        uint256 minAPY;
        uint256 rebalanceThreshold; // Minimum difference to trigger rebalance
        uint256 maxProtocols; // Maximum number of protocols to use
        uint256 diversificationWeight; // Weight for diversification in optimization
        uint256 gasOptimizationWeight; // Weight for gas efficiency
    }

    struct MarketData {
        uint256 timestamp;
        uint256 volatilityIndex;
        uint256 marketSentiment; // 0-100 scale
        uint256 gasPrice;
        uint256 totalMarketTVL;
        mapping(uint256 => uint256) protocolAPYs;
    }

    // Core state
    IERC20 public immutable baseAsset;
    Protocol[] public protocols;
    Strategy[] public strategies;
    mapping(address => uint256) public protocolIds;
    mapping(address => bool) public approvedProtocols;
    
    // Optimization parameters
    OptimizationParams public optimizationParams;
    MarketData public marketData;
    
    // AI model parameters
    mapping(bytes32 => uint256) public aiModelWeights;
    mapping(address => uint256) public agentPredictionAccuracy;
    uint256 public modelConfidence = 75; // 0-100 scale
    
    // Performance tracking
    uint256 public totalYieldGenerated;
    uint256 public totalGasSpent;
    uint256 public successfulRebalances;
    uint256 public totalRebalances;
    
    // Emergency controls
    bool public emergencyMode;
    uint256 public maxSlippage = 300; // 3% max slippage
    uint256 public emergencyExitThreshold = 2000; // 20% loss threshold
    
    event ProtocolAdded(uint256 indexed protocolId, address protocol, string name);
    event StrategyOptimized(uint256 indexed strategyId, uint256 newAllocation, uint256 expectedAPY);
    event Rebalanced(uint256 totalValue, uint256 gasUsed);
    event YieldHarvested(uint256 indexed strategyId, uint256 amount);
    event EmergencyModeActivated(string reason);
    event MarketDataUpdated(uint256 volatilityIndex, uint256 sentiment);
    event AIModelUpdated(bytes32 modelHash, uint256 confidence);
    
    modifier notInEmergency() {
        require(!emergencyMode, "Emergency mode active");
        _;
    }
    
    modifier onlyVault() {
        require(hasRole(VAULT_ROLE, msg.sender), "Only vault can call");
        _;
    }
    
    modifier onlyAgent() {
        require(hasRole(AGENT_ROLE, msg.sender), "Only agent can call");
        _;
    }
    
    constructor(address _baseAsset) {
        baseAsset = IERC20(_baseAsset);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        
        // Initialize optimization parameters
        optimizationParams = OptimizationParams({
            maxRiskScore: 7,
            minAPY: 300, // 3% minimum APY
            rebalanceThreshold: 100, // 1%
            maxProtocols: 5,
            diversificationWeight: 30,
            gasOptimizationWeight: 20
        });
    }
    
    /**
     * @dev Add a new protocol for yield optimization
     */
    function addProtocol(
        address protocolAddress,
        ProtocolType protocolType,
        string calldata name,
        uint256 riskScore,
        uint256 maxAllocation,
        uint256 minDeposit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(protocolAddress != address(0), "Invalid protocol address");
        require(!approvedProtocols[protocolAddress], "Protocol already added");
        require(riskScore >= 1 && riskScore <= 10, "Invalid risk score");
        require(maxAllocation <= 10000, "Invalid max allocation");
        
        uint256 protocolId = protocols.length;
        
        protocols.push(Protocol({
            protocolAddress: protocolAddress,
            protocolType: protocolType,
            name: name,
            currentAPY: 0,
            tvl: 0,
            riskScore: riskScore,
            lastUpdate: block.timestamp,
            isActive: true,
            maxAllocation: maxAllocation,
            minDeposit: minDeposit,
            withdrawalTime: 0
        }));
        
        protocolIds[protocolAddress] = protocolId;
        approvedProtocols[protocolAddress] = true;
        
        emit ProtocolAdded(protocolId, protocolAddress, name);
    }
    
    /**
     * @dev AI-driven yield optimization
     */
    function optimizeYield(uint256 totalAssets) 
        external 
        onlyAgent 
        notInEmergency 
        returns (uint256[] memory newAllocations) 
    {
        require(totalAssets > 0, "No assets to optimize");
        
        // Update market data
        _updateMarketData();
        
        // Calculate optimal allocations using AI model
        newAllocations = _calculateOptimalAllocations(totalAssets);
        
        // Update strategies with new allocations
        _updateStrategyAllocations(newAllocations);
        
        // Execute rebalancing if needed
        if (_shouldRebalance()) {
            _executeRebalance(totalAssets, newAllocations);
        }
        
        return newAllocations;
    }
    
    /**
     * @dev Calculate optimal allocations using AI model
     */
    function _calculateOptimalAllocations(uint256 totalAssets) 
        internal 
        view 
        returns (uint256[] memory allocations) 
    {
        allocations = new uint256[](protocols.length);
        
        // AI-driven allocation calculation
        uint256 totalScore = 0;
        uint256[] memory protocolScores = new uint256[](protocols.length);
        
        // Calculate scores for each protocol
        for (uint256 i = 0; i < protocols.length; i++) {
            if (!protocols[i].isActive) continue;
            
            protocolScores[i] = _calculateProtocolScore(i);
            totalScore += protocolScores[i];
        }
        
        // Allocate based on scores with diversification constraints
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocolScores[i] == 0 || totalScore == 0) continue;
            
            uint256 baseAllocation = (protocolScores[i] * 10000) / totalScore;
            
            // Apply maximum allocation constraint
            uint256 maxAllowed = protocols[i].maxAllocation;
            allocations[i] = baseAllocation > maxAllowed ? maxAllowed : baseAllocation;
            
            // Apply minimum deposit constraint
            uint256 allocationAmount = (totalAssets * allocations[i]) / 10000;
            if (allocationAmount < protocols[i].minDeposit) {
                allocations[i] = 0;
            }
        }
        
        // Normalize allocations to ensure they sum to 100%
        allocations = _normalizeAllocations(allocations);
        
        return allocations;
    }
    
    /**
     * @dev Calculate protocol score for optimization
     */
    function _calculateProtocolScore(uint256 protocolId) 
        internal 
        view 
        returns (uint256 score) 
    {
        Protocol memory protocol = protocols[protocolId];
        
        // Base score from APY
        uint256 apyScore = protocol.currentAPY;
        
        // Risk adjustment
        uint256 riskAdjustment = (11 - protocol.riskScore) * 10;
        apyScore = (apyScore * riskAdjustment) / 100;
        
        // Market sentiment adjustment
        uint256 sentimentMultiplier = (marketData.marketSentiment + 50) / 100;
        apyScore = (apyScore * sentimentMultiplier) / 100;
        
        // Volatility adjustment
        if (marketData.volatilityIndex > 50) {
            apyScore = (apyScore * (150 - marketData.volatilityIndex)) / 100;
        }
        
        // Gas optimization factor
        uint256 gasScore = _calculateGasEfficiencyScore(protocolId);
        
        // Combined score with weights
        score = (apyScore * 70 + gasScore * 30) / 100;
        
        return score;
    }
    
    /**
     * @dev Calculate gas efficiency score for a protocol
     */
    function _calculateGasEfficiencyScore(uint256 protocolId) 
        internal 
        view 
        returns (uint256) 
    {
        Protocol memory protocol = protocols[protocolId];
        
        // Estimate gas costs based on protocol type
        uint256 gasEstimate;
        
        if (protocol.protocolType == ProtocolType.LENDING) {
            gasEstimate = 200000; // Estimated gas for lending protocols
        } else if (protocol.protocolType == ProtocolType.YIELD_FARMING) {
            gasEstimate = 350000; // Higher gas for complex farming
        } else if (protocol.protocolType == ProtocolType.STAKING) {
            gasEstimate = 150000; // Lower gas for simple staking
        } else {
            gasEstimate = 300000; // Default estimate
        }
        
        // Calculate efficiency score (inverse of gas cost)
        uint256 gasCost = gasEstimate * marketData.gasPrice;
        uint256 maxScore = 100;
        
        return gasCost > 0 ? (maxScore * 1e18) / gasCost : maxScore;
    }
    
    /**
     * @dev Normalize allocations to sum to 100%
     */
    function _normalizeAllocations(uint256[] memory allocations) 
        internal 
        pure 
        returns (uint256[] memory) 
    {
        uint256 total = 0;
        for (uint256 i = 0; i < allocations.length; i++) {
            total += allocations[i];
        }
        
        if (total == 0) return allocations;
        
        // Normalize to 10000 basis points (100%)
        for (uint256 i = 0; i < allocations.length; i++) {
            allocations[i] = (allocations[i] * 10000) / total;
        }
        
        return allocations;
    }
    
    /**
     * @dev Update strategy allocations
     */
    function _updateStrategyAllocations(uint256[] memory newAllocations) internal {
        // Ensure we have enough strategies
        while (strategies.length < protocols.length) {
            strategies.push(Strategy({
                protocolId: strategies.length,
                allocation: 0,
                targetAllocation: 0,
                depositedAmount: 0,
                earnedYield: 0,
                lastRebalance: 0,
                status: StrategyStatus.ACTIVE,
                performanceScore: 50 // Start with neutral score
            }));
        }
        
        // Update target allocations
        for (uint256 i = 0; i < newAllocations.length; i++) {
            if (i < strategies.length) {
                strategies[i].targetAllocation = newAllocations[i];
            }
        }
    }
    
    /**
     * @dev Check if rebalancing is needed
     */
    function _shouldRebalance() internal view returns (bool) {
        for (uint256 i = 0; i < strategies.length; i++) {
            Strategy memory strategy = strategies[i];
            if (strategy.status != StrategyStatus.ACTIVE) continue;
            
            uint256 diff = strategy.targetAllocation > strategy.allocation ?
                strategy.targetAllocation - strategy.allocation :
                strategy.allocation - strategy.targetAllocation;
                
            if (diff >= optimizationParams.rebalanceThreshold) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Execute rebalancing
     */
    function _executeRebalance(uint256 totalAssets, uint256[] memory newAllocations) 
        internal 
    {
        uint256 gasStart = gasleft();
        
        // Withdraw from over-allocated strategies
        for (uint256 i = 0; i < strategies.length; i++) {
            Strategy storage strategy = strategies[i];
            if (strategy.status != StrategyStatus.ACTIVE) continue;
            
            uint256 currentAmount = strategy.depositedAmount;
            uint256 targetAmount = (totalAssets * newAllocations[i]) / 10000;
            
            if (currentAmount > targetAmount && currentAmount > 0) {
                uint256 withdrawAmount = currentAmount - targetAmount;
                _withdrawFromProtocol(i, withdrawAmount);
                strategy.depositedAmount -= withdrawAmount;
            }
        }
        
        // Deposit to under-allocated strategies
        for (uint256 i = 0; i < strategies.length; i++) {
            Strategy storage strategy = strategies[i];
            if (strategy.status != StrategyStatus.ACTIVE) continue;
            
            uint256 currentAmount = strategy.depositedAmount;
            uint256 targetAmount = (totalAssets * newAllocations[i]) / 10000;
            
            if (targetAmount > currentAmount) {
                uint256 depositAmount = targetAmount - currentAmount;
                uint256 available = baseAsset.balanceOf(address(this));
                
                depositAmount = depositAmount > available ? available : depositAmount;
                
                if (depositAmount > 0) {
                    _depositToProtocol(i, depositAmount);
                    strategy.depositedAmount += depositAmount;
                }
            }
            
            // Update allocation and timestamp
            strategy.allocation = newAllocations[i];
            strategy.lastRebalance = block.timestamp;
        }
        
        // Track rebalance metrics
        uint256 gasUsed = gasStart - gasleft();
        totalGasSpent += gasUsed;
        totalRebalances++;
        
        emit Rebalanced(totalAssets, gasUsed);
    }
    
    /**
     * @dev Deposit to a specific protocol
     */
    function _depositToProtocol(uint256 strategyId, uint256 amount) internal {
        require(strategyId < strategies.length, "Invalid strategy ID");
        
        Strategy storage strategy = strategies[strategyId];
        Protocol memory protocol = protocols[strategy.protocolId];
        
        // Transfer tokens to protocol
        baseAsset.safeTransfer(protocol.protocolAddress, amount);
        
        // Call protocol-specific deposit function
        // This would be implemented based on each protocol's interface
        // For now, it's a placeholder
    }
    
    /**
     * @dev Withdraw from a specific protocol
     */
    function _withdrawFromProtocol(uint256 strategyId, uint256 amount) internal {
        require(strategyId < strategies.length, "Invalid strategy ID");
        
        Strategy storage strategy = strategies[strategyId];
        Protocol memory protocol = protocols[strategy.protocolId];
        
        // Call protocol-specific withdraw function
        // This would be implemented based on each protocol's interface
        // For now, it's a placeholder
    }
    
    /**
     * @dev Update market data
     */
    function _updateMarketData() internal {
        // This would typically fetch from oracles or external data sources
        // For now, using placeholder values
        marketData.timestamp = block.timestamp;
        marketData.gasPrice = tx.gasprice;
    }
    
    /**
     * @dev Harvest yield from all active strategies
     */
    function harvestAll() external nonReentrant returns (uint256 totalHarvested) {
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].status == StrategyStatus.ACTIVE) {
                totalHarvested += _harvestStrategy(i);
            }
        }
        
        return totalHarvested;
    }
    
    /**
     * @dev Harvest yield from a specific strategy
     */
    function _harvestStrategy(uint256 strategyId) internal returns (uint256 harvested) {
        Strategy storage strategy = strategies[strategyId];
        Protocol memory protocol = protocols[strategy.protocolId];
        
        uint256 beforeBalance = baseAsset.balanceOf(address(this));
        
        // Call protocol-specific harvest function
        // This would be implemented based on each protocol's interface
        
        uint256 afterBalance = baseAsset.balanceOf(address(this));
        harvested = afterBalance - beforeBalance;
        
        if (harvested > 0) {
            strategy.earnedYield += harvested;
            totalYieldGenerated += harvested;
            
            emit YieldHarvested(strategyId, harvested);
        }
        
        return harvested;
    }
    
    /**
     * @dev Update protocol APY data
     */
    function updateProtocolAPY(
        uint256 protocolId,
        uint256 newAPY,
        uint256 newTVL
    ) external onlyRole(ORACLE_ROLE) {
        require(protocolId < protocols.length, "Invalid protocol ID");
        
        Protocol storage protocol = protocols[protocolId];
        protocol.currentAPY = newAPY;
        protocol.tvl = newTVL;
        protocol.lastUpdate = block.timestamp;
        
        // Store in market data mapping
        marketData.protocolAPYs[protocolId] = newAPY;
    }
    
    /**
     * @dev Update market sentiment and volatility data
     */
    function updateMarketData(
        uint256 volatilityIndex,
        uint256 marketSentiment,
        uint256 totalMarketTVL
    ) external onlyRole(ORACLE_ROLE) {
        require(volatilityIndex <= 100, "Invalid volatility index");
        require(marketSentiment <= 100, "Invalid market sentiment");
        
        marketData.volatilityIndex = volatilityIndex;
        marketData.marketSentiment = marketSentiment;
        marketData.totalMarketTVL = totalMarketTVL;
        marketData.timestamp = block.timestamp;
        
        emit MarketDataUpdated(volatilityIndex, marketSentiment);
    }
    
    /**
     * @dev Emergency exit from all protocols
     */
    function emergencyExit(string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyMode = true;
        
        // Withdraw from all protocols
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].depositedAmount > 0) {
                _withdrawFromProtocol(i, strategies[i].depositedAmount);
                strategies[i].status = StrategyStatus.EMERGENCY;
            }
        }
        
        emit EmergencyModeActivated(reason);
    }
    
    /**
     * @dev Update optimization parameters
     */
    function updateOptimizationParams(
        uint256 maxRiskScore,
        uint256 minAPY,
        uint256 rebalanceThreshold,
        uint256 maxProtocols,
        uint256 diversificationWeight,
        uint256 gasOptimizationWeight
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(maxRiskScore <= 10, "Invalid max risk score");
        require(rebalanceThreshold <= 1000, "Invalid rebalance threshold");
        require(maxProtocols > 0, "Invalid max protocols");
        
        optimizationParams.maxRiskScore = maxRiskScore;
        optimizationParams.minAPY = minAPY;
        optimizationParams.rebalanceThreshold = rebalanceThreshold;
        optimizationParams.maxProtocols = maxProtocols;
        optimizationParams.diversificationWeight = diversificationWeight;
        optimizationParams.gasOptimizationWeight = gasOptimizationWeight;
    }
    
    /**
     * @dev Get optimization metrics
     */
    function getOptimizationMetrics() external view returns (
        uint256 totalYield,
        uint256 totalGasSpent,
        uint256 successfulRebalances,
        uint256 totalRebalances,
        uint256 efficiency
    ) {
        totalYield = totalYieldGenerated;
        totalGasSpent = totalGasSpent;
        successfulRebalances = successfulRebalances;
        totalRebalances = totalRebalances;
        
        // Calculate efficiency as yield per gas unit
        efficiency = totalGasSpent > 0 ? (totalYield * 1e18) / totalGasSpent : 0;
        
        return (totalYield, totalGasSpent, successfulRebalances, totalRebalances, efficiency);
    }
    
    /**
     * @dev Get current protocol allocations
     */
    function getCurrentAllocations() external view returns (
        uint256[] memory protocolIds,
        uint256[] memory allocations,
        uint256[] memory amounts
    ) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].status == StrategyStatus.ACTIVE && strategies[i].allocation > 0) {
                activeCount++;
            }
        }
        
        protocolIds = new uint256[](activeCount);
        allocations = new uint256[](activeCount);
        amounts = new uint256[](activeCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < strategies.length; i++) {
            Strategy memory strategy = strategies[i];
            if (strategy.status == StrategyStatus.ACTIVE && strategy.allocation > 0) {
                protocolIds[index] = strategy.protocolId;
                allocations[index] = strategy.allocation;
                amounts[index] = strategy.depositedAmount;
                index++;
            }
        }
        
        return (protocolIds, allocations, amounts);
    }
}