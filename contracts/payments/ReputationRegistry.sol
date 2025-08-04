// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ReputationRegistry
 * @dev Agent reputation and performance tracking system
 */
contract ReputationRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");
    
    struct AgentProfile {
        string name;
        string description;
        string[] skills;
        uint256 totalJobs;
        uint256 completedJobs;
        uint256 totalEarnings;
        uint256 averageRating; // Scaled by 100 (e.g., 450 = 4.50)
        uint256 responseTime; // Average response time in seconds
        uint256 registrationTime;
        bool isActive;
        bool isVerified;
    }
    
    struct Review {
        uint256 jobId;
        address client;
        address agent;
        uint256 rating; // 1-5 scaled by 100
        string comment;
        uint256 timestamp;
        bool verified;
    }
    
    struct PerformanceMetrics {
        uint256 onTimeDelivery;
        uint256 qualityScore;
        uint256 communicationScore;
        uint256 technicalScore;
        uint256 totalReviews;
        uint256 lastUpdated;
    }
    
    mapping(address => AgentProfile) public agents;
    mapping(address => PerformanceMetrics) public metrics;
    mapping(uint256 => Review) public reviews;
    mapping(address => uint256[]) public agentReviews;
    mapping(address => uint256[]) public clientReviews;
    mapping(address => bool) public registeredAgents;
    
    uint256 public reviewCounter;
    uint256 public verificationFee = 1 ether;
    uint256 public minimumStake = 10 ether;
    
    mapping(address => uint256) public agentStakes;
    mapping(address => uint256) public disputedJobs;
    
    event AgentRegistered(address indexed agent, string name);
    event AgentVerified(address indexed agent, address indexed verifier);
    event ReviewSubmitted(uint256 indexed reviewId, address indexed client, address indexed agent, uint256 rating);
    event ReputationUpdated(address indexed agent, uint256 newRating, uint256 totalJobs);
    event AgentStaked(address indexed agent, uint256 amount);
    event AgentSlashed(address indexed agent, uint256 amount, string reason);
    event SkillAdded(address indexed agent, string skill);
    
    modifier onlyRegisteredAgent() {
        require(registeredAgents[msg.sender], "Agent not registered");
        _;
    }
    
    modifier agentExists(address agent) {
        require(registeredAgents[agent], "Agent does not exist");
        _;
    }
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }
    
    /**
     * @dev Register as an AI agent
     */
    function registerAgent(
        string calldata name,
        string calldata description,
        string[] calldata skills
    ) external payable {
        require(!registeredAgents[msg.sender], "Agent already registered");
        require(bytes(name).length > 0, "Name required");
        require(msg.value >= minimumStake, "Insufficient stake");
        
        AgentProfile storage profile = agents[msg.sender];
        profile.name = name;
        profile.description = description;
        profile.skills = skills;
        profile.registrationTime = block.timestamp;
        profile.isActive = true;
        
        registeredAgents[msg.sender] = true;
        agentStakes[msg.sender] = msg.value;
        
        emit AgentRegistered(msg.sender, name);
        emit AgentStaked(msg.sender, msg.value);
    }
    
    /**
     * @dev Verify agent (verifier only)
     */
    function verifyAgent(address agent) external onlyRole(VERIFIER_ROLE) agentExists(agent) {
        agents[agent].isVerified = true;
        emit AgentVerified(agent, msg.sender);
    }
    
    /**
     * @dev Submit review for completed job
     */
    function submitReview(
        uint256 jobId,
        address agent,
        uint256 rating,
        string calldata comment,
        uint256 onTimeScore,
        uint256 qualityScore,
        uint256 communicationScore,
        uint256 technicalScore
    ) external agentExists(agent) {
        require(rating >= 100 && rating <= 500, "Invalid rating"); // 1.00 to 5.00
        require(onTimeScore <= 100 && qualityScore <= 100, "Invalid scores");
        require(communicationScore <= 100 && technicalScore <= 100, "Invalid scores");
        
        uint256 reviewId = reviewCounter++;
        Review storage review = reviews[reviewId];
        
        review.jobId = jobId;
        review.client = msg.sender;
        review.agent = agent;
        review.rating = rating;
        review.comment = comment;
        review.timestamp = block.timestamp;
        
        agentReviews[agent].push(reviewId);
        clientReviews[msg.sender].push(reviewId);
        
        _updateReputation(agent, rating, onTimeScore, qualityScore, communicationScore, technicalScore);
        
        emit ReviewSubmitted(reviewId, msg.sender, agent, rating);
    }
    
    /**
     * @dev Update job completion (escrow contract only)
     */
    function updateJobCompletion(
        address agent,
        bool completed,
        uint256 earnings
    ) external onlyRole(ESCROW_ROLE) agentExists(agent) {
        AgentProfile storage profile = agents[agent];
        profile.totalJobs++;
        
        if (completed) {
            profile.completedJobs++;
            profile.totalEarnings += earnings;
        }
        
        emit ReputationUpdated(agent, profile.averageRating, profile.totalJobs);
    }
    
    /**
     * @dev Update agent reputation based on review
     */
    function _updateReputation(
        address agent,
        uint256 rating,
        uint256 onTimeScore,
        uint256 qualityScore,
        uint256 communicationScore,
        uint256 technicalScore
    ) internal {
        AgentProfile storage profile = agents[agent];
        PerformanceMetrics storage perf = metrics[agent];
        
        // Update average rating
        uint256 totalRatingScore = profile.averageRating * perf.totalReviews + rating;
        perf.totalReviews++;
        profile.averageRating = totalRatingScore / perf.totalReviews;
        
        // Update performance metrics
        perf.onTimeDelivery = (perf.onTimeDelivery * (perf.totalReviews - 1) + onTimeScore) / perf.totalReviews;
        perf.qualityScore = (perf.qualityScore * (perf.totalReviews - 1) + qualityScore) / perf.totalReviews;
        perf.communicationScore = (perf.communicationScore * (perf.totalReviews - 1) + communicationScore) / perf.totalReviews;
        perf.technicalScore = (perf.technicalScore * (perf.totalReviews - 1) + technicalScore) / perf.totalReviews;
        perf.lastUpdated = block.timestamp;
    }
    
    /**
     * @dev Add skill to agent profile
     */
    function addSkill(string calldata skill) external onlyRegisteredAgent {
        require(bytes(skill).length > 0, "Invalid skill");
        
        agents[msg.sender].skills.push(skill);
        emit SkillAdded(msg.sender, skill);
    }
    
    /**
     * @dev Update agent description
     */
    function updateDescription(string calldata newDescription) external onlyRegisteredAgent {
        agents[msg.sender].description = newDescription;
    }
    
    /**
     * @dev Stake additional tokens
     */
    function stakeTokens() external payable onlyRegisteredAgent {
        require(msg.value > 0, "Invalid amount");
        agentStakes[msg.sender] += msg.value;
        emit AgentStaked(msg.sender, msg.value);
    }
    
    /**
     * @dev Slash agent stake for misconduct
     */
    function slashAgent(
        address agent, 
        uint256 amount, 
        string calldata reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) agentExists(agent) {
        require(amount <= agentStakes[agent], "Insufficient stake");
        
        agentStakes[agent] -= amount;
        disputedJobs[agent]++;
        
        // Reduce reputation for slashing
        AgentProfile storage profile = agents[agent];
        if (profile.averageRating > 50) {
            profile.averageRating -= 50; // Reduce by 0.5 points
        }
        
        emit AgentSlashed(agent, amount, reason);
    }
    
    /**
     * @dev Withdraw stake (if agent wants to leave)
     */
    function withdrawStake() external onlyRegisteredAgent nonReentrant {
        require(!agents[msg.sender].isActive, "Agent still active");
        require(disputedJobs[msg.sender] == 0, "Pending disputes");
        
        uint256 stake = agentStakes[msg.sender];
        require(stake > 0, "No stake to withdraw");
        
        agentStakes[msg.sender] = 0;
        payable(msg.sender).transfer(stake);
    }
    
    /**
     * @dev Set agent active status
     */
    function setActiveStatus(bool active) external onlyRegisteredAgent {
        agents[msg.sender].isActive = active;
    }
    
    /**
     * @dev Get agent profile
     */
    function getAgentProfile(address agent) external view agentExists(agent) returns (
        string memory name,
        string memory description,
        string[] memory skills,
        uint256 totalJobs,
        uint256 completedJobs,
        uint256 totalEarnings,
        uint256 averageRating,
        bool isActive,
        bool isVerified
    ) {
        AgentProfile storage profile = agents[agent];
        return (
            profile.name,
            profile.description,
            profile.skills,
            profile.totalJobs,
            profile.completedJobs,
            profile.totalEarnings,
            profile.averageRating,
            profile.isActive,
            profile.isVerified
        );
    }
    
    /**
     * @dev Get performance metrics
     */
    function getPerformanceMetrics(address agent) external view agentExists(agent) returns (
        uint256 onTimeDelivery,
        uint256 qualityScore,
        uint256 communicationScore,
        uint256 technicalScore,
        uint256 totalReviews,
        uint256 completionRate
    ) {
        PerformanceMetrics storage perf = metrics[agent];
        AgentProfile storage profile = agents[agent];
        
        uint256 completionRate = profile.totalJobs > 0 ? 
            (profile.completedJobs * 100) / profile.totalJobs : 0;
        
        return (
            perf.onTimeDelivery,
            perf.qualityScore,
            perf.communicationScore,
            perf.technicalScore,
            perf.totalReviews,
            completionRate
        );
    }
    
    /**
     * @dev Get agent reviews
     */
    function getAgentReviews(address agent, uint256 limit) 
        external 
        view 
        agentExists(agent) 
        returns (uint256[] memory) 
    {
        uint256[] memory agentReviewList = agentReviews[agent];
        uint256 length = agentReviewList.length;
        
        if (limit == 0 || limit > length) {
            limit = length;
        }
        
        uint256[] memory result = new uint256[](limit);
        for (uint256 i = 0; i < limit; i++) {
            result[i] = agentReviewList[length - 1 - i]; // Most recent first
        }
        
        return result;
    }
    
    /**
     * @dev Get review details
     */
    function getReview(uint256 reviewId) external view returns (
        uint256 jobId,
        address client,
        address agent,
        uint256 rating,
        string memory comment,
        uint256 timestamp,
        bool verified
    ) {
        require(reviewId < reviewCounter, "Review does not exist");
        Review storage review = reviews[reviewId];
        
        return (
            review.jobId,
            review.client,
            review.agent,
            review.rating,
            review.comment,
            review.timestamp,
            review.verified
        );
    }
    
    /**
     * @dev Update minimum stake (admin only)
     */
    function updateMinimumStake(uint256 newStake) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minimumStake = newStake;
    }
    
    /**
     * @dev Update verification fee (admin only)
     */
    function updateVerificationFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        verificationFee = newFee;
    }
}