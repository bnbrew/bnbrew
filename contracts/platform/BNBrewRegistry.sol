// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BNBrewRegistry
 * @notice Platform-level registry for all BNBrew-deployed apps.
 * Tracks app ownership, contract addresses, gas credits, and metadata.
 * Deployed once, shared by all BNBrew apps.
 */
contract BNBrewRegistry is Ownable {
    struct App {
        address owner;
        string appId;
        address[] contracts;
        string frontendBucket;
        string dataBucket;
        string domain;
        uint256 gasCredits;
        uint256 createdAt;
        bool active;
    }

    uint256 public appCount;
    mapping(string => App) public apps;
    mapping(address => string[]) public ownerApps;

    event AppRegistered(
        string indexed appId,
        address indexed owner,
        address[] contracts
    );
    event AppUpdated(string indexed appId, address[] contracts);
    event GasCreditsAdded(string indexed appId, uint256 amount);
    event GasCreditsUsed(string indexed appId, uint256 amount);
    event AppDeactivated(string indexed appId);

    error AppAlreadyExists();
    error AppNotFound();
    error NotAppOwner();
    error InsufficientGasCredits();

    constructor() Ownable(msg.sender) {}

    /// @notice Register a new app
    function registerApp(
        string calldata appId,
        address appOwner,
        address[] calldata contractAddresses,
        string calldata frontendBucket,
        string calldata dataBucket
    ) external onlyOwner {
        if (apps[appId].createdAt != 0) revert AppAlreadyExists();

        apps[appId] = App({
            owner: appOwner,
            appId: appId,
            contracts: contractAddresses,
            frontendBucket: frontendBucket,
            dataBucket: dataBucket,
            domain: "",
            gasCredits: 0,
            createdAt: block.timestamp,
            active: true
        });
        ownerApps[appOwner].push(appId);
        appCount++;

        emit AppRegistered(appId, appOwner, contractAddresses);
    }

    /// @notice Update app contracts (after UUPS upgrade)
    function updateAppContracts(
        string calldata appId,
        address[] calldata contractAddresses
    ) external {
        App storage app = apps[appId];
        if (app.createdAt == 0) revert AppNotFound();
        if (app.owner != msg.sender && owner() != msg.sender) revert NotAppOwner();

        app.contracts = contractAddresses;
        emit AppUpdated(appId, contractAddresses);
    }

    /// @notice Add gas credits for an app (paid by platform or app owner)
    function addGasCredits(string calldata appId) external payable {
        App storage app = apps[appId];
        if (app.createdAt == 0) revert AppNotFound();
        app.gasCredits += msg.value;
        emit GasCreditsAdded(appId, msg.value);
    }

    /// @notice Use gas credits (called by paymaster)
    function useGasCredits(
        string calldata appId,
        uint256 amount
    ) external onlyOwner {
        App storage app = apps[appId];
        if (app.createdAt == 0) revert AppNotFound();
        if (app.gasCredits < amount) revert InsufficientGasCredits();
        app.gasCredits -= amount;
        emit GasCreditsUsed(appId, amount);
    }

    /// @notice Get app details
    function getApp(
        string calldata appId
    ) external view returns (App memory) {
        if (apps[appId].createdAt == 0) revert AppNotFound();
        return apps[appId];
    }

    /// @notice Get all apps owned by an address
    function getOwnerApps(
        address appOwner
    ) external view returns (string[] memory) {
        return ownerApps[appOwner];
    }

    /// @notice Check if app has sufficient gas credits
    function hasGasCredits(
        string calldata appId,
        uint256 amount
    ) external view returns (bool) {
        return apps[appId].gasCredits >= amount;
    }
}
