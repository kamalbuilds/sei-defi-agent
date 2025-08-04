// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title RiskManager
 * @dev Advanced risk management system for NEXUS AI DeFi platform
 */
contract RiskManager is ReentrancyGuard, AccessControl {
    using Math for uint256;

    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant RISK_ASSESSOR_ROLE = keccak256("RISK_ASSESSOR_ROLE");

    enum RiskLevel {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL,
        EMERGENCY
    }

    enum ProtocolHealth {
        HEALTHY,
        WARNING,
        CRITICAL,
        COMPROMISED
    }

    struct RiskMetrics {
        uint256 volatility; // Volatility percentage (scaled by 100)
        uint256 liquidityRisk; // Liquidity risk score 1-100
        uint256 smartContractRisk; // Smart contract risk score 1-100
        uint256 concentrationRisk; // Concentration risk score 1-100
        uint256 correlationRisk; // Cross-protocol correlation risk
        uint256 marketRisk; // Overall market risk
        uint256 lastUpdated;
    }

    struct ProtocolRisk {
        address protocol;
        uint256 riskScore; // Overall risk score 1-100
        uint256 auditScore; // Audit quality score 1-100
        uint256 tvlRisk; // TVL-based risk assessment
        uint256 timeRisk; // Time-based risk (newer = riskier)
        uint256 governanceRisk; // Governance decentralization risk
        ProtocolHealth health;
        uint256 maxAllocation; // Maximum safe allocation percentage
        uint256 lastAssessment;
        bool isBlacklisted;
    }

    struct PortfolioRisk {
        uint256 totalValue;
        uint256 aggregateRiskScore;
        uint256 diversificationScore;
        uint256 correlationMatrix; // Simplified correlation score
        RiskLevel riskLevel;
        uint256 maxDrawdown; // Historical maximum drawdown
        uint256 valueAtRisk; // 95% VaR
        uint256 expectedShortfall; // Expected shortfall (CVaR)
    }

    struct CircuitBreaker {
        uint256 dailyLossThreshold; // Maximum daily loss percentage
        uint256 totalLossThreshold; // Maximum total loss percentage
        uint256 correlationThreshold; // Maximum correlation before circuit breaker
        uint256 liquidityThreshold; // Minimum liquidity ratio
        bool isActive;
        uint256 lastTriggered;
        uint256 cooldownPeriod;
    }

    struct Alert {
        uint256 id;
        RiskLevel severity;
        address protocol;
        string description;
        uint256 timestamp;
        bool resolved;
        address resolver;
    }

    // State variables
    mapping(address => ProtocolRisk) public protocolRisks;
    mapping(address => RiskMetrics) public riskMetrics;
    mapping(address => bool) public monitoredProtocols;
    
    PortfolioRisk public portfolioRisk;
    CircuitBreaker public circuitBreaker;
    
    Alert[] public alerts;
    mapping(uint256 => bool) public alertResolved;
    uint256 public alertCounter;
    
    // Risk parameters
    uint256 public maxPortfolioRisk = 70; // Maximum portfolio risk score
    uint256 public maxProtocolAllocation = 25; // Maximum allocation to single protocol (25%)
    uint256 public maxCorrelation = 80; // Maximum correlation between protocols
    uint256 public minLiquidityRatio = 10; // Minimum liquidity ratio (10%)
    
    // Historical data for risk calculations
    mapping(address => uint256[]) public historicalReturns;
    mapping(address => uint256) public returnIndex;
    uint256 public constant RETURN_HISTORY_SIZE = 30; // 30 data points
    
    // Emergency controls
    bool public emergencyMode;
    mapping(address => uint256) public emergencyWithdrawals;
    uint256 public emergencyThreshold = 20; // 20% loss triggers emergency
    
    // AI risk assessment
    mapping(bytes32 => uint256) public aiRiskModels;
    uint256 public aiConfidence = 75; // AI model confidence level
    
    event RiskAssessmentUpdated(address indexed protocol, uint256 riskScore, ProtocolHealth health);
    event CircuitBreakerTriggered(string reason, uint256 timestamp);
    event AlertCreated(uint256 indexed alertId, RiskLevel severity, address protocol);
    event AlertResolved(uint256 indexed alertId, address resolver);
    event EmergencyModeActivated(string reason);
    event PortfolioRiskUpdated(uint256 aggregateRisk, RiskLevel level);
    event ProtocolBlacklisted(address indexed protocol, string reason);
    
    modifier notInEmergency() {
        require(!emergencyMode, "Emergency mode active");
        _;
    }
    
    modifier onlyVault() {
        require(hasRole(VAULT_ROLE, msg.sender), "Only vault can call");
        _;
    }
    
    modifier validProtocol(address protocol) {
        require(protocol != address(0), "Invalid protocol address");
        require(monitoredProtocols[protocol], "Protocol not monitored");
        _;
    }
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RISK_ASSESSOR_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        
        // Initialize circuit breaker
        circuitBreaker = CircuitBreaker({
            dailyLossThreshold: 500, // 5%
            totalLossThreshold: 2000, // 20%
            correlationThreshold: 80,
            liquidityThreshold: 10,
            isActive: false,
            lastTriggered: 0,
            cooldownPeriod: 24 hours
        });
    }
    
    /**
     * @dev Add protocol for risk monitoring
     */
    function addProtocolForMonitoring(
        address protocol,
        uint256 initialRiskScore,
        uint256 auditScore,
        uint256 maxAllocation
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(protocol != address(0), "Invalid protocol");
        require(initialRiskScore >= 1 && initialRiskScore <= 100, "Invalid risk score");
        require(auditScore >= 1 && auditScore <= 100, "Invalid audit score");
        require(maxAllocation <= 100, "Invalid max allocation");
        
        protocolRisks[protocol] = ProtocolRisk({
            protocol: protocol,
            riskScore: initialRiskScore,
            auditScore: auditScore,
            tvlRisk: 50, // Default medium risk
            timeRisk: _calculateTimeRisk(protocol),
            governanceRisk: 50, // Default medium risk
            health: ProtocolHealth.HEALTHY,
            maxAllocation: maxAllocation,
            lastAssessment: block.timestamp,
            isBlacklisted: false
        });
        
        monitoredProtocols[protocol] = true;
        
        // Initialize risk metrics
        riskMetrics[protocol] = RiskMetrics({
            volatility: 0,
            liquidityRisk: 50,
            smartContractRisk: initialRiskScore,
            concentrationRisk: 0,
            correlationRisk: 0,
            marketRisk: 50,
            lastUpdated: block.timestamp
        });
    }
    
    /**
     * @dev Assess portfolio risk before allocation changes
     */
    function assessAllocationRisk(
        address[] calldata protocols,
        uint256[] calldata allocations,
        uint256 totalValue
    ) external view returns (bool isAllowed, string memory reason) {
        require(protocols.length == allocations.length, "Array length mismatch");
        
        // Check individual protocol limits
        for (uint256 i = 0; i < protocols.length; i++) {
            if (allocations[i] == 0) continue;
            
            ProtocolRisk memory risk = protocolRisks[protocols[i]];
            
            // Check if protocol is blacklisted
            if (risk.isBlacklisted) {
                return (false, "Protocol is blacklisted");
            }
            
            // Check maximum allocation
            if (allocations[i] > risk.maxAllocation * 100) {
                return (false, "Exceeds protocol max allocation");
            }
            
            // Check protocol health
            if (risk.health == ProtocolHealth.COMPROMISED) {
                return (false, "Protocol is compromised");
            }
            
            if (risk.health == ProtocolHealth.CRITICAL && allocations[i] > 500) {
                return (false, "Protocol in critical state");
            }
        }
        
        // Calculate aggregate risk
        uint256 aggregateRisk = _calculateAggregateRisk(protocols, allocations);
        if (aggregateRisk > maxPortfolioRisk) {
            return (false, "Portfolio risk too high");
        }
        
        // Check concentration risk
        uint256 maxAllocation = 0;
        for (uint256 i = 0; i < allocations.length; i++) {
            if (allocations[i] > maxAllocation) {
                maxAllocation = allocations[i];
            }
        }
        
        if (maxAllocation > maxProtocolAllocation * 100) {
            return (false, "Concentration risk too high");
        }
        
        // Check correlation risk
        if (_calculateCorrelationRisk(protocols, allocations) > maxCorrelation) {
            return (false, "Correlation risk too high");
        }
        
        return (true, "Allocation approved");
    }
    
    /**
     * @dev Update protocol risk assessment
     */
    function updateProtocolRisk(
        address protocol,
        uint256 newRiskScore,
        uint256 volatility,
        uint256 liquidityRisk,
        ProtocolHealth health
    ) external onlyRole(RISK_ASSESSOR_ROLE) validProtocol(protocol) {
        require(newRiskScore >= 1 && newRiskScore <= 100, "Invalid risk score");
        require(volatility <= 10000, "Invalid volatility"); // Max 100%
        require(liquidityRisk >= 1 && liquidityRisk <= 100, "Invalid liquidity risk");
        
        ProtocolRisk storage risk = protocolRisks[protocol];
        risk.riskScore = newRiskScore;
        risk.health = health;
        risk.lastAssessment = block.timestamp;
        
        // Update risk metrics
        RiskMetrics storage metrics = riskMetrics[protocol];
        metrics.volatility = volatility;
        metrics.liquidityRisk = liquidityRisk;
        metrics.smartContractRisk = newRiskScore;
        metrics.lastUpdated = block.timestamp;
        
        // Check if risk level requires action
        if (newRiskScore >= 80 || health == ProtocolHealth.CRITICAL) {
            _createAlert(
                RiskLevel.HIGH,
                protocol,
                "High risk protocol detected"
            );
        }
        
        emit RiskAssessmentUpdated(protocol, newRiskScore, health);
    }
    
    /**
     * @dev Monitor portfolio and trigger circuit breakers if needed
     */
    function monitorPortfolio(
        uint256 currentValue,
        uint256 previousValue
    ) external onlyVault returns (bool shouldHalt) {
        // Calculate daily loss
        if (previousValue > 0 && currentValue < previousValue) {
            uint256 loss = ((previousValue - currentValue) * 10000) / previousValue;
            
            // Check daily loss threshold
            if (loss > circuitBreaker.dailyLossThreshold) {
                _triggerCircuitBreaker("Daily loss threshold exceeded");
                return true;
            }
        }
        
        // Update portfolio risk
        _updatePortfolioRisk(currentValue);
        
        // Check if emergency action needed
        if (portfolioRisk.riskLevel == RiskLevel.EMERGENCY) {
            _activateEmergencyMode("Critical portfolio risk level");
            return true;
        }
        
        return false;
    }
    
    /**
     * @dev Calculate Value at Risk (VaR) for the portfolio
     */
    function calculateVaR(
        address[] calldata protocols,
        uint256[] calldata allocations,
        uint256 confidence
    ) external view returns (uint256 var) {
        require(confidence >= 90 && confidence <= 99, "Invalid confidence level");
        require(protocols.length == allocations.length, "Array length mismatch");
        
        uint256 portfolioVolatility = 0;
        uint256 totalAllocation = 0;
        
        // Calculate weighted portfolio volatility
        for (uint256 i = 0; i < protocols.length; i++) {
            if (allocations[i] > 0) {
                RiskMetrics memory metrics = riskMetrics[protocols[i]];
                uint256 weight = allocations[i];
                portfolioVolatility += (weight * weight * metrics.volatility * metrics.volatility);
                totalAllocation += allocations[i];
            }
        }
        
        if (totalAllocation == 0) return 0;
        
        // Add correlation adjustment (simplified)
        uint256 correlationAdjustment = _calculateCorrelationRisk(protocols, allocations);
        portfolioVolatility = (portfolioVolatility * (100 + correlationAdjustment)) / 100;
        
        portfolioVolatility = Math.sqrt(portfolioVolatility);
        
        // Calculate VaR based on normal distribution approximation
        uint256 zScore;
        if (confidence == 95) {
            zScore = 1645; // 1.645 scaled by 1000
        } else if (confidence == 99) {
            zScore = 2326; // 2.326 scaled by 1000
        } else {
            zScore = 1960; // 1.96 scaled by 1000 (approximate)
        }
        
        var = (portfolioVolatility * zScore) / 1000;
        return var;
    }
    
    /**
     * @dev Stress test the portfolio against various scenarios
     */
    function stressTest(
        address[] calldata protocols,
        uint256[] calldata allocations,
        uint256[] calldata stressFactors
    ) external view returns (uint256[] memory scenarioLosses) {
        require(protocols.length == allocations.length, "Array length mismatch");
        require(stressFactors.length > 0, "No stress factors provided");
        
        scenarioLosses = new uint256[](stressFactors.length);
        
        for (uint256 s = 0; s < stressFactors.length; s++) {
            uint256 totalLoss = 0;
            
            for (uint256 i = 0; i < protocols.length; i++) {
                if (allocations[i] > 0) {
                    RiskMetrics memory metrics = riskMetrics[protocols[i]];
                    ProtocolRisk memory protocolRisk = protocolRisks[protocols[i]];
                    
                    // Calculate protocol-specific loss under stress
                    uint256 protocolLoss = (allocations[i] * metrics.volatility * stressFactors[s] * protocolRisk.riskScore) / 1000000;
                    totalLoss += protocolLoss;
                }
            }
            
            scenarioLosses[s] = totalLoss;
        }
        
        return scenarioLosses;
    }
    
    /**
     * @dev Blacklist a protocol due to critical risk
     */
    function blacklistProtocol(
        address protocol,
        string calldata reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validProtocol(protocol) {
        protocolRisks[protocol].isBlacklisted = true;
        protocolRisks[protocol].health = ProtocolHealth.COMPROMISED;
        
        _createAlert(
            RiskLevel.CRITICAL,
            protocol,
            string(abi.encodePacked("Protocol blacklisted: ", reason))
        );
        
        emit ProtocolBlacklisted(protocol, reason);
    }
    
    /**
     * @dev Create a risk alert
     */
    function _createAlert(
        RiskLevel severity,
        address protocol,
        string memory description
    ) internal returns (uint256 alertId) {
        alertId = alertCounter++;
        
        alerts.push(Alert({
            id: alertId,
            severity: severity,
            protocol: protocol,
            description: description,
            timestamp: block.timestamp,
            resolved: false,
            resolver: address(0)
        }));
        
        emit AlertCreated(alertId, severity, protocol);
        return alertId;
    }
    
    /**
     * @dev Resolve an alert
     */
    function resolveAlert(uint256 alertId) external onlyRole(RISK_ASSESSOR_ROLE) {
        require(alertId < alerts.length, "Invalid alert ID");
        require(!alerts[alertId].resolved, "Alert already resolved");
        
        alerts[alertId].resolved = true;
        alerts[alertId].resolver = msg.sender;
        alertResolved[alertId] = true;
        
        emit AlertResolved(alertId, msg.sender);
    }
    
    /**
     * @dev Trigger circuit breaker
     */
    function _triggerCircuitBreaker(string memory reason) internal {
        if (!circuitBreaker.isActive && 
            block.timestamp >= circuitBreaker.lastTriggered + circuitBreaker.cooldownPeriod) {
            
            circuitBreaker.isActive = true;
            circuitBreaker.lastTriggered = block.timestamp;
            
            emit CircuitBreakerTriggered(reason, block.timestamp);
        }
    }
    
    /**
     * @dev Activate emergency mode
     */
    function _activateEmergencyMode(string memory reason) internal {
        if (!emergencyMode) {
            emergencyMode = true;
            emit EmergencyModeActivated(reason);
        }
    }
    
    /**
     * @dev Calculate aggregate portfolio risk
     */
    function _calculateAggregateRisk(
        address[] calldata protocols,
        uint256[] calldata allocations
    ) internal view returns (uint256) {
        uint256 totalRisk = 0;
        uint256 totalAllocation = 0;
        
        for (uint256 i = 0; i < protocols.length; i++) {
            if (allocations[i] > 0) {
                ProtocolRisk memory risk = protocolRisks[protocols[i]];
                totalRisk += (allocations[i] * risk.riskScore);
                totalAllocation += allocations[i];
            }
        }
        
        return totalAllocation > 0 ? totalRisk / totalAllocation : 0;
    }
    
    /**
     * @dev Calculate correlation risk between protocols
     */
    function _calculateCorrelationRisk(
        address[] calldata protocols,
        uint256[] calldata allocations
    ) internal view returns (uint256) {
        // Simplified correlation calculation
        // In practice, this would use historical correlation data
        
        uint256 correlationRisk = 0;
        uint256 pairCount = 0;
        
        for (uint256 i = 0; i < protocols.length; i++) {
            if (allocations[i] == 0) continue;
            
            for (uint256 j = i + 1; j < protocols.length; j++) {
                if (allocations[j] == 0) continue;
                
                // Simplified correlation based on protocol types
                uint256 correlation = _estimateCorrelation(protocols[i], protocols[j]);
                uint256 weight = (allocations[i] * allocations[j]) / 10000;
                
                correlationRisk += (correlation * weight);
                pairCount++;
            }
        }
        
        return pairCount > 0 ? correlationRisk / pairCount : 0;
    }
    
    /**
     * @dev Estimate correlation between two protocols
     */
    function _estimateCorrelation(address protocol1, address protocol2) 
        internal 
        view 
        returns (uint256) 
    {
        // Simplified correlation estimation
        // In practice, this would use historical price data
        
        RiskMetrics memory metrics1 = riskMetrics[protocol1];
        RiskMetrics memory metrics2 = riskMetrics[protocol2];
        
        // Higher volatilities suggest higher correlation in stressed markets
        uint256 avgVolatility = (metrics1.volatility + metrics2.volatility) / 2;
        
        // Base correlation increases with market risk
        uint256 baseCorrelation = (metrics1.marketRisk + metrics2.marketRisk) / 2;
        
        return Math.min(baseCorrelation + (avgVolatility / 10), 100);
    }
    
    /**
     * @dev Calculate time-based risk for new protocols
     */
    function _calculateTimeRisk(address protocol) internal view returns (uint256) {
        // This would typically check protocol deployment time
        // New protocols are riskier
        // For now, return default medium risk
        return 50;
    }
    
    /**
     * @dev Update portfolio risk metrics
     */
    function _updatePortfolioRisk(uint256 currentValue) internal {
        portfolioRisk.totalValue = currentValue;
        
        // Calculate aggregate risk (simplified)
        // In practice, this would consider all active allocations
        portfolioRisk.aggregateRiskScore = 50; // Placeholder
        
        // Determine risk level
        if (portfolioRisk.aggregateRiskScore >= 90) {
            portfolioRisk.riskLevel = RiskLevel.EMERGENCY;
        } else if (portfolioRisk.aggregateRiskScore >= 70) {
            portfolioRisk.riskLevel = RiskLevel.CRITICAL;
        } else if (portfolioRisk.aggregateRiskScore >= 50) {
            portfolioRisk.riskLevel = RiskLevel.HIGH;
        } else if (portfolioRisk.aggregateRiskScore >= 30) {
            portfolioRisk.riskLevel = RiskLevel.MEDIUM;
        } else {
            portfolioRisk.riskLevel = RiskLevel.LOW;
        }
        
        emit PortfolioRiskUpdated(portfolioRisk.aggregateRiskScore, portfolioRisk.riskLevel);
    }
    
    /**
     * @dev Get protocol risk information
     */
    function getProtocolRisk(address protocol) 
        external 
        view 
        validProtocol(protocol) 
        returns (ProtocolRisk memory) 
    {
        return protocolRisks[protocol];
    }
    
    /**
     * @dev Get all active alerts
     */
    function getActiveAlerts() external view returns (Alert[] memory activeAlerts) {
        uint256 activeCount = 0;
        
        // Count active alerts
        for (uint256 i = 0; i < alerts.length; i++) {
            if (!alerts[i].resolved) {
                activeCount++;
            }
        }
        
        // Create array of active alerts
        activeAlerts = new Alert[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < alerts.length; i++) {
            if (!alerts[i].resolved) {
                activeAlerts[index] = alerts[i];
                index++;
            }
        }
        
        return activeAlerts;
    }
    
    /**
     * @dev Update risk parameters
     */
    function updateRiskParameters(
        uint256 _maxPortfolioRisk,
        uint256 _maxProtocolAllocation,
        uint256 _maxCorrelation,
        uint256 _emergencyThreshold
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_maxPortfolioRisk <= 100, "Invalid max portfolio risk");
        require(_maxProtocolAllocation <= 100, "Invalid max protocol allocation");
        require(_maxCorrelation <= 100, "Invalid max correlation");
        require(_emergencyThreshold <= 50, "Invalid emergency threshold");
        
        maxPortfolioRisk = _maxPortfolioRisk;
        maxProtocolAllocation = _maxProtocolAllocation;
        maxCorrelation = _maxCorrelation;
        emergencyThreshold = _emergencyThreshold;
    }
    
    /**
     * @dev Reset circuit breaker
     */
    function resetCircuitBreaker() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            block.timestamp >= circuitBreaker.lastTriggered + circuitBreaker.cooldownPeriod,
            "Cooldown period not met"
        );
        
        circuitBreaker.isActive = false;
    }
    
    /**
     * @dev Deactivate emergency mode
     */
    function deactivateEmergencyMode() external onlyRole(DEFAULT_ADMIN_ROLE) {
        emergencyMode = false;
    }
}