# Smart Contract Interfaces Architecture

## Overview
The Smart Contract Interfaces provide secure, gas-optimized blockchain interactions for the NEXUS AI DeFi platform, enabling agents to interact with DeFi protocols through standardized contract interfaces.

## Core Contract Architecture

### 1. Agent Registry Contract
Central registry for all AI agents with reputation and capability management.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IAgentRegistry {
    struct AgentInfo {
        address owner;
        string agentId;
        AgentType agentType;
        string[] capabilities;
        uint256 reputation;
        uint256 totalEarnings;
        uint256 successfulTasks;
        uint256 failedTasks;
        bool active;
        uint256 registeredAt;
    }
    
    enum AgentType {
        PORTFOLIO_MANAGER,
        ARBITRAGE_HUNTER,
        RISK_MANAGER,
        EXECUTION,
        ANALYTICS,
        PAYMENT,
        STRATEGY
    }
    
    function registerAgent(
        string calldata agentId,
        AgentType agentType,
        string[] calldata capabilities
    ) external returns (bool);
    
    function updateReputation(
        string calldata agentId,
        int256 change
    ) external returns (uint256);
    
    function getAgentInfo(
        string calldata agentId
    ) external view returns (AgentInfo memory);
    
    function isAgentActive(
        string calldata agentId
    ) external view returns (bool);
}

