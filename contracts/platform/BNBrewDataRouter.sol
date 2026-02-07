// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BNBrewDataRouter
 * @notice Onchain audit trail for encrypted data writes.
 * The relay service calls this after storing encrypted data on Greenfield.
 * Provides verifiable proof that data was stored.
 */
contract BNBrewDataRouter is Ownable {
    uint256 public totalDataStored;

    mapping(string => uint256) public appDataCount;

    event DataStored(
        string indexed appId,
        address indexed submitter,
        string dataHash,
        string greenfieldObjectId,
        uint256 timestamp
    );

    error EmptyAppId();
    error EmptyDataHash();

    constructor() Ownable(msg.sender) {}

    /// @notice Log a data storage event (called by relay service)
    function logDataStore(
        string calldata appId,
        address submitter,
        string calldata dataHash,
        string calldata greenfieldObjectId
    ) external onlyOwner {
        if (bytes(appId).length == 0) revert EmptyAppId();
        if (bytes(dataHash).length == 0) revert EmptyDataHash();

        totalDataStored++;
        appDataCount[appId]++;

        emit DataStored(
            appId,
            submitter,
            dataHash,
            greenfieldObjectId,
            block.timestamp
        );
    }

    /// @notice Get the number of data entries for an app
    function getAppDataCount(
        string calldata appId
    ) external view returns (uint256) {
        return appDataCount[appId];
    }
}
