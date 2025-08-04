// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TreasuryManager
 * @dev Treasury management for NEXUS AI collective funds
 */
contract TreasuryManager is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    enum AllocationCategory {
        AGENT_REWARDS,
        PLATFORM_DEVELOPMENT,
        MARKETING,
        RESEARCH,
        RESERVES,
        EMERGENCY_FUND
    }

    enum TransactionType {
        ALLOCATION,
        PAYMENT,
        INVESTMENT,
        WITHDRAWAL,
        EMERGENCY
    }

    struct Allocation {
        AllocationCategory category;
        address token;
        uint256 amount;
        uint256 timestamp;
        bool executed;
        address proposedBy;
        string description;
    }

    struct Budget {
        uint256 totalBudget;
        uint256 allocated;
        uint256 spent;
        mapping(AllocationCategory => uint256) categoryLimits;
        mapping(AllocationCategory => uint256) categorySpent;
        uint256 period; // Budget period in seconds
        uint256 startTime;
    }

    struct Investment {
        address protocol;
        address token;
        uint256 amount;
        uint256 expectedReturn;
        uint256 duration;
        uint256 startTime;
        bool isActive;
        uint256 actualReturn;
    }

    mapping(uint256 => Allocation) public allocations;
    mapping(address => uint256) public tokenBalances;
    mapping(address => bool) public approvedTokens;
    mapping(uint256 => Investment) public investments;
    mapping(address => bool) public approvedProtocols;
    
    Budget public currentBudget;
    uint256 public allocationCounter;
    uint256 public investmentCounter;
    uint256 public reserveRatio = 20; // 20% kept in reserves
    uint256 public emergencyThreshold = 10; // 10% for emergency fund
    
    // Multi-sig settings
    mapping(bytes32 => mapping(address => bool)) public signatures;
    mapping(bytes32 => uint256) public signatureCount;
    uint256 public requiredSignatures = 3;
    
    // Yield farming and staking
    mapping(address => uint256) public stakingRewards;
    mapping(address => uint256) public yieldEarned;
    uint256 public totalYieldEarned;
    
    event AllocationProposed(uint256 indexed allocationId, AllocationCategory category, uint256 amount);
    event AllocationExecuted(uint256 indexed allocationId, address recipient, uint256 amount);
    event FundsReceived(address indexed token, uint256 amount, address from);
    event InvestmentMade(uint256 indexed investmentId, address protocol, uint256 amount);
    event InvestmentReturned(uint256 indexed investmentId, uint256 returnAmount);
    event BudgetUpdated(uint256 totalBudget, uint256 period);
    event EmergencyWithdrawal(address indexed token, uint256 amount, address to);
    event YieldClaimed(address indexed protocol, uint256 amount);
    
    modifier onlyGovernance() {
        require(hasRole(GOVERNANCE_ROLE, msg.sender), "Not governance");
        _;
    }
    
    modifier onlyExecutor() {
        require(hasRole(EXECUTOR_ROLE, msg.sender), "Not executor");
        _;
    }
    
    modifier onlyEmergency() {
        require(hasRole(EMERGENCY_ROLE, msg.sender), "Not emergency role");
        _;
    }
    
    modifier validAllocation(uint256 allocationId) {
        require(allocationId < allocationCounter, "Invalid allocation ID");
        _;
    }
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        
        // Initialize budget period (quarterly)
        currentBudget.period = 90 days;
        currentBudget.startTime = block.timestamp;
    }
    
    /**
     * @dev Receive funds into treasury
     */
    function deposit(address token, uint256 amount) external {
        require(approvedTokens[token], "Token not approved");
        require(amount > 0, "Invalid amount");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        tokenBalances[token] += amount;
        
        emit FundsReceived(token, amount, msg.sender);
    }
    
    /**
     * @dev Propose fund allocation
     */
    function proposeAllocation(
        AllocationCategory category,
        address token,
        uint256 amount,
        string calldata description
    ) external onlyGovernance returns (uint256) {
        require(approvedTokens[token], "Token not approved");
        require(amount > 0, "Invalid amount");
        require(amount <= tokenBalances[token], "Insufficient balance");
        
        // Check budget limits
        require(
            currentBudget.categorySpent[category] + amount <= 
            currentBudget.categoryLimits[category],
            "Exceeds category budget"
        );
        
        uint256 allocationId = allocationCounter++;
        Allocation storage allocation = allocations[allocationId];
        
        allocation.category = category;
        allocation.token = token;
        allocation.amount = amount;
        allocation.timestamp = block.timestamp;
        allocation.proposedBy = msg.sender;
        allocation.description = description;
        
        emit AllocationProposed(allocationId, category, amount);
        return allocationId;
    }
    
    /**
     * @dev Execute approved allocation
     */
    function executeAllocation(
        uint256 allocationId,
        address recipient
    ) external onlyExecutor validAllocation(allocationId) nonReentrant {
        Allocation storage allocation = allocations[allocationId];
        require(!allocation.executed, "Already executed");
        require(recipient != address(0), "Invalid recipient");
        
        allocation.executed = true;
        
        // Update budget tracking
        currentBudget.allocated += allocation.amount;
        currentBudget.spent += allocation.amount;
        currentBudget.categorySpent[allocation.category] += allocation.amount;
        
        // Update token balance
        tokenBalances[allocation.token] -= allocation.amount;
        
        // Transfer funds
        IERC20(allocation.token).safeTransfer(recipient, allocation.amount);
        
        emit AllocationExecuted(allocationId, recipient, allocation.amount);
    }
    
    /**
     * @dev Make investment in approved protocol
     */
    function invest(
        address protocol,
        address token,
        uint256 amount,
        uint256 expectedReturn,
        uint256 duration
    ) external onlyExecutor nonReentrant returns (uint256) {
        require(approvedProtocols[protocol], "Protocol not approved");
        require(approvedTokens[token], "Token not approved");
        require(amount > 0, "Invalid amount");
        require(amount <= tokenBalances[token], "Insufficient balance");
        
        uint256 investmentId = investmentCounter++;
        Investment storage investment = investments[investmentId];
        
        investment.protocol = protocol;
        investment.token = token;
        investment.amount = amount;
        investment.expectedReturn = expectedReturn;
        investment.duration = duration;
        investment.startTime = block.timestamp;
        investment.isActive = true;
        
        // Update balances
        tokenBalances[token] -= amount;
        
        // Transfer to investment protocol
        IERC20(token).safeTransfer(protocol, amount);
        
        emit InvestmentMade(investmentId, protocol, amount);
        return investmentId;
    }
    
    /**
     * @dev Withdraw investment returns
     */
    function withdrawInvestmentReturns(
        uint256 investmentId,
        uint256 returnAmount
    ) external onlyExecutor nonReentrant {
        require(investmentId < investmentCounter, "Invalid investment ID");
        Investment storage investment = investments[investmentId];
        require(investment.isActive, "Investment not active");
        require(
            block.timestamp >= investment.startTime + investment.duration,
            "Investment period not complete"
        );
        
        investment.isActive = false;
        investment.actualReturn = returnAmount;
        
        // Receive returns from protocol
        IERC20(investment.token).safeTransferFrom(
            investment.protocol,
            address(this),
            returnAmount
        );
        
        // Update balance
        tokenBalances[investment.token] += returnAmount;
        
        emit InvestmentReturned(investmentId, returnAmount);
    }
    
    /**
     * @dev Set budget for current period
     */
    function setBudget(
        uint256 totalBudget,
        uint256[6] calldata categoryLimits
    ) external onlyGovernance {
        require(totalBudget > 0, "Invalid budget");
        
        // Check if current period expired
        if (block.timestamp >= currentBudget.startTime + currentBudget.period) {
            // Reset for new period
            currentBudget.startTime = block.timestamp;
            currentBudget.allocated = 0;
            currentBudget.spent = 0;
            
            // Reset category spending
            for (uint256 i = 0; i < 6; i++) {
                AllocationCategory category = AllocationCategory(i);
                currentBudget.categorySpent[category] = 0;
            }
        }
        
        currentBudget.totalBudget = totalBudget;
        
        // Set category limits
        for (uint256 i = 0; i < 6; i++) {
            AllocationCategory category = AllocationCategory(i);
            currentBudget.categoryLimits[category] = categoryLimits[i];
        }
        
        emit BudgetUpdated(totalBudget, currentBudget.period);
    }
    
    /**
     * @dev Multi-signature withdrawal for large amounts
     */
    function proposeWithdrawal(
        address token,
        uint256 amount,
        address recipient
    ) external onlyExecutor returns (bytes32) {
        require(amount > 0, "Invalid amount");
        require(amount <= tokenBalances[token], "Insufficient balance");
        
        bytes32 txHash = keccak256(abi.encodePacked(
            token,
            amount,
            recipient,
            block.timestamp
        ));
        
        signatures[txHash][msg.sender] = true;
        signatureCount[txHash] = 1;
        
        return txHash;
    }
    
    /**
     * @dev Sign withdrawal proposal
     */
    function signWithdrawal(bytes32 txHash) external onlyExecutor {
        require(!signatures[txHash][msg.sender], "Already signed");
        
        signatures[txHash][msg.sender] = true;
        signatureCount[txHash]++;
    }
    
    /**
     * @dev Execute multi-sig withdrawal
     */
    function executeWithdrawal(
        bytes32 txHash,
        address token,
        uint256 amount,
        address recipient
    ) external onlyExecutor nonReentrant {
        require(signatureCount[txHash] >= requiredSignatures, "Insufficient signatures");
        require(amount <= tokenBalances[token], "Insufficient balance");
        
        // Verify transaction hash
        bytes32 computedHash = keccak256(abi.encodePacked(
            token,
            amount,
            recipient,
            block.timestamp
        ));
        require(txHash == computedHash, "Invalid transaction hash");
        
        tokenBalances[token] -= amount;
        IERC20(token).safeTransfer(recipient, amount);
        
        // Clear signatures
        signatureCount[txHash] = 0;
    }
    
    /**
     * @dev Emergency withdrawal (requires emergency role)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address recipient,
        string calldata reason
    ) external onlyEmergency nonReentrant {
        require(amount > 0, "Invalid amount");
        require(amount <= tokenBalances[token], "Insufficient balance");
        
        tokenBalances[token] -= amount;
        IERC20(token).safeTransfer(recipient, amount);
        
        emit EmergencyWithdrawal(token, amount, recipient);
    }
    
    /**
     * @dev Claim yield from external protocols
     */
    function claimYield(
        address protocol,
        address token,
        uint256 amount
    ) external onlyExecutor nonReentrant {
        require(approvedProtocols[protocol], "Protocol not approved");
        require(amount > 0, "Invalid amount");
        
        // Claim from protocol (implementation depends on specific protocol)
        IERC20(token).safeTransferFrom(protocol, address(this), amount);
        
        tokenBalances[token] += amount;
        yieldEarned[protocol] += amount;
        totalYieldEarned += amount;
        
        emit YieldClaimed(protocol, amount);
    }
    
    /**
     * @dev Distribute staking rewards to agents
     */
    function distributeStakingRewards(
        address[] calldata agents,
        uint256[] calldata amounts,
        address token
    ) external onlyExecutor nonReentrant {
        require(agents.length == amounts.length, "Array length mismatch");
        require(approvedTokens[token], "Token not approved");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(totalAmount <= tokenBalances[token], "Insufficient balance");
        
        tokenBalances[token] -= totalAmount;
        
        for (uint256 i = 0; i < agents.length; i++) {
            if (amounts[i] > 0) {
                stakingRewards[agents[i]] += amounts[i];
                IERC20(token).safeTransfer(agents[i], amounts[i]);
            }
        }
    }
    
    /**
     * @dev Add approved token
     */
    function addApprovedToken(address token) external onlyGovernance {
        require(token != address(0), "Invalid token");
        approvedTokens[token] = true;
    }
    
    /**
     * @dev Add approved protocol
     */
    function addApprovedProtocol(address protocol) external onlyGovernance {
        require(protocol != address(0), "Invalid protocol");
        approvedProtocols[protocol] = true;
    }
    
    /**
     * @dev Get treasury balance for token
     */
    function getBalance(address token) external view returns (uint256) {
        return tokenBalances[token];
    }
    
    /**
     * @dev Get current budget status
     */
    function getBudgetStatus() external view returns (
        uint256 totalBudget,
        uint256 allocated,
        uint256 spent,
        uint256 remaining,
        uint256 periodEnd
    ) {
        remaining = currentBudget.totalBudget - currentBudget.spent;
        periodEnd = currentBudget.startTime + currentBudget.period;
        
        return (
            currentBudget.totalBudget,
            currentBudget.allocated,
            currentBudget.spent,
            remaining,
            periodEnd
        );
    }
    
    /**
     * @dev Get category budget status
     */
    function getCategoryBudget(AllocationCategory category) external view returns (
        uint256 limit,
        uint256 spent,
        uint256 remaining
    ) {
        limit = currentBudget.categoryLimits[category];
        spent = currentBudget.categorySpent[category];
        remaining = limit - spent;
        
        return (limit, spent, remaining);
    }
    
    /**
     * @dev Update required signatures for multi-sig
     */
    function updateRequiredSignatures(uint256 _requiredSignatures) external onlyGovernance {
        require(_requiredSignatures > 0, "Invalid signature count");
        requiredSignatures = _requiredSignatures;
    }
    
    /**
     * @dev Update reserve ratio
     */
    function updateReserveRatio(uint256 _reserveRatio) external onlyGovernance {
        require(_reserveRatio <= 50, "Reserve ratio too high");
        reserveRatio = _reserveRatio;
    }
}