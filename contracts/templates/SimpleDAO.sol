// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BNBrewBase.sol";

/**
 * @title SimpleDAO
 * @notice Minimal DAO with proposals, voting, and execution.
 */
contract SimpleDAO is BNBrewBase {
    struct Proposal {
        string description;
        address target;
        bytes callData;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool executed;
    }

    uint256 public proposalCount;
    uint256 public votingDuration;
    uint256 public quorum;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed id, string description, uint256 deadline);
    event Voted(uint256 indexed id, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed id);

    error ProposalNotFound();
    error VotingEnded();
    error VotingNotEnded();
    error AlreadyVoted();
    error AlreadyExecuted();
    error QuorumNotReached();
    error ExecutionFailed();

    function initialize(
        address owner,
        uint256 _votingDuration,
        uint256 _quorum
    ) external initializer {
        __BNBrewBase_init(owner);
        votingDuration = _votingDuration;
        quorum = _quorum;
    }

    /// @notice Create a new proposal
    function createProposal(
        string calldata description,
        address target,
        bytes calldata callData
    ) external onlyOwner returns (uint256) {
        uint256 id = proposalCount++;
        proposals[id] = Proposal({
            description: description,
            target: target,
            callData: callData,
            votesFor: 0,
            votesAgainst: 0,
            deadline: block.timestamp + votingDuration,
            executed: false
        });
        emit ProposalCreated(id, description, proposals[id].deadline);
        return id;
    }

    /// @notice Vote on a proposal
    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert ProposalNotFound();
        if (block.timestamp > p.deadline) revert VotingEnded();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        hasVoted[proposalId][msg.sender] = true;
        if (support) {
            p.votesFor++;
        } else {
            p.votesAgainst++;
        }
        emit Voted(proposalId, msg.sender, support);
    }

    /// @notice Execute a passed proposal
    function executeProposal(uint256 proposalId) external onlyOwner {
        Proposal storage p = proposals[proposalId];
        if (p.deadline == 0) revert ProposalNotFound();
        if (block.timestamp <= p.deadline) revert VotingNotEnded();
        if (p.executed) revert AlreadyExecuted();
        if (p.votesFor < quorum) revert QuorumNotReached();
        if (p.votesFor <= p.votesAgainst) revert QuorumNotReached();

        p.executed = true;
        if (p.target != address(0)) {
            (bool success, ) = p.target.call(p.callData);
            if (!success) revert ExecutionFailed();
        }
        emit ProposalExecuted(proposalId);
    }
}
