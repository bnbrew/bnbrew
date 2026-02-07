// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title BNBrewBase
 * @notice Abstract base contract for all BNBrew-generated apps.
 * Provides UUPS upgradeability, ownership, and reentrancy protection.
 * All generated contracts extend this base.
 */
abstract contract BNBrewBase is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    /// @notice Initialize the base contract
    /// @param owner The address that will own this contract
    function __BNBrewBase_init(address owner) internal onlyInitializing {
        __Ownable_init(owner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
    }

    /// @notice Only the owner can authorize upgrades
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
