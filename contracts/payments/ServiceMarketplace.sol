// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ReputationRegistry.sol";

/**
 * @title ServiceMarketplace
 * @dev Marketplace for AI agent services with bidding and direct hiring
 */
contract ServiceMarketplace is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum ServiceStatus {
        OPEN,
        ASSIGNED,
        IN_PROGRESS,
        COMPLETED,
        CANCELLED,
        DISPUTED
    }

    enum ServiceType {
        FIXED_PRICE,
        HOURLY_RATE,
        AUCTION,
        SUBSCRIPTION
    }

    struct Service {
        uint256 id;
        address client;
        address assignedAgent;
        string title;
        string description;
        string[] requiredSkills;
        ServiceType serviceType;
        uint256 budget;
        uint256 hourlyRate;
        uint256 duration; // in hours for hourly, days for fixed
        uint256 deadline;
        ServiceStatus status;
        uint256 createdAt;
        address paymentToken;
        bool isUrgent;
        uint256 complexity; // 1-5 scale
    }

    struct Bid {
        uint256 serviceId;
        address agent;
        uint256 proposedPrice;
        uint256 estimatedHours;
        string proposal;
        uint256 deliveryTime;
        uint256 timestamp;
        bool isAccepted;
    }

    struct Subscription {
        uint256 serviceId;
        address client;
        address agent;
        uint256 monthlyRate;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        address paymentToken;
    }

    mapping(uint256 => Service) public services;
    mapping(uint256 => Bid[]) public serviceBids;
    mapping(uint256 => uint256) public serviceBidCount;
    mapping(address => uint256[]) public clientServices;
    mapping(address => uint256[]) public agentServices;
    mapping(bytes32 => uint256[]) public skillServices; // keccak256(skill) => serviceIds
    mapping(uint256 => Subscription) public subscriptions;
    
    uint256 public serviceCounter;
    uint256 public platformFee = 250; // 2.5%
    address public feeRecipient;
    ReputationRegistry public reputationRegistry;
    
    // Service discovery
    uint256[] public openServices;
    mapping(uint256 => uint256) public serviceIndexInOpen;
    
    event ServicePosted(uint256 indexed serviceId, address indexed client, ServiceType serviceType, uint256 budget);
    event BidSubmitted(uint256 indexed serviceId, address indexed agent, uint256 proposedPrice);
    event BidAccepted(uint256 indexed serviceId, address indexed agent, uint256 finalPrice);
    event ServiceCompleted(uint256 indexed serviceId, address indexed agent, uint256 payout);
    event ServiceCancelled(uint256 indexed serviceId, string reason);
    event SubscriptionCreated(uint256 indexed serviceId, address indexed agent, uint256 monthlyRate);
    event SubscriptionRenewed(uint256 indexed serviceId, uint256 newEndTime);
    
    modifier serviceExists(uint256 serviceId) {
        require(serviceId < serviceCounter, "Service does not exist");
        _;
    }
    
    modifier onlyServiceClient(uint256 serviceId) {
        require(msg.sender == services[serviceId].client, "Only client can perform this action");
        _;
    }
    
    modifier onlyAssignedAgent(uint256 serviceId) {
        require(msg.sender == services[serviceId].assignedAgent, "Only assigned agent can perform this action");
        _;
    }
    
    constructor(address _feeRecipient, address _reputationRegistry) {
        feeRecipient = _feeRecipient;
        reputationRegistry = ReputationRegistry(_reputationRegistry);
    }
    
    /**
     * @dev Post a new service request
     */
    function postService(
        string calldata title,
        string calldata description,
        string[] calldata requiredSkills,
        ServiceType serviceType,
        uint256 budget,
        uint256 hourlyRate,
        uint256 duration,
        uint256 deadline,
        address paymentToken,
        bool isUrgent,
        uint256 complexity
    ) external returns (uint256) {
        require(bytes(title).length > 0, "Title required");
        require(bytes(description).length > 0, "Description required");
        require(complexity >= 1 && complexity <= 5, "Invalid complexity");
        require(deadline > block.timestamp, "Invalid deadline");
        
        if (serviceType == ServiceType.FIXED_PRICE) {
            require(budget > 0, "Budget required for fixed price");
        } else if (serviceType == ServiceType.HOURLY_RATE) {
            require(hourlyRate > 0, "Hourly rate required");
            require(duration > 0, "Duration required");
        }
        
        uint256 serviceId = serviceCounter++;
        Service storage service = services[serviceId];
        
        service.id = serviceId;
        service.client = msg.sender;
        service.title = title;
        service.description = description;
        service.requiredSkills = requiredSkills;
        service.serviceType = serviceType;
        service.budget = budget;
        service.hourlyRate = hourlyRate;
        service.duration = duration;
        service.deadline = deadline;
        service.status = ServiceStatus.OPEN;
        service.createdAt = block.timestamp;
        service.paymentToken = paymentToken;
        service.isUrgent = isUrgent;
        service.complexity = complexity;
        
        clientServices[msg.sender].push(serviceId);
        
        // Add to open services for discovery
        openServices.push(serviceId);
        serviceIndexInOpen[serviceId] = openServices.length - 1;
        
        // Index by skills for discovery
        for (uint256 i = 0; i < requiredSkills.length; i++) {
            bytes32 skillHash = keccak256(bytes(requiredSkills[i]));
            skillServices[skillHash].push(serviceId);
        }
        
        emit ServicePosted(serviceId, msg.sender, serviceType, budget);
        return serviceId;
    }
    
    /**
     * @dev Submit a bid for a service
     */
    function submitBid(
        uint256 serviceId,
        uint256 proposedPrice,
        uint256 estimatedHours,
        string calldata proposal,
        uint256 deliveryTime
    ) external serviceExists(serviceId) {
        Service storage service = services[serviceId];
        require(service.status == ServiceStatus.OPEN, "Service not open for bids");
        require(msg.sender != service.client, "Client cannot bid on own service");
        require(proposedPrice > 0, "Invalid proposed price");
        require(bytes(proposal).length > 0, "Proposal required");
        require(deliveryTime >= block.timestamp, "Invalid delivery time");
        
        // Check if agent is registered and active
        (,,, uint256 totalJobs, uint256 completedJobs,, uint256 rating, bool isActive,) = 
            reputationRegistry.getAgentProfile(msg.sender);
        require(isActive, "Agent not active");
        
        Bid memory newBid = Bid({
            serviceId: serviceId,
            agent: msg.sender,
            proposedPrice: proposedPrice,
            estimatedHours: estimatedHours,
            proposal: proposal,
            deliveryTime: deliveryTime,
            timestamp: block.timestamp,
            isAccepted: false
        });
        
        serviceBids[serviceId].push(newBid);
        serviceBidCount[serviceId]++;
        
        emit BidSubmitted(serviceId, msg.sender, proposedPrice);
    }
    
    /**
     * @dev Accept a bid and assign service to agent
     */
    function acceptBid(
        uint256 serviceId,
        uint256 bidIndex
    ) external serviceExists(serviceId) onlyServiceClient(serviceId) nonReentrant {
        Service storage service = services[serviceId];
        require(service.status == ServiceStatus.OPEN, "Service not open");
        require(bidIndex < serviceBids[serviceId].length, "Invalid bid index");
        
        Bid storage bid = serviceBids[serviceId][bidIndex];
        require(!bid.isAccepted, "Bid already accepted");
        
        // Transfer payment to escrow (this contract)
        uint256 totalAmount = bid.proposedPrice;
        IERC20(service.paymentToken).safeTransferFrom(
            msg.sender,
            address(this),
            totalAmount
        );
        
        // Update service and bid
        service.assignedAgent = bid.agent;
        service.status = ServiceStatus.ASSIGNED;
        service.budget = bid.proposedPrice; // Update with accepted bid amount
        bid.isAccepted = true;
        
        agentServices[bid.agent].push(serviceId);
        _removeFromOpenServices(serviceId);
        
        emit BidAccepted(serviceId, bid.agent, bid.proposedPrice);
    }
    
    /**
     * @dev Direct hire an agent (no bidding)
     */
    function directHire(
        uint256 serviceId,
        address agent,
        uint256 agreedPrice
    ) external serviceExists(serviceId) onlyServiceClient(serviceId) nonReentrant {
        Service storage service = services[serviceId];
        require(service.status == ServiceStatus.OPEN, "Service not open");
        require(agent != address(0), "Invalid agent");
        require(agreedPrice > 0, "Invalid price");
        
        // Check if agent is registered and active
        (,,, uint256 totalJobs, uint256 completedJobs,, uint256 rating, bool isActive,) = 
            reputationRegistry.getAgentProfile(agent);
        require(isActive, "Agent not active");
        
        // Transfer payment to escrow
        IERC20(service.paymentToken).safeTransferFrom(
            msg.sender,
            address(this),
            agreedPrice
        );
        
        service.assignedAgent = agent;
        service.status = ServiceStatus.ASSIGNED;
        service.budget = agreedPrice;
        
        agentServices[agent].push(serviceId);
        _removeFromOpenServices(serviceId);
        
        emit BidAccepted(serviceId, agent, agreedPrice);
    }
    
    /**
     * @dev Agent starts working on assigned service
     */
    function startWork(uint256 serviceId) 
        external 
        serviceExists(serviceId) 
        onlyAssignedAgent(serviceId) 
    {
        Service storage service = services[serviceId];
        require(service.status == ServiceStatus.ASSIGNED, "Service not assigned");
        
        service.status = ServiceStatus.IN_PROGRESS;
    }
    
    /**
     * @dev Complete service and release payment
     */
    function completeService(uint256 serviceId) 
        external 
        serviceExists(serviceId) 
        onlyServiceClient(serviceId) 
        nonReentrant 
    {
        Service storage service = services[serviceId];
        require(service.status == ServiceStatus.IN_PROGRESS, "Service not in progress");
        
        uint256 payout = service.budget;
        uint256 fee = (payout * platformFee) / 10000;
        uint256 agentPayout = payout - fee;
        
        service.status = ServiceStatus.COMPLETED;
        
        // Release payments
        IERC20(service.paymentToken).safeTransfer(service.assignedAgent, agentPayout);
        if (fee > 0) {
            IERC20(service.paymentToken).safeTransfer(feeRecipient, fee);
        }
        
        // Update reputation
        reputationRegistry.updateJobCompletion(service.assignedAgent, true, agentPayout);
        
        emit ServiceCompleted(serviceId, service.assignedAgent, agentPayout);
    }
    
    /**
     * @dev Cancel service before assignment
     */
    function cancelService(uint256 serviceId, string calldata reason) 
        external 
        serviceExists(serviceId) 
        onlyServiceClient(serviceId) 
    {
        Service storage service = services[serviceId];
        require(service.status == ServiceStatus.OPEN, "Can only cancel open services");
        
        service.status = ServiceStatus.CANCELLED;
        _removeFromOpenServices(serviceId);
        
        emit ServiceCancelled(serviceId, reason);
    }
    
    /**
     * @dev Create subscription service
     */
    function createSubscription(
        uint256 serviceId,
        address agent,
        uint256 monthlyRate,
        uint256 durationMonths
    ) external serviceExists(serviceId) onlyServiceClient(serviceId) nonReentrant {
        Service storage service = services[serviceId];
        require(service.serviceType == ServiceType.SUBSCRIPTION, "Not a subscription service");
        require(service.status == ServiceStatus.OPEN, "Service not open");
        require(monthlyRate > 0, "Invalid monthly rate");
        require(durationMonths > 0, "Invalid duration");
        
        // Transfer first month payment
        IERC20(service.paymentToken).safeTransferFrom(
            msg.sender,
            address(this),
            monthlyRate
        );
        
        uint256 endTime = block.timestamp + (durationMonths * 30 days);
        
        subscriptions[serviceId] = Subscription({
            serviceId: serviceId,
            client: msg.sender,
            agent: agent,
            monthlyRate: monthlyRate,
            startTime: block.timestamp,
            endTime: endTime,
            isActive: true,
            paymentToken: service.paymentToken
        });
        
        service.assignedAgent = agent;
        service.status = ServiceStatus.IN_PROGRESS;
        
        agentServices[agent].push(serviceId);
        _removeFromOpenServices(serviceId);
        
        emit SubscriptionCreated(serviceId, agent, monthlyRate);
    }
    
    /**
     * @dev Renew subscription
     */
    function renewSubscription(uint256 serviceId, uint256 additionalMonths) 
        external 
        serviceExists(serviceId) 
        nonReentrant 
    {
        Subscription storage sub = subscriptions[serviceId];
        require(sub.client == msg.sender, "Only client can renew");
        require(sub.isActive, "Subscription not active");
        require(additionalMonths > 0, "Invalid duration");
        
        uint256 renewalCost = sub.monthlyRate * additionalMonths;
        IERC20(sub.paymentToken).safeTransferFrom(
            msg.sender,
            address(this),
            renewalCost
        );
        
        sub.endTime += (additionalMonths * 30 days);
        
        emit SubscriptionRenewed(serviceId, sub.endTime);
    }
    
    /**
     * @dev Get services by skill
     */
    function getServicesBySkill(string calldata skill) 
        external 
        view 
        returns (uint256[] memory) 
    {
        bytes32 skillHash = keccak256(bytes(skill));
        return skillServices[skillHash];
    }
    
    /**
     * @dev Get all open services
     */
    function getOpenServices() external view returns (uint256[] memory) {
        return openServices;
    }
    
    /**
     * @dev Get service bids
     */
    function getServiceBids(uint256 serviceId) 
        external 
        view 
        serviceExists(serviceId) 
        returns (Bid[] memory) 
    {
        return serviceBids[serviceId];
    }
    
    /**
     * @dev Get services by agent
     */
    function getAgentServices(address agent) external view returns (uint256[] memory) {
        return agentServices[agent];
    }
    
    /**
     * @dev Get services by client
     */
    function getClientServices(address client) external view returns (uint256[] memory) {
        return clientServices[client];
    }
    
    /**
     * @dev Remove service from open services array
     */
    function _removeFromOpenServices(uint256 serviceId) internal {
        uint256 index = serviceIndexInOpen[serviceId];
        uint256 lastIndex = openServices.length - 1;
        
        if (index != lastIndex) {
            uint256 lastServiceId = openServices[lastIndex];
            openServices[index] = lastServiceId;
            serviceIndexInOpen[lastServiceId] = index;
        }
        
        openServices.pop();
        delete serviceIndexInOpen[serviceId];
    }
    
    /**
     * @dev Update platform fee (owner only)
     */
    function updatePlatformFee(uint256 newFee) external {
        require(msg.sender == feeRecipient, "Not authorized");
        require(newFee <= 500, "Fee too high"); // Max 5%
        platformFee = newFee;
    }
    
    /**
     * @dev Emergency withdraw (owner only)
     */
    function emergencyWithdraw(address token, uint256 amount) external {
        require(msg.sender == feeRecipient, "Not authorized");
        IERC20(token).safeTransfer(feeRecipient, amount);
    }
}