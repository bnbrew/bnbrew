// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BNBrewBase.sol";

/**
 * @title Tipping
 * @notice Simple tipping contract. Users can send tips, owner can withdraw.
 */
contract Tipping is BNBrewBase {
    uint256 public totalTips;
    uint256 public tipCount;

    mapping(address => uint256) public tipsByUser;

    event TipReceived(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error ZeroAmount();
    error TransferFailed();

    function initialize(address owner) external initializer {
        __BNBrewBase_init(owner);
    }

    /// @notice Send a tip
    function tip() external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        totalTips += msg.value;
        tipsByUser[msg.sender] += msg.value;
        tipCount++;
        emit TipReceived(msg.sender, msg.value);
    }

    /// @notice Withdraw all accumulated tips
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert ZeroAmount();
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();
        emit Withdrawn(owner(), balance);
    }

    /// @notice Get contract balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
