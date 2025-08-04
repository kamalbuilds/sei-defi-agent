// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Import protocol interfaces
import "../interfaces/IYEIFinance.sol";
import "../interfaces/IDragonSwap.sol";
import "../interfaces/ISymphony.sol";
import "../interfaces/ICitrex.sol";
import "../interfaces/ITakara.sol";
import "../interfaces/ISilo.sol";

/**
 * @title ProtocolAdapter
 * @dev Unified adapter for interacting with various DeFi protocols
 */
contract ProtocolAdapter is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    bytes32 public constant STRATEGY_ROLE = keccak256("STRATEGY_ROLE");

    enum ProtocolType {
        YEI_FINANCE,
        DRAGON_SWAP,
        SYMPHONY,
        CITREX,
        TAKARA,
        SILO
    }

    struct ProtocolInfo {
        ProtocolType protocolType;
        address protocolAddress;
        string name;
        bool isActive;
        uint256 totalValueLocked;
        uint256 currentAPY;
        uint256 riskScore;
    }

    struct AdapterConfig {
        uint256 maxSlippage; // In basis points
        uint256 minLiquidity;
        uint256 gasFeeBuffer;
        bool emergencyMode;
    }

    mapping(ProtocolType => ProtocolInfo) public protocols;
    mapping(address => ProtocolType) public protocolAddresses;
    AdapterConfig public config;

    // Protocol-specific contract instances
    IYEIFinance public yeiFinance;
    IDragonSwap public dragonSwap;
    ISymphony public symphony;
    ICitrex public citrex;
    ITakara public takara;
    ISilo public silo;

    event ProtocolRegistered(ProtocolType indexed protocolType, address indexed protocol, string name);
    event Deposit(ProtocolType indexed protocol, address indexed asset, uint256 amount);
    event Withdraw(ProtocolType indexed protocol, address indexed asset, uint256 amount);
    event Swap(ProtocolType indexed protocol, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event EmergencyWithdraw(ProtocolType indexed protocol, address asset, uint256 amount);

    modifier onlyVault() {
        require(hasRole(VAULT_ROLE, msg.sender), "Only vault can call");
        _;
    }

    modifier onlyStrategy() {
        require(hasRole(STRATEGY_ROLE, msg.sender), "Only strategy can call");
        _;
    }

    modifier protocolActive(ProtocolType protocolType) {
        require(protocols[protocolType].isActive, "Protocol not active");
        _;
    }

    modifier notEmergencyMode() {
        require(!config.emergencyMode, "Emergency mode active");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        config = AdapterConfig({
            maxSlippage: 300, // 3%
            minLiquidity: 1000e6, // $1000 minimum
            gasFeeBuffer: 150, // 1.5%
            emergencyMode: false
        });
    }

    /**
     * @dev Register a protocol
     */
    function registerProtocol(
        ProtocolType protocolType,
        address protocolAddress,
        string calldata name,
        uint256 riskScore
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(protocolAddress != address(0), "Invalid protocol address");
        require(!protocols[protocolType].isActive, "Protocol already registered");
        require(riskScore >= 1 && riskScore <= 100, "Invalid risk score");

        protocols[protocolType] = ProtocolInfo({
            protocolType: protocolType,
            protocolAddress: protocolAddress,
            name: name,
            isActive: true,
            totalValueLocked: 0,
            currentAPY: 0,
            riskScore: riskScore
        });

        protocolAddresses[protocolAddress] = protocolType;

        // Initialize protocol-specific contracts
        if (protocolType == ProtocolType.YEI_FINANCE) {
            yeiFinance = IYEIFinance(protocolAddress);
        } else if (protocolType == ProtocolType.DRAGON_SWAP) {
            dragonSwap = IDragonSwap(protocolAddress);
        } else if (protocolType == ProtocolType.SYMPHONY) {
            symphony = ISymphony(protocolAddress);
        } else if (protocolType == ProtocolType.CITREX) {
            citrex = ICitrex(protocolAddress);
        } else if (protocolType == ProtocolType.TAKARA) {
            takara = ITakara(protocolAddress);
        } else if (protocolType == ProtocolType.SILO) {
            silo = ISilo(protocolAddress);
        }

        emit ProtocolRegistered(protocolType, protocolAddress, name);
    }

    /**
     * @dev Deposit to YEI Finance farming pool
     */
    function depositYEIFinance(
        uint256 poolId,
        uint256 amount
    ) external onlyStrategy protocolActive(ProtocolType.YEI_FINANCE) notEmergencyMode nonReentrant {
        require(amount > 0, "Invalid amount");
        
        // Get pool info to validate
        IYEIFinance.PoolInfo memory poolInfo = yeiFinance.poolInfo(poolId);
        require(poolInfo.lpToken != address(0), "Invalid pool");
        
        // Transfer tokens to this contract first
        IERC20(poolInfo.lpToken).safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve and deposit to YEI Finance
        IERC20(poolInfo.lpToken).safeIncreaseAllowance(address(yeiFinance), amount);
        yeiFinance.deposit(poolId, amount);
        
        emit Deposit(ProtocolType.YEI_FINANCE, poolInfo.lpToken, amount);
    }

    /**
     * @dev Withdraw from YEI Finance farming pool
     */
    function withdrawYEIFinance(
        uint256 poolId,
        uint256 amount
    ) external onlyStrategy protocolActive(ProtocolType.YEI_FINANCE) nonReentrant {
        require(amount > 0, "Invalid amount");
        
        IYEIFinance.PoolInfo memory poolInfo = yeiFinance.poolInfo(poolId);
        yeiFinance.withdraw(poolId, amount);
        
        // Transfer withdrawn tokens back to strategy
        IERC20(poolInfo.lpToken).safeTransfer(msg.sender, amount);
        
        emit Withdraw(ProtocolType.YEI_FINANCE, poolInfo.lpToken, amount);
    }

    /**
     * @dev Swap tokens on DragonSwap
     */
    function swapDragonSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 deadline
    ) external onlyStrategy protocolActive(ProtocolType.DRAGON_SWAP) notEmergencyMode nonReentrant {
        require(amountIn > 0, "Invalid amount");
        require(tokenIn != tokenOut, "Same tokens");
        
        // Transfer input tokens
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeIncreaseAllowance(address(dragonSwap), amountIn);
        
        // Prepare swap path
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        // Execute swap
        uint256[] memory amounts = dragonSwap.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            deadline
        );
        
        emit Swap(ProtocolType.DRAGON_SWAP, tokenIn, tokenOut, amountIn, amounts[1]);
    }

    /**
     * @dev Add liquidity to DragonSwap
     */
    function addLiquidityDragonSwap(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 deadline
    ) external onlyStrategy protocolActive(ProtocolType.DRAGON_SWAP) notEmergencyMode nonReentrant returns (
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    ) {
        // Transfer tokens
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountADesired);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountBDesired);
        
        // Approve tokens
        IERC20(tokenA).safeIncreaseAllowance(address(dragonSwap), amountADesired);
        IERC20(tokenB).safeIncreaseAllowance(address(dragonSwap), amountBDesired);
        
        // Add liquidity
        (amountA, amountB, liquidity) = dragonSwap.addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            msg.sender,
            deadline
        );
        
        // Return unused tokens
        if (amountADesired > amountA) {
            IERC20(tokenA).safeTransfer(msg.sender, amountADesired - amountA);
        }
        if (amountBDesired > amountB) {
            IERC20(tokenB).safeTransfer(msg.sender, amountBDesired - amountB);
        }
        
        return (amountA, amountB, liquidity);
    }

    /**
     * @dev Supply to Symphony lending protocol
     */
    function supplySymphony(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external onlyStrategy protocolActive(ProtocolType.SYMPHONY) notEmergencyMode nonReentrant {
        require(amount > 0, "Invalid amount");
        
        // Transfer and approve
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(asset).safeIncreaseAllowance(address(symphony), amount);
        
        // Supply to Symphony
        symphony.supply(asset, amount, onBehalfOf, referralCode);
        
        emit Deposit(ProtocolType.SYMPHONY, asset, amount);
    }

    /**
     * @dev Withdraw from Symphony lending protocol
     */
    function withdrawSymphony(
        address asset,
        uint256 amount,
        address to
    ) external onlyStrategy protocolActive(ProtocolType.SYMPHONY) nonReentrant returns (uint256) {
        require(amount > 0, "Invalid amount");
        
        uint256 withdrawn = symphony.withdraw(asset, amount, to);
        
        emit Withdraw(ProtocolType.SYMPHONY, asset, withdrawn);
        return withdrawn;
    }

    /**
     * @dev Borrow from Symphony lending protocol
     */
    function borrowSymphony(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external onlyStrategy protocolActive(ProtocolType.SYMPHONY) notEmergencyMode nonReentrant {
        symphony.borrow(asset, amount, interestRateMode, referralCode, onBehalfOf);
    }

    /**
     * @dev Repay to Symphony lending protocol
     */
    function repaySymphony(
        address asset,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) external onlyStrategy protocolActive(ProtocolType.SYMPHONY) nonReentrant returns (uint256) {
        // Transfer repayment amount
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(asset).safeIncreaseAllowance(address(symphony), amount);
        
        return symphony.repay(asset, amount, rateMode, onBehalfOf);
    }

    /**
     * @dev Deposit to Silo isolated lending
     */
    function depositSilo(
        address asset,
        uint256 amount,
        bool collateralOnly
    ) external onlyStrategy protocolActive(ProtocolType.SILO) notEmergencyMode nonReentrant returns (
        uint256 collateralAmount,
        uint256 collateralOnlyAmount
    ) {
        require(amount > 0, "Invalid amount");
        
        // Transfer and approve
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(asset).safeIncreaseAllowance(address(silo), amount);
        
        // Deposit to Silo
        (collateralAmount, collateralOnlyAmount) = silo.deposit(asset, amount, collateralOnly);
        
        emit Deposit(ProtocolType.SILO, asset, amount);
        return (collateralAmount, collateralOnlyAmount);
    }

    /**
     * @dev Withdraw from Silo isolated lending
     */
    function withdrawSilo(
        address asset,
        uint256 amount,
        bool collateralOnly
    ) external onlyStrategy protocolActive(ProtocolType.SILO) nonReentrant returns (uint256) {
        require(amount > 0, "Invalid amount");
        
        uint256 withdrawn = silo.withdraw(asset, amount, collateralOnly);
        
        // Transfer to strategy
        IERC20(asset).safeTransfer(msg.sender, withdrawn);
        
        emit Withdraw(ProtocolType.SILO, asset, withdrawn);
        return withdrawn;
    }

    /**
     * @dev Harvest rewards from multiple protocols
     */
    function harvestRewards(ProtocolType[] calldata protocolTypes) external onlyStrategy nonReentrant {
        for (uint256 i = 0; i < protocolTypes.length; i++) {
            ProtocolType protocolType = protocolTypes[i];
            
            if (!protocols[protocolType].isActive) continue;
            
            if (protocolType == ProtocolType.YEI_FINANCE) {
                try yeiFinance.harvestAll() {} catch {}
            } else if (protocolType == ProtocolType.DRAGON_SWAP) {
                // DragonSwap reward claiming would go here
            } else if (protocolType == ProtocolType.SYMPHONY) {
                // Symphony reward claiming would go here
                address[] memory assets = symphony.getReservesList();
                try symphony.claimRewards(assets, type(uint256).max, msg.sender) {} catch {}
            } else if (protocolType == ProtocolType.SILO) {
                address[] memory assets = silo.getAssets();
                try silo.claimRewards(assets) {} catch {}
            }
        }
    }

    /**
     * @dev Get protocol APY for a specific asset
     */
    function getProtocolAPY(ProtocolType protocolType, address asset) external view returns (uint256) {
        if (!protocols[protocolType].isActive) return 0;
        
        if (protocolType == ProtocolType.YEI_FINANCE) {
            // Return pool APY (would need pool mapping)
            return protocols[protocolType].currentAPY;
        } else if (protocolType == ProtocolType.SYMPHONY) {
            return symphony.getSupplyRate(asset);
        } else if (protocolType == ProtocolType.DRAGON_SWAP) {
            // Return LP reward APY
            return protocols[protocolType].currentAPY;
        }
        
        return protocols[protocolType].currentAPY;
    }

    /**
     * @dev Emergency withdraw from all protocols
     */
    function emergencyWithdrawAll() external onlyRole(DEFAULT_ADMIN_ROLE) {
        config.emergencyMode = true;
        
        // Emergency withdraw logic for each protocol would go here
        // This is protocol-specific and would require detailed implementation
    }

    /**
     * @dev Update protocol information
     */
    function updateProtocolInfo(
        ProtocolType protocolType,
        uint256 tvl,
        uint256 apy,
        uint256 riskScore
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(protocols[protocolType].isActive, "Protocol not active");
        require(riskScore >= 1 && riskScore <= 100, "Invalid risk score");
        
        ProtocolInfo storage protocol = protocols[protocolType];
        protocol.totalValueLocked = tvl;
        protocol.currentAPY = apy;
        protocol.riskScore = riskScore;
    }

    /**
     * @dev Update adapter configuration
     */
    function updateConfig(
        uint256 maxSlippage,
        uint256 minLiquidity,
        uint256 gasFeeBuffer
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(maxSlippage <= 1000, "Slippage too high"); // Max 10%
        
        config.maxSlippage = maxSlippage;
        config.minLiquidity = minLiquidity;
        config.gasFeeBuffer = gasFeeBuffer;
    }

    /**
     * @dev Pause/unpause protocol
     */
    function pauseProtocol(ProtocolType protocolType) external onlyRole(DEFAULT_ADMIN_ROLE) {
        protocols[protocolType].isActive = false;
    }

    function unpauseProtocol(ProtocolType protocolType) external onlyRole(DEFAULT_ADMIN_ROLE) {
        protocols[protocolType].isActive = true;
    }

    /**
     * @dev Get protocol information
     */
    function getProtocolInfo(ProtocolType protocolType) external view returns (ProtocolInfo memory) {
        return protocols[protocolType];
    }

    /**
     * @dev Check if protocol supports specific operation
     */
    function supportsOperation(ProtocolType protocolType, string calldata operation) external pure returns (bool) {
        // This would contain logic to check if protocol supports specific operations
        // like "lending", "borrowing", "farming", "swapping", etc.
        return true; // Simplified implementation
    }
}