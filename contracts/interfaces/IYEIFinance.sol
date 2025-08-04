// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IYEIFinance
 * @dev Interface for YEI Finance protocol integration
 */
interface IYEIFinance {
    struct PoolInfo {
        address lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accYeiPerShare;
        uint256 totalSupply;
    }
    
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 pendingRewards;
    }
    
    // Pool management
    function poolLength() external view returns (uint256);
    function poolInfo(uint256 _pid) external view returns (PoolInfo memory);
    function userInfo(uint256 _pid, address _user) external view returns (UserInfo memory);
    
    // Farming functions
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
    function emergencyWithdraw(uint256 _pid) external;
    function harvest(uint256 _pid) external;
    function harvestAll() external;
    
    // Rewards
    function pendingYei(uint256 _pid, address _user) external view returns (uint256);
    function totalAllocPoint() external view returns (uint256);
    function yeiPerBlock() external view returns (uint256);
    
    // Staking
    function enterStaking(uint256 _amount) external;
    function leaveStaking(uint256 _amount) external;
    
    // LP Token management
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
    
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
    
    // Price and APY information
    function getPoolAPY(uint256 _pid) external view returns (uint256);
    function getTokenPrice(address _token) external view returns (uint256);
    function getTVL(uint256 _pid) external view returns (uint256);
    
    // Events
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event Harvest(address indexed user, uint256 indexed pid, uint256 amount);
}