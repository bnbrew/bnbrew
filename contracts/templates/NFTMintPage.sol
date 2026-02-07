// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "./BNBrewBase.sol";

/**
 * @title NFTMintPage
 * @notice ERC721 NFT collection with configurable supply and mint price.
 */
contract NFTMintPage is BNBrewBase, ERC721Upgradeable {
    uint256 public maxSupply;
    uint256 public mintPrice;
    uint256 public totalMinted;
    string public baseTokenURI;
    bool public mintActive;

    event Minted(address indexed to, uint256 indexed tokenId);
    event MintToggled(bool active);
    event BaseURIUpdated(string uri);

    error MintNotActive();
    error MaxSupplyReached();
    error InsufficientPayment();
    error TransferFailed();

    function initialize(
        address owner,
        string memory name,
        string memory symbol,
        uint256 _maxSupply,
        uint256 _mintPrice
    ) external initializer {
        __BNBrewBase_init(owner);
        __ERC721_init(name, symbol);
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        mintActive = false;
    }

    /// @notice Mint an NFT
    function mint() external payable nonReentrant {
        if (!mintActive) revert MintNotActive();
        if (totalMinted >= maxSupply) revert MaxSupplyReached();
        if (msg.value < mintPrice) revert InsufficientPayment();

        uint256 tokenId = totalMinted++;
        _safeMint(msg.sender, tokenId);
        emit Minted(msg.sender, tokenId);
    }

    /// @notice Toggle minting on/off
    function toggleMint() external onlyOwner {
        mintActive = !mintActive;
        emit MintToggled(mintActive);
    }

    /// @notice Set base URI for token metadata
    function setBaseURI(string calldata uri) external onlyOwner {
        baseTokenURI = uri;
        emit BaseURIUpdated(uri);
    }

    /// @notice Withdraw mint proceeds
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }
}
