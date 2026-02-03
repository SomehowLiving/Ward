# Part A — Direct Interaction with `ClaimSellBlockedToken` (CSBT)

This section documents **direct EOA interactions** with `ClaimSellBlockedToken`, demonstrating both **normal behavior** and the **honeypot sell trap**.

The goal is to establish a **ground truth baseline** before introducing Pocket / WARD isolation.

---

## Contract Summary

**ClaimSellBlockedToken (CSBT)** is a *conditional honeypot ERC20* with the following properties:

* Anyone may claim a one-time airdrop
* Tokens behave like a normal ERC20 **until a sell is attempted**
* **Selling to the DEX pair is permanently blocked for claimed wallets**
* The **contract owner is exempt** from all restrictions (realistic scam behavior)

---

## Roles Used in Testing

| Role         | Description                                    |
| ------------ | ---------------------------------------------- |
| **Owner**    | Contract deployer (liquidity seeder / scammer) |
| **User**     | Regular wallet that has not claimed            |
| **Victim**   | Regular wallet that has claimed                |
| **DEX Pair** | Simulated DEX pair address                     |

---

## Environment Variables

```bash
export RPC_URL=...
export TOKEN_ADDRESS=...
export DEX_PAIR=0x0000000000000000000000000000000000000001
```

---

## A.1 Token Identity Check

```bash
cast call $TOKEN_ADDRESS "symbol()(string)" --rpc-url $RPC_URL
```

**Expected**

```
CSBT
```

---

## A.2 Owner Claims Airdrop (Allowed)

```bash
cast send $TOKEN_ADDRESS \
  "claimAirdrop()" \
  --rpc-url $RPC_URL \
  --private-key $OWNER_KEY
```

**Expected**

* ✅ Success
* `claimed(owner) == true`
* Owner balance increases by `1000 CSBT`

---

## A.3 Owner Can Transfer to Other Wallets

```bash
cast send $TOKEN_ADDRESS \
  "transfer(address,uint256)" \
  $FRIEND_ADDRESS \
  10 \
  --rpc-url $RPC_URL \
  --private-key $OWNER_KEY
```

**Expected**

* ✅ Success
* Tokens behave like a normal ERC20

---

## A.4 Owner Can Sell to DEX (Exempt by Design)

```bash
cast send $TOKEN_ADDRESS \
  "transfer(address,uint256)" \
  $DEX_PAIR \
  1 \
  --rpc-url $RPC_URL \
  --private-key $OWNER_KEY
```

**Expected**

* ✅ Success

> **Important:**
> The contract owner is intentionally exempt from sell restrictions.
> This allows liquidity seeding, fake volume, and dumping — matching real honeypot behavior.

---

## A.5 Owner Approval Does Not Affect Honeypot Logic

```bash
cast send $TOKEN_ADDRESS \
  "approve(address,uint256)" \
  $DEX_PAIR \
  1000 \
  --rpc-url $RPC_URL \
  --private-key $OWNER_KEY
```

**Expected**

* ✅ Success
* Does **not** bypass sell restrictions for victims

---

## A.6 Victim Claims Airdrop

```bash
cast send $TOKEN_ADDRESS \
  "claimAirdrop()" \
  --rpc-url $RPC_URL \
  --private-key $VICTIM_KEY
```

```bash
cast call $TOKEN_ADDRESS \
  "claimed(address)(bool)" \
  $VICTIM_ADDRESS \
  --rpc-url $RPC_URL
```

**Expected**

```
true
```

---

## A.7 Victim Transfers to Another Wallet (Still Allowed)

```bash
cast send $TOKEN_ADDRESS \
  "transfer(address,uint256)" \
  $FRIEND_ADDRESS \
  10 \
  --rpc-url $RPC_URL \
  --private-key $VICTIM_KEY
```

**Expected**

* ✅ Success

Tokens **appear fully functional**.

---

## A.8 Victim Attempts to Sell (HONEYPOT TRIGGER)

```bash
cast send $TOKEN_ADDRESS \
  "transfer(address,uint256)" \
  $DEX_PAIR \
  1 \
  --rpc-url $RPC_URL \
  --private-key $VICTIM_KEY
```

**Expected**

* ❌ Revert

  ```
  SELL DISABLED: claimed wallet
  ```

This is the **honeypot trap**.

---

## A.9 Approval Does NOT Bypass the Trap

```bash
cast send $TOKEN_ADDRESS \
  "approve(address,uint256)" \
  $DEX_PAIR \
  1000 \
  --rpc-url $RPC_URL \
  --private-key $VICTIM_KEY
```

```bash
cast send $TOKEN_ADDRESS \
  "transferFrom(address,address,uint256)" \
  $VICTIM_ADDRESS \
  $DEX_PAIR \
  1 \
  --rpc-url $RPC_URL \
  --private-key $VICTIM_KEY
```

**Expected**

* ❌ Revert

  ```
  SELL DISABLED: claimed wallet
  ```

---

## A.10 Behavioral Summary

| Action              | Owner | Victim |
| ------------------- | ----- | ------ |
| Claim airdrop       | ✅     | ✅      |
| Transfer to wallet  | ✅     | ✅      |
| Approve spender     | ✅     | ✅      |
| Sell to DEX         | ✅     | ❌      |
| Bypass via approval | N/A   | ❌      |

---

## A.11 Security Implication

This token demonstrates a **realistic conditional honeypot**:

* Tokens look transferable
* Balance increases normally
* Wallet-to-wallet transfers work
* Only the **sell action** fails
* Owner behavior masks the scam

This makes static detection difficult and motivates **isolated execution environments** like WARD pockets.

---

If you want, next I can write **Part B: Pocket-based interaction with CSBT** or **Part C: Why WARD prevents damage here**.
