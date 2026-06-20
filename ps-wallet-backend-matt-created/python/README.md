# PinkSurfing KeyVault — On-Chain Encrypted Wallet Backup

Python sidecar service that manages Chia blockchain singletons for encrypted wallet backup.

## Architecture

```
Flutter App → Node.js Backend (API gateway) → Python KeyVault (this) → Chia blockchain
                                            → IPFS (Pinata) for encrypted blobs
```

**Adapted from** [mothsoft/solslot-backend](https://github.com/mothsoft/solslot-backend) branch 40 vault singleton architecture.

## How It Works

1. **Create**: User encrypts mnemonic with password → pins to IPFS → deploys Chia singleton with CID hash in Merkle tree
2. **Update**: New encrypted blob → IPFS → spends singleton to update Merkle root (requires owner BLS signature)
3. **Recover**: Scan chain for singleton by launcher_id → follow singleton chain → extract all CID hashes → fetch from IPFS → decrypt with password
4. **Transfer**: Change owner pubkey (key rotation) — requires current owner signature

## Key Files

| File | Purpose |
|------|---------|
| `ps_keyvault/clsp/keyvault_inner.clsp` | Chialisp singleton inner puzzle |
| `ps_keyvault/driver.py` | Chia blockchain operations (deploy, update, recover) |
| `ps_keyvault/api.py` | FastAPI REST endpoints |
| `ps_keyvault/models.py` | Pydantic request/response models |

## Chialisp Puzzle

The KeyVault singleton inner puzzle (`keyvault_inner.clsp`) stores:
- **OWNER_PUBKEY** — BLS public key of the wallet owner
- **BACKUPS_MERKLE_ROOT** — Merkle root of all backup version CID hashes
- **BACKUP_COUNT** — number of backup versions committed
- **LATEST_CID_HASH** — SHA256 hash of the latest IPFS CID string

Spend cases:
- `'u'` (update) — add new backup version, requires owner BLS signature
- `'t'` (transfer) — change owner pubkey (key rotation)
- `'a'` (announce) — read-only state announcement

## Running

```bash
cd python
pip install -e .
python -m ps_keyvault.api
# Runs on http://localhost:5002
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KEYVAULT_PORT` | `5002` | Port for the FastAPI service |
| `CHIA_FULL_NODE_HOST` | `localhost` | Chia full node RPC host |
| `CHIA_FULL_NODE_PORT` | `8555` | Chia full node RPC port |
| `CHIA_USE_REMOTE` | `false` | Use coinset.org public API instead of local node |

## Recovery Without Our Server

The key insight: **all state is on-chain**. If our server goes down completely:

1. User knows their `launcher_id` (stored locally on their device)
2. Any Chia full node can scan the singleton chain → get all CID hashes
3. IPFS is decentralized — encrypted blobs are pinned and available
4. User decrypts with their password → wallet restored

No server, no account, no trust required.
