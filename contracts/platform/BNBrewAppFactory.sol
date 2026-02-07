// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title BNBrewAppFactory
 * @notice CREATE2 factory for deterministic deployment of per-app contracts.
 * Each app gets its own UUPS proxy pointing to the generated implementation.
 */
contract BNBrewAppFactory is Ownable {
    uint256 public deployedCount;

    mapping(bytes32 => address) public deployedProxies;

    event ContractDeployed(
        string indexed appId,
        address indexed proxy,
        address indexed implementation,
        bytes32 salt
    );

    error AlreadyDeployed();
    error DeploymentFailed();

    constructor() Ownable(msg.sender) {}

    /// @notice Deploy a new UUPS proxy for an app contract
    /// @param appId The app identifier
    /// @param implementation The implementation contract address
    /// @param initData The encoded initialize() call
    function deployApp(
        string calldata appId,
        address implementation,
        bytes calldata initData
    ) external onlyOwner returns (address) {
        bytes32 salt = keccak256(
            abi.encodePacked(appId, deployedCount)
        );

        if (deployedProxies[salt] != address(0)) revert AlreadyDeployed();

        ERC1967Proxy proxy = new ERC1967Proxy{salt: salt}(
            implementation,
            initData
        );

        address proxyAddr = address(proxy);
        deployedProxies[salt] = proxyAddr;
        deployedCount++;

        emit ContractDeployed(appId, proxyAddr, implementation, salt);
        return proxyAddr;
    }

    /// @notice Compute the deterministic address for a deployment
    function computeAddress(
        string calldata appId,
        uint256 nonce,
        address implementation,
        bytes calldata initData
    ) external view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(appId, nonce));
        bytes memory bytecode = abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(implementation, initData)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }
}
