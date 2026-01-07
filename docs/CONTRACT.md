# Smart Contract Development — Start Plan

## Guiding principles (do not violate)

1. **Isolation > features**
2. **No custody in controller**
3. **All authority = EIP-712 signatures**
4. **Pocket executes exactly once**
5. **Controller enforces fees on-chain**
6. **Relayer is never trusted**

If any implementation choice violates one of these, it’s wrong.

---

## Tech stack (recommended)

* **Solidity** `^0.8.20`
* **Foundry** (fast iteration, fuzzing, scripts)
* **OpenZeppelin** (ECDSA, IERC20, Address)
* **No upgradeability in MVP**

---

## Repo structure (contracts only)

```
contracts/
 ├─ Pocket.sol
 ├─ PocketController.sol
 ├─ PocketFactory.sol
 ├─ libraries/
 │   ├─ EIP712Domain.sol
 │   └─ IntentHash.sol
 └─ interfaces/
     ├─ IPocket.sol
     └─ IPocketController.sol
```

Start with **interfaces first**, then implementations.

---

## Contract order (important)

To implement **in this exact order**:

1. `IPocket`
2. `IPocketController`
3. `Pocket`
4. `PocketController`
5. `PocketFactory`

This avoids circular thinking.

---

## 1. `IPocket.sol` (interface)

Purpose: define *exactly* what a pocket is allowed to do.

```solidity
interface IPocket {
    function exec(
        address target,
        bytes calldata data,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external;

    function sweep(
        address token,
        address to,
        uint256 amount
    ) external;

    function owner() external view returns (address);
    function used() external view returns (bool);
}
```

No extras. No approvals. No loops.

---

## 2. `IPocketController.sol`

Purpose: controller is the **only external entrypoint**.

```solidity
interface IPocketController {
    function createPocket(
        address user,
        uint256 nonce
    ) external returns (address pocket);

    function executeFromPocket(
        address pocket,
        address target,
        bytes calldata data,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external;

    function sweep(
        address pocket,
        address token,
        address receiver,
        uint256 amount,
        uint8 tier,
        bytes calldata signature
    ) external;
}
```

Note:

* `tier` is passed explicitly
* controller validates fee rules
* relayer never decides tier

---

## 3. `Pocket.sol` (core isolation contract)

This is the **most important file**.

### State

```solidity
address public immutable controller;
address public immutable owner;
bool public used;

mapping(uint256 => bool) public usedNonces;
```

### Key rules (hard requirements)

* `exec`:

  * callable **only by controller**
  * verifies EIP-712 signature
  * enforces `!used`
  * marks `used = true`
* `sweep`:

  * callable **only by controller**
  * transfers **only owned assets**
* No approvals
* No fallback logic
* No receive hooks beyond ETH receive

---

### Pocket execution (simplified)

```solidity
function exec(
    address target,
    bytes calldata data,
    uint256 nonce,
    uint256 expiry,
    bytes calldata signature
) external {
    require(msg.sender == controller, "NOT_CONTROLLER");
    require(!used, "POCKET_USED");
    require(block.timestamp <= expiry, "EXPIRED");
    require(!usedNonces[nonce], "NONCE_USED");

    bytes32 digest = IntentHash.hashExec(
        address(this),
        target,
        data,
        nonce,
        expiry
    );

    address signer = ECDSA.recover(digest, signature);
    require(signer == owner, "INVALID_SIGNER");

    usedNonces[nonce] = true;
    used = true;

    (bool ok, ) = target.call(data);
    require(ok, "EXEC_FAILED");
}
```

This is the **isolation wall**.

---

## 4. `PocketController.sol`

Responsibilities:

* Deterministic pocket creation
* Funding pockets
* Routing execution
* Enforcing fees on sweep

### Controller state

```solidity
address public treasury;
uint256 public constant GAS_RESERVE = 0.005 ether;

mapping(address => bool) public validPocket;
mapping(address => address) public pocketOwner;
```

### Fee policy (hard-coded for MVP)

```solidity
function feeForTier(uint8 tier) public pure returns (uint256) {
    if (tier == 2) return 200; // 2%
    if (tier == 4) return 300; // 3%
    if (tier == 3) return 800; // 8%
    return 0;
}
```

Controller **never guesses tier**.
It only enforces what backend decided + user signed.

---

## 5. `PocketFactory.sol`

Very small contract.

Purpose:

* CREATE2 deployment
* No logic
* No custody

```solidity
function deployPocket(
    address controller,
    address owner,
    uint256 salt
) external returns (address);
```

Controller is the only caller.

---

## MVP features to implement now (strict)

### MUST implement

* Pocket single-use execution
* EIP-712 signature validation
* Controller-enforced sweep fees
* Lazy pocket creation
* ETH funding on creation

### TO NOT implement yet

* Upgradeability
* Social recovery
* NFT handling
* Cross-chain
* Batch execution
* ERC-4337

---
