// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title PaymentChannel
 * @dev Payment streaming contract for continuous AI agent services
 */
contract PaymentChannel is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    enum ChannelStatus {
        OPEN,
        CHALLENGE_PERIOD,
        CLOSED
    }

    struct Channel {
        address client;
        address agent;
        address token;
        uint256 totalDeposit;
        uint256 withdrawn;
        uint256 rate; // tokens per second
        uint256 lastUpdated;
        uint256 challengeTimeout;
        ChannelStatus status;
        uint256 nonce;
    }

    struct PaymentState {
        uint256 channelId;
        uint256 totalPaid;
        uint256 nonce;
    }

    mapping(uint256 => Channel) public channels;
    mapping(address => uint256[]) public clientChannels;
    mapping(address => uint256[]) public agentChannels;
    
    uint256 public channelCounter;
    uint256 public challengePeriod = 1 days;
    uint256 public platformFee = 250; // 2.5%
    address public feeRecipient;

    event ChannelOpened(uint256 indexed channelId, address indexed client, address indexed agent, uint256 deposit, uint256 rate);
    event PaymentWithdrawn(uint256 indexed channelId, uint256 amount, uint256 totalWithdrawn);
    event ChannelChallenged(uint256 indexed channelId, uint256 challengeTimeout);
    event ChannelClosed(uint256 indexed channelId, uint256 finalBalance);
    event ChannelTopUp(uint256 indexed channelId, uint256 amount, uint256 newTotal);
    event RateUpdated(uint256 indexed channelId, uint256 newRate);

    modifier channelExists(uint256 channelId) {
        require(channelId < channelCounter, "Channel does not exist");
        _;
    }

    modifier onlyChannelParties(uint256 channelId) {
        Channel storage channel = channels[channelId];
        require(
            msg.sender == channel.client || msg.sender == channel.agent,
            "Not authorized"
        );
        _;
    }

    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev Open a new payment channel
     */
    function openChannel(
        address agent,
        address token,
        uint256 initialDeposit,
        uint256 rate
    ) external returns (uint256) {
        require(agent != address(0), "Invalid agent");
        require(token != address(0), "Invalid token");
        require(initialDeposit > 0, "Invalid deposit");
        require(rate > 0, "Invalid rate");

        uint256 channelId = channelCounter++;
        Channel storage channel = channels[channelId];

        channel.client = msg.sender;
        channel.agent = agent;
        channel.token = token;
        channel.totalDeposit = initialDeposit;
        channel.rate = rate;
        channel.lastUpdated = block.timestamp;
        channel.status = ChannelStatus.OPEN;

        clientChannels[msg.sender].push(channelId);
        agentChannels[agent].push(channelId);

        IERC20(token).safeTransferFrom(msg.sender, address(this), initialDeposit);

        emit ChannelOpened(channelId, msg.sender, agent, initialDeposit, rate);
        return channelId;
    }

    /**
     * @dev Top up channel deposit
     */
    function topUpChannel(uint256 channelId, uint256 amount) 
        external 
        channelExists(channelId) 
        nonReentrant 
    {
        Channel storage channel = channels[channelId];
        require(msg.sender == channel.client, "Only client can top up");
        require(channel.status == ChannelStatus.OPEN, "Channel not open");
        require(amount > 0, "Invalid amount");

        channel.totalDeposit += amount;
        IERC20(channel.token).safeTransferFrom(msg.sender, address(this), amount);

        emit ChannelTopUp(channelId, amount, channel.totalDeposit);
    }

    /**
     * @dev Update payment rate (mutual consent required)
     */
    function updateRate(
        uint256 channelId, 
        uint256 newRate,
        bytes calldata clientSignature,
        bytes calldata agentSignature
    ) external channelExists(channelId) {
        Channel storage channel = channels[channelId];
        require(channel.status == ChannelStatus.OPEN, "Channel not open");
        require(newRate > 0, "Invalid rate");

        // Verify signatures
        bytes32 message = keccak256(abi.encodePacked(
            "UPDATE_RATE",
            channelId,
            newRate,
            block.timestamp
        ));
        bytes32 ethSignedMessage = message.toEthSignedMessageHash();

        require(
            ethSignedMessage.recover(clientSignature) == channel.client,
            "Invalid client signature"
        );
        require(
            ethSignedMessage.recover(agentSignature) == channel.agent,
            "Invalid agent signature"
        );

        _settleChannel(channelId);
        channel.rate = newRate;
        
        emit RateUpdated(channelId, newRate);
    }

    /**
     * @dev Withdraw earned payments (agent only)
     */
    function withdrawPayments(uint256 channelId) 
        external 
        channelExists(channelId) 
        nonReentrant 
    {
        Channel storage channel = channels[channelId];
        require(msg.sender == channel.agent, "Only agent can withdraw");
        require(channel.status == ChannelStatus.OPEN, "Channel not open");

        uint256 earned = _calculateEarned(channelId);
        require(earned > 0, "No payments to withdraw");

        channel.withdrawn += earned;
        channel.lastUpdated = block.timestamp;

        uint256 fee = (earned * platformFee) / 10000;
        uint256 agentAmount = earned - fee;

        IERC20(channel.token).safeTransfer(channel.agent, agentAmount);
        if (fee > 0) {
            IERC20(channel.token).safeTransfer(feeRecipient, fee);
        }

        emit PaymentWithdrawn(channelId, earned, channel.withdrawn);
    }

    /**
     * @dev Withdraw with signed state (off-chain computed)
     */
    function withdrawWithState(
        uint256 channelId,
        uint256 totalPaid,
        uint256 nonce,
        bytes calldata signature
    ) external channelExists(channelId) nonReentrant {
        Channel storage channel = channels[channelId];
        require(msg.sender == channel.agent, "Only agent can withdraw");
        require(channel.status == ChannelStatus.OPEN, "Channel not open");
        require(nonce > channel.nonce, "Invalid nonce");
        require(totalPaid <= channel.totalDeposit, "Invalid payment amount");

        // Verify client signature
        bytes32 message = keccak256(abi.encodePacked(
            "PAYMENT_STATE",
            channelId,
            totalPaid,
            nonce
        ));
        bytes32 ethSignedMessage = message.toEthSignedMessageHash();
        
        require(
            ethSignedMessage.recover(signature) == channel.client,
            "Invalid signature"
        );

        uint256 newWithdrawal = totalPaid - channel.withdrawn;
        require(newWithdrawal > 0, "No new payments");

        channel.withdrawn = totalPaid;
        channel.nonce = nonce;
        channel.lastUpdated = block.timestamp;

        uint256 fee = (newWithdrawal * platformFee) / 10000;
        uint256 agentAmount = newWithdrawal - fee;

        IERC20(channel.token).safeTransfer(channel.agent, agentAmount);
        if (fee > 0) {
            IERC20(channel.token).safeTransfer(feeRecipient, fee);
        }

        emit PaymentWithdrawn(channelId, newWithdrawal, channel.withdrawn);
    }

    /**
     * @dev Challenge channel closure
     */
    function challengeChannel(uint256 channelId) 
        external 
        channelExists(channelId) 
        onlyChannelParties(channelId) 
    {
        Channel storage channel = channels[channelId];
        require(channel.status == ChannelStatus.OPEN, "Channel not open");

        _settleChannel(channelId);
        channel.status = ChannelStatus.CHALLENGE_PERIOD;
        channel.challengeTimeout = block.timestamp + challengePeriod;

        emit ChannelChallenged(channelId, channel.challengeTimeout);
    }

    /**
     * @dev Close channel after challenge period
     */
    function closeChannel(uint256 channelId) 
        external 
        channelExists(channelId) 
        nonReentrant 
    {
        Channel storage channel = channels[channelId];
        require(
            channel.status == ChannelStatus.CHALLENGE_PERIOD,
            "Channel not in challenge period"
        );
        require(
            block.timestamp >= channel.challengeTimeout,
            "Challenge period not ended"
        );

        uint256 remaining = channel.totalDeposit - channel.withdrawn;
        channel.status = ChannelStatus.CLOSED;

        if (remaining > 0) {
            IERC20(channel.token).safeTransfer(channel.client, remaining);
        }

        emit ChannelClosed(channelId, remaining);
    }

    /**
     * @dev Force close channel (mutual consent)
     */
    function forceCloseChannel(
        uint256 channelId,
        bytes calldata clientSignature,
        bytes calldata agentSignature
    ) external channelExists(channelId) nonReentrant {
        Channel storage channel = channels[channelId];
        require(channel.status == ChannelStatus.OPEN, "Channel not open");

        // Verify signatures
        bytes32 message = keccak256(abi.encodePacked(
            "FORCE_CLOSE",
            channelId,
            block.timestamp
        ));
        bytes32 ethSignedMessage = message.toEthSignedMessageHash();

        require(
            ethSignedMessage.recover(clientSignature) == channel.client,
            "Invalid client signature"
        );
        require(
            ethSignedMessage.recover(agentSignature) == channel.agent,
            "Invalid agent signature"
        );

        _settleChannel(channelId);
        uint256 remaining = channel.totalDeposit - channel.withdrawn;
        channel.status = ChannelStatus.CLOSED;

        if (remaining > 0) {
            IERC20(channel.token).safeTransfer(channel.client, remaining);
        }

        emit ChannelClosed(channelId, remaining);
    }

    /**
     * @dev Calculate earned amount based on time and rate
     */
    function _calculateEarned(uint256 channelId) internal view returns (uint256) {
        Channel storage channel = channels[channelId];
        uint256 timeElapsed = block.timestamp - channel.lastUpdated;
        uint256 earned = timeElapsed * channel.rate;
        uint256 maxEarnable = channel.totalDeposit - channel.withdrawn;
        
        return earned > maxEarnable ? maxEarnable : earned;
    }

    /**
     * @dev Settle channel to current time
     */
    function _settleChannel(uint256 channelId) internal {
        Channel storage channel = channels[channelId];
        uint256 earned = _calculateEarned(channelId);
        
        if (earned > 0) {
            channel.withdrawn += earned;
        }
        channel.lastUpdated = block.timestamp;
    }

    /**
     * @dev Get channel details
     */
    function getChannel(uint256 channelId) external view channelExists(channelId) returns (
        address client,
        address agent,
        address token,
        uint256 totalDeposit,
        uint256 withdrawn,
        uint256 rate,
        uint256 lastUpdated,
        ChannelStatus status
    ) {
        Channel storage channel = channels[channelId];
        return (
            channel.client,
            channel.agent,
            channel.token,
            channel.totalDeposit,
            channel.withdrawn,
            channel.rate,
            channel.lastUpdated,
            channel.status
        );
    }

    /**
     * @dev Get available balance for withdrawal
     */
    function getAvailableBalance(uint256 channelId) external view channelExists(channelId) returns (uint256) {
        return _calculateEarned(channelId);
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
     * @dev Update challenge period (owner only)
     */
    function updateChallengePeriod(uint256 newPeriod) external {
        require(msg.sender == feeRecipient, "Not authorized");
        require(newPeriod >= 1 hours && newPeriod <= 7 days, "Invalid period");
        challengePeriod = newPeriod;
    }
}