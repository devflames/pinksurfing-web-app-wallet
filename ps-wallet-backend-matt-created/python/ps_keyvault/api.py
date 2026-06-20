"""
PinkSurfing KeyVault REST API

FastAPI service that exposes KeyVault operations for the Node.js backend.
Runs as a sidecar service on a separate port (default 5002).

Endpoints:
  POST /keyvault/deploy        — Deploy new KeyVault singleton
  POST /keyvault/update        — Add new backup version
  POST /keyvault/transfer      — Transfer ownership (key rotation)
  POST /keyvault/recover       — Recover state from blockchain
  POST /keyvault/status        — Check KeyVault status
  POST /keyvault/verify-backup — Verify a CID is in the Merkle tree
  GET  /keyvault/health        — Health check
"""

import asyncio
import logging
import os

import uvicorn
from chia.rpc.rpc_client import RpcClient
from chia.types.blockchain_format.coin import Coin
from chia.util.bech32m import decode_puzzle_hash
from chia.util.config import load_config
from chia.util.default_root import DEFAULT_ROOT_PATH
from chia_rs import G1Element, PrivateKey
from chia_rs.sized_bytes import bytes32
from chia_rs.sized_ints import uint16
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ps_keyvault.driver import KeyVaultDriver
from ps_keyvault.models import (
    DeployKeyvaultRequest,
    KeyvaultResponse,
    KeyvaultStatusRequest,
    PrepareTransferRequest,
    PrepareUpdateRequest,
    PrepareWithdrawRequest,
    RecoverKeyvaultRequest,
    ServerFundedDeployRequest,
    SubmitSignedRequest,
    TransferOwnershipRequest,
    UpdateBackupRequest,
    VaultAddressRequest,
    VaultBalanceRequest,
    VaultDepositRequest,
    VaultWithdrawRequest,
    VerifyBackupRequest,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PinkSurfing KeyVault API",
    description="On-chain encrypted wallet backup management via Chia singletons",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

driver = KeyVaultDriver()


async def initialize_driver():
    """Initialize the KeyVault driver with Chia RPC clients."""
    try:
        # Support both local node and remote (coinset.org) connections
        chia_host = os.environ.get("CHIA_FULL_NODE_HOST", "localhost")
        chia_port = int(os.environ.get("CHIA_FULL_NODE_PORT", "8555"))
        use_remote = os.environ.get("CHIA_USE_REMOTE", "false").lower() == "true"

        # Ensure chia config exists (creates ~/.chia/mainnet/config/config.yaml)
        if not (DEFAULT_ROOT_PATH / "config" / "config.yaml").exists():
            logger.info("No chia config found — running chia init...")
            import subprocess
            subprocess.run(["chia", "init"], check=True, capture_output=True)
            logger.info("chia init completed")

        config = load_config(DEFAULT_ROOT_PATH, "config.yaml")

        if use_remote:
            # Use coinset.org public API (no local node required)
            node_client = await RpcClient.create(
                "api.coinset.org",
                uint16(443),
                DEFAULT_ROOT_PATH,
                config,
            )
            await driver.init(node_client=node_client)
        else:
            node_client = await RpcClient.create(
                config["self_hostname"],
                uint16(config["full_node"]["rpc_port"]),
                DEFAULT_ROOT_PATH,
                config,
            )

            # Wallet client is optional (needed for signing via wallet)
            wallet_client = None
            try:
                wallet_client = await RpcClient.create(
                    config["self_hostname"],
                    uint16(config["wallet"]["rpc_port"]),
                    DEFAULT_ROOT_PATH,
                    config,
                )
            except Exception as e:
                logger.warning(f"Wallet client not available: {e}")

            await driver.init(node_client=node_client, wallet_client=wallet_client)

        logger.info("KeyVault driver initialized successfully")
        return True
    except BaseException as e:
        logger.error(f"Error initializing KeyVault driver: {e}")
        return False


@app.on_event("startup")
async def startup_event():
    logger.info("Starting KeyVault API...")
    asyncio.create_task(initialize_driver())


@app.get("/keyvault/health")
async def health_check():
    """Health check endpoint."""
    connected = driver.node_client is not None
    return {
        "success": True,
        "service": "ps-keyvault",
        "node_connected": connected,
    }


@app.post("/keyvault/deploy", response_model=KeyvaultResponse)
async def deploy_keyvault(request: DeployKeyvaultRequest):
    """
    Deploy a new KeyVault singleton on the Chia blockchain.

    The KeyVault stores encrypted wallet backup references (IPFS CIDs)
    in a Merkle tree, controlled by the owner's BLS public key.
    """
    try:
        owner_pubkey = G1Element.from_bytes(bytes.fromhex(request.owner_pubkey_hex))
        funding_coin = Coin.from_json_dict(request.funding_coin)

        launcher_id = await driver.deploy_keyvault(
            owner_pubkey=owner_pubkey,
            initial_cid=request.initial_cid,
            funding_coin=funding_coin,
            fee_amount=request.fee_amount,
        )

        return KeyvaultResponse(
            success=True,
            message="KeyVault deployed successfully",
            data={
                "launcher_id": launcher_id.hex(),
                "initial_cid": request.initial_cid,
            },
        )
    except Exception as e:
        logger.error(f"Deploy error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to deploy KeyVault: {str(e)}",
        )


@app.post("/keyvault/deploy-server-funded", response_model=KeyvaultResponse)
async def deploy_server_funded(request: ServerFundedDeployRequest):
    """
    Deploy a new KeyVault singleton funded by the server's wallet.

    The server uses its own XCH to create the singleton on behalf of the user.
    Only requires the owner's public key and an initial IPFS CID.
    """
    try:
        from chia.util.keychain import Keychain

        # Load server master secret key from Chia keychain
        keychain = Keychain()
        all_sks = keychain.get_all_private_keys()
        if not all_sks:
            return KeyvaultResponse(
                success=False,
                message="No keys in server keychain. Run 'chia keys generate'.",
            )

        # Use fingerprint from env if set, otherwise first key
        target_fp = os.environ.get("SERVER_KEY_FINGERPRINT")
        server_sk = None
        for entry in all_sks:
            sk = entry[0] if isinstance(entry, (tuple, list)) else entry
            if target_fp is None or str(sk.get_g1().get_fingerprint()) == target_fp:
                server_sk = sk
                break

        if server_sk is None:
            return KeyvaultResponse(
                success=False,
                message=f"Key with fingerprint {target_fp} not found.",
            )

        owner_pubkey = G1Element.from_bytes(bytes.fromhex(request.owner_pubkey_hex))

        launcher_id = await driver.deploy_keyvault_server_funded(
            server_master_sk=server_sk,
            owner_pubkey=owner_pubkey,
            initial_cid=request.initial_cid,
            fee_amount=request.fee_amount,
        )

        return KeyvaultResponse(
            success=True,
            message="KeyVault deployed (server-funded)",
            data={
                "launcher_id": launcher_id.hex(),
                "initial_cid": request.initial_cid,
            },
        )
    except Exception as e:
        logger.error(f"Server-funded deploy error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Server-funded deploy failed: {str(e)}",
        )


@app.post("/vault/address", response_model=KeyvaultResponse)
async def vault_address(request: VaultAddressRequest):
    """Get the vault's deposit address (p2_keyvault puzzle hash)."""
    try:
        launcher_id = bytes32.from_hexstr(request.launcher_id)
        address = driver.get_vault_address(launcher_id)
        puzzle_hash = driver.get_vault_puzzle_hash(launcher_id)

        return KeyvaultResponse(
            success=True,
            message="Vault deposit address",
            data={
                "deposit_address": address,
                "puzzle_hash": puzzle_hash.hex(),
                "launcher_id": request.launcher_id,
            },
        )
    except Exception as e:
        logger.error(f"Vault address error: {e}")
        return KeyvaultResponse(success=False, message=str(e))


@app.post("/vault/balance", response_model=KeyvaultResponse)
async def vault_balance(request: VaultBalanceRequest):
    """Query the vault's XCH balance (unspent p2_keyvault coins)."""
    try:
        launcher_id = bytes32.from_hexstr(request.launcher_id)
        balance_info = await driver.get_vault_balance(launcher_id)

        return KeyvaultResponse(
            success=True,
            message="Vault balance",
            data=balance_info,
        )
    except Exception as e:
        logger.error(f"Vault balance error: {e}")
        return KeyvaultResponse(success=False, message=str(e))


@app.post("/vault/withdraw", response_model=KeyvaultResponse)
async def vault_withdraw(request: VaultWithdrawRequest):
    """
    Withdraw XCH from the vault to a destination address.

    For server-funded vaults (owner_sk_hex omitted), the server signs.
    For user-owned vaults, provide owner_sk_hex.
    """
    try:
        launcher_id = bytes32.from_hexstr(request.launcher_id)
        destination_ph = decode_puzzle_hash(request.destination_address)
        owner_pubkey = G1Element.from_bytes(bytes.fromhex(request.owner_pubkey_hex))
        cid_hashes = [bytes32.from_hexstr(h) for h in request.current_cid_hashes]

        if request.owner_sk_hex:
            # User-signed withdrawal
            owner_sk = PrivateKey.from_bytes(bytes.fromhex(request.owner_sk_hex))
            result = await driver.withdraw_from_vault(
                launcher_id=launcher_id,
                owner_pubkey=owner_pubkey,
                owner_sk=owner_sk,
                destination_puzzle_hash=destination_ph,
                amount=request.amount,
                current_cid_hashes=cid_hashes,
                fee_amount=request.fee_amount,
            )
        else:
            # Server-funded vault: server signs
            from chia.util.keychain import Keychain
            keychain = Keychain()
            all_sks = keychain.get_all_private_keys()
            if not all_sks:
                return KeyvaultResponse(success=False, message="No server keys in keychain")

            target_fp = os.environ.get("SERVER_KEY_FINGERPRINT")
            server_sk = None
            for entry in all_sks:
                sk = entry[0] if isinstance(entry, (tuple, list)) else entry
                if target_fp is None or str(sk.get_g1().get_fingerprint()) == target_fp:
                    server_sk = sk
                    break

            if server_sk is None:
                return KeyvaultResponse(success=False, message="Server key not found")

            result = await driver.withdraw_from_vault_server_funded(
                server_master_sk=server_sk,
                launcher_id=launcher_id,
                owner_pubkey=owner_pubkey,
                destination_puzzle_hash=destination_ph,
                amount=request.amount,
                current_cid_hashes=cid_hashes,
                fee_amount=request.fee_amount,
            )

        return KeyvaultResponse(
            success=True,
            message="Vault withdrawal submitted",
            data=result,
        )
    except Exception as e:
        logger.error(f"Vault withdraw error: {e}")
        return KeyvaultResponse(success=False, message=f"Withdrawal failed: {str(e)}")


@app.post("/vault/send-to-vault", response_model=KeyvaultResponse)
async def vault_send_to_vault(request: VaultDepositRequest):
    """
    Send XCH from the server wallet to the vault deposit address.

    This is a standard wallet → vault transfer. The server signs the
    transaction using its wallet key.
    """
    try:
        launcher_id = bytes32.from_hexstr(request.launcher_id)

        from chia.util.keychain import Keychain
        keychain = Keychain()
        all_sks = keychain.get_all_private_keys()
        if not all_sks:
            return KeyvaultResponse(success=False, message="No server keys in keychain")

        target_fp = os.environ.get("SERVER_KEY_FINGERPRINT")
        server_sk = None
        for entry in all_sks:
            sk = entry[0] if isinstance(entry, (tuple, list)) else entry
            if target_fp is None or str(sk.get_g1().get_fingerprint()) == target_fp:
                server_sk = sk
                break

        if server_sk is None:
            return KeyvaultResponse(success=False, message="Server key not found")

        result = await driver.send_to_vault(
            server_master_sk=server_sk,
            launcher_id=launcher_id,
            amount=request.amount,
            fee_amount=request.fee_amount,
        )

        return KeyvaultResponse(
            success=True,
            message="Deposit sent to vault",
            data=result,
        )
    except Exception as e:
        logger.error(f"Vault send-to-vault error: {e}")
        return KeyvaultResponse(success=False, message=f"Deposit failed: {str(e)}")


@app.post("/keyvault/prepare-update", response_model=KeyvaultResponse)
async def prepare_update(request: PrepareUpdateRequest):
    """
    Prepare an unsigned backup update spend (2-step signing).

    Returns unsigned coin spends + the exact message the client must
    sign with their BLS key. No private key needed server-side.
    """
    try:
        owner_pubkey = G1Element.from_bytes(bytes.fromhex(request.owner_pubkey_hex))
        launcher_id = bytes32.fromhex(request.launcher_id)
        current_cid_hashes = [
            bytes32.fromhex(h) for h in request.current_cid_hashes
        ]

        result = await driver.prepare_update(
            launcher_id=launcher_id,
            owner_pubkey=owner_pubkey,
            current_cid_hashes=current_cid_hashes,
            new_cid=request.new_cid,
            fee_amount=request.fee_amount,
        )

        return KeyvaultResponse(
            success=True,
            message="Update spend prepared — sign and submit",
            data=result,
        )
    except Exception as e:
        logger.error(f"Prepare update error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to prepare update: {str(e)}",
        )


@app.post("/keyvault/prepare-transfer", response_model=KeyvaultResponse)
async def prepare_transfer(request: PrepareTransferRequest):
    """
    Prepare an unsigned ownership transfer spend (2-step signing).
    """
    try:
        current_pubkey = G1Element.from_bytes(
            bytes.fromhex(request.current_owner_pubkey_hex)
        )
        new_pubkey = G1Element.from_bytes(
            bytes.fromhex(request.new_owner_pubkey_hex)
        )
        launcher_id = bytes32.fromhex(request.launcher_id)

        current_state = {
            "backups_merkle_root": bytes32.fromhex(
                request.current_state["backups_merkle_root"]
            ),
            "backup_count": request.current_state["backup_count"],
            "latest_cid_hash": bytes32.fromhex(
                request.current_state["latest_cid_hash"]
            ),
        }

        result = await driver.prepare_transfer(
            launcher_id=launcher_id,
            current_owner_pubkey=current_pubkey,
            new_owner_pubkey=new_pubkey,
            current_state=current_state,
            fee_amount=request.fee_amount,
        )

        return KeyvaultResponse(
            success=True,
            message="Transfer spend prepared — sign and submit",
            data=result,
        )
    except Exception as e:
        logger.error(f"Prepare transfer error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to prepare transfer: {str(e)}",
        )


@app.post("/vault/prepare-withdraw", response_model=KeyvaultResponse)
async def prepare_withdraw(request: PrepareWithdrawRequest):
    """
    Prepare an unsigned vault withdrawal spend (2-step signing).
    """
    try:
        launcher_id = bytes32.from_hexstr(request.launcher_id)
        destination_ph = decode_puzzle_hash(request.destination_address)
        owner_pubkey = G1Element.from_bytes(bytes.fromhex(request.owner_pubkey_hex))
        cid_hashes = [bytes32.from_hexstr(h) for h in request.current_cid_hashes]

        result = await driver.prepare_withdraw(
            launcher_id=launcher_id,
            owner_pubkey=owner_pubkey,
            destination_puzzle_hash=destination_ph,
            amount=request.amount,
            current_cid_hashes=cid_hashes,
            fee_amount=request.fee_amount,
        )

        return KeyvaultResponse(
            success=True,
            message="Withdrawal spend prepared — sign and submit",
            data=result,
        )
    except Exception as e:
        logger.error(f"Prepare withdraw error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to prepare withdrawal: {str(e)}",
        )


@app.post("/keyvault/submit", response_model=KeyvaultResponse)
async def submit_signed(request: SubmitSignedRequest):
    """
    Submit a client-signed spend bundle to the blockchain.

    Takes the unsigned coin spends (from any prepare_* endpoint) and
    the client's BLS signature, then pushes the final SpendBundle.
    """
    try:
        result = await driver.submit_signed(
            coin_spends_json=request.coin_spends_json,
            signature_hex=request.signature_hex,
        )

        return KeyvaultResponse(
            success=True,
            message="Signed spend bundle submitted",
            data=result,
        )
    except Exception as e:
        logger.error(f"Submit signed error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to submit: {str(e)}",
        )


# ── Legacy endpoints (kept for server-funded vaults) ─────────────────

@app.post("/keyvault/update", response_model=KeyvaultResponse)
async def update_backup(request: UpdateBackupRequest):
    """
    Add a new encrypted backup version to the KeyVault.

    Spends the singleton to update the Merkle root with the new CID hash.
    Requires the owner's BLS signature.
    """
    try:
        owner_pubkey = G1Element.from_bytes(bytes.fromhex(request.owner_pubkey_hex))
        owner_sk = PrivateKey.from_bytes(bytes.fromhex(request.owner_sk_hex))
        launcher_id = bytes32.fromhex(request.launcher_id)
        current_cid_hashes = [
            bytes32.fromhex(h) for h in request.current_cid_hashes
        ]

        new_coin_id = await driver.update_backup(
            launcher_id=launcher_id,
            owner_pubkey=owner_pubkey,
            current_cid_hashes=current_cid_hashes,
            new_cid=request.new_cid,
            owner_sk=owner_sk,
            fee_amount=request.fee_amount,
        )

        return KeyvaultResponse(
            success=True,
            message="Backup updated successfully",
            data={
                "new_coin_id": new_coin_id.hex(),
                "new_cid": request.new_cid,
                "backup_count": len(current_cid_hashes) + 1,
            },
        )
    except Exception as e:
        logger.error(f"Update error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to update backup: {str(e)}",
        )


@app.post("/keyvault/transfer", response_model=KeyvaultResponse)
async def transfer_ownership(request: TransferOwnershipRequest):
    """
    Transfer KeyVault ownership to a new BLS public key (key rotation).

    Requires the current owner's BLS signature.
    """
    try:
        current_pubkey = G1Element.from_bytes(
            bytes.fromhex(request.current_owner_pubkey_hex)
        )
        new_pubkey = G1Element.from_bytes(
            bytes.fromhex(request.new_owner_pubkey_hex)
        )
        owner_sk = PrivateKey.from_bytes(bytes.fromhex(request.owner_sk_hex))
        launcher_id = bytes32.fromhex(request.launcher_id)

        # Reconstruct current_state with bytes32 values
        current_state = {
            "backups_merkle_root": bytes32.fromhex(
                request.current_state["backups_merkle_root"]
            ),
            "backup_count": request.current_state["backup_count"],
            "latest_cid_hash": bytes32.fromhex(
                request.current_state["latest_cid_hash"]
            ),
        }

        new_coin_id = await driver.transfer_ownership(
            launcher_id=launcher_id,
            current_owner_pubkey=current_pubkey,
            new_owner_pubkey=new_pubkey,
            current_state=current_state,
            owner_sk=owner_sk,
            fee_amount=request.fee_amount,
        )

        return KeyvaultResponse(
            success=True,
            message="Ownership transferred successfully",
            data={"new_coin_id": new_coin_id.hex()},
        )
    except Exception as e:
        logger.error(f"Transfer error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to transfer ownership: {str(e)}",
        )


@app.post("/keyvault/recover", response_model=KeyvaultResponse)
async def recover_keyvault(request: RecoverKeyvaultRequest):
    """
    Recover KeyVault state by scanning the blockchain.

    Follows the singleton chain from launcher to current unspent coin,
    extracting all backup CID hashes from the spend history.
    This works even if our backend is completely offline —
    all state is on-chain.
    """
    try:
        launcher_id = bytes32.fromhex(request.launcher_id)
        state = await driver.recover_keyvault(launcher_id)

        if state is None:
            return KeyvaultResponse(
                success=False,
                message="KeyVault not found on chain",
            )

        return KeyvaultResponse(
            success=True,
            message="KeyVault recovered from blockchain",
            data=state,
        )
    except Exception as e:
        logger.error(f"Recovery error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to recover KeyVault: {str(e)}",
        )


@app.post("/keyvault/status", response_model=KeyvaultResponse)
async def keyvault_status(request: KeyvaultStatusRequest):
    """Check if a KeyVault singleton exists and is active."""
    try:
        launcher_id = bytes32.fromhex(request.launcher_id)
        status = await driver.get_keyvault_status(launcher_id)

        return KeyvaultResponse(
            success=True,
            message=f"KeyVault status: {status}",
            data={"status": status, "launcher_id": request.launcher_id},
        )
    except Exception as e:
        logger.error(f"Status error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to check status: {str(e)}",
        )


@app.post("/keyvault/verify-backup", response_model=KeyvaultResponse)
async def verify_backup(request: VerifyBackupRequest):
    """
    Verify that a specific backup CID is in the Merkle tree.

    This proves that a backup version was committed on-chain without
    needing to download the full backup.
    """
    try:
        cid_hash = KeyVaultDriver.cid_to_hash(request.cid)
        all_hashes = [bytes32.fromhex(h) for h in request.all_cid_hashes]
        expected_root = bytes32.fromhex(request.expected_root)

        # Build tree and verify
        root, tree = KeyVaultDriver.build_backup_merkle_tree(all_hashes)

        if root != expected_root:
            return KeyvaultResponse(
                success=False,
                message="Merkle root mismatch",
                data={
                    "computed_root": root.hex(),
                    "expected_root": expected_root.hex(),
                },
            )

        # Check if the CID hash is in the tree
        if cid_hash not in all_hashes:
            return KeyvaultResponse(
                success=False,
                message="CID not found in backup history",
            )

        # Generate proof
        proof = KeyVaultDriver.generate_merkle_proof(tree, cid_hash)

        return KeyvaultResponse(
            success=True,
            message="Backup CID verified in Merkle tree",
            data={
                "cid": request.cid,
                "cid_hash": cid_hash.hex(),
                "merkle_root": root.hex(),
                "proof_index": proof[0],
            },
        )
    except Exception as e:
        logger.error(f"Verify error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to verify backup: {str(e)}",
        )


if __name__ == "__main__":
    port = int(os.environ.get("KEYVAULT_PORT", "5002"))
    uvicorn.run("ps_keyvault.api:app", host="0.0.0.0", port=port, reload=True)


# ── DID Endpoints ────────────────────────────────────────────────────

from ps_keyvault.did_driver import DidDriver
from ps_keyvault.models import PrepareCreateDidRequest, PrepareMintNftRequest, DidStatusRequest

did_driver = DidDriver()


# ── PayChat Endpoints ────────────────────────────────────────────────

from ps_keyvault.paychat_driver import PayChatDriver
from ps_keyvault.models import PreparePayChatOfferRequest, BroadcastPayChatOfferRequest, CheckOfferCoinsRequest

paychat_driver = PayChatDriver()


@app.on_event("startup")
async def init_drivers():
    """Initialize DID and PayChat drivers alongside KeyVault driver."""
    try:
        if driver.node_client:
            await did_driver.init(driver.node_client)
            logger.info("DID driver initialized (shared node client)")
            await paychat_driver.init(driver.node_client)
            logger.info("PayChat driver initialized (shared node client)")
    except Exception as e:
        logger.warning(f"Driver init deferred: {e}")


@app.post("/did/prepare-create", response_model=KeyvaultResponse)
async def prepare_create_did(request: PrepareCreateDidRequest):
    """
    Prepare an unsigned DID creation spend (2-step signing).

    Returns unsigned coin spends + the exact message the client must
    sign with their SYNTHETIC BLS key. No private key needed server-side.
    """
    try:
        # Lazy-init if startup didn't catch it
        if did_driver.node_client is None and driver.node_client:
            await did_driver.init(driver.node_client)

        owner_pubkey = G1Element.from_bytes(bytes.fromhex(request.owner_pubkey_hex))

        result = await did_driver.prepare_create_did(
            owner_pubkey=owner_pubkey,
            fee_amount=request.fee_amount,
        )

        return KeyvaultResponse(
            success=True,
            message="DID creation spend prepared — sign with synthetic key and submit",
            data=result,
        )
    except Exception as e:
        logger.error(f"Prepare create DID error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to prepare DID creation: {str(e)}",
        )


@app.post("/did/submit", response_model=KeyvaultResponse)
async def submit_did_signed(request: SubmitSignedRequest):
    """
    Submit a client-signed DID spend bundle to the blockchain.
    Reuses the same submit_signed logic as KeyVault.
    """
    try:
        if did_driver.node_client is None and driver.node_client:
            await did_driver.init(driver.node_client)

        result = await did_driver.submit_signed(
            coin_spends_json=request.coin_spends_json,
            signature_hex=request.signature_hex,
        )

        return KeyvaultResponse(
            success=True,
            message="DID creation transaction submitted",
            data=result,
        )
    except Exception as e:
        logger.error(f"Submit DID signed error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to submit DID transaction: {str(e)}",
        )


@app.post("/did/prepare-mint-card", response_model=KeyvaultResponse)
async def prepare_mint_card(request: PrepareMintNftRequest):
    """
    Prepare an unsigned NFT1 business card mint spend (2-step signing).

    Returns unsigned coin spends + the exact message the client must
    sign with their SYNTHETIC BLS key. No private key needed server-side.
    """
    try:
        if did_driver.node_client is None and driver.node_client:
            await did_driver.init(driver.node_client)

        owner_pubkey = G1Element.from_bytes(bytes.fromhex(request.owner_pubkey_hex))
        recipient_ph = decode_puzzle_hash(request.recipient_address)

        license_hash_bytes = None
        if request.license_hash:
            license_hash_bytes = bytes32.fromhex(request.license_hash)

        result = await did_driver.prepare_mint_nft(
            owner_pubkey=owner_pubkey,
            recipient_puzzle_hash=bytes32(recipient_ph),
            metadata_uris=request.metadata_uris,
            metadata_hash=bytes32.fromhex(request.metadata_hash),
            image_uris=request.image_uris,
            image_hash=bytes32.fromhex(request.image_hash),
            license_uris=request.license_uris,
            license_hash=license_hash_bytes,
            royalty_percentage=request.royalty_percentage,
            fee_amount=request.fee_amount,
        )

        return KeyvaultResponse(
            success=True,
            message="NFT mint spend prepared — sign with synthetic key and submit",
            data=result,
        )
    except Exception as e:
        import traceback
        logger.error(f"Prepare mint NFT error: {e}\n{traceback.format_exc()}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to prepare NFT mint: {str(e)}",
        )


@app.post("/did/status", response_model=KeyvaultResponse)
async def get_did_status(request: DidStatusRequest):
    """Get the current on-chain status of a DID."""
    try:
        if did_driver.node_client is None and driver.node_client:
            await did_driver.init(driver.node_client)

        launcher_id = bytes32.fromhex(request.launcher_id)
        state = await did_driver.get_did_state(launcher_id)

        if state is None:
            return KeyvaultResponse(
                success=False,
                message="DID not found on chain",
            )

        return KeyvaultResponse(
            success=True,
            message=f"DID status: {state.get('status', 'unknown')}",
            data=state,
        )
    except Exception as e:
        logger.error(f"DID status error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to get DID status: {str(e)}",
        )


# ── PayChat Offer Endpoints ──────────────────────────────────────────


@app.post("/paychat/prepare-offer", response_model=KeyvaultResponse)
async def prepare_paychat_offer(request: PreparePayChatOfferRequest):
    """
    Prepare an unsigned XCH send as a PayChat offer (2-step signing).

    Returns unsigned coin spends + the exact message the client must
    sign with their SYNTHETIC BLS key. The signed bundle is stored
    as an "offer" and NOT broadcast until the recipient responds.
    """
    try:
        if paychat_driver.node_client is None and driver.node_client:
            await paychat_driver.init(driver.node_client)

        sender_pubkey = G1Element.from_bytes(bytes.fromhex(request.sender_pubkey_hex))

        result = await paychat_driver.prepare_offer(
            sender_pubkey=sender_pubkey,
            recipient_address=request.recipient_address,
            amount_mojos=request.amount_mojos,
            memo=request.memo or "",
            fee_amount=request.fee_amount,
        )

        return KeyvaultResponse(
            success=True,
            message="PayChat offer prepared — sign with synthetic key",
            data=result,
        )
    except Exception as e:
        import traceback
        logger.error(f"Prepare PayChat offer error: {e}\n{traceback.format_exc()}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to prepare PayChat offer: {str(e)}",
        )


@app.post("/paychat/broadcast-offer", response_model=KeyvaultResponse)
async def broadcast_paychat_offer(request: BroadcastPayChatOfferRequest):
    """
    Broadcast a signed PayChat offer on-chain.

    Called when the recipient responds (accepts the offer).
    The spend bundle was previously signed by the sender.
    """
    try:
        if paychat_driver.node_client is None and driver.node_client:
            await paychat_driver.init(driver.node_client)

        result = await paychat_driver.broadcast_offer(
            coin_spends_json=request.coin_spends_json,
            signature_hex=request.signature_hex,
        )

        return KeyvaultResponse(
            success=True,
            message="PayChat offer broadcast successfully",
            data=result,
        )
    except Exception as e:
        import traceback
        logger.error(f"Broadcast PayChat offer error: {e}\n{traceback.format_exc()}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to broadcast PayChat offer: {str(e)}",
        )


@app.post("/paychat/check-coins", response_model=KeyvaultResponse)
async def check_offer_coins(request: CheckOfferCoinsRequest):
    """
    Check if an offer's coins are still unspent (offer still valid).
    """
    try:
        if paychat_driver.node_client is None and driver.node_client:
            await paychat_driver.init(driver.node_client)

        valid = await paychat_driver.check_coins_unspent(request.coin_ids)

        return KeyvaultResponse(
            success=True,
            message="Offer is valid" if valid else "Offer is invalid (coins spent)",
            data={"valid": valid},
        )
    except Exception as e:
        logger.error(f"Check offer coins error: {e}")
        return KeyvaultResponse(
            success=False,
            message=f"Failed to check offer coins: {str(e)}",
        )
