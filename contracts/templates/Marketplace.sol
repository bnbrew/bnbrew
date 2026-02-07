// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BNBrewBase.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title Marketplace
 * @notice Simple NFT marketplace with listing, buying, and cancellation.
 */
contract Marketplace is BNBrewBase {
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    uint256 public listingCount;
    uint256 public feePercent;

    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed id, address indexed seller, address nftContract, uint256 tokenId, uint256 price);
    event Sold(uint256 indexed id, address indexed buyer, uint256 price);
    event Cancelled(uint256 indexed id);
    event FeeUpdated(uint256 feePercent);

    error NotSeller();
    error NotActive();
    error InsufficientPayment();
    error TransferFailed();
    error InvalidPrice();
    error InvalidFee();

    function initialize(address owner, uint256 _feePercent) external initializer {
        __BNBrewBase_init(owner);
        if (_feePercent > 1000) revert InvalidFee();
        feePercent = _feePercent;
    }

    /// @notice List an NFT for sale
    function list(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external returns (uint256) {
        if (price == 0) revert InvalidPrice();
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);

        uint256 id = listingCount++;
        listings[id] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: true
        });
        emit Listed(id, msg.sender, nftContract, tokenId, price);
        return id;
    }

    /// @notice Buy a listed NFT
    function buy(uint256 id) external payable nonReentrant {
        Listing storage listing = listings[id];
        if (!listing.active) revert NotActive();
        if (msg.value < listing.price) revert InsufficientPayment();

        listing.active = false;

        uint256 fee = (listing.price * feePercent) / 10000;
        uint256 sellerAmount = listing.price - fee;

        IERC721(listing.nftContract).transferFrom(address(this), msg.sender, listing.tokenId);

        (bool success, ) = payable(listing.seller).call{value: sellerAmount}("");
        if (!success) revert TransferFailed();

        emit Sold(id, msg.sender, listing.price);
    }

    /// @notice Cancel a listing
    function cancel(uint256 id) external {
        Listing storage listing = listings[id];
        if (listing.seller != msg.sender) revert NotSeller();
        if (!listing.active) revert NotActive();

        listing.active = false;
        IERC721(listing.nftContract).transferFrom(address(this), msg.sender, listing.tokenId);
        emit Cancelled(id);
    }

    /// @notice Update marketplace fee
    function setFee(uint256 _feePercent) external onlyOwner {
        if (_feePercent > 1000) revert InvalidFee();
        feePercent = _feePercent;
        emit FeeUpdated(_feePercent);
    }

    /// @notice Withdraw accumulated fees
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();
    }
}
