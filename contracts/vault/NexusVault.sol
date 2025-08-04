// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title NexusVault
 * @dev Main vault contract for NEXUS AI DeFi platform with yield optimization
 */
contract NexusVault is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;
    using Math for uint256;

    bytes32 public constant STRATEGY_ROLE = keccak256("STRATEGY_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    enum StrategyStatus {
        ACTIVE,
        PAUSED,
        DEPRECATED,
        EMERGENCY_EXIT
    }

    struct StrategyInfo {
        address strategy;
        uint256 allocation; // Percentage allocation (in basis points)
        uint256 totalDeposited;
        uint256 totalWithdrawn;
        uint256 lastHarvest;
        StrategyStatus status;
        uint256 performanceFee; // Performance fee in basis points
        uint256 riskScore; // Risk score 1-10
        string name;
    }

    struct UserInfo {
        uint256 shares;
        uint256 depositTime;
        uint256 lastAction;
        uint256 totalDeposited;
        uint256 totalWithdrawn;
        uint256 rewardDebt;
    }

    struct VaultStats {
        uint256 totalAssets;
        uint256 totalShares;
        uint256 totalYieldGenerated;
        uint256 totalFeesPaid;
        uint256 pricePerShare;
        uint256 apy; // Annual Percentage Yield
        uint256 lastUpdate;
    }

    // Core vault variables
    IERC20 public immutable asset; // Base asset (e.g., USDC)
    string public name;
    string public symbol;
    uint256 public decimals;
    
    // Strategy management
    StrategyInfo[] public strategies;
    mapping(address => uint256) public strategyIndexes;
    mapping(address => bool) public approvedStrategies;
    
    // User management
    mapping(address => UserInfo) public users;
    mapping(address => bool) public whitelistedAgents;
    
    // Vault stats
    VaultStats public vaultStats;
    
    // Fees and limits
    uint256 public managementFee = 200; // 2% annual management fee
    uint256 public performanceFee = 1000; // 10% performance fee
    uint256 public withdrawalFee = 50; // 0.5% withdrawal fee
    uint256 public minDeposit = 1000e6; // Minimum deposit (1000 USDC)
    uint256 public maxTVL = 100000000e6; // Maximum Total Value Locked
    
    // Emergency and safety
    bool public emergencyShutdown;
    uint256 public lastEmergencyCheck;
    uint256 public emergencyWithdrawDelay = 24 hours;
    
    // Yield distribution
    uint256 public agentRewardRate = 300; // 3% of yield to agents
    uint256 public treasuryRate = 200; // 2% to treasury
    address public treasury;
    
    // AI-driven parameters
    uint256 public aiConfidenceScore = 80; // AI prediction confidence (0-100)
    uint256 public rebalanceThreshold = 500; // 5% threshold for rebalancing
    uint256 public lastRebalance;
    
    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);
    event StrategyAdded(address indexed strategy, uint256 allocation, string name);
    event StrategyRemoved(address indexed strategy, string reason);
    event Harvest(address indexed strategy, uint256 profit, uint256 loss);
    event Rebalance(uint256 timestamp, uint256 totalValue);
    event EmergencyShutdown(address indexed caller, string reason);
    event YieldDistributed(uint256 totalYield, uint256 agentRewards, uint256 treasuryRewards);
    event AIParametersUpdated(uint256 confidenceScore, uint256 rebalanceThreshold);
    
    modifier notShutdown() {
        require(!emergencyShutdown, "Vault is shutdown");
        _;
    }
    
    modifier onlyStrategy() {
        require(hasRole(STRATEGY_ROLE, msg.sender), "Not authorized strategy");
        _;
    }
    
    modifier onlyAgent() {
        require(hasRole(AGENT_ROLE, msg.sender), "Not authorized agent");
        _;
    }
    
    constructor(
        address _asset,
        string memory _name,
        string memory _symbol,
        address _treasury
    ) {
        asset = IERC20(_asset);
        name = _name;
        symbol = _symbol;
        treasury = _treasury;
        decimals = 18; // Vault shares have 18 decimals
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        
        vaultStats.pricePerShare = 1e18; // Initial price per share
        vaultStats.lastUpdate = block.timestamp;
        lastEmergencyCheck = block.timestamp;
    }
    
    /**
     * @dev Deposit assets into the vault
     */
    function deposit(uint256 assets, address receiver) 
        external 
        nonReentrant 
        notShutdown 
        returns (uint256 shares) 
    {
        require(assets >= minDeposit, "Below minimum deposit");
        require(vaultStats.totalAssets + assets <= maxTVL, "Exceeds max TVL");
        require(receiver != address(0), "Invalid receiver");
        
        // Calculate shares to mint
        shares = convertToShares(assets);
        require(shares > 0, "Zero shares");
        
        // Update user info
        UserInfo storage user = users[receiver];
        user.shares += shares;
        user.totalDeposited += assets;
        user.depositTime = block.timestamp;
        user.lastAction = block.timestamp;
        
        // Update vault stats
        vaultStats.totalShares += shares;
        vaultStats.totalAssets += assets;
        
        // Transfer assets
        asset.safeTransferFrom(msg.sender, address(this), assets);
        
        // Trigger rebalance if needed
        if (_shouldRebalance()) {
            _rebalance();
        }
        
        emit Deposit(receiver, assets, shares);
    }
    
    /**
     * @dev Withdraw assets from the vault
     */
    function withdraw(
        uint256 shares,
        address receiver,
        address owner
    ) external nonReentrant returns (uint256 assets) {
        require(shares > 0, "Zero shares");
        require(receiver != address(0), "Invalid receiver");
        
        // Check ownership or allowance
        if (msg.sender != owner) {
            // Implement allowance logic if needed
            revert("Not authorized");
        }
        
        UserInfo storage user = users[owner];
        require(user.shares >= shares, "Insufficient shares");
        
        // Calculate assets to withdraw
        assets = convertToAssets(shares);
        
        // Apply withdrawal fee if not emergency
        uint256 fee = 0;
        if (!emergencyShutdown && block.timestamp < user.depositTime + 7 days) {
            fee = (assets * withdrawalFee) / 10000;
            assets -= fee;
        }
        
        // Update user info
        user.shares -= shares;
        user.totalWithdrawn += assets;
        user.lastAction = block.timestamp;
        
        // Update vault stats
        vaultStats.totalShares -= shares;
        vaultStats.totalAssets -= (assets + fee);
        
        // Ensure we have enough liquid assets
        uint256 liquidAssets = asset.balanceOf(address(this));
        if (liquidAssets < assets) {
            _withdrawFromStrategies(assets - liquidAssets);
        }
        
        // Transfer assets
        asset.safeTransfer(receiver, assets);
        
        if (fee > 0) {
            asset.safeTransfer(treasury, fee);
        }
        
        emit Withdraw(receiver, assets, shares);
    }
    
    /**
     * @dev Add a new strategy
     */
    function addStrategy(
        address strategy,
        uint256 allocation,
        uint256 performanceFeeRate,
        uint256 riskScore,
        string calldata strategyName
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(strategy != address(0), "Invalid strategy");
        require(!approvedStrategies[strategy], "Strategy already added");
        require(allocation <= 10000, "Invalid allocation"); // Max 100%
        require(riskScore >= 1 && riskScore <= 10, "Invalid risk score");
        
        // Check total allocation doesn't exceed 100%
        uint256 totalAllocation = allocation;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].status == StrategyStatus.ACTIVE) {
                totalAllocation += strategies[i].allocation;
            }
        }
        require(totalAllocation <= 10000, "Total allocation exceeds 100%");
        
        strategies.push(StrategyInfo({
            strategy: strategy,
            allocation: allocation,
            totalDeposited: 0,
            totalWithdrawn: 0,
            lastHarvest: block.timestamp,
            status: StrategyStatus.ACTIVE,
            performanceFee: performanceFeeRate,
            riskScore: riskScore,
            name: strategyName
        }));
        
        strategyIndexes[strategy] = strategies.length - 1;
        approvedStrategies[strategy] = true;
        
        _grantRole(STRATEGY_ROLE, strategy);
        
        emit StrategyAdded(strategy, allocation, strategyName);
    }
    
    /**
     * @dev Remove or deprecate a strategy
     */
    function removeStrategy(
        address strategy,
        string calldata reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(approvedStrategies[strategy], "Strategy not approved");
        
        uint256 index = strategyIndexes[strategy];
        strategies[index].status = StrategyStatus.DEPRECATED;
        
        // Withdraw all funds from strategy
        _emergencyWithdrawFromStrategy(strategy);
        
        approvedStrategies[strategy] = false;
        _revokeRole(STRATEGY_ROLE, strategy);
        
        emit StrategyRemoved(strategy, reason);
    }
    
    /**
     * @dev Harvest yield from strategies
     */
    function harvest(address strategy) external onlyRole(STRATEGY_ROLE) nonReentrant {
        require(approvedStrategies[strategy], "Strategy not approved");
        
        uint256 index = strategyIndexes[strategy];
        StrategyInfo storage stratInfo = strategies[index];
        require(stratInfo.status == StrategyStatus.ACTIVE, "Strategy not active");
        
        uint256 beforeBalance = asset.balanceOf(address(this));
        
        // Call strategy harvest (implementation depends on specific strategy)
        // This is a placeholder - actual implementation would call strategy contract
        
        uint256 afterBalance = asset.balanceOf(address(this));
        uint256 profit = afterBalance - beforeBalance;
        
        if (profit > 0) {
            // Update stats
            vaultStats.totalYieldGenerated += profit;
            stratInfo.lastHarvest = block.timestamp;
            
            // Distribute yield
            _distributeYield(profit);
            
            emit Harvest(strategy, profit, 0);
        }
        
        // Update price per share
        _updatePricePerShare();
    }
    
    /**
     * @dev AI-driven rebalancing of strategies
     */
    function rebalance() external onlyAgent {
        require(_shouldRebalance(), "Rebalance not needed");
        _rebalance();
    }
    
    /**
     * @dev Emergency shutdown of the vault
     */
    function emergencyShutdownVault(string calldata reason) 
        external 
        onlyRole(EMERGENCY_ROLE) 
    {
        emergencyShutdown = true;
        
        // Withdraw from all strategies
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].status == StrategyStatus.ACTIVE) {
                strategies[i].status = StrategyStatus.EMERGENCY_EXIT;
                _emergencyWithdrawFromStrategy(strategies[i].strategy);
            }
        }
        
        emit EmergencyShutdown(msg.sender, reason);
    }
    
    /**
     * @dev Update AI parameters
     */
    function updateAIParameters(
        uint256 _aiConfidenceScore,
        uint256 _rebalanceThreshold
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_aiConfidenceScore <= 100, "Invalid confidence score");
        require(_rebalanceThreshold <= 2000, "Invalid rebalance threshold"); // Max 20%
        
        aiConfidenceScore = _aiConfidenceScore;
        rebalanceThreshold = _rebalanceThreshold;
        
        emit AIParametersUpdated(_aiConfidenceScore, _rebalanceThreshold);
    }
    
    /**
     * @dev Internal rebalancing logic
     */
    function _rebalance() internal {
        uint256 totalAssets = totalAssetsManaged();
        
        // Calculate target allocations for each strategy
        for (uint256 i = 0; i < strategies.length; i++) {
            StrategyInfo storage stratInfo = strategies[i];
            if (stratInfo.status != StrategyStatus.ACTIVE) continue;
            
            uint256 targetAmount = (totalAssets * stratInfo.allocation) / 10000;
            uint256 currentAmount = stratInfo.totalDeposited - stratInfo.totalWithdrawn;
            
            if (targetAmount > currentAmount) {
                // Need to deposit more
                uint256 toDeposit = targetAmount - currentAmount;
                uint256 available = asset.balanceOf(address(this));
                
                if (available >= toDeposit) {
                    asset.safeTransfer(stratInfo.strategy, toDeposit);
                    stratInfo.totalDeposited += toDeposit;
                }
            } else if (currentAmount > targetAmount) {
                // Need to withdraw excess
                uint256 toWithdraw = currentAmount - targetAmount;
                _withdrawFromStrategy(stratInfo.strategy, toWithdraw);
            }
        }
        
        lastRebalance = block.timestamp;
        emit Rebalance(block.timestamp, totalAssets);
    }
    
    /**
     * @dev Check if rebalancing is needed
     */
    function _shouldRebalance() internal view returns (bool) {
        if (block.timestamp < lastRebalance + 1 hours) return false;
        
        uint256 totalAssets = totalAssetsManaged();
        
        for (uint256 i = 0; i < strategies.length; i++) {
            StrategyInfo storage stratInfo = strategies[i];
            if (stratInfo.status != StrategyStatus.ACTIVE) continue;
            
            uint256 targetAmount = (totalAssets * stratInfo.allocation) / 10000;
            uint256 currentAmount = stratInfo.totalDeposited - stratInfo.totalWithdrawn;
            
            uint256 deviation = targetAmount > currentAmount ?
                targetAmount - currentAmount :
                currentAmount - targetAmount;
                
            if (totalAssets > 0 && (deviation * 10000) / totalAssets > rebalanceThreshold) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Distribute yield to agents and treasury
     */
    function _distributeYield(uint256 totalYield) internal {
        uint256 agentRewards = (totalYield * agentRewardRate) / 10000;
        uint256 treasuryRewards = (totalYield * treasuryRate) / 10000;
        
        if (agentRewards > 0) {
            // Distribute to active agents (simplified - would implement proper distribution)
            asset.safeTransfer(treasury, agentRewards); // Placeholder
        }
        
        if (treasuryRewards > 0) {
            asset.safeTransfer(treasury, treasuryRewards);
        }
        
        emit YieldDistributed(totalYield, agentRewards, treasuryRewards);
    }
    
    /**
     * @dev Update price per share based on current assets
     */
    function _updatePricePerShare() internal {
        if (vaultStats.totalShares > 0) {
            uint256 totalValue = totalAssetsManaged();
            vaultStats.pricePerShare = (totalValue * 1e18) / vaultStats.totalShares;
        }
        vaultStats.lastUpdate = block.timestamp;
    }
    
    /**
     * @dev Withdraw assets from strategies when needed
     */
    function _withdrawFromStrategies(uint256 amountNeeded) internal {
        uint256 withdrawn = 0;
        
        for (uint256 i = 0; i < strategies.length && withdrawn < amountNeeded; i++) {
            StrategyInfo storage stratInfo = strategies[i];
            if (stratInfo.status != StrategyStatus.ACTIVE) continue;
            
            uint256 available = stratInfo.totalDeposited - stratInfo.totalWithdrawn;
            uint256 toWithdraw = Math.min(available, amountNeeded - withdrawn);
            
            if (toWithdraw > 0) {
                _withdrawFromStrategy(stratInfo.strategy, toWithdraw);
                withdrawn += toWithdraw;
            }
        }
    }
    
    /**
     * @dev Withdraw from a specific strategy
     */
    function _withdrawFromStrategy(address strategy, uint256 amount) internal {
        uint256 index = strategyIndexes[strategy];
        StrategyInfo storage stratInfo = strategies[index];
        
        // Call strategy withdraw (placeholder)
        // Actual implementation would call strategy contract's withdraw function
        
        stratInfo.totalWithdrawn += amount;
    }
    
    /**
     * @dev Emergency withdraw from strategy
     */
    function _emergencyWithdrawFromStrategy(address strategy) internal {
        uint256 index = strategyIndexes[strategy];
        StrategyInfo storage stratInfo = strategies[index];
        uint256 amount = stratInfo.totalDeposited - stratInfo.totalWithdrawn;
        
        if (amount > 0) {
            _withdrawFromStrategy(strategy, amount);
        }
    }
    
    /**
     * @dev Convert assets to shares
     */
    function convertToShares(uint256 assets) public view returns (uint256) {
        if (vaultStats.totalShares == 0 || vaultStats.pricePerShare == 0) {
            return assets; // 1:1 ratio for first deposit
        }
        return (assets * 1e18) / vaultStats.pricePerShare;
    }
    
    /**
     * @dev Convert shares to assets
     */
    function convertToAssets(uint256 shares) public view returns (uint256) {
        if (vaultStats.totalShares == 0) {
            return shares;
        }
        return (shares * vaultStats.pricePerShare) / 1e18;
    }
    
    /**
     * @dev Get total assets under management
     */
    function totalAssetsManaged() public view returns (uint256) {
        uint256 liquid = asset.balanceOf(address(this));
        uint256 deployed = 0;
        
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].status == StrategyStatus.ACTIVE) {
                deployed += strategies[i].totalDeposited - strategies[i].totalWithdrawn;
            }
        }
        
        return liquid + deployed;
    }
    
    /**
     * @dev Get vault performance metrics
     */
    function getPerformanceMetrics() external view returns (
        uint256 totalValue,
        uint256 apy,
        uint256 totalYield,
        uint256 pricePerShare,
        uint256 totalUsers
    ) {
        totalValue = totalAssetsManaged();
        pricePerShare = vaultStats.pricePerShare;
        totalYield = vaultStats.totalYieldGenerated;
        
        // Calculate APY (simplified)
        if (vaultStats.totalAssets > 0 && block.timestamp > vaultStats.lastUpdate) {
            uint256 timeElapsed = block.timestamp - vaultStats.lastUpdate;
            apy = (totalYield * 365 days * 10000) / (vaultStats.totalAssets * timeElapsed);
        }
        
        // Count users (simplified - would track in practice)
        totalUsers = 0;
        
        return (totalValue, apy, totalYield, pricePerShare, totalUsers);
    }
    
    /**
     * @dev Get user information
     */
    function getUserInfo(address user) external view returns (
        uint256 shares,
        uint256 assetValue,
        uint256 totalDeposited,
        uint256 totalWithdrawn,
        uint256 unrealizedGains
    ) {
        UserInfo storage userInfo = users[user];
        shares = userInfo.shares;
        assetValue = convertToAssets(shares);
        totalDeposited = userInfo.totalDeposited;
        totalWithdrawn = userInfo.totalWithdrawn;
        
        unrealizedGains = assetValue > totalDeposited ?
            assetValue - totalDeposited : 0;
            
        return (shares, assetValue, totalDeposited, totalWithdrawn, unrealizedGains);
    }
    
    /**
     * @dev Update vault fees
     */
    function updateFees(
        uint256 _managementFee,
        uint256 _performanceFee,
        uint256 _withdrawalFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_managementFee <= 500, "Management fee too high"); // Max 5%
        require(_performanceFee <= 2000, "Performance fee too high"); // Max 20%
        require(_withdrawalFee <= 100, "Withdrawal fee too high"); // Max 1%
        
        managementFee = _managementFee;
        performanceFee = _performanceFee;
        withdrawalFee = _withdrawalFee;
    }
    
    /**
     * @dev Pause/unpause the vault
     */
    function pause() external onlyRole(EMERGENCY_ROLE) {
        emergencyShutdown = true;
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyShutdown = false;
    }
}