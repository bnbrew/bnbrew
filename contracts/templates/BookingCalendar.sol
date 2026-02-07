// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BNBrewBase.sol";

/**
 * @title BookingCalendar
 * @notice Appointment scheduling with payment. Supports booking, cancellation, and refunds.
 * Use case: dental clinics, salons, consultations, tutoring, etc.
 */
contract BookingCalendar is BNBrewBase {
    struct Slot {
        address bookedBy;
        uint256 paidAmount;
        bool active;
    }

    uint256 public slotPrice;
    uint256 public slotDuration;
    uint256 public cancellationWindow;

    mapping(uint256 => Slot) public slots;

    event SlotBooked(address indexed user, uint256 indexed timestamp, uint256 amount);
    event SlotCancelled(address indexed user, uint256 indexed timestamp, uint256 refund);
    event SlotConfigUpdated(uint256 price, uint256 duration);

    error SlotAlreadyBooked();
    error SlotNotFound();
    error NotBooker();
    error InsufficientPayment();
    error CancellationWindowClosed();
    error TransferFailed();
    error InvalidConfig();
    error SlotInPast();

    function initialize(
        address owner,
        uint256 _slotPrice,
        uint256 _slotDuration,
        uint256 _cancellationWindow
    ) external initializer {
        __BNBrewBase_init(owner);
        slotPrice = _slotPrice;
        slotDuration = _slotDuration;
        cancellationWindow = _cancellationWindow;
    }

    /// @notice Book an appointment slot
    function bookSlot(uint256 timestamp) external payable nonReentrant {
        if (timestamp <= block.timestamp) revert SlotInPast();
        if (msg.value < slotPrice) revert InsufficientPayment();
        if (slots[timestamp].active) revert SlotAlreadyBooked();

        slots[timestamp] = Slot({
            bookedBy: msg.sender,
            paidAmount: msg.value,
            active: true
        });
        emit SlotBooked(msg.sender, timestamp, msg.value);
    }

    /// @notice Cancel a booking and get a refund
    function cancelSlot(uint256 timestamp) external nonReentrant {
        Slot storage slot = slots[timestamp];
        if (!slot.active) revert SlotNotFound();
        if (slot.bookedBy != msg.sender) revert NotBooker();
        if (block.timestamp > timestamp - cancellationWindow)
            revert CancellationWindowClosed();

        uint256 refund = slot.paidAmount;
        slot.active = false;
        slot.bookedBy = address(0);
        slot.paidAmount = 0;

        (bool success, ) = payable(msg.sender).call{value: refund}("");
        if (!success) revert TransferFailed();
        emit SlotCancelled(msg.sender, timestamp, refund);
    }

    /// @notice Update slot configuration
    function setSlotConfig(
        uint256 _price,
        uint256 _duration
    ) external onlyOwner {
        if (_duration == 0) revert InvalidConfig();
        slotPrice = _price;
        slotDuration = _duration;
        emit SlotConfigUpdated(_price, _duration);
    }

    /// @notice Withdraw collected payments
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();
    }
}