contract AgentRegistry is IAgentRegistry, AccessControl, ReentrancyGuard {
    bytes32 public constant AGENT_MANAGER_ROLE = keccak256("AGENT_MANAGER_ROLE");
    bytes32 public constant REPUTATION_UPDATER_ROLE = keccak256("REPUTATION_UPDATER_ROLE");
    
    mapping(string => AgentInfo) private agents;
    mapping(address => string[]) private ownerAgents;
    string[] public allAgentIds;
    
    event AgentRegistered(
        string indexed agentId,
        address indexed owner,
        AgentType agentType
    );
    
    event ReputationUpdated(
        string indexed agentId,
        uint256 oldReputation,
        uint256 newReputation
    );
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AGENT_MANAGER_ROLE, msg.sender);
        _grantRole(REPUTATION_UPDATER_ROLE, msg.sender);
    }
    
    function registerAgent(
        string calldata agentId,
        AgentType agentType,
        string[] calldata capabilities
    ) external override returns (bool) {
        require(bytes(agentId).length > 0, "Invalid agent ID");
        require(agents[agentId].registeredAt == 0, "Agent already registered");
        
        agents[agentId] = AgentInfo({
            owner: msg.sender,
            agentId: agentId,
            agentType: agentType,
            capabilities: capabilities,
            reputation: 100,
            totalEarnings: 0,
            successfulTasks: 0,
            failedTasks: 0,
            active: true,
            registeredAt: block.timestamp
        });
        
        ownerAgents[msg.sender].push(agentId);
        allAgentIds.push(agentId);
        
        emit AgentRegistered(agentId, msg.sender, agentType);
        return true;
    }
    
    function updateReputation(
        string calldata agentId,
        int256 change
    ) external override onlyRole(REPUTATION_UPDATER_ROLE) returns (uint256) {
        AgentInfo storage agent = agents[agentId];
        require(agent.registeredAt != 0, "Agent not registered");
        
        uint256 oldReputation = agent.reputation;
        
        if (change < 0 && uint256(-change) >= agent.reputation) {
            agent.reputation = 0;
        } else if (change > 0) {
            agent.reputation = agent.reputation + uint256(change);
            if (agent.reputation > 1000) {
                agent.reputation = 1000; // Cap at 1000
            }
        } else {
            agent.reputation = agent.reputation - uint256(-change);
        }
        
        emit ReputationUpdated(agentId, oldReputation, agent.reputation);
        return agent.reputation;
    }
}
```

### 2. Payment Channel Contract
State channel implementation for instant agent-to-agent payments.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPaymentChannel {
    struct ChannelState {
        uint256 nonce;
        uint256 balanceA;
        uint256 balanceB;
        uint256 timeout;
    }
    
    struct Payment {
        uint256 amount;
        string serviceId;
        bytes32 conditionHash;
        uint256 deadline;
    }
    
    function openChannel(
        address agentB,
        uint256 depositA,
        uint256 depositB,
        uint256 timelock
    ) external payable returns (bytes32 channelId);
    
    function updateState(
        bytes32 channelId,
        ChannelState calldata newState,
        bytes calldata signatureA,
        bytes calldata signatureB
    ) external;
    
    function closeChannel(
        bytes32 channelId,
        ChannelState calldata finalState,
        bytes calldata signatureA,
        bytes calldata signatureB
    ) external;
    
    function disputeState(
        bytes32 channelId,
        ChannelState calldata disputedState,
        bytes calldata evidence
    ) external;
}

contract PaymentChannel is IPaymentChannel, ReentrancyGuard {
    struct Channel {
        address agentA;
        address agentB;
        uint256 totalDeposit;
        ChannelState currentState;
        bool active;
        uint256 disputeDeadline;
        address challenger;
    }
    
    mapping(bytes32 => Channel) public channels;
    mapping(bytes32 => mapping(uint256 => bool)) public usedNonces;
    
    event ChannelOpened(
        bytes32 indexed channelId,
        address indexed agentA,
        address indexed agentB,
        uint256 totalDeposit
    );
    
    event StateUpdated(
        bytes32 indexed channelId,
        uint256 nonce,
        uint256 balanceA,
        uint256 balanceB
    );
    
    event ChannelClosed(
        bytes32 indexed channelId,
        uint256 finalBalanceA,
        uint256 finalBalanceB
    );
    
    function openChannel(
        address agentB,
        uint256 depositA,
        uint256 depositB,
        uint256 timelock
    ) external payable override nonReentrant returns (bytes32 channelId) {
        require(agentB != address(0), "Invalid agent B address");
        require(agentB != msg.sender, "Cannot open channel with self");
        require(msg.value == depositA + depositB, "Incorrect deposit amount");
        require(timelock > 0, "Invalid timelock");
        
        channelId = keccak256(
            abi.encodePacked(msg.sender, agentB, block.timestamp, block.number)
        );
        
        channels[channelId] = Channel({
            agentA: msg.sender,
            agentB: agentB,
            totalDeposit: msg.value,
            currentState: ChannelState({
                nonce: 0,
                balanceA: depositA,
                balanceB: depositB,
                timeout: block.timestamp + timelock
            }),
            active: true,
            disputeDeadline: 0,
            challenger: address(0)
        });
        
        emit ChannelOpened(channelId, msg.sender, agentB, msg.value);
    }
    
    function updateState(
        bytes32 channelId,
        ChannelState calldata newState,
        bytes calldata signatureA,
        bytes calldata signatureB
    ) external override {
        Channel storage channel = channels[channelId];
        require(channel.active, "Channel not active");
        require(newState.nonce > channel.currentState.nonce, "Invalid nonce");
        require(!usedNonces[channelId][newState.nonce], "Nonce already used");
        
        // Verify signatures
        bytes32 stateHash = keccak256(abi.encodePacked(
            channelId,
            newState.nonce,
            newState.balanceA,
            newState.balanceB
        ));
        
        require(verifySignature(stateHash, signatureA, channel.agentA), "Invalid signature A");
        require(verifySignature(stateHash, signatureB, channel.agentB), "Invalid signature B");
        
        // Update state
        channel.currentState = newState;
        usedNonces[channelId][newState.nonce] = true;
        
        emit StateUpdated(channelId, newState.nonce, newState.balanceA, newState.balanceB);
    }
    
    function closeChannel(
        bytes32 channelId,
        ChannelState calldata finalState,
        bytes calldata signatureA,
        bytes calldata signatureB
    ) external override nonReentrant {
        Channel storage channel = channels[channelId];
        require(channel.active, "Channel not active");
        
        // Verify final state signatures
        bytes32 stateHash = keccak256(abi.encodePacked(
            channelId,
            finalState.nonce,
            finalState.balanceA,
            finalState.balanceB
        ));
        
        require(verifySignature(stateHash, signatureA, channel.agentA), "Invalid signature A");
        require(verifySignature(stateHash, signatureB, channel.agentB), "Invalid signature B");
        
        // Transfer final balances
        channel.active = false;
        
        if (finalState.balanceA > 0) {
            payable(channel.agentA).transfer(finalState.balanceA);
        }
        
        if (finalState.balanceB > 0) {
            payable(channel.agentB).transfer(finalState.balanceB);
        }
        
        emit ChannelClosed(channelId, finalState.balanceA, finalState.balanceB);
    }
    
    function verifySignature(
        bytes32 hash,
        bytes memory signature,
        address signer
    ) internal pure returns (bool) {
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(signature);
        return ecrecover(ethSignedMessageHash, v, r, s) == signer;
    }
    
    function splitSignature(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");
        
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
```

