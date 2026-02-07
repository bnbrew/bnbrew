// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BNBrewBase.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TokenGatedContent
 * @notice Content access gated by ERC20 token ownership.
 * Users must hold a minimum token balance to access protected content.
 */
contract TokenGatedContent is BNBrewBase {
    IERC20 public gateToken;
    uint256 public requiredBalance;
    uint256 public contentCount;

    mapping(uint256 => string) public contentHashes;

    event ContentAdded(uint256 indexed id, string contentHash);
    event GateUpdated(address indexed token, uint256 requiredBalance);

    error InsufficientTokenBalance();
    error InvalidToken();
    error InvalidContentHash();

    function initialize(address owner) external initializer {
        __BNBrewBase_init(owner);
    }

    /// @notice Set the token gate requirements
    function setGate(address token, uint256 minBalance) external onlyOwner {
        if (token == address(0)) revert InvalidToken();
        gateToken = IERC20(token);
        requiredBalance = minBalance;
        emit GateUpdated(token, minBalance);
    }

    /// @notice Add new content (owner only)
    function addContent(string calldata contentHash) external onlyOwner {
        if (bytes(contentHash).length == 0) revert InvalidContentHash();
        contentHashes[contentCount] = contentHash;
        emit ContentAdded(contentCount, contentHash);
        contentCount++;
    }

    /// @notice Check if a user has access
    function hasAccess(address user) public view returns (bool) {
        if (address(gateToken) == address(0)) return true;
        return gateToken.balanceOf(user) >= requiredBalance;
    }

    /// @notice Get content hash (reverts if user lacks access)
    function getContent(uint256 id) external view returns (string memory) {
        if (!hasAccess(msg.sender)) revert InsufficientTokenBalance();
        return contentHashes[id];
    }
}
