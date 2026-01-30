# Ward

**Ward** is a wallet-layer security system that prevents catastrophic wallet loss by executing risky on-chain interactions inside **isolated, disposable smart-wallet pockets**.

Instead of relying on warnings or detection alone, Ward enforces **execution isolation** so that even if a user interacts with a malicious contract, losses are **contained by design** and never propagate to the main wallet.

---

## What problem are we solving?

Crypto users lose millions of dollars interacting with malicious contracts:

* Approval drainers (`setApprovalForAll`, infinite ERC-20 allowances)
* Fake or malicious airdrops
* Honeypot and tax tokens
* Phishing dApps and spoofed frontends

Most existing security tools are **detective**:

* warnings,
* signature previews,
* contract scanners.

These fail when users ignore alerts or when malicious logic executes faster than users can react.

**Once a transaction is sent from the main wallet, damage is irreversible.**

---

## The core primitive: Execution Isolation

Ward introduces a new security primitive:

> **Every risky on-chain action is executed from a disposable, single-use smart wallet instead of the main wallet.**

This “pocket”:

* holds a small, capped balance,
* executes exactly one authorized action,
* is destroyed or disabled immediately after use.

If compromised, **only the pocket is affected**.

The main wallet:

* never executes risky calls,
* never grants approvals to unknown contracts,
* is used only for identity and message signatures.

---

## How does it work? (High-level)

1. **User initiates a risky action**
   Example: claiming an airdrop or interacting with an unknown contract.

2. **Ward analyzes the target**
   Backend performs static checks and simulations to classify risk.

3. **A pocket is created on demand**
   A disposable smart wallet is deployed and temporarily funded with a small gas reserve.

4. **User signs an intent (no gas)**
   The user signs a message authorizing:

   * one specific pocket,
   * one specific contract,
   * one exact calldata,
   * exactly once.

5. **Relayer executes the transaction**
   A relayer pays gas and submits the transaction from the pocket.

6. **Outcome is contained**

   * If the contract is safe: assets can be swept to the main wallet.
   * If malicious: the pocket is drained or burned.
   * In all cases, the main wallet remains untouched.

---

## How does the flow look like ?

### Ward Execution Isolation Flow
*The main wallet never executes risky calls — it only signs a one-time intent.*

```markdown

┌────────────────┐        Sign intent        ┌───────────────┐
│   Main Wallet  │ ───────────────────────▶ │     Pocket     │
│ (Identity only)│                           │ (Single-use)  │
└────────────────┘                           └──────┬────────┘
                                                           │
                                             On-chain call │
                                                           ▼
                                           ┌────────────────────┐
                                           │  Target Contract   │
                                           │ (Airdrop / DeFi)   │
                                           └────────────────────┘
```

### Ward Trust Boundary Model
*Risky execution is physically separated from the user’s wallet by a disposable smart-wallet boundary.*
```markdown
┌───────────────────────────────────────────┐
│             USER TRUST ZONE               │
│                                           │
│  ┌───────────────┐                        │
│  │ Main Wallet   │                        │
│  │  (Signer)     │                        │
│  └───────┬───────┘                        │
│          │  Off-chain signature           │
│          ▼                                │
│  ┌───────────────┐                        │
│  │   Pocket      │  ←── Isolation Wall    │
│  │ (Single-use)  │                        │
│  └───────┬───────┘                        │
└──────────│────────────────────────────────┘
           │  On-chain execution
           ▼
┌───────────────────────────────────────────┐
│        UNTRUSTED CONTRACT SPACE           │
│                                           │
│   Airdrops • DeFi • Unknown Contracts     │
└───────────────────────────────────────────┘
```

---
## Why is this safer than existing approaches?

### Detection vs. containment

| Approach           | What happens if user ignores warning? |
| ------------------ | ------------------------------------- |
| Browser warnings   | Wallet drained                        |
| Signature previews | Wallet drained                        |
| Static scanners    | Wallet drained                        |
| **Ward**    | **Loss capped to pocket**             |

Ward does not rely on users making the “right” decision.
It **removes catastrophic failure modes entirely**.

---

### No approval inheritance

* Main wallet never approves unknown contracts.
* Pockets do not inherit main-wallet permissions.
* Compromising a pocket cannot escalate access.

This is fundamentally safer than:

* session keys,
* delegated approvals,
* extended wallet permissions.

---

### Gasless UX without custody

* Users sign messages, not transactions.
* Relayers pay gas.
* Fees are enforced on-chain by the controller.
* Relayers never custody user assets.

Security is preserved without UX friction.

---

## What does the demo prove?

The demo intentionally walks into a scam.

### Demo scenario

1. User claims a **malicious airdrop** using Ward.
2. The malicious contract drains the executing wallet.
3. That wallet is a **pocket**, not the main wallet.
4. The main wallet balance remains unchanged.

### What this proves

* Malicious execution **can be survived by design**
* Wallet drains become **bounded losses**, not catastrophic failures
* Ward protects users **even when they make mistakes**

This is the core value proposition.

---

## What Ward does *not* claim

* It does not guarantee tokens are valuable.
* It does not promise perfect scam detection.
* It does not recover funds from compromised pockets.
* It does not protect assets after they are moved to the main wallet.

Ward is honest about its scope:

> **It prevents catastrophic loss — not all loss.**

---

## In One-sentence

> **Ward turns every risky on-chain action into a disposable, loss-capped execution environment, making wallet drains structurally impossible.**

---
