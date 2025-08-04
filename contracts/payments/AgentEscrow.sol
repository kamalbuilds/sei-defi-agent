// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AgentEscrow
 * @dev Escrow contract for AI agent services with milestone-based payments
 */
contract AgentEscrow is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    
    enum EscrowStatus {
        CREATED,
        FUNDED,
        ACTIVE,
        DISPUTED,
        COMPLETED,
        CANCELLED
    }
    
    struct Milestone {
        uint256 amount;
        string description;
        bool completed;
        bool approved;
        uint256 deadline;
    }
    
    struct EscrowData {
        address client;
        address agent;
        address token;
        uint256 totalAmount;
        uint256 releasedAmount;
        EscrowStatus status;
        uint256 createdAt;
        uint256 disputeDeadline;
        Milestone[] milestones;
    }
    
    mapping(uint256 => EscrowData) public escrows;
    mapping(address => uint256[]) public clientEscrows;
    mapping(address => uint256[]) public agentEscrows;
    
    uint256 public escrowCounter;
    uint256 public platformFee = 250; // 2.5%
    uint256 public constant MAX_FEE = 500; // 5%
    address public feeRecipient;
    
    event EscrowCreated(uint256 indexed escrowId, address indexed client, address indexed agent, uint256 amount);
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
    event MilestoneCompleted(uint256 indexed escrowId, uint256 milestoneIndex);
    event MilestoneApproved(uint256 indexed escrowId, uint256 milestoneIndex, uint256 amount);
    event PaymentReleased(uint256 indexed escrowId, uint256 amount);
    event DisputeRaised(uint256 indexed escrowId, address indexed initiator);
    event DisputeResolved(uint256 indexed escrowId, address winner, uint256 amount);
    event EscrowCompleted(uint256 indexed escrowId);
    
    modifier onlyEscrowParties(uint256 escrowId) {
        require(
            msg.sender == escrows[escrowId].client || 
            msg.sender == escrows[escrowId].agent,
            "Not authorized"
        );
        _;
    }
    
    modifier escrowExists(uint256 escrowId) {
        require(escrowId < escrowCounter, "Escrow does not exist");
        _;
    }
    
    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ARBITRATOR_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new escrow with milestones
     */
    function createEscrow(
        address agent,
        address token,
        uint256 totalAmount,
        uint256[] calldata milestoneAmounts,
        string[] calldata milestoneDescriptions,
        uint256[] calldata milestoneDeadlines
    ) external returns (uint256) {
        require(agent != address(0), "Invalid agent");
        require(token != address(0), "Invalid token");
        require(totalAmount > 0, "Invalid amount");
        require(
            milestoneAmounts.length == milestoneDescriptions.length &&
            milestoneAmounts.length == milestoneDeadlines.length,
            "Milestone data mismatch"
        );
        
        uint256 totalMilestoneAmount = 0;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            totalMilestoneAmount += milestoneAmounts[i];
        }
        require(totalMilestoneAmount == totalAmount, "Milestone amounts don't match total");
        
        uint256 escrowId = escrowCounter++;
        EscrowData storage escrow = escrows[escrowId];
        
        escrow.client = msg.sender;
        escrow.agent = agent;
        escrow.token = token;
        escrow.totalAmount = totalAmount;
        escrow.status = EscrowStatus.CREATED;
        escrow.createdAt = block.timestamp;
        
        // Create milestones
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            escrow.milestones.push(Milestone({
                amount: milestoneAmounts[i],
                description: milestoneDescriptions[i],
                completed: false,
                approved: false,
                deadline: milestoneDeadlines[i]
            }));
        }
        
        clientEscrows[msg.sender].push(escrowId);
        agentEscrows[agent].push(escrowId);
        
        emit EscrowCreated(escrowId, msg.sender, agent, totalAmount);
        return escrowId;
    }
    
    /**
     * @dev Fund the escrow
     */
    function fundEscrow(uint256 escrowId) external escrowExists(escrowId) nonReentrant {
        EscrowData storage escrow = escrows[escrowId];
        require(msg.sender == escrow.client, "Only client can fund");
        require(escrow.status == EscrowStatus.CREATED, "Invalid status");
        
        IERC20(escrow.token).safeTransferFrom(msg.sender, address(this), escrow.totalAmount);
        escrow.status = EscrowStatus.FUNDED;
        
        emit EscrowFunded(escrowId, escrow.totalAmount);
    }
    
    /**
     * @dev Agent marks milestone as completed
     */
    function completeMilestone(uint256 escrowId, uint256 milestoneIndex) 
        external 
        escrowExists(escrowId) 
    {
        EscrowData storage escrow = escrows[escrowId];
        require(msg.sender == escrow.agent, "Only agent can complete");
        require(escrow.status == EscrowStatus.FUNDED || escrow.status == EscrowStatus.ACTIVE, "Invalid status");
        require(milestoneIndex < escrow.milestones.length, "Invalid milestone");
        require(!escrow.milestones[milestoneIndex].completed, "Already completed");
        
        escrow.milestones[milestoneIndex].completed = true;
        escrow.status = EscrowStatus.ACTIVE;
        
        emit MilestoneCompleted(escrowId, milestoneIndex);
    }
    
    /**
     * @dev Client approves milestone and releases payment
     */
    function approveMilestone(uint256 escrowId, uint256 milestoneIndex) 
        external 
        escrowExists(escrowId) 
        nonReentrant 
    {
        EscrowData storage escrow = escrows[escrowId];
        require(msg.sender == escrow.client, "Only client can approve");
        require(escrow.milestones[milestoneIndex].completed, "Milestone not completed");
        require(!escrow.milestones[milestoneIndex].approved, "Already approved");
        
        Milestone storage milestone = escrow.milestones[milestoneIndex];
        milestone.approved = true;
        
        uint256 amount = milestone.amount;
        uint256 fee = (amount * platformFee) / 10000;
        uint256 agentAmount = amount - fee;
        
        escrow.releasedAmount += amount;
        
        IERC20(escrow.token).safeTransfer(escrow.agent, agentAmount);
        if (fee > 0) {
            IERC20(escrow.token).safeTransfer(feeRecipient, fee);
        }
        
        emit MilestoneApproved(escrowId, milestoneIndex, amount);
        emit PaymentReleased(escrowId, agentAmount);
        
        // Check if all milestones are completed
        bool allCompleted = true;
        for (uint256 i = 0; i < escrow.milestones.length; i++) {
            if (!escrow.milestones[i].approved) {
                allCompleted = false;
                break;
            }
        }
        
        if (allCompleted) {
            escrow.status = EscrowStatus.COMPLETED;
            emit EscrowCompleted(escrowId);
        }
    }
    
    /**
     * @dev Raise a dispute
     */
    function raiseDispute(uint256 escrowId) 
        external 
        escrowExists(escrowId) 
        onlyEscrowParties(escrowId) 
    {
        EscrowData storage escrow = escrows[escrowId];
        require(
            escrow.status == EscrowStatus.ACTIVE || 
            escrow.status == EscrowStatus.FUNDED,
            "Invalid status for dispute"
        );
        
        escrow.status = EscrowStatus.DISPUTED;
        escrow.disputeDeadline = block.timestamp + 7 days;
        
        emit DisputeRaised(escrowId, msg.sender);
    }
    
    /**
     * @dev Resolve dispute (arbitrator only)
     */
    function resolveDispute(
        uint256 escrowId, 
        address winner, 
        uint256 clientAmount, 
        uint256 agentAmount
    ) external escrowExists(escrowId) onlyRole(ARBITRATOR_ROLE) nonReentrant {
        EscrowData storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.DISPUTED, "Not in dispute");
        require(winner == escrow.client || winner == escrow.agent, "Invalid winner");
        require(clientAmount + agentAmount <= escrow.totalAmount - escrow.releasedAmount, "Invalid amounts");
        
        if (clientAmount > 0) {
            IERC20(escrow.token).safeTransfer(escrow.client, clientAmount);
        }
        
        if (agentAmount > 0) {
            uint256 fee = (agentAmount * platformFee) / 10000;
            uint256 netAgentAmount = agentAmount - fee;
            
            IERC20(escrow.token).safeTransfer(escrow.agent, netAgentAmount);
            if (fee > 0) {
                IERC20(escrow.token).safeTransfer(feeRecipient, fee);
            }
        }
        
        escrow.status = EscrowStatus.COMPLETED;
        emit DisputeResolved(escrowId, winner, clientAmount + agentAmount);
        emit EscrowCompleted(escrowId);
    }
    
    /**
     * @dev Get escrow details
     */
    function getEscrow(uint256 escrowId) external view escrowExists(escrowId) returns (
        address client,
        address agent,
        address token,
        uint256 totalAmount,
        uint256 releasedAmount,
        EscrowStatus status,
        uint256 createdAt
    ) {
        EscrowData storage escrow = escrows[escrowId];
        return (
            escrow.client,
            escrow.agent,
            escrow.token,
            escrow.totalAmount,
            escrow.releasedAmount,
            escrow.status,
            escrow.createdAt
        );
    }
    
    /**
     * @dev Get milestone details
     */
    function getMilestone(uint256 escrowId, uint256 milestoneIndex) 
        external 
        view 
        escrowExists(escrowId) 
        returns (uint256 amount, string memory description, bool completed, bool approved, uint256 deadline) 
    {
        require(milestoneIndex < escrows[escrowId].milestones.length, "Invalid milestone");
        Milestone storage milestone = escrows[escrowId].milestones[milestoneIndex];
        return (milestone.amount, milestone.description, milestone.completed, milestone.approved, milestone.deadline);
    }
    
    /**
     * @dev Update platform fee (admin only)
     */
    function updatePlatformFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFee <= MAX_FEE, "Fee too high");
        platformFee = newFee;
    }
    
    /**
     * @dev Update fee recipient (admin only)
     */
    function updateFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRecipient != address(0), "Invalid address");
        feeRecipient = newRecipient;
    }
}