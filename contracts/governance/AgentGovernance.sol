// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title AgentGovernance
 * @dev Decentralized governance system for AI agents collective decision making
 */
contract AgentGovernance is ReentrancyGuard {
    using ECDSA for bytes32;

    enum ProposalType {
        PARAMETER_CHANGE,
        TREASURY_ALLOCATION,
        AGENT_ADMISSION,
        AGENT_REMOVAL,
        STRATEGY_CHANGE,
        EMERGENCY_ACTION
    }

    enum ProposalStatus {
        PENDING,
        ACTIVE,
        SUCCEEDED,
        DEFEATED,
        EXECUTED,
        CANCELLED
    }

    struct Proposal {
        uint256 id;
        address proposer;
        ProposalType proposalType;
        string title;
        string description;
        bytes executionData;
        address targetContract;
        uint256 value;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 quorumRequired;
        ProposalStatus status;
        bool executed;
        mapping(address => bool) hasVoted;
        mapping(address => uint8) voteChoice; // 0=against, 1=for, 2=abstain
    }

    struct VotingPower {
        uint256 tokenBalance;
        uint256 reputationScore;
        uint256 stakingWeight;
        uint256 totalPower;
        uint256 lastUpdated;
    }

    // Governance parameters
    uint256 public proposalThreshold = 1000e18; // Min tokens to propose
    uint256 public quorumPercentage = 4; // 4% of total supply
    uint256 public votingPeriod = 3 days;
    uint256 public executionDelay = 1 days;
    uint256 public reputationWeight = 30; // 30% weight for reputation
    uint256 public stakingWeight = 20; // 20% weight for staking
    uint256 public tokenWeight = 50; // 50% weight for token holdings

    mapping(uint256 => Proposal) public proposals;
    mapping(address => VotingPower) public votingPowers;
    mapping(address => uint256[]) public agentProposals;
    mapping(address => uint256) public agentStakes;
    mapping(address => bool) public approvedAgents;
    mapping(address => uint256) public lastProposalTime;

    uint256 public proposalCounter;
    uint256 public totalVotingPower;
    uint256 public totalAgentStake;
    
    IERC20 public governanceToken;
    address public treasury;
    address public reputationContract;
    address public stakingContract;
    
    // Multi-signature for emergency actions
    mapping(address => bool) public emergencyCouncil;
    uint256 public emergencyCouncilSize;
    uint256 public emergencyQuorum = 3;

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType proposalType,
        string title
    );
    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        uint8 support,
        uint256 votingPower,
        string reason
    );
    event ProposalExecuted(uint256 indexed proposalId, bool success);
    event ProposalCancelled(uint256 indexed proposalId, string reason);
    event VotingPowerUpdated(address indexed agent, uint256 newPower);
    event AgentApproved(address indexed agent);
    event AgentRemoved(address indexed agent, string reason);
    event EmergencyActionExecuted(address indexed executor, bytes data);

    modifier onlyApprovedAgent() {
        require(approvedAgents[msg.sender], "Agent not approved");
        _;
    }

    modifier onlyEmergencyCouncil() {
        require(emergencyCouncil[msg.sender], "Not emergency council member");
        _;
    }

    modifier proposalExists(uint256 proposalId) {
        require(proposalId < proposalCounter, "Proposal does not exist");
        _;
    }

    constructor(
        address _governanceToken,
        address _treasury,
        address _reputationContract,
        address _stakingContract
    ) {
        governanceToken = IERC20(_governanceToken);
        treasury = _treasury;
        reputationContract = _reputationContract;
        stakingContract = _stakingContract;
        
        // Set deployer as initial emergency council member
        emergencyCouncil[msg.sender] = true;
        emergencyCouncilSize = 1;
    }

    /**
     * @dev Create a new governance proposal
     */
    function propose(
        ProposalType proposalType,
        string calldata title,
        string calldata description,
        address targetContract,
        uint256 value,
        bytes calldata executionData
    ) external onlyApprovedAgent returns (uint256) {
        require(bytes(title).length > 0, "Title required");
        require(bytes(description).length > 0, "Description required");
        require(
            governanceToken.balanceOf(msg.sender) >= proposalThreshold,
            "Insufficient tokens to propose"
        );
        require(
            block.timestamp >= lastProposalTime[msg.sender] + 1 days,
            "Proposal cooldown active"
        );

        uint256 proposalId = proposalCounter++;
        Proposal storage proposal = proposals[proposalId];

        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.proposalType = proposalType;
        proposal.title = title;
        proposal.description = description;
        proposal.executionData = executionData;
        proposal.targetContract = targetContract;
        proposal.value = value;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + votingPeriod;
        proposal.quorumRequired = (totalVotingPower * quorumPercentage) / 100;
        proposal.status = ProposalStatus.ACTIVE;

        agentProposals[msg.sender].push(proposalId);
        lastProposalTime[msg.sender] = block.timestamp;

        emit ProposalCreated(proposalId, msg.sender, proposalType, title);
        return proposalId;
    }

    /**
     * @dev Cast vote on a proposal
     */
    function castVote(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    ) external proposalExists(proposalId) onlyApprovedAgent {
        require(support <= 2, "Invalid vote type");
        
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.ACTIVE, "Proposal not active");
        require(block.timestamp <= proposal.endTime, "Voting period ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");

        _updateVotingPower(msg.sender);
        uint256 voterPower = votingPowers[msg.sender].totalPower;
        require(voterPower > 0, "No voting power");

        proposal.hasVoted[msg.sender] = true;
        proposal.voteChoice[msg.sender] = support;

        if (support == 0) {
            proposal.againstVotes += voterPower;
        } else if (support == 1) {
            proposal.forVotes += voterPower;
        } else {
            proposal.abstainVotes += voterPower;
        }

        emit VoteCast(msg.sender, proposalId, support, voterPower, reason);

        // Check if proposal can be executed early (supermajority)
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        if (totalVotes >= proposal.quorumRequired) {
            if (proposal.forVotes > (totalVotes * 67) / 100) {
                proposal.status = ProposalStatus.SUCCEEDED;
            } else if (proposal.againstVotes > (totalVotes * 67) / 100) {
                proposal.status = ProposalStatus.DEFEATED;
            }
        }
    }

    /**
     * @dev Cast vote with signature (for meta-transactions)
     */
    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        string calldata reason,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external proposalExists(proposalId) {
        bytes32 domainSeparator = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("NEXUS Agent Governance"),
            keccak256("1"),
            block.chainid,
            address(this)
        ));

        bytes32 structHash = keccak256(abi.encode(
            keccak256("Vote(uint256 proposalId,uint8 support,string reason,uint256 nonce)"),
            proposalId,
            support,
            keccak256(bytes(reason)),
            block.timestamp
        ));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = ecrecover(digest, v, r, s);
        
        require(approvedAgents[signer], "Signer not approved agent");
        require(!proposals[proposalId].hasVoted[signer], "Already voted");

        // Execute vote on behalf of signer
        _castVoteInternal(proposalId, support, signer, reason);
    }

    /**
     * @dev Execute a successful proposal
     */
    function executeProposal(uint256 proposalId) 
        external 
        proposalExists(proposalId) 
        nonReentrant 
    {
        Proposal storage proposal = proposals[proposalId];
        require(
            proposal.status == ProposalStatus.SUCCEEDED || 
            (block.timestamp > proposal.endTime && _isProposalSuccessful(proposalId)),
            "Proposal not ready for execution"
        );
        require(!proposal.executed, "Proposal already executed");
        require(
            block.timestamp >= proposal.endTime + executionDelay,
            "Execution delay not met"
        );

        proposal.executed = true;
        proposal.status = ProposalStatus.EXECUTED;

        bool success = false;
        if (proposal.executionData.length > 0) {
            (success,) = proposal.targetContract.call{value: proposal.value}(
                proposal.executionData
            );
        } else {
            success = true; // For proposals that don't require execution
        }

        emit ProposalExecuted(proposalId, success);
    }

    /**
     * @dev Cancel a proposal (proposer or emergency council)
     */
    function cancelProposal(uint256 proposalId, string calldata reason) 
        external 
        proposalExists(proposalId) 
    {
        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.proposer || emergencyCouncil[msg.sender],
            "Not authorized to cancel"
        );
        require(
            proposal.status == ProposalStatus.ACTIVE || 
            proposal.status == ProposalStatus.PENDING,
            "Cannot cancel executed proposal"
        );

        proposal.status = ProposalStatus.CANCELLED;
        emit ProposalCancelled(proposalId, reason);
    }

    /**
     * @dev Update voting power for an agent
     */
    function updateVotingPower(address agent) external {
        _updateVotingPower(agent);
    }

    /**
     * @dev Approve new agent for governance participation
     */
    function approveAgent(address agent) external onlyEmergencyCouncil {
        require(!approvedAgents[agent], "Agent already approved");
        approvedAgents[agent] = true;
        _updateVotingPower(agent);
        emit AgentApproved(agent);
    }

    /**
     * @dev Remove agent from governance
     */
    function removeAgent(address agent, string calldata reason) external onlyEmergencyCouncil {
        require(approvedAgents[agent], "Agent not approved");
        approvedAgents[agent] = false;
        
        // Remove voting power
        totalVotingPower -= votingPowers[agent].totalPower;
        delete votingPowers[agent];
        
        emit AgentRemoved(agent, reason);
    }

    /**
     * @dev Emergency action (requires multiple emergency council signatures)
     */
    function emergencyAction(
        address target,
        bytes calldata data,
        bytes[] calldata signatures
    ) external onlyEmergencyCouncil nonReentrant {
        require(signatures.length >= emergencyQuorum, "Insufficient signatures");
        
        bytes32 actionHash = keccak256(abi.encodePacked(target, data, block.timestamp));
        
        // Verify signatures
        address[] memory signers = new address[](signatures.length);
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = actionHash.toEthSignedMessageHash().recover(signatures[i]);
            require(emergencyCouncil[signer], "Invalid signer");
            
            // Check for duplicate signers
            for (uint256 j = 0; j < i; j++) {
                require(signers[j] != signer, "Duplicate signer");
            }
            signers[i] = signer;
        }
        
        (bool success,) = target.call(data);
        require(success, "Emergency action failed");
        
        emit EmergencyActionExecuted(msg.sender, data);
    }

    /**
     * @dev Internal function to cast vote
     */
    function _castVoteInternal(
        uint256 proposalId,
        uint8 support,
        address voter,
        string calldata reason
    ) internal {
        Proposal storage proposal = proposals[proposalId];
        
        _updateVotingPower(voter);
        uint256 voterPower = votingPowers[voter].totalPower;
        
        proposal.hasVoted[voter] = true;
        proposal.voteChoice[voter] = support;

        if (support == 0) {
            proposal.againstVotes += voterPower;
        } else if (support == 1) {
            proposal.forVotes += voterPower;
        } else {
            proposal.abstainVotes += voterPower;
        }

        emit VoteCast(voter, proposalId, support, voterPower, reason);
    }

    /**
     * @dev Update voting power calculation
     */
    function _updateVotingPower(address agent) internal {
        if (!approvedAgents[agent]) return;
        
        VotingPower storage power = votingPowers[agent];
        uint256 oldPower = power.totalPower;
        
        // Get current balances and scores
        power.tokenBalance = governanceToken.balanceOf(agent);
        
        // Get reputation score from reputation contract
        // This would call the reputation contract to get agent's score
        // For now, we'll use a placeholder
        power.reputationScore = 100; // Placeholder
        
        // Get staking weight
        power.stakingWeight = agentStakes[agent];
        
        // Calculate total voting power
        power.totalPower = 
            (power.tokenBalance * tokenWeight / 100) +
            (power.reputationScore * reputationWeight / 100) +
            (power.stakingWeight * stakingWeight / 100);
            
        power.lastUpdated = block.timestamp;
        
        // Update total voting power
        totalVotingPower = totalVotingPower - oldPower + power.totalPower;
        
        emit VotingPowerUpdated(agent, power.totalPower);
    }

    /**
     * @dev Check if proposal is successful
     */
    function _isProposalSuccessful(uint256 proposalId) internal view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        
        return totalVotes >= proposal.quorumRequired && 
               proposal.forVotes > proposal.againstVotes;
    }

    /**
     * @dev Stake tokens for additional voting power
     */
    function stakeForVoting(uint256 amount) external onlyApprovedAgent {
        require(amount > 0, "Invalid amount");
        
        governanceToken.transferFrom(msg.sender, address(this), amount);
        agentStakes[msg.sender] += amount;
        totalAgentStake += amount;
        
        _updateVotingPower(msg.sender);
    }

    /**
     * @dev Unstake tokens
     */
    function unstake(uint256 amount) external onlyApprovedAgent {
        require(amount > 0, "Invalid amount");
        require(agentStakes[msg.sender] >= amount, "Insufficient stake");
        
        agentStakes[msg.sender] -= amount;
        totalAgentStake -= amount;
        
        governanceToken.transfer(msg.sender, amount);
        _updateVotingPower(msg.sender);
    }

    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 proposalId) external view proposalExists(proposalId) returns (
        address proposer,
        ProposalType proposalType,
        string memory title,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        ProposalStatus status
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.proposalType,
            proposal.title,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.status
        );
    }

    /**
     * @dev Update governance parameters (via proposal execution)
     */
    function updateGovernanceParams(
        uint256 _proposalThreshold,
        uint256 _quorumPercentage,
        uint256 _votingPeriod,
        uint256 _executionDelay
    ) external {
        require(msg.sender == address(this), "Only via governance");
        
        proposalThreshold = _proposalThreshold;
        quorumPercentage = _quorumPercentage;
        votingPeriod = _votingPeriod;
        executionDelay = _executionDelay;
    }
}