// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ITakara
 * @dev Interface for Takara gaming and NFT platform integration
 */
interface ITakara {
    enum GameType {
        PREDICTION,
        LOTTERY,
        BATTLE,
        STAKING,
        TOURNAMENT
    }
    
    enum GameStatus {
        ACTIVE,
        PAUSED,
        ENDED,
        CANCELLED
    }
    
    enum BetOutcome {
        PENDING,
        WON,
        LOST,
        DRAW
    }
    
    struct Game {
        uint256 id;
        string name;
        GameType gameType;
        GameStatus status;
        uint256 entryFee;
        uint256 prizePool;
        uint256 maxParticipants;
        uint256 currentParticipants;
        uint256 startTime;
        uint256 endTime;
        address creator;
        bool isPublic;
    }
    
    struct Bet {
        uint256 id;
        uint256 gameId;
        address player;
        uint256 amount;
        bytes32 prediction;
        uint256 timestamp;
        BetOutcome outcome;
        uint256 payout;
    }
    
    struct NFTStaking {
        uint256 tokenId;
        address owner;
        uint256 stakingTime;
        uint256 lastClaimTime;
        uint256 rewardRate;
        bool isActive;
    }
    
    struct Tournament {
        uint256 id;
        string name;
        uint256 entryFee;
        uint256 prizePool;
        uint256 maxPlayers;
        uint256[] participantIds;
        address[] participants;
        uint256 startTime;
        uint256 endTime;
        GameStatus status;
        address winner;
    }
    
    struct UserStats {
        uint256 totalGamesPlayed;
        uint256 totalWon;
        uint256 totalLost;
        uint256 totalEarnings;
        uint256 currentStreak;
        uint256 longestStreak;
        uint256 level;
        uint256 experience;
    }
    
    // Game management
    function createGame(
        string calldata name,
        GameType gameType,
        uint256 entryFee,
        uint256 maxParticipants,
        uint256 duration,
        bool isPublic
    ) external returns (uint256 gameId);
    
    function joinGame(uint256 gameId) external payable;
    function leaveGame(uint256 gameId) external;
    function startGame(uint256 gameId) external;
    function endGame(uint256 gameId, bytes32 result) external;
    function cancelGame(uint256 gameId) external;
    
    // Betting functions
    function placeBet(
        uint256 gameId,
        bytes32 prediction,
        uint256 amount
    ) external returns (uint256 betId);
    
    function cancelBet(uint256 betId) external;
    function claimPayout(uint256 betId) external;
    function getBetResult(uint256 betId) external view returns (BetOutcome, uint256 payout);
    
    // NFT staking
    function stakeNFT(uint256 tokenId) external;
    function unstakeNFT(uint256 tokenId) external;
    function claimStakingRewards(uint256 tokenId) external;
    function getStakingRewards(uint256 tokenId) external view returns (uint256);
    function getStakedNFTs(address user) external view returns (uint256[] memory);
    
    // Tournament functions
    function createTournament(
        string calldata name,
        uint256 entryFee,
        uint256 prizePool,
        uint256 maxPlayers,
        uint256 startTime,
        uint256 duration
    ) external returns (uint256 tournamentId);
    
    function joinTournament(uint256 tournamentId) external payable;
    function startTournament(uint256 tournamentId) external;
    function endTournament(uint256 tournamentId, address winner) external;
    function claimTournamentPrize(uint256 tournamentId) external;
    
    // Lottery functions
    function buyLotteryTicket(uint256 gameId, uint256[] calldata numbers) external payable;
    function drawLottery(uint256 gameId) external;
    function claimLotteryPrize(uint256 gameId, uint256 ticketId) external;
    function getLotteryResults(uint256 gameId) external view returns (uint256[] memory winningNumbers);
    
    // Prediction market functions
    function createPredictionMarket(
        string calldata question,
        string[] calldata options,
        uint256 endTime,
        address oracle
    ) external returns (uint256 marketId);
    
    function placePrediction(
        uint256 marketId,
        uint256 optionIndex,
        uint256 amount
    ) external;
    
    function resolvePredictionMarket(
        uint256 marketId,
        uint256 winningOptionIndex
    ) external;
    
    function claimPredictionWinnings(uint256 marketId) external;
    
    // View functions
    function getGame(uint256 gameId) external view returns (Game memory);
    function getActiveGames() external view returns (Game[] memory);
    function getUserGames(address user) external view returns (uint256[] memory);
    function getBet(uint256 betId) external view returns (Bet memory);
    function getUserBets(address user) external view returns (Bet[] memory);
    function getUserStats(address user) external view returns (UserStats memory);
    
    function getTournament(uint256 tournamentId) external view returns (Tournament memory);
    function getActiveTournaments() external view returns (Tournament[] memory);
    function getTournamentParticipants(uint256 tournamentId) external view returns (address[] memory);
    
    function getNFTStaking(uint256 tokenId) external view returns (NFTStaking memory);
    function getTotalStaked() external view returns (uint256);
    function getRewardRate(uint256 tokenId) external view returns (uint256);
    
    // Governance and rewards
    function claimDailyReward() external;
    function getDailyReward(address user) external view returns (uint256);
    function getWeeklyBonus(address user) external view returns (uint256);
    function claimWeeklyBonus() external;
    
    function voteOnProposal(uint256 proposalId, bool support) external;
    function createProposal(
        string calldata description,
        bytes calldata executionData
    ) external returns (uint256 proposalId);
    
    // Leaderboard and rankings
    function getTopPlayers(uint256 limit) external view returns (address[] memory, uint256[] memory);
    function getUserRank(address user) external view returns (uint256);
    function getSeasonLeaderboard(uint256 season) external view returns (address[] memory, uint256[] memory);
    
    // Fee and treasury management
    function setGameFees(GameType gameType, uint256 feePercentage) external;
    function withdrawTreasury(address token, uint256 amount) external;
    function getTreasuryBalance(address token) external view returns (uint256);
    
    // Random number generation
    function requestRandomness(uint256 gameId) external returns (bytes32 requestId);
    function fulfillRandomness(bytes32 requestId, uint256 randomness) external;
    
    // Game state validation
    function validateGameResult(uint256 gameId, bytes32 result) external view returns (bool);
    function isGameActive(uint256 gameId) external view returns (bool);
    function canJoinGame(uint256 gameId, address user) external view returns (bool);
    
    // Events
    event GameCreated(
        uint256 indexed gameId,
        address indexed creator,
        GameType gameType,
        uint256 entryFee
    );
    
    event GameJoined(
        uint256 indexed gameId,
        address indexed player,
        uint256 entryFee
    );
    
    event GameStarted(uint256 indexed gameId, uint256 timestamp);
    event GameEnded(uint256 indexed gameId, bytes32 result, address[] winners);
    
    event BetPlaced(
        uint256 indexed betId,
        uint256 indexed gameId,
        address indexed player,
        uint256 amount,
        bytes32 prediction
    );
    
    event BetResolved(
        uint256 indexed betId,
        BetOutcome outcome,
        uint256 payout
    );
    
    event NFTStaked(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 timestamp
    );
    
    event NFTUnstaked(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 rewards
    );
    
    event TournamentCreated(
        uint256 indexed tournamentId,
        string name,
        uint256 prizePool,
        uint256 maxPlayers
    );
    
    event TournamentJoined(
        uint256 indexed tournamentId,
        address indexed player
    );
    
    event TournamentEnded(
        uint256 indexed tournamentId,
        address indexed winner,
        uint256 prize
    );
    
    event RewardsClaimed(
        address indexed user,
        uint256 amount,
        string rewardType
    );
}