// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BNBrewBase.sol";

/**
 * @title PaymentPage
 * @notice Simple payment collection with configurable amounts and receipt tracking.
 * Use case: invoicing, donations, event tickets, service payments.
 */
contract PaymentPage is BNBrewBase {
    struct Payment {
        address payer;
        uint256 amount;
        string reference;
        uint256 timestamp;
    }

    uint256 public paymentCount;
    uint256 public totalCollected;
    uint256 public defaultAmount;
    bool public customAmountsAllowed;

    mapping(uint256 => Payment) public payments;

    event PaymentReceived(
        uint256 indexed id,
        address indexed payer,
        uint256 amount,
        string reference
    );
    event ConfigUpdated(uint256 defaultAmount, bool customAmountsAllowed);

    error ZeroAmount();
    error CustomAmountsNotAllowed();
    error IncorrectAmount();
    error TransferFailed();

    function initialize(
        address owner,
        uint256 _defaultAmount,
        bool _customAmountsAllowed
    ) external initializer {
        __BNBrewBase_init(owner);
        defaultAmount = _defaultAmount;
        customAmountsAllowed = _customAmountsAllowed;
    }

    /// @notice Make a payment
    function pay(string calldata reference) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (!customAmountsAllowed && msg.value != defaultAmount)
            revert IncorrectAmount();

        uint256 id = paymentCount++;
        totalCollected += msg.value;
        payments[id] = Payment({
            payer: msg.sender,
            amount: msg.value,
            reference: reference,
            timestamp: block.timestamp
        });
        emit PaymentReceived(id, msg.sender, msg.value, reference);
    }

    /// @notice Update payment configuration
    function setConfig(
        uint256 _defaultAmount,
        bool _customAmountsAllowed
    ) external onlyOwner {
        defaultAmount = _defaultAmount;
        customAmountsAllowed = _customAmountsAllowed;
        emit ConfigUpdated(_defaultAmount, _customAmountsAllowed);
    }

    /// @notice Withdraw collected payments
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();
    }
}
