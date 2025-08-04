// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title StrategyVoting
 * @dev Voting system for DeFi strategy selection and parameter optimization
 */
contract StrategyVoting is ReentrancyGuard, AccessControl {
    bytes32 public constant STRATEGY_PROPOSER_ROLE = keccak256("STRATEGY_PROPOSER_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant ANALYZER_ROLE = keccak256("ANALYZER_ROLE");

    enum StrategyType {
        YIELD_FARMING,
        LIQUIDITY_PROVISION,
        ARBITRAGE,
        LENDING,
        STAKING,
        DERIVATIVES
    }

    enum VoteStatus {
        ACTIVE,
        EXECUTED,
        DEFEATED,
        EXPIRED
    }

    struct Strategy {
        uint256 id;
        string name;
        string description;
        StrategyType strategyType;
        address targetProtocol;
        uint256 proposedAllocation; // Percentage of treasury to allocate
        uint256 expectedAPY;
        uint256 riskLevel; // 1-10 scale
        bytes configData;
        address proposer;
        uint256 createdAt;
        uint256 votingDeadline;
        bool isActive;
    }

    struct Vote {
        uint256 strategyId;
        address voter;
        uint256 votingPower;
        uint8 support; // 0=against, 1=for, 2=abstain
        uint256 riskTolerance; // 1-10 scale
        uint256 expectedReturn; // Agent's expected return prediction
        string reasoning;
        uint256 timestamp;
    }

    struct VotingResult {
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 totalVotingPower;
        uint256 averageRiskTolerance;
        uint256 averageExpectedReturn;
        bool quorumReached;
        VoteStatus status;
    }

    struct AgentPreference {
        uint256 riskTolerance; // 1-10 scale
        uint256 returnExpectation; // Expected APY in basis points
        StrategyType[] preferredTypes;
        mapping(address => bool) trustedProtocols;
        uint256 lastUpdated;
    }

    mapping(uint256 => Strategy) public strategies;
    mapping(uint256 => VotingResult) public votingResults;
    mapping(uint256 => Vote[]) public strategyVotes;
    mapping(address => AgentPreference) public agentPreferences;
    mapping(address => uint256) public votingPower;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    // Strategy performance tracking
    mapping(uint256 => uint256) public strategyPerformance; // Actual APY achieved
    mapping(uint256 => uint256) public strategyTVL; // Total Value Locked
    mapping(uint256 => bool) public activeStrategies;
    
    // Quadratic voting weights
    mapping(address => uint256) public quadraticCredits;
    mapping(uint256 => mapping(address => uint256)) public creditsUsed;
    
    uint256 public strategyCounter;
    uint256 public votingPeriod = 3 days;
    uint256 public quorumPercentage = 10; // 10% of total voting power
    uint256 public totalVotingPower;
    uint256 public maxAllocationPerStrategy = 25; // Max 25% of treasury per strategy
    
    // Performance-based voting power adjustments
    mapping(address => uint256) public accuracyScore; // Prediction accuracy score
    mapping(address => uint256) public totalPredictions;
    mapping(address => uint256) public correctPredictions;
    
    event StrategyProposed(
        uint256 indexed strategyId,
        address indexed proposer,
        StrategyType strategyType,
        string name
    );
    event VoteCast(
        uint256 indexed strategyId,
        address indexed voter,
        uint8 support,
        uint256 votingPower,
        uint256 riskTolerance
    );
    event StrategyExecuted(uint256 indexed strategyId, uint256 allocation);
    event StrategyDefeated(uint256 indexed strategyId, string reason);
    event PreferencesUpdated(address indexed agent, uint256 riskTolerance);
    event PerformanceUpdated(uint256 indexed strategyId, uint256 actualAPY);
    event AccuracyScoreUpdated(address indexed agent, uint256 newScore);
    
    modifier strategyExists(uint256 strategyId) {
        require(strategyId < strategyCounter, "Strategy does not exist");
        _;
    }
    
    modifier onlyAgent() {
        require(hasRole(AGENT_ROLE, msg.sender), "Not authorized agent");
        _;
    }
    
    modifier onlyProposer() {
        require(hasRole(STRATEGY_PROPOSER_ROLE, msg.sender), "Not authorized proposer");
        _;
    }
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(STRATEGY_PROPOSER_ROLE, msg.sender);
        _grantRole(AGENT_ROLE, msg.sender);
        _grantRole(ANALYZER_ROLE, msg.sender);
    }
    
    /**
     * @dev Propose a new strategy
     */
    function proposeStrategy(
        string calldata name,
        string calldata description,
        StrategyType strategyType,
        address targetProtocol,
        uint256 proposedAllocation,
        uint256 expectedAPY,
        uint256 riskLevel,
        bytes calldata configData
    ) external onlyProposer returns (uint256) {
        require(bytes(name).length > 0, "Name required");
        require(bytes(description).length > 0, "Description required");
        require(proposedAllocation <= maxAllocationPerStrategy, "Allocation too high");
        require(riskLevel >= 1 && riskLevel <= 10, "Invalid risk level");
        require(expectedAPY > 0, "Invalid expected APY");
        
        uint256 strategyId = strategyCounter++;
        Strategy storage strategy = strategies[strategyId];
        
        strategy.id = strategyId;
        strategy.name = name;
        strategy.description = description;
        strategy.strategyType = strategyType;
        strategy.targetProtocol = targetProtocol;
        strategy.proposedAllocation = proposedAllocation;
        strategy.expectedAPY = expectedAPY;
        strategy.riskLevel = riskLevel;
        strategy.configData = configData;
        strategy.proposer = msg.sender;
        strategy.createdAt = block.timestamp;
        strategy.votingDeadline = block.timestamp + votingPeriod;
        strategy.isActive = true;
        
        // Initialize voting result
        VotingResult storage result = votingResults[strategyId];
        result.status = VoteStatus.ACTIVE;
        
        emit StrategyProposed(strategyId, msg.sender, strategyType, name);
        return strategyId;
    }
    
    /**
     * @dev Cast vote on a strategy with quadratic voting
     */
    function castVote(
        uint256 strategyId,
        uint8 support,
        uint256 creditsToSpend,
        uint256 riskTolerance,
        uint256 expectedReturn,
        string calldata reasoning
    ) external strategyExists(strategyId) onlyAgent {
        require(support <= 2, "Invalid vote type");
        require(riskTolerance >= 1 && riskTolerance <= 10, "Invalid risk tolerance");
        require(!hasVoted[strategyId][msg.sender], "Already voted");
        
        Strategy storage strategy = strategies[strategyId];
        require(block.timestamp <= strategy.votingDeadline, "Voting period ended");
        require(strategy.isActive, "Strategy not active");
        
        // Quadratic voting: cost = credits^2
        require(creditsToSpend > 0, "Must spend credits");
        uint256 costInCredits = creditsToSpend * creditsToSpend;
        require(quadraticCredits[msg.sender] >= costInCredits, "Insufficient credits");
        
        quadraticCredits[msg.sender] -= costInCredits;
        creditsUsed[strategyId][msg.sender] = costInCredits;
        
        // Calculate effective voting power (quadratic)
        uint256 effectiveVotes = creditsToSpend;
        
        // Apply performance-based multiplier
        uint256 accuracyMultiplier = _getAccuracyMultiplier(msg.sender);
        uint256 finalVotingPower = (effectiveVotes * accuracyMultiplier) / 100;
        
        // Record vote
        Vote memory vote = Vote({
            strategyId: strategyId,
            voter: msg.sender,
            votingPower: finalVotingPower,
            support: support,
            riskTolerance: riskTolerance,
            expectedReturn: expectedReturn,
            reasoning: reasoning,
            timestamp: block.timestamp
        });
        
        strategyVotes[strategyId].push(vote);
        hasVoted[strategyId][msg.sender] = true;
        
        // Update voting results
        VotingResult storage result = votingResults[strategyId];
        result.totalVotingPower += finalVotingPower;
        
        if (support == 0) {
            result.againstVotes += finalVotingPower;
        } else if (support == 1) {
            result.forVotes += finalVotingPower;
        } else {
            result.abstainVotes += finalVotingPower;
        }
        
        // Update weighted averages
        uint256 totalVotes = strategyVotes[strategyId].length;
        result.averageRiskTolerance = (
            result.averageRiskTolerance * (totalVotes - 1) + riskTolerance
        ) / totalVotes;
        
        result.averageExpectedReturn = (
            result.averageExpectedReturn * (totalVotes - 1) + expectedReturn
        ) / totalVotes;
        
        // Check quorum
        result.quorumReached = result.totalVotingPower >= 
            (totalVotingPower * quorumPercentage) / 100;
        
        emit VoteCast(strategyId, msg.sender, support, finalVotingPower, riskTolerance);
        
        // Auto-execute if supermajority and quorum reached
        if (result.quorumReached && 
            result.forVotes > (result.totalVotingPower * 67) / 100) {
            _executeStrategy(strategyId);
        }
    }
    
    /**
     * @dev Execute strategy after voting period
     */
    function executeStrategy(uint256 strategyId) 
        external 
        strategyExists(strategyId) 
        nonReentrant 
    {
        Strategy storage strategy = strategies[strategyId];
        VotingResult storage result = votingResults[strategyId];
        
        require(block.timestamp > strategy.votingDeadline, "Voting period active");
        require(result.status == VoteStatus.ACTIVE, "Strategy not active");
        require(result.quorumReached, "Quorum not reached");
        require(result.forVotes > result.againstVotes, "Strategy defeated");
        
        _executeStrategy(strategyId);
    }
    
    /**
     * @dev Internal function to execute strategy
     */
    function _executeStrategy(uint256 strategyId) internal {
        Strategy storage strategy = strategies[strategyId];
        VotingResult storage result = votingResults[strategyId];
        
        result.status = VoteStatus.EXECUTED;
        activeStrategies[strategyId] = true;
        
        // Record predictions for accuracy tracking
        _recordPredictions(strategyId);
        
        emit StrategyExecuted(strategyId, strategy.proposedAllocation);
    }
    
    /**
     * @dev Update agent preferences
     */
    function updatePreferences(
        uint256 riskTolerance,
        uint256 returnExpectation,
        StrategyType[] calldata preferredTypes,
        address[] calldata trustedProtocols
    ) external onlyAgent {
        require(riskTolerance >= 1 && riskTolerance <= 10, "Invalid risk tolerance");
        
        AgentPreference storage pref = agentPreferences[msg.sender];
        pref.riskTolerance = riskTolerance;
        pref.returnExpectation = returnExpectation;
        pref.preferredTypes = preferredTypes;
        pref.lastUpdated = block.timestamp;
        
        // Update trusted protocols
        for (uint256 i = 0; i < trustedProtocols.length; i++) {
            pref.trustedProtocols[trustedProtocols[i]] = true;
        }
        
        emit PreferencesUpdated(msg.sender, riskTolerance);
    }
    
    /**
     * @dev Update strategy performance (analyzer role)
     */
    function updateStrategyPerformance(
        uint256 strategyId,
        uint256 actualAPY,
        uint256 currentTVL
    ) external onlyRole(ANALYZER_ROLE) strategyExists(strategyId) {
        require(activeStrategies[strategyId], "Strategy not active");
        
        strategyPerformance[strategyId] = actualAPY;
        strategyTVL[strategyId] = currentTVL;
        
        // Update accuracy scores for voters
        _updateAccuracyScores(strategyId, actualAPY);
        
        emit PerformanceUpdated(strategyId, actualAPY);
    }
    
    /**
     * @dev Get strategy recommendations based on agent preferences
     */
    function getRecommendations(address agent) 
        external 
        view 
        returns (uint256[] memory recommendedStrategies) 
    {
        AgentPreference storage pref = agentPreferences[agent];
        uint256[] memory candidates = new uint256[](strategyCounter);
        uint256 count = 0;
        
        for (uint256 i = 0; i < strategyCounter; i++) {
            Strategy storage strategy = strategies[i];
            if (strategy.isActive && 
                block.timestamp <= strategy.votingDeadline &&
                _isCompatibleStrategy(strategy, pref)) {
                candidates[count] = i;
                count++;
            }
        }
        
        // Resize array
        recommendedStrategies = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            recommendedStrategies[i] = candidates[i];
        }
        
        return recommendedStrategies;
    }
    
    /**
     * @dev Allocate quadratic voting credits to agents
     */
    function allocateCredits(address[] calldata agents, uint256[] calldata credits) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(agents.length == credits.length, "Array length mismatch");
        
        for (uint256 i = 0; i < agents.length; i++) {
            quadraticCredits[agents[i]] += credits[i];
        }
    }
    
    /**
     * @dev Check if strategy is compatible with agent preferences
     */
    function _isCompatibleStrategy(
        Strategy storage strategy,
        AgentPreference storage pref
    ) internal view returns (bool) {
        // Check risk tolerance (within 2 points)
        if (strategy.riskLevel > pref.riskTolerance + 2 || 
            strategy.riskLevel < pref.riskTolerance - 2) {
            return false;
        }
        
        // Check if protocol is trusted
        if (!pref.trustedProtocols[strategy.targetProtocol]) {
            return false;
        }
        
        // Check preferred strategy types
        bool typeMatch = false;
        for (uint256 i = 0; i < pref.preferredTypes.length; i++) {
            if (pref.preferredTypes[i] == strategy.strategyType) {
                typeMatch = true;
                break;
            }
        }
        
        return typeMatch;
    }
    
    /**
     * @dev Record predictions for accuracy tracking
     */
    function _recordPredictions(uint256 strategyId) internal {
        Vote[] storage votes = strategyVotes[strategyId];
        for (uint256 i = 0; i < votes.length; i++) {
            if (votes[i].support == 1) { // Only for 'for' votes
                totalPredictions[votes[i].voter]++;
            }
        }
    }
    
    /**
     * @dev Update accuracy scores based on actual performance
     */
    function _updateAccuracyScores(uint256 strategyId, uint256 actualAPY) internal {
        Vote[] storage votes = strategyVotes[strategyId];
        Strategy storage strategy = strategies[strategyId];
        
        for (uint256 i = 0; i < votes.length; i++) {
            Vote storage vote = votes[i];
            if (vote.support == 1) { // Only for 'for' votes
                // Check if prediction was accurate (within 20% of actual)
                uint256 expectedAPY = vote.expectedReturn;
                uint256 deviation = actualAPY > expectedAPY ? 
                    actualAPY - expectedAPY : expectedAPY - actualAPY;
                
                if (deviation <= (expectedAPY * 20) / 100) {
                    correctPredictions[vote.voter]++;
                }
                
                // Update accuracy score
                if (totalPredictions[vote.voter] > 0) {
                    accuracyScore[vote.voter] = 
                        (correctPredictions[vote.voter] * 100) / totalPredictions[vote.voter];
                }
                
                emit AccuracyScoreUpdated(vote.voter, accuracyScore[vote.voter]);
            }
        }
    }
    
    /**
     * @dev Get accuracy-based voting power multiplier
     */
    function _getAccuracyMultiplier(address agent) internal view returns (uint256) {
        uint256 accuracy = accuracyScore[agent];
        if (accuracy >= 80) return 150; // 50% bonus for high accuracy
        if (accuracy >= 60) return 125; // 25% bonus for good accuracy
        if (accuracy >= 40) return 100; // Normal voting power
        if (accuracy >= 20) return 75;  // 25% penalty for poor accuracy
        return 50; // 50% penalty for very poor accuracy
    }
    
    /**
     * @dev Get strategy voting results
     */
    function getVotingResults(uint256 strategyId) 
        external 
        view 
        strategyExists(strategyId) 
        returns (
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            uint256 totalVotingPower,
            uint256 averageRiskTolerance,
            uint256 averageExpectedReturn,
            bool quorumReached,
            VoteStatus status
        ) 
    {
        VotingResult storage result = votingResults[strategyId];
        return (
            result.forVotes,
            result.againstVotes,
            result.abstainVotes,
            result.totalVotingPower,
            result.averageRiskTolerance,
            result.averageExpectedReturn,
            result.quorumReached,
            result.status
        );
    }
    
    /**
     * @dev Get agent's voting history for a strategy
     */
    function getAgentVote(uint256 strategyId, address agent) 
        external 
        view 
        returns (bool voted, uint8 support, uint256 votingPower, string memory reasoning) 
    {
        if (!hasVoted[strategyId][agent]) {
            return (false, 0, 0, "");
        }
        
        Vote[] storage votes = strategyVotes[strategyId];
        for (uint256 i = 0; i < votes.length; i++) {
            if (votes[i].voter == agent) {
                return (
                    true,
                    votes[i].support,
                    votes[i].votingPower,
                    votes[i].reasoning
                );
            }
        }
        
        return (false, 0, 0, "");
    }
    
    /**
     * @dev Update voting parameters
     */
    function updateVotingParameters(
        uint256 _votingPeriod,
        uint256 _quorumPercentage,
        uint256 _maxAllocationPerStrategy
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_votingPeriod >= 1 days && _votingPeriod <= 7 days, "Invalid voting period");
        require(_quorumPercentage >= 1 && _quorumPercentage <= 50, "Invalid quorum");
        require(_maxAllocationPerStrategy <= 50, "Invalid max allocation");
        
        votingPeriod = _votingPeriod;
        quorumPercentage = _quorumPercentage;
        maxAllocationPerStrategy = _maxAllocationPerStrategy;
    }
}