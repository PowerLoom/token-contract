// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// using OpenZeppelin contracts v5.0.0, please refer to package.json to see the exact version
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

/// @custom:security-contact security@powerloom.network
contract PowerloomToken is ERC20, ERC20Permit, ERC20Votes {

    constructor(address multisigAddress)
        ERC20("Powerloom Token", "POWER")
        ERC20Permit("Powerloom Token")
    {
        _mint(multisigAddress, 1000000000 * 10 ** decimals());
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function _maxSupply() internal view override returns (uint256) {
        return 1000000000 * 10 ** decimals();
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