### 3. Escrow Contract
Smart contract escrow for conditional payments and multi-party transactions.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IEscrow {
    struct EscrowDetails {
        address payer;
        address payee;
        uint256 amount;
        address token;
        bytes32[] conditions;
        uint256 timeout;
        address arbitrator;
        EscrowStatus status;
        uint256 createdAt;
    }
    
    enum EscrowStatus {
        CREATED,
        FUNDED,
        RELEASED,
        REFUNDED,
        DISPUTED
    }
    
    function createEscrow(
        address payee,
        uint256 amount,
        address token,
        bytes32[] calldata conditions,
        uint256 timeout,
        address arbitrator
    ) external payable returns (bytes32 escrowId);
    
    function releaseEscrow(bytes32 escrowId) external;
    function refundEscrow(bytes32 escrowId) external;
    function disputeEscrow(bytes32 escrowId, string calldata reason) external;
}

contract Escrow is IEscrow, AccessControl, ReentrancyGuard {
    bytes32 public constant CONDITION_VERIFIER_ROLE = keccak256("CONDITION_VERIFIER_ROLE");
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");
    
    mapping(bytes32 => EscrowDetails) public escrows;
    mapping(bytes32 => mapping(bytes32 => bool)) public conditionsMet;
    
    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed payer,
        address indexed payee,
        uint256 amount
    );
    
    event EscrowReleased(bytes32 indexed escrowId, uint256 amount);
    event EscrowRefunded(bytes32 indexed escrowId, uint256 amount);
    event EscrowDisputed(bytes32 indexed escrowId, string reason);
    
    function createEscrow(
        address payee,
        uint256 amount,
        address token,
        bytes32[] calldata conditions,
        uint256 timeout,
        address arbitrator
    ) external payable override returns (bytes32 escrowId) {
        require(payee != address(0), "Invalid payee");
        require(amount > 0, "Invalid amount");
        require(timeout > block.timestamp, "Invalid timeout");
        
        if (token == address(0)) {
            require(msg.value == amount, "Incorrect ETH amount");
        }
        
        escrowId = keccak256(
            abi.encodePacked(
                msg.sender,
                payee,
                amount,
                token,
                block.timestamp,
                block.number
            )
        );
        
        escrows[escrowId] = EscrowDetails({
            payer: msg.sender,
            payee: payee,
            amount: amount,
            token: token,
            conditions: conditions,
            timeout: timeout,
            arbitrator: arbitrator,
            status: EscrowStatus.FUNDED,
            createdAt: block.timestamp
        });
        
        // Transfer tokens if ERC20
        if (token != address(0)) {
            IERC20(token).transferFrom(msg.sender, address(this), amount);
        }
        
        emit EscrowCreated(escrowId, msg.sender, payee, amount);
    }
    
    function releaseEscrow(bytes32 escrowId) external override nonReentrant {
        EscrowDetails storage details = escrows[escrowId];
        require(details.status == EscrowStatus.FUNDED, "Escrow not funded");
        require(
            msg.sender == details.payer || 
            msg.sender == details.payee || 
            hasRole(CONDITION_VERIFIER_ROLE, msg.sender),
            "Unauthorized"
        );
        
        // Check if all conditions are met
        require(allConditionsMet(escrowId), "Conditions not met");
        
        details.status = EscrowStatus.RELEASED;
        
        // Transfer funds to payee
        if (details.token == address(0)) {
            payable(details.payee).transfer(details.amount);
        } else {
            IERC20(details.token).transfer(details.payee, details.amount);
        }
        
        emit EscrowReleased(escrowId, details.amount);
    }
    
    function allConditionsMet(bytes32 escrowId) public view returns (bool) {
        EscrowDetails storage details = escrows[escrowId];
        
        for (uint256 i = 0; i < details.conditions.length; i++) {
            if (!conditionsMet[escrowId][details.conditions[i]]) {
                return false;
            }
        }
        
        return true;
    }
    
    function setConditionMet(
        bytes32 escrowId,
        bytes32 condition
    ) external onlyRole(CONDITION_VERIFIER_ROLE) {
        conditionsMet[escrowId][condition] = true;
    }
}
```

### 4. Protocol Vault Contract
Unified vault for managing funds across multiple DeFi protocols.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IProtocolVault {
    struct ProtocolAllocation {
        address protocol;
        uint256 allocation; // Percentage in basis points (10000 = 100%)
        uint256 currentValue;
        uint256 targetValue;
    }
    
    struct VaultStrategy {
        string name;
        ProtocolAllocation[] allocations;
        uint256 riskScore;
        uint256 expectedAPY;
        bool active;
    }
    
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function rebalance() external;
    function updateStrategy(VaultStrategy calldata newStrategy) external;
}

contract ProtocolVault is IProtocolVault, AccessControl, ReentrancyGuard {
    bytes32 public constant STRATEGY_MANAGER_ROLE = keccak256("STRATEGY_MANAGER_ROLE");
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");
    
    IERC20 public immutable baseToken;
    VaultStrategy public currentStrategy;
    
    mapping(address => uint256) public userShares;
    uint256 public totalShares;
    uint256 public totalAssets;
    
    event Deposited(address indexed user, uint256 amount, uint256 shares);
    event Withdrawn(address indexed user, uint256 amount, uint256 shares);
    event Rebalanced(uint256 totalValue);
    event StrategyUpdated(string newStrategyName);
    
    constructor(address _baseToken) {
        baseToken = IERC20(_baseToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(STRATEGY_MANAGER_ROLE, msg.sender);
        _grantRole(REBALANCER_ROLE, msg.sender);
    }
    
    function deposit(uint256 amount) external override nonReentrant {
        require(amount > 0, "Invalid amount");
        
        uint256 shares;
        if (totalShares == 0) {
            shares = amount;
        } else {
            shares = (amount * totalShares) / totalAssets;
        }
        
        userShares[msg.sender] += shares;
        totalShares += shares;
        totalAssets += amount;
        
        baseToken.transferFrom(msg.sender, address(this), amount);
        
        emit Deposited(msg.sender, amount, shares);
    }
    
    function withdraw(uint256 shares) external override nonReentrant {
        require(shares > 0 && shares <= userShares[msg.sender], "Invalid shares");
        
        uint256 amount = (shares * totalAssets) / totalShares;
        
        userShares[msg.sender] -= shares;
        totalShares -= shares;
        totalAssets -= amount;
        
        baseToken.transfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount, shares);
    }
    
    function rebalance() external override onlyRole(REBALANCER_ROLE) nonReentrant {
        // Withdraw from all protocols
        for (uint256 i = 0; i < currentStrategy.allocations.length; i++) {
            ProtocolAllocation storage allocation = currentStrategy.allocations[i];
            if (allocation.currentValue > 0) {
                _withdrawFromProtocol(allocation.protocol, allocation.currentValue);
            }
        }
        
        // Get current total balance
        uint256 totalBalance = baseToken.balanceOf(address(this));
        
        // Redistribute according to strategy
        for (uint256 i = 0; i < currentStrategy.allocations.length; i++) {
            ProtocolAllocation storage allocation = currentStrategy.allocations[i];
            uint256 targetAmount = (totalBalance * allocation.allocation) / 10000;
            
            if (targetAmount > 0) {
                _depositToProtocol(allocation.protocol, targetAmount);
                allocation.currentValue = targetAmount;
            }
        }
        
        totalAssets = totalBalance;
        emit Rebalanced(totalBalance);
    }
    
    function _depositToProtocol(address protocol, uint256 amount) internal {
        // Implementation depends on specific protocol interfaces
        // This would call the appropriate protocol's deposit function
        baseToken.approve(protocol, amount);
        
        if (protocol == address(0x1)) { // YEI Finance example
            IYEIFinance(protocol).deposit(address(baseToken), amount);
        } else if (protocol == address(0x2)) { // DragonSwap example
            IDragonSwap(protocol).addLiquidity(amount);
        }
        // Add more protocol integrations as needed
    }
    
    function _withdrawFromProtocol(address protocol, uint256 amount) internal {
        // Implementation depends on specific protocol interfaces
        if (protocol == address(0x1)) { // YEI Finance example
            IYEIFinance(protocol).withdraw(address(baseToken), amount);
        } else if (protocol == address(0x2)) { // DragonSwap example
            IDragonSwap(protocol).removeLiquidity(amount);
        }
        // Add more protocol integrations as needed
    }
}
```

