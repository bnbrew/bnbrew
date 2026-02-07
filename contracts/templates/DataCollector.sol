// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BNBrewBase.sol";

/**
 * @title DataCollector
 * @notice Onchain audit trail for encrypted form submissions stored on Greenfield.
 * Use case: contact forms, surveys, lead capture, feedback forms.
 * Actual data is encrypted and stored off-chain. This contract logs submission events.
 */
contract DataCollector is BNBrewBase {
    uint256 public submissionCount;

    mapping(uint256 => Submission) public submissions;

    struct Submission {
        address submitter;
        string dataHash;
        uint256 timestamp;
    }

    event DataSubmitted(
        uint256 indexed id,
        address indexed submitter,
        string dataHash,
        uint256 timestamp
    );

    error EmptyDataHash();

    function initialize(address owner) external initializer {
        __BNBrewBase_init(owner);
    }

    /// @notice Log a data submission (called by relay on behalf of user)
    function logSubmission(
        address submitter,
        string calldata dataHash
    ) external returns (uint256) {
        if (bytes(dataHash).length == 0) revert EmptyDataHash();

        uint256 id = submissionCount++;
        submissions[id] = Submission({
            submitter: submitter,
            dataHash: dataHash,
            timestamp: block.timestamp
        });
        emit DataSubmitted(id, submitter, dataHash, block.timestamp);
        return id;
    }

    /// @notice Get total submission count
    function getSubmissionCount() external view returns (uint256) {
        return submissionCount;
    }
}
