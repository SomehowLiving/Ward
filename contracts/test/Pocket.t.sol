// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Pocket.sol";

/// -----------------------------------------------------------------------
/// Mock target contracts
/// -----------------------------------------------------------------------

contract MockTarget {
    uint256 public value;

    function setValue(uint256 v) external {
        value = v;
    }
}

contract MockReverter {
    function boom() external pure {
        revert("nope");
    }
}

contract PocketTest is Test {
    /// -----------------------------------------------------------------------
    /// Test actors
    /// -----------------------------------------------------------------------

    uint256 ownerPk;
    address owner;

    address controller;
    address attacker;

    Pocket pocket;
    MockTarget target;
    MockReverter reverter;

    /// -----------------------------------------------------------------------
    /// Setup
    /// -----------------------------------------------------------------------

    function setUp() public {
        ownerPk = 0xA11CE;
        owner = vm.addr(ownerPk);

        controller = address(this);
        attacker = address(0xBAD);

        pocket = new Pocket(controller, owner);
        target = new MockTarget();
        reverter = new MockReverter();

        // fund pocket with ETH to simulate gas reserve
        vm.deal(address(pocket), 1 ether);
    }

    /// -----------------------------------------------------------------------
    /// Helpers
    /// -----------------------------------------------------------------------

    function _signExec(
        address _target,
        bytes memory _data,
        uint256 _nonce,
        uint256 _expiry
    ) internal view returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                address(pocket),
                _target,
                keccak256(_data),
                _nonce,
                _expiry,
                block.chainid
            )
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    /// -----------------------------------------------------------------------
    /// Tests
    /// -----------------------------------------------------------------------

    function testExecSuccess() public {
        bytes memory data = abi.encodeWithSelector(
            MockTarget.setValue.selector,
            42
        );

        uint256 nonce = 1;
        uint256 expiry = block.timestamp + 1 hours;

        bytes memory sig = _signExec(address(target), data, nonce, expiry);

        pocket.exec(address(target), data, nonce, expiry, sig);

        assertEq(target.value(), 42);
        assertTrue(pocket.used());
    }

    function testCannotExecuteTwice() public {
        bytes memory data = abi.encodeWithSelector(
            MockTarget.setValue.selector,
            1
        );

        uint256 nonce = 1;
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _signExec(address(target), data, nonce, expiry);

        pocket.exec(address(target), data, nonce, expiry, sig);

        vm.expectRevert(Pocket.PocketAlreadyUsed.selector);
        pocket.exec(address(target), data, nonce + 1, expiry, sig);
    }

    function testInvalidSignerFails() public {
        bytes memory data = abi.encodeWithSelector(
            MockTarget.setValue.selector,
            99
        );

        uint256 nonce = 1;
        uint256 expiry = block.timestamp + 1 hours;

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                address(pocket),
                address(target),
                keccak256(data),
                nonce,
                expiry,
                block.chainid
            )
        );

        // sign with attacker key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBEEF, digest);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert(Pocket.InvalidSigner.selector);
        pocket.exec(address(target), data, nonce, expiry, badSig);
    }

    function testExpiredSignatureFails() public {
        bytes memory data = abi.encodeWithSelector(
            MockTarget.setValue.selector,
            5
        );

        uint256 nonce = 1;
        uint256 expiry = block.timestamp - 1;

        bytes memory sig = _signExec(address(target), data, nonce, expiry);

        vm.expectRevert(Pocket.SignatureExpired.selector);
        pocket.exec(address(target), data, nonce, expiry, sig);
    }

function testNonceReplaySamePocketFails() public {
    bytes memory data = abi.encodeWithSelector(
        MockTarget.setValue.selector,
        10
    );

    uint256 nonce = 7;
    uint256 expiry = block.timestamp + 1 hours;
    bytes memory sig = _signExec(address(target), data, nonce, expiry);

    pocket.exec(address(target), data, nonce, expiry, sig);

    vm.expectRevert(Pocket.PocketAlreadyUsed.selector);
    pocket.exec(address(target), data, nonce, expiry, sig);
}

function testSignatureReplayAcrossPocketsFails() public {
    bytes memory data = abi.encodeWithSelector(
        MockTarget.setValue.selector,
        10
    );

    uint256 nonce = 7;
    uint256 expiry = block.timestamp + 1 hours;

    bytes memory sig = _signExec(address(target), data, nonce, expiry);

    // Deploy a NEW pocket
    Pocket newPocket = new Pocket(controller, owner);
    vm.deal(address(newPocket), 1 ether);

    vm.expectRevert(Pocket.InvalidSigner.selector);
    newPocket.exec(address(target), data, nonce, expiry, sig);
}


    function testExecutionFailureReverts() public {
        bytes memory data = abi.encodeWithSelector(
            MockReverter.boom.selector
        );

        uint256 nonce = 1;
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _signExec(address(reverter), data, nonce, expiry);

        vm.expectRevert(Pocket.ExecutionFailed.selector);
        pocket.exec(address(reverter), data, nonce, expiry, sig);
    }

    function testOnlyControllerCanExecute() public {
        bytes memory data = abi.encodeWithSelector(
            MockTarget.setValue.selector,
            77
        );

        uint256 nonce = 1;
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _signExec(address(target), data, nonce, expiry);

        vm.prank(attacker);
        vm.expectRevert(Pocket.NotController.selector);
        pocket.exec(address(target), data, nonce, expiry, sig);
    }

    function testOnlyControllerCanSweep() public {
        vm.prank(attacker);
        vm.expectRevert(Pocket.NotController.selector);
        pocket.sweepERC20(address(0xDEAD), attacker, 1);
    }
}
