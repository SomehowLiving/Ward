// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Pocket {
    using ECDSA for bytes32;

    /// -----------------------------------------------------------------------
    /// Immutable configuration
    /// -----------------------------------------------------------------------

    address public immutable controller;
    address public immutable owner;

    /// -----------------------------------------------------------------------
    /// Execution state
    /// -----------------------------------------------------------------------

    bool public used;
    mapping(uint256 => bool) public usedNonces;

    /// -----------------------------------------------------------------------
    /// Errors
    /// -----------------------------------------------------------------------

    error NotController();
    error PocketAlreadyUsed();
    error NonceUsed();
    error SignatureExpired();
    error InvalidSigner();
    error ExecutionFailed();

    /// -----------------------------------------------------------------------
    /// Constructor
    /// -----------------------------------------------------------------------

    constructor(address _controller, address _owner) {
        controller = _controller;
        owner = _owner;
    }

    /// -----------------------------------------------------------------------
    /// Core execution (single-use)
    /// -----------------------------------------------------------------------

    function exec(
        address target,
        bytes calldata data,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external {
        if (msg.sender != controller) revert NotController();
        if (used) revert PocketAlreadyUsed();
        if (usedNonces[nonce]) revert NonceUsed();
        if (block.timestamp > expiry) revert SignatureExpired();

        bytes32 digest = _hashExec(
            target,
            data,
            nonce,
            expiry
        );

        address signer = digest.recover(signature);
        if (signer != owner) revert InvalidSigner();

        usedNonces[nonce] = true;
        used = true;

        (bool ok, ) = target.call(data);
        if (!ok) revert ExecutionFailed();
    }

    /// -----------------------------------------------------------------------
    /// Sweep assets (controller only)
    /// -----------------------------------------------------------------------

    function sweepERC20(
        address token,
        address to,
        uint256 amount
    ) external {
        if (msg.sender != controller) revert NotController();

        IERC20(token).transfer(to, amount);
    }

    /// -----------------------------------------------------------------------
    /// EIP-712 style hashing (minimal, no domain separator yet)
    /// -----------------------------------------------------------------------

    function _hashExec(
        address target,
        bytes calldata data,
        uint256 nonce,
        uint256 expiry
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                address(this),
                target,
                keccak256(data),
                nonce,
                expiry,
                block.chainid
            )
        );
    }

    /// -----------------------------------------------------------------------
    /// Receive ETH
    /// -----------------------------------------------------------------------

    receive() external payable {}
}