### 5. Risk Management Contract
On-chain risk assessment and automatic position management.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IRiskManager {
    struct RiskParameters {
        uint256 maxPositionSize;
        uint256 maxLeverage;
        uint256 stopLossThreshold;
        uint256 liquidationThreshold;
        uint256 maxDrawdown;
    }
    
    struct PositionRisk {
        uint256 currentValue;
        uint256 unrealizedPnL;
        uint256 riskScore;
        bool liquidationRisk;
        uint256 timeToLiquidation;
    }
    
    function setRiskParameters(
        string calldata agentId,
        RiskParameters calldata params
    ) external;
    
    function assessPositionRisk(
        string calldata agentId,
        bytes calldata positionData
    ) external view returns (PositionRisk memory);
    
    function triggerEmergencyStop(string calldata agentId) external;
}

contract RiskManager is IRiskManager, AccessControl {
    bytes32 public constant RISK_ASSESSOR_ROLE = keccak256("RISK_ASSESSOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    mapping(string => RiskParameters) public agentRiskParams;
    mapping(string => bool) public emergencyStop;
    
    event RiskParametersUpdated(string indexed agentId);
    event EmergencyStopTriggered(string indexed agentId);
    event RiskAssessmentCompleted(string indexed agentId, uint256 riskScore);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RISK_ASSESSOR_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
    }
    
    function setRiskParameters(
        string calldata agentId,
        RiskParameters calldata params
    ) external override onlyRole(RISK_ASSESSOR_ROLE) {
        require(bytes(agentId).length > 0, "Invalid agent ID");
        require(params.maxLeverage > 0 && params.maxLeverage <= 1000, "Invalid leverage");
        require(params.stopLossThreshold > 0, "Invalid stop loss");
        
        agentRiskParams[agentId] = params;
        
        emit RiskParametersUpdated(agentId);
    }
    
    function assessPositionRisk(
        string calldata agentId,
        bytes calldata positionData
    ) external view override returns (PositionRisk memory) {
        RiskParameters memory params = agentRiskParams[agentId];
        
        // Decode position data (implementation depends on data format)
        (uint256 positionValue, uint256 collateral, uint256 debt) = 
            abi.decode(positionData, (uint256, uint256, uint256));
        
        // Calculate risk metrics
        uint256 leverage = debt > 0 ? (positionValue * 100) / collateral : 100;
        int256 unrealizedPnL = int256(positionValue) - int256(collateral + debt);
        
        // Calculate risk score (0-100)
        uint256 riskScore = _calculateRiskScore(
            leverage,
            params.maxLeverage,
            positionValue,
            params.maxPositionSize,
            unrealizedPnL
        );
        
        // Check liquidation risk
        bool liquidationRisk = leverage > params.liquidationThreshold;
        uint256 timeToLiquidation = liquidationRisk ? 
            _estimateTimeToLiquidation(positionValue, debt, collateral) : 0;
        
        return PositionRisk({
            currentValue: positionValue,
            unrealizedPnL: unrealizedPnL,
            riskScore: riskScore,
            liquidationRisk: liquidationRisk,
            timeToLiquidation: timeToLiquidation
        });
    }
    
    function triggerEmergencyStop(
        string calldata agentId
    ) external override onlyRole(EMERGENCY_ROLE) {
        emergencyStop[agentId] = true;
        emit EmergencyStopTriggered(agentId);
    }
    
    function _calculateRiskScore(
        uint256 leverage,
        uint256 maxLeverage,
        uint256 positionValue,
        uint256 maxPositionSize,
        int256 unrealizedPnL
    ) internal pure returns (uint256) {
        uint256 leverageRisk = (leverage * 40) / maxLeverage; // Max 40 points
        uint256 sizeRisk = (positionValue * 30) / maxPositionSize; // Max 30 points
        uint256 pnlRisk = unrealizedPnL < 0 ? 
            (uint256(-unrealizedPnL) * 30) / positionValue : 0; // Max 30 points
        
        return leverageRisk + sizeRisk + pnlRisk;
    }
    
    function _estimateTimeToLiquidation(
        uint256 positionValue,
        uint256 debt,
        uint256 collateral
    ) internal pure returns (uint256) {
        if (collateral <= debt * 110 / 100) { // 110% liquidation ratio
            return 0; // Immediate liquidation risk
        }
        
        // Simple estimation based on historical volatility
        // In practice, this would use oracle data and volatility models
        uint256 safetyBuffer = collateral - (debt * 110 / 100);
        uint256 dailyVolatilityImpact = positionValue * 5 / 100; // 5% daily volatility
        
        if (safetyBuffer >= dailyVolatilityImpact) {
            return safetyBuffer / dailyVolatilityImpact; // Days until potential liquidation
        }
        
        return 1; // Less than 1 day
    }
}
```

### 6. Oracle Integration Contract
Unified price feeds and data aggregation from multiple oracle sources.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IUnifiedOracle {
    struct PriceData {
        uint256 price;
        uint256 confidence;
        uint256 timestamp;
        string source;
    }
    
    struct AggregatedPrice {
        uint256 price;
        uint256 confidence;
        uint256 timestamp;
        uint256 deviation;
    }
    
    function getPrice(address token) external view returns (AggregatedPrice memory);
    function getPrices(address[] calldata tokens) external view returns (AggregatedPrice[] memory);
    function addPriceSource(string calldata name, address oracle) external;
}

contract UnifiedOracle is IUnifiedOracle, AccessControl {
    bytes32 public constant ORACLE_MANAGER_ROLE = keccak256("ORACLE_MANAGER_ROLE");
    
    struct PriceSource {
        string name;
        address oracle;
        uint256 weight;
        bool active;
    }
    
    mapping(string => PriceSource) public priceSources;
    string[] public sourceNames;
    mapping(address => mapping(string => PriceData)) public priceCache;
    
    uint256 public constant PRICE_VALIDITY_PERIOD = 300; // 5 minutes
    uint256 public constant MIN_SOURCES_REQUIRED = 2;
    
    event PriceSourceAdded(string name, address oracle, uint256 weight);
    event PriceUpdated(address token, uint256 price, uint256 confidence);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_MANAGER_ROLE, msg.sender);
    }
    
    function getPrice(address token) external view override returns (AggregatedPrice memory) {
        PriceData[] memory prices = new PriceData[](sourceNames.length);
        uint256 validPriceCount = 0;
        
        // Collect prices from all sources
        for (uint256 i = 0; i < sourceNames.length; i++) {
            PriceSource memory source = priceSources[sourceNames[i]];
            if (!source.active) continue;
            
            PriceData memory priceData = _getPriceFromSource(token, source);
            if (_isPriceValid(priceData)) {
                prices[validPriceCount] = priceData;
                validPriceCount++;
            }
        }
        
        require(validPriceCount >= MIN_SOURCES_REQUIRED, "Insufficient price sources");
        
        return _aggregatePrices(prices, validPriceCount);
    }
    
    function _getPriceFromSource(
        address token,
        PriceSource memory source
    ) internal view returns (PriceData memory) {
        // Check cache first
        PriceData memory cachedPrice = priceCache[token][source.name];
        if (_isPriceValid(cachedPrice)) {
            return cachedPrice;
        }
        
        // Fetch from oracle (implementation depends on oracle type)
        uint256 price;
        uint256 confidence;
        
        if (source.oracle == address(0x1)) { // API3 example
            (price, confidence) = IAPI3Oracle(source.oracle).readDataFeed(token);
        } else if (source.oracle == address(0x2)) { // Pyth example
            (price, confidence) = IPythOracle(source.oracle).getPrice(token);
        } else if (source.oracle == address(0x3)) { // Redstone example
            (price, confidence) = IRedstoneOracle(source.oracle).getPrice(token);
        }
        
        return PriceData({
            price: price,
            confidence: confidence,
            timestamp: block.timestamp,
            source: source.name
        });
    }
    
    function _aggregatePrices(
        PriceData[] memory prices,
        uint256 validCount
    ) internal pure returns (AggregatedPrice memory) {
        require(validCount > 0, "No valid prices");
        
        // Weighted average based on confidence
        uint256 totalWeightedPrice = 0;
        uint256 totalWeight = 0;
        uint256 minPrice = type(uint256).max;
        uint256 maxPrice = 0;
        
        for (uint256 i = 0; i < validCount; i++) {
            uint256 weight = prices[i].confidence;
            totalWeightedPrice += prices[i].price * weight;
            totalWeight += weight;
            
            if (prices[i].price < minPrice) minPrice = prices[i].price;
            if (prices[i].price > maxPrice) maxPrice = prices[i].price;
        }
        
        uint256 aggregatedPrice = totalWeightedPrice / totalWeight;
        uint256 deviation = maxPrice > minPrice ? 
            ((maxPrice - minPrice) * 10000) / aggregatedPrice : 0; // basis points
        
        return AggregatedPrice({
            price: aggregatedPrice,
            confidence: totalWeight / validCount, // Average confidence
            timestamp: block.timestamp,
            deviation: deviation
        });
    }
    
    function _isPriceValid(PriceData memory priceData) internal view returns (bool) {
        return priceData.timestamp > 0 && 
               priceData.timestamp + PRICE_VALIDITY_PERIOD >= block.timestamp &&
               priceData.price > 0 &&
               priceData.confidence > 50; // Minimum 50% confidence
    }
}
```

These smart contract interfaces provide the foundation for secure, efficient blockchain interactions within the NEXUS AI DeFi platform, ensuring proper agent registration, payment processing, risk management, and oracle data integration.