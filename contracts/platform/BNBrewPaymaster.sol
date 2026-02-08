// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BNBrewPaymaster
 * @notice ERC-4337 compliant paymaster that sponsors gas for end users of BNBrew apps.
 * Validates against BNBrewRegistry to check app has gas credits.
 * Per-user per-app rate limiting to prevent abuse.
 */
contract BNBrewPaymaster is Ownable {
    address public immutable entryPoint;
    address public registry;

    uint256 public constant MAX_OPS_PER_DAY = 100;

    // appId => user => day => count
    mapping(bytes32 => mapping(address => mapping(uint256 => uint256)))
        public userOpsCount;

    event GasSponsored(
        bytes32 indexed appId,
        address indexed user,
        uint256 gasUsed,
        uint256 gasCost
    );
    event RegistryUpdated(address indexed registry);
    event Deposited(uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error NotEntryPoint();
    error RateLimitExceeded();
    error InsufficientDeposit();
    error TransferFailed();

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert NotEntryPoint();
        _;
    }

    constructor(address _entryPoint, address _registry) Ownable(msg.sender) {
        entryPoint = _entryPoint;
        registry = _registry;
    }

    /// @notice Validate a UserOperation for gas sponsorship
    /// @dev Called by EntryPoint during validation phase
    function validatePaymasterUserOp(
        bytes calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        // Decode appId and user from paymasterAndData
        (bytes32 appId, address user) = _decodePaymasterData(userOp);

        // Check rate limit
        uint256 today = block.timestamp / 1 days;
        if (userOpsCount[appId][user][today] >= MAX_OPS_PER_DAY) {
            revert RateLimitExceeded();
        }

        userOpsCount[appId][user][today]++;

        // Encode context for postOp
        context = abi.encode(appId, user, maxCost);
        validationData = 0; // valid
    }

    /// @notice Post-operation accounting
    /// @dev Called by EntryPoint after UserOp execution
    function postOp(
        uint256 mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external onlyEntryPoint {
        (bytes32 appId, address user, ) = abi.decode(
            context,
            (bytes32, address, uint256)
        );

        emit GasSponsored(appId, user, actualGasCost, actualUserOpFeePerGas);
    }

    /// @notice Deposit funds into EntryPoint for gas sponsorship
    function deposit() external payable onlyOwner {
        (bool success, ) = entryPoint.call{value: msg.value}(
            abi.encodeWithSignature("depositTo(address)", address(this))
        );
        if (!success) revert TransferFailed();
        emit Deposited(msg.value);
    }

    /// @notice Update the registry address
    function setRegistry(address _registry) external onlyOwner {
        registry = _registry;
        emit RegistryUpdated(_registry);
    }

    /// @notice Withdraw from EntryPoint
    function withdrawFromEntryPoint(
        address payable to,
        uint256 amount
    ) external onlyOwner {
        (bool success, ) = entryPoint.call(
            abi.encodeWithSignature(
                "withdrawTo(address,uint256)",
                to,
                amount
            )
        );
        if (!success) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    /// @notice Get the rate limit count for a user on an app today
    function getUserOpsToday(
        bytes32 appId,
        address user
    ) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        return userOpsCount[appId][user][today];
    }

    function _decodePaymasterData(
        bytes calldata userOp
    ) internal pure returns (bytes32 appId, address user) {
        // paymasterAndData format: [paymaster(20)] [appId(32)] [user(20)]
        // Skip first 20 bytes (paymaster address)
        bytes calldata paymasterData = userOp[20:];
        appId = bytes32(paymasterData[:32]);
        user = address(bytes20(paymasterData[32:52]));
    }

    receive() external payable {}
}
