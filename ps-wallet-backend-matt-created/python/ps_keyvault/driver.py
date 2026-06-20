"""
PinkSurfing KeyVault Driver

Manages on-chain KeyVault singletons on the Chia blockchain.
Adapted from mothsoft/solslot-backend branch 40 driver.py.

Handles:
  - Singleton deployment (create new KeyVault)
  - Backup updates (spend singleton to commit new encrypted backup CID)
  - Key rotation (transfer ownership to new pubkey)
  - Recovery (scan chain for singleton, read state, extract CIDs)
  - Merkle tree construction for backup version history
"""

import hashlib
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from chia.consensus.default_constants import DEFAULT_CONSTANTS
from chia.rpc.rpc_client import RpcClient
from chia.types.blockchain_format.coin import Coin
from chia.types.blockchain_format.program import Program
from chia.types.coin_spend import CoinSpend
from chia.util.bech32m import decode_puzzle_hash, encode_puzzle_hash
from chia.util.hash import std_hash
from chia.wallet.conditions import (
    AssertCoinAnnouncement,
    CreateCoin,
)
from chia.wallet.lineage_proof import LineageProof
from chia.wallet.puzzles.load_clvm import load_clvm
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import (
    DEFAULT_HIDDEN_PUZZLE_HASH,
    calculate_synthetic_secret_key,
    puzzle_for_pk,
    puzzle_hash_for_synthetic_public_key,
)
from chia.wallet.puzzles.singleton_top_layer_v1_1 import (
    SINGLETON_LAUNCHER,
    SINGLETON_LAUNCHER_HASH,
    SINGLETON_MOD_HASH,
    lineage_proof_for_coinsol,
    puzzle_for_singleton,
    solution_for_singleton,
)
from chia.wallet.util.merkle_tree import MerkleTree
from chia.wallet.util.merkle_utils import build_merkle_tree
from chia.wallet.wallet import Wallet
from chia_rs import (
    CoinRecord,
    CoinSpend as RsCoinSpend,
    G1Element,
    G2Element,
    PrivateKey,
    Program as RsProgram,
    SpendBundle,
)
from chia_rs.sized_bytes import bytes32
from chia_rs.sized_ints import uint16, uint32, uint64

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


# ── chia 2.6.0 compatibility shims ──────────────────────────────────
def make_spend(coin, puzzle_reveal, solution) -> CoinSpend:
    """Replacement for removed chia.types.coin_spend.make_spend."""
    pr = RsProgram.from_bytes(bytes(puzzle_reveal)) if not isinstance(puzzle_reveal, RsProgram) else puzzle_reveal
    sol = RsProgram.from_bytes(bytes(solution)) if not isinstance(solution, RsProgram) else solution
    return CoinSpend(coin, pr, sol)


def compute_additions(coin_spend) -> list:
    """Replacement for removed chia.types.coin_spend.compute_additions.
    Wraps the single CoinSpend in a SpendBundle and calls .additions()."""
    sb = SpendBundle([coin_spend], G2Element())
    return list(sb.additions())


# Constants
MAX_COIN_AMOUNT = DEFAULT_CONSTANTS.MAX_COIN_AMOUNT
SINGLETON_AMOUNT = uint64(1)

# Load compiled Chialisp puzzles
KEYVAULT_INNER: Program = load_clvm(
    "keyvault_inner.clsp",
    package_or_requirement="ps_keyvault.clsp",
    recompile=True,
)

P2_KEYVAULT: Program = load_clvm(
    "p2_keyvault.clsp",
    package_or_requirement="ps_keyvault.clsp",
    recompile=True,
)

# Retry configuration
BACKOFF_RETRY_COUNT = int(os.environ.get("BACKOFF_RETRY_COUNT", 25))
BACKOFF_RETRY_WAIT_SECS = float(os.environ.get("BACKOFF_RETRY_WAIT_SECS", 1))


def lineage_proof_for_custom_coinsol(coin_spend: CoinSpend) -> LineageProof:
    """Extract lineage proof from a coin spend for singleton continuity."""
    parent_coin = coin_spend.coin
    inner_puzzle_hash = Program.from_bytes(bytes(coin_spend.solution)).at("rrf").get_tree_hash()
    return LineageProof(
        parent_name=parent_coin.parent_coin_info,
        inner_puzzle_hash=inner_puzzle_hash,
        amount=uint64(parent_coin.amount),
    )


class KeyVaultDriver:
    """
    Driver for PinkSurfing KeyVault on-chain singletons.

    Each KeyVault is a Chia singleton that stores:
      - Owner's BLS public key
      - Merkle root of all backup version CID hashes
      - Backup count
      - Hash of the latest IPFS CID

    The singleton can only be spent (updated) by the owner via BLS signature.
    """

    def __init__(self):
        self.node_client: Optional[RpcClient] = None
        self.wallet_client: Optional[RpcClient] = None
        self.prefix = "xch"

    async def init(
        self,
        node_client: RpcClient,
        wallet_client: Optional[RpcClient] = None,
    ):
        """Initialize with RPC clients."""
        self.node_client = node_client
        self.wallet_client = wallet_client
        logger.info("KeyVault driver initialized")

    async def _fetch_rpc(self, endpoint: str, data: dict) -> dict:
        """Make an RPC call. Uses standard SSL for remote (coinset.org) connections."""
        use_remote = os.environ.get("CHIA_USE_REMOTE", "false").lower() == "true"
        if use_remote:
            import aiohttp
            import ssl as _ssl
            ssl_ctx = _ssl.create_default_context()
            url = os.environ.get("CHIA_RPC_URL", "https://api.coinset.org")
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{url}/{endpoint}", json=data, ssl=ssl_ctx
                ) as resp:
                    return await resp.json()
        else:
            return await self.node_client.fetch(endpoint, data)

    async def close(self):
        """Close RPC clients."""
        if self.node_client:
            self.node_client.close()
            await self.node_client.await_closed()
        if self.wallet_client:
            self.wallet_client.close()
            await self.wallet_client.await_closed()

    # ─── RPC Helper Methods ──────────────────────────────────────
    # These wrap _fetch_rpc to provide the same API as FullNodeRpcClient
    # since we use the base RpcClient which lacks convenience methods.

    @staticmethod
    def _strip_0x(h: str) -> str:
        """Strip 0x prefix from hex strings if present."""
        return h[2:] if h.startswith("0x") or h.startswith("0X") else h

    @staticmethod
    def _parse_coin_record(cr_dict: dict):
        """Parse a coin record JSON dict into a simple object with .coin, .spent, .spent_block_index."""
        class _CoinRecord:
            def __init__(self, d):
                coin_d = d.get("coin", {})
                strip = KeyVaultDriver._strip_0x
                self.coin = Coin(
                    bytes.fromhex(strip(coin_d["parent_coin_info"])),
                    bytes.fromhex(strip(coin_d["puzzle_hash"])),
                    int(coin_d["amount"]),
                )
                self.spent = d.get("spent", False)
                self.spent_block_index = d.get("spent_block_index", 0)
                self.confirmed_block_index = d.get("confirmed_block_index", 0)
                self.timestamp = d.get("timestamp", 0)
        return _CoinRecord(cr_dict)

    async def _get_coin_record_by_name(self, coin_id) -> Optional[Any]:
        """Fetch a coin record by its name (coin ID)."""
        name_hex = coin_id.hex() if isinstance(coin_id, bytes) else self._strip_0x(str(coin_id))
        resp = await self._fetch_rpc("get_coin_record_by_name", {"name": name_hex})
        if resp.get("coin_record"):
            return self._parse_coin_record(resp["coin_record"])
        return None

    async def _get_puzzle_and_solution(self, coin_id, height: int):
        """Fetch the puzzle and solution for a spent coin."""
        name_hex = coin_id.hex() if isinstance(coin_id, bytes) else self._strip_0x(str(coin_id))
        resp = await self._fetch_rpc("get_puzzle_and_solution", {
            "coin_id": name_hex,
            "height": height,
        })
        cs = resp.get("coin_solution")
        if not cs:
            return None
        # Manually construct CoinSpend — coinset.org returns 0x-prefixed hex
        coin_d = cs.get("coin", {})
        coin = Coin(
            bytes.fromhex(self._strip_0x(coin_d["parent_coin_info"])),
            bytes.fromhex(self._strip_0x(coin_d["puzzle_hash"])),
            int(coin_d["amount"]),
        )
        from chia.types.blockchain_format.serialized_program import SerializedProgram
        puzzle_reveal = SerializedProgram.from_bytes(bytes.fromhex(self._strip_0x(cs["puzzle_reveal"])))
        solution = SerializedProgram.from_bytes(bytes.fromhex(self._strip_0x(cs["solution"])))
        return CoinSpend(coin, puzzle_reveal, solution)

    async def _push_tx(self, spend_bundle):
        """Push a transaction (spend bundle) to the mempool."""
        resp = await self._fetch_rpc("push_tx", {
            "spend_bundle": spend_bundle.to_json_dict(),
        })
        return resp

    async def _get_aggsig_additional_data(self):
        """Get the AGG_SIG_ME additional data (genesis challenge)."""
        try:
            resp = await self._fetch_rpc("get_blockchain_state", {})
            gc = resp.get("blockchain_state", {}).get("genesis_challenge_initialized")
            if gc:
                return bytes.fromhex(gc)
        except Exception:
            pass
        return DEFAULT_CONSTANTS.AGG_SIG_ME_ADDITIONAL_DATA

    async def _get_coin_records_by_puzzle_hash(self, puzzle_hash, include_spent_coins=True):
        """Fetch coin records by puzzle hash."""
        ph_hex = puzzle_hash.hex() if isinstance(puzzle_hash, bytes) else str(puzzle_hash)
        resp = await self._fetch_rpc("get_coin_records_by_puzzle_hash", {
            "puzzle_hash": ph_hex,
            "include_spent_coins": include_spent_coins,
        })
        if resp.get("coin_records"):
            return [self._parse_coin_record(cr) for cr in resp["coin_records"]]
        return []


    # ─── Puzzle Construction ────────────────────────────────────────────

    def build_keyvault_inner_puzzle(
        self,
        launcher_id: bytes32,
        owner_pubkey: G1Element,
        backups_merkle_root: bytes32,
        backup_count: int,
        latest_cid_hash: bytes32,
    ) -> Program:
        """
        Build the KeyVault inner puzzle with curried arguments.

        Args:
            launcher_id: The singleton launcher ID
            owner_pubkey: Owner's BLS public key
            backups_merkle_root: Merkle root of backup CID hashes
            backup_count: Number of backup versions
            latest_cid_hash: SHA256 hash of the latest IPFS CID string
        """
        singleton_struct = (SINGLETON_MOD_HASH, (launcher_id, SINGLETON_LAUNCHER_HASH))

        inner_puzzle = KEYVAULT_INNER.curry(
            KEYVAULT_INNER.get_tree_hash(),  # KEYVAULT_MOD_HASH
            singleton_struct,
            owner_pubkey,
            backups_merkle_root,
            backup_count,
            latest_cid_hash,
        )
        return inner_puzzle

    def build_keyvault_full_puzzle(
        self,
        launcher_id: bytes32,
        inner_puzzle: Program,
    ) -> Program:
        """Wrap inner puzzle in singleton top layer."""
        return puzzle_for_singleton(launcher_id, inner_puzzle)

    # ─── Merkle Tree for Backup Versions ────────────────────────────────

    @staticmethod
    def cid_to_hash(cid: str) -> bytes32:
        """Convert an IPFS CID string to a bytes32 hash for Merkle tree."""
        return bytes32(hashlib.sha256(cid.encode("utf-8")).digest())

    @staticmethod
    def build_backup_merkle_tree(cid_hashes: List[bytes32]) -> Tuple[bytes32, MerkleTree]:
        """
        Build a Merkle tree from a list of backup CID hashes.

        Returns:
            (merkle_root, merkle_tree) tuple
        """
        if not cid_hashes:
            # Empty tree: use a zero hash as root
            return bytes32(b"\x00" * 32), None

        tree = MerkleTree(cid_hashes, waterfall=True)
        root = tree.calculate_root()
        return root, tree

    @staticmethod
    def generate_merkle_proof(
        tree: MerkleTree, leaf: bytes32
    ) -> Tuple[int, List[bytes32]]:
        """Generate a Merkle proof for a specific backup CID hash."""
        return tree.generate_proof(leaf)

    # ─── Singleton Deployment ───────────────────────────────────────────

    async def deploy_keyvault(
        self,
        owner_pubkey: G1Element,
        initial_cid: str,
        funding_coin: Coin,
        fee_amount: int = 0,
    ) -> bytes32:
        """
        Deploy a new KeyVault singleton on-chain.

        Args:
            owner_pubkey: Owner's BLS public key
            initial_cid: IPFS CID of the initial encrypted backup
            funding_coin: Coin to fund the singleton creation
            fee_amount: Transaction fee in mojos

        Returns:
            launcher_id (bytes32) of the new KeyVault singleton
        """
        # Build initial state
        initial_cid_hash = self.cid_to_hash(initial_cid)
        cid_hashes = [initial_cid_hash]
        merkle_root, _ = self.build_backup_merkle_tree(cid_hashes)

        # Create launcher coin
        launcher_coin = Coin(
            funding_coin.name(),
            SINGLETON_LAUNCHER_HASH,
            SINGLETON_AMOUNT,
        )
        launcher_id = launcher_coin.name()

        # Build inner puzzle with initial state
        inner_puzzle = self.build_keyvault_inner_puzzle(
            launcher_id=launcher_id,
            owner_pubkey=owner_pubkey,
            backups_merkle_root=merkle_root,
            backup_count=1,
            latest_cid_hash=initial_cid_hash,
        )

        # Build full singleton puzzle
        full_puzzle = self.build_keyvault_full_puzzle(launcher_id, inner_puzzle)
        puzzle_hash = full_puzzle.get_tree_hash()

        # Create launcher solution
        # extra_data stores recovery info: [owner_pubkey, initial_cid_hash]
        extra_data = Program.to([bytes(owner_pubkey), initial_cid_hash])
        genesis_launcher_solution = Program.to([puzzle_hash, SINGLETON_AMOUNT, extra_data])

        # Build spend for funding coin
        change_amount = funding_coin.amount - fee_amount - SINGLETON_AMOUNT
        assert change_amount >= 0, f"Insufficient funds: {funding_coin.amount} < {fee_amount + SINGLETON_AMOUNT}"

        primaries = []
        if change_amount > 0:
            primaries.append(
                CreateCoin(funding_coin.puzzle_hash, change_amount, [funding_coin.puzzle_hash])
            )
        primaries.append(
            CreateCoin(SINGLETON_LAUNCHER_HASH, SINGLETON_AMOUNT, [])
        )

        # Announcement for launcher
        message_program = Program.to([puzzle_hash, SINGLETON_AMOUNT, []])
        announcement = AssertCoinAnnouncement(
            asserted_msg=message_program.get_tree_hash(),
            asserted_id=launcher_coin.name(),
        )

        wallet = Wallet()
        funding_solution = wallet.make_solution(
            primaries=primaries,
            fee=fee_amount,
            conditions=(announcement,),
        )

        # Get puzzle for funding coin
        funding_puzzle = await self.puzzle_for_coin(funding_coin)

        funding_spend = make_spend(funding_coin, funding_puzzle, funding_solution)
        launcher_spend = make_spend(launcher_coin, SINGLETON_LAUNCHER, genesis_launcher_solution)

        # Sign and push
        spend_bundle = await self._sign_coin_spends([funding_spend, launcher_spend])

        status = await self._push_tx(spend_bundle)
        logger.info(f"KeyVault deploy tx status: {status}")

        if status and status.get("success"):
            logger.info(f"KeyVault deployed! Launcher ID: 0x{launcher_id.hex()}")
            return launcher_id

        raise RuntimeError(f"Failed to deploy KeyVault singleton: {status}")

    async def deploy_keyvault_server_funded(
        self,
        server_master_sk: PrivateKey,
        owner_pubkey: G1Element,
        initial_cid: str,
        fee_amount: int = 0,
    ) -> bytes32:
        """
        Deploy a new KeyVault singleton funded by the server's wallet.

        Like deploy_keyvault, but uses the server's own key to fund the
        singleton creation. No external funding coin is needed.
        """
        from chia.wallet.derive_keys import master_sk_to_wallet_sk_unhardened

        # 1. Derive wallet key (index 0 = first wallet address)
        wallet_sk = master_sk_to_wallet_sk_unhardened(server_master_sk, uint32(0))
        wallet_pk = wallet_sk.get_g1()
        funding_puzzle = puzzle_for_pk(wallet_pk)
        funding_puzzle_hash = funding_puzzle.get_tree_hash()

        logger.info(f"Server wallet: {encode_puzzle_hash(funding_puzzle_hash, self.prefix)}")

        # 2. Find unspent coins in the server wallet
        resp = await self._fetch_rpc("get_coin_records_by_puzzle_hash", {
            "puzzle_hash": "0x" + funding_puzzle_hash.hex(),
            "include_spent_coins": False,
        })
        coin_records = resp.get("coin_records", [])
        if not coin_records:
            raise ValueError("No spendable coins in server wallet. Send XCH first.")

        # Pick largest coin
        best = max(coin_records, key=lambda r: r["coin"]["amount"])
        funding_coin = Coin.from_json_dict(best["coin"])
        required = SINGLETON_AMOUNT + fee_amount
        if funding_coin.amount < required:
            raise ValueError(f"Insufficient: {funding_coin.amount} mojos, need {required}")

        logger.info(f"Funding coin: {funding_coin.name().hex()} ({funding_coin.amount} mojos)")

        # 3. Build singleton deployment (mirrors deploy_keyvault logic)
        initial_cid_hash = self.cid_to_hash(initial_cid)
        cid_hashes = [initial_cid_hash]
        merkle_root, _ = self.build_backup_merkle_tree(cid_hashes)

        launcher_coin = Coin(funding_coin.name(), SINGLETON_LAUNCHER_HASH, SINGLETON_AMOUNT)
        launcher_id = launcher_coin.name()

        inner_puzzle = self.build_keyvault_inner_puzzle(
            launcher_id=launcher_id,
            owner_pubkey=owner_pubkey,
            backups_merkle_root=merkle_root,
            backup_count=1,
            latest_cid_hash=initial_cid_hash,
        )
        full_puzzle = self.build_keyvault_full_puzzle(launcher_id, inner_puzzle)
        target_ph = full_puzzle.get_tree_hash()

        # Launcher solution with recovery data
        extra_data = Program.to([bytes(owner_pubkey), initial_cid_hash])
        genesis_launcher_solution = Program.to([target_ph, SINGLETON_AMOUNT, extra_data])

        # Funding coin conditions
        change_amount = funding_coin.amount - fee_amount - SINGLETON_AMOUNT
        assert change_amount >= 0, "Insufficient funds for deploy"

        conditions = []
        if change_amount > 0:
            conditions.append([51, funding_coin.puzzle_hash, change_amount])
        conditions.append([51, SINGLETON_LAUNCHER_HASH, SINGLETON_AMOUNT])
        if fee_amount > 0:
            conditions.append([52, fee_amount])

        # Assert launcher coin announcement (must match full launcher solution hash)
        ann_hash = std_hash(launcher_coin.name() + genesis_launcher_solution.get_tree_hash())
        conditions.append([61, ann_hash])

        # p2_delegated_puzzle_or_hidden_puzzle solution: ((), delegated_puzzle, ())
        delegated_puzzle = Program.to((1, conditions))
        funding_solution = Program.to([[], delegated_puzzle, []])

        funding_spend = make_spend(funding_coin, funding_puzzle, funding_solution)
        launcher_spend = make_spend(launcher_coin, SINGLETON_LAUNCHER, genesis_launcher_solution)

        # 4. Sign funding coin spend with server's synthetic key
        synthetic_sk = calculate_synthetic_secret_key(wallet_sk, DEFAULT_HIDDEN_PUZZLE_HASH)
        sig = synthetic_sk.sign(
            delegated_puzzle.get_tree_hash()
            + funding_coin.name()
            + DEFAULT_CONSTANTS.AGG_SIG_ME_ADDITIONAL_DATA
        )

        spend_bundle = SpendBundle([funding_spend, launcher_spend], sig)

        # 5. Push transaction
        push_result = await self._fetch_rpc("push_tx", {
            "spend_bundle": spend_bundle.to_json_dict(),
        })
        logger.info(f"Server-funded deploy result: {push_result}")

        if push_result and push_result.get("success"):
            logger.info(f"KeyVault deployed! Launcher: 0x{launcher_id.hex()}")
            return launcher_id

        raise RuntimeError(f"push_tx failed: {push_result}")

    # ─── Vault (p2_keyvault) Operations ──────────────────────────────────

    def build_p2_keyvault_puzzle(self, launcher_id: bytes32) -> Program:
        """
        Build the p2_keyvault puzzle for a given vault launcher ID.
        Anyone can send XCH to this puzzle hash to deposit into the vault.
        Only the vault owner can withdraw (via singleton authorization).
        """
        return P2_KEYVAULT.curry(
            SINGLETON_MOD_HASH,
            launcher_id,
            SINGLETON_LAUNCHER_HASH,
        )

    def get_vault_puzzle_hash(self, launcher_id: bytes32) -> bytes32:
        """Get the puzzle hash for the vault's deposit address."""
        p2_puzzle = self.build_p2_keyvault_puzzle(launcher_id)
        return p2_puzzle.get_tree_hash()

    def get_vault_address(self, launcher_id: bytes32) -> str:
        """Get the bech32m deposit address for the vault."""
        ph = self.get_vault_puzzle_hash(launcher_id)
        return encode_puzzle_hash(ph, self.prefix)

    async def get_vault_balance(self, launcher_id: bytes32) -> Dict[str, Any]:
        """
        Query unspent p2_keyvault coins for a vault.

        Returns:
            Dict with 'total_balance' (mojos), 'coin_count', and 'coins' list.
        """
        p2_ph = self.get_vault_puzzle_hash(launcher_id)

        resp = await self._fetch_rpc("get_coin_records_by_puzzle_hash", {
            "puzzle_hash": "0x" + p2_ph.hex(),
            "include_spent_coins": False,
        })

        coin_records = resp.get("coin_records", [])
        total = sum(r["coin"]["amount"] for r in coin_records)

        return {
            "total_balance": total,
            "coin_count": len(coin_records),
            "coins": [
                {
                    "coin_id": Coin.from_json_dict(r["coin"]).name().hex(),
                    "amount": r["coin"]["amount"],
                    "parent_coin_info": r["coin"]["parent_coin_info"],
                    "puzzle_hash": r["coin"]["puzzle_hash"],
                }
                for r in coin_records
            ],
            "deposit_address": self.get_vault_address(launcher_id),
        }

    async def withdraw_from_vault(
        self,
        launcher_id: bytes32,
        owner_pubkey: G1Element,
        owner_sk: PrivateKey,
        destination_puzzle_hash: bytes32,
        amount: int,
        current_cid_hashes: List[bytes32],
        fee_amount: int = 0,
    ) -> Dict[str, Any]:
        """
        Legacy: server-side signed withdrawal. Only for server-funded vaults.
        For user-owned vaults, use prepare_withdraw + submit_signed.
        """
        prepared = await self.prepare_withdraw(
            launcher_id=launcher_id,
            owner_pubkey=owner_pubkey,
            destination_puzzle_hash=destination_puzzle_hash,
            amount=amount,
            current_cid_hashes=current_cid_hashes,
            fee_amount=fee_amount,
        )

        # Sign with raw key (matches OWNER_PUBKEY in puzzle)
        msg = bytes.fromhex(prepared["signing_message_hex"])
        sig = owner_sk.sign(msg)

        await self.submit_signed(
            coin_spends_json=prepared["coin_spends_json"],
            signature_hex=bytes(sig).hex(),
        )

        return {
            "success": True,
            "amount": prepared["amount"],
            "fee": prepared["fee"],
            "destination": prepared["destination"],
            "coins_spent": prepared["coins_spent"],
        }

    async def withdraw_from_vault_server_funded(
        self,
        server_master_sk: PrivateKey,
        launcher_id: bytes32,
        owner_pubkey: G1Element,
        destination_puzzle_hash: bytes32,
        amount: int,
        current_cid_hashes: List[bytes32],
        fee_amount: int = 0,
    ) -> Dict[str, Any]:
        """
        Withdraw XCH from a server-deployed vault.

        Like withdraw_from_vault but the server signs as the owner since
        server-funded vaults use the server's key as the initial owner.
        The server's wallet SK is derived and used for the AGG_SIG_ME.
        """
        from chia.wallet.derive_keys import master_sk_to_wallet_sk_unhardened

        # For server-funded vaults, the owner key matches the server's master PK
        # but signing needs the actual wallet SK path
        wallet_sk = master_sk_to_wallet_sk_unhardened(server_master_sk, uint32(0))

        return await self.withdraw_from_vault(
            launcher_id=launcher_id,
            owner_pubkey=owner_pubkey,
            owner_sk=wallet_sk,
            destination_puzzle_hash=destination_puzzle_hash,
            amount=amount,
            current_cid_hashes=current_cid_hashes,
            fee_amount=fee_amount,
        )

    async def send_to_vault(
        self,
        server_master_sk: PrivateKey,
        launcher_id: bytes32,
        amount: int,
        fee_amount: int = 0,
    ) -> Dict[str, Any]:
        """
        Send XCH from the server wallet to the vault deposit address.

        Builds a standard p2_delegated_puzzle_or_hidden_puzzle spend from
        the server's wallet coin(s) to the vault's p2_keyvault puzzle hash.
        This is a normal XCH send — no singleton interaction needed for deposits.
        """
        from chia.wallet.derive_keys import master_sk_to_wallet_sk_unhardened

        wallet_sk = master_sk_to_wallet_sk_unhardened(server_master_sk, uint32(0))
        wallet_pk = wallet_sk.get_g1()
        wallet_puzzle = puzzle_for_pk(wallet_pk)
        wallet_puzzle_hash = wallet_puzzle.get_tree_hash()

        vault_puzzle_hash = self.get_vault_puzzle_hash(launcher_id)

        # Find unspent coins in server wallet
        resp = await self._fetch_rpc("get_coin_records_by_puzzle_hash", {
            "puzzle_hash": "0x" + wallet_puzzle_hash.hex(),
            "include_spent_coins": False,
        })
        coin_records = resp.get("coin_records", [])
        if not coin_records:
            raise ValueError("No spendable coins in server wallet")

        # Select coins to cover amount + fee
        total_needed = amount + fee_amount
        coins_sorted = sorted(coin_records, key=lambda r: r["coin"]["amount"], reverse=True)

        selected_coins = []
        selected_total = 0
        for cr in coins_sorted:
            coin = Coin.from_json_dict(cr["coin"])
            selected_coins.append(coin)
            selected_total += coin.amount
            if selected_total >= total_needed:
                break

        if selected_total < total_needed:
            raise ValueError(
                f"Insufficient wallet balance: {selected_total} mojos, need {total_needed}"
            )

        change_amount = selected_total - total_needed

        # Build conditions: send to vault + change back to wallet
        conditions = [
            [51, vault_puzzle_hash, amount],  # CREATE_COIN → vault
        ]
        if change_amount > 0:
            conditions.append([51, wallet_puzzle_hash, change_amount])  # change
        if fee_amount > 0:
            conditions.append([52, fee_amount])  # RESERVE_FEE

        # Build spends for each selected coin
        synthetic_sk = calculate_synthetic_secret_key(wallet_sk, DEFAULT_HIDDEN_PUZZLE_HASH)
        coin_spends = []
        sigs = []

        for i, coin in enumerate(selected_coins):
            if i == 0:
                # First coin carries all conditions
                delegated_puzzle = Program.to((1, conditions))
            else:
                # Additional coins just assert first coin announcement
                delegated_puzzle = Program.to((1, []))

            solution = Program.to([[], delegated_puzzle, []])
            coin_spends.append(make_spend(coin, wallet_puzzle, solution))

            sig = synthetic_sk.sign(
                delegated_puzzle.get_tree_hash()
                + coin.name()
                + DEFAULT_CONSTANTS.AGG_SIG_ME_ADDITIONAL_DATA
            )
            sigs.append(sig)

        from functools import reduce
        from operator import add
        agg_sig = reduce(add, sigs)

        spend_bundle = SpendBundle(coin_spends, agg_sig)

        push_result = await self._fetch_rpc("push_tx", {
            "spend_bundle": spend_bundle.to_json_dict(),
        })

        if not push_result or not push_result.get("success"):
            raise RuntimeError(f"push_tx failed: {push_result}")

        vault_address = encode_puzzle_hash(vault_puzzle_hash, self.prefix)
        wallet_address = encode_puzzle_hash(wallet_puzzle_hash, self.prefix)

        logger.info(f"Sent {amount} mojos from wallet to vault {vault_address}")

        return {
            "amount": amount,
            "fee": fee_amount,
            "vault_address": vault_address,
            "wallet_address": wallet_address,
            "coins_spent": len(selected_coins),
        }

    # ─── Singleton Spending (Prepare / Submit) ──────────────────────────
    # Follows solslot's 2-step pattern: server prepares unsigned spend,
    # client signs locally, client submits signature back.
    # Private key NEVER leaves the client device.

    async def prepare_update(
        self,
        launcher_id: bytes32,
        owner_pubkey: G1Element,
        current_cid_hashes: List[bytes32],
        new_cid: str,
        fee_amount: int = 0,
    ) -> Dict[str, Any]:
        """
        Prepare an unsigned KeyVault update spend.

        Builds the coin spend and computes the exact message the client
        must sign with their BLS key. No private key needed server-side.

        Returns:
            Dict with 'coin_spends' (serialized), 'signing_message_hex',
            'backup_count', 'new_cid'.
        """
        new_cid_hash = self.cid_to_hash(new_cid)

        # Build new Merkle tree with the additional CID
        all_cid_hashes = current_cid_hashes + [new_cid_hash]
        new_merkle_root, _ = self.build_backup_merkle_tree(all_cid_hashes)
        new_backup_count = len(all_cid_hashes)

        # Build current state puzzle
        current_merkle_root, _ = self.build_backup_merkle_tree(current_cid_hashes)
        current_inner = self.build_keyvault_inner_puzzle(
            launcher_id=launcher_id,
            owner_pubkey=owner_pubkey,
            backups_merkle_root=current_merkle_root,
            backup_count=len(current_cid_hashes),
            latest_cid_hash=current_cid_hashes[-1],
        )

        # Find current singleton coin
        current_coin, lineage_proof = await self._find_current_singleton(launcher_id, current_inner)

        # Build inner solution for update
        inner_solution = Program.to([
            current_coin.name(),              # my_id
            current_inner.get_tree_hash(),     # my_inner_puzzlehash
            current_coin.amount,               # my_amount
            "u",                               # spend_case = update
            [new_merkle_root, new_backup_count, new_cid_hash],  # args
        ])

        # Build full singleton solution
        singleton_solution = Program.to([
            lineage_proof.to_program(),
            current_coin.amount,
            inner_solution,
        ])

        # Build full puzzle and create spend
        full_puzzle = self.build_keyvault_full_puzzle(launcher_id, current_inner)
        coin_spend = make_spend(current_coin, full_puzzle, singleton_solution)

        # Compute the exact AGG_SIG_ME message the client must sign.
        # keyvault_inner.clsp: (AGG_SIG_ME OWNER_PUBKEY (sha256 my_id new_cid_hash))
        # AGG_SIG_ME verification: sig.verify(pk, msg || coin_id || AGG_SIG_ME_ADDITIONAL_DATA)
        # So full_signing_message = sha256(coin_id, new_cid_hash) || coin_id || aggsig_data
        aggsig_msg = std_hash(current_coin.name() + new_cid_hash)
        aggsig_data = await self._get_aggsig_additional_data()
        full_signing_message = aggsig_msg + current_coin.name() + aggsig_data

        # Serialize coin spend for transport
        sb_unsigned = SpendBundle([coin_spend], G2Element())

        return {
            "coin_spends_json": sb_unsigned.to_json_dict()["coin_spends"],
            "signing_message_hex": full_signing_message.hex(),
            "backup_count": new_backup_count,
            "new_cid": new_cid,
        }

    async def prepare_transfer(
        self,
        launcher_id: bytes32,
        current_owner_pubkey: G1Element,
        new_owner_pubkey: G1Element,
        current_state: dict,
        fee_amount: int = 0,
    ) -> Dict[str, Any]:
        """
        Prepare an unsigned KeyVault ownership transfer spend.

        Returns:
            Dict with 'coin_spends_json', 'signing_message_hex'.
        """
        current_inner = self.build_keyvault_inner_puzzle(
            launcher_id=launcher_id,
            owner_pubkey=current_owner_pubkey,
            backups_merkle_root=current_state["backups_merkle_root"],
            backup_count=current_state["backup_count"],
            latest_cid_hash=current_state["latest_cid_hash"],
        )

        current_coin, lineage_proof = await self._find_current_singleton(launcher_id, current_inner)

        inner_solution = Program.to([
            current_coin.name(),
            current_inner.get_tree_hash(),
            current_coin.amount,
            "t",  # spend_case = transfer
            [bytes(new_owner_pubkey)],
        ])

        singleton_solution = Program.to([
            lineage_proof.to_program(),
            current_coin.amount,
            inner_solution,
        ])

        full_puzzle = self.build_keyvault_full_puzzle(launcher_id, current_inner)
        coin_spend = make_spend(current_coin, full_puzzle, singleton_solution)

        # keyvault_inner.clsp: (AGG_SIG_ME OWNER_PUBKEY (sha256 my_id (f args)))
        # (f args) = new_owner_pubkey
        aggsig_msg = std_hash(current_coin.name() + bytes(new_owner_pubkey))
        aggsig_data = await self._get_aggsig_additional_data()
        full_signing_message = aggsig_msg + current_coin.name() + aggsig_data

        sb_unsigned = SpendBundle([coin_spend], G2Element())

        return {
            "coin_spends_json": sb_unsigned.to_json_dict()["coin_spends"],
            "signing_message_hex": full_signing_message.hex(),
        }

    async def prepare_withdraw(
        self,
        launcher_id: bytes32,
        owner_pubkey: G1Element,
        destination_puzzle_hash: bytes32,
        amount: int,
        current_cid_hashes: List[bytes32],
        fee_amount: int = 0,
    ) -> Dict[str, Any]:
        """
        Prepare an unsigned vault withdrawal spend.

        Builds singleton spend (case 's') + p2_keyvault spends,
        returns the unsigned coin spends and the message to sign.

        Returns:
            Dict with 'coin_spends_json', 'signing_message_hex',
            'amount', 'fee', 'destination', 'coins_spent'.
        """
        # 1. Get vault p2 coins
        balance_info = await self.get_vault_balance(launcher_id)
        if balance_info["total_balance"] < amount + fee_amount:
            raise ValueError(
                f"Insufficient vault balance: {balance_info['total_balance']} mojos, "
                f"need {amount + fee_amount}"
            )

        # Select coins to spend (greedy, largest first)
        p2_ph = self.get_vault_puzzle_hash(launcher_id)
        resp = await self._fetch_rpc("get_coin_records_by_puzzle_hash", {
            "puzzle_hash": "0x" + p2_ph.hex(),
            "include_spent_coins": False,
        })
        coin_records = sorted(
            resp.get("coin_records", []),
            key=lambda r: r["coin"]["amount"],
            reverse=True,
        )

        selected_coins = []
        selected_total = 0
        for r in coin_records:
            coin = Coin.from_json_dict(r["coin"])
            selected_coins.append(coin)
            selected_total += coin.amount
            if selected_total >= amount + fee_amount:
                break

        if selected_total < amount + fee_amount:
            raise ValueError("Could not select enough coins")

        # 2. Build current inner puzzle to find singleton
        current_merkle_root, _ = self.build_backup_merkle_tree(current_cid_hashes)
        current_inner = self.build_keyvault_inner_puzzle(
            launcher_id=launcher_id,
            owner_pubkey=owner_pubkey,
            backups_merkle_root=current_merkle_root,
            backup_count=len(current_cid_hashes),
            latest_cid_hash=current_cid_hashes[-1],
        )
        current_inner_ph = current_inner.get_tree_hash()

        # 3. Find current singleton coin
        current_coin, lineage_proof = await self._find_current_singleton(
            launcher_id, current_inner
        )

        # 4. Build delegated puzzles for each p2 coin
        change_amount = selected_total - amount - fee_amount
        spend_coin_list = []
        authorized_spends = []

        for i, p2_coin in enumerate(selected_coins):
            conditions = []
            if i == 0:
                if destination_puzzle_hash == p2_ph:
                    conditions.append([51, p2_ph, amount + change_amount])
                else:
                    conditions.append([51, destination_puzzle_hash, amount])
                    if change_amount > 0:
                        conditions.append([51, p2_ph, change_amount])
                if fee_amount > 0:
                    conditions.append([52, fee_amount])

            delegated_puzzle = Program.to((1, conditions))
            delegated_solution = Program.to([])

            authorized_spends.append(
                [p2_coin.name(), delegated_puzzle.get_tree_hash()]
            )
            spend_coin_list.append((p2_coin, delegated_puzzle, delegated_solution))

        # 5. Build singleton spend (case 's')
        singleton_solution_inner = Program.to([
            current_coin.name(),
            current_inner_ph,
            current_coin.amount,
            "s",
            authorized_spends,
        ])

        singleton_solution = solution_for_singleton(
            lineage_proof, current_coin.amount, singleton_solution_inner
        )

        full_puzzle = self.build_keyvault_full_puzzle(launcher_id, current_inner)
        singleton_spend = make_spend(current_coin, full_puzzle, singleton_solution)

        # 6. Build p2_keyvault spends
        p2_puzzle = self.build_p2_keyvault_puzzle(launcher_id)
        p2_spends = []

        for p2_coin, delegated_puzzle, delegated_solution in spend_coin_list:
            p2_solution = Program.to([
                current_inner_ph,
                p2_coin.name(),
                delegated_puzzle,
                delegated_solution,
            ])
            p2_spends.append(make_spend(p2_coin, p2_puzzle, p2_solution))

        # 7. Compute signing message
        # keyvault_inner.clsp: (AGG_SIG_ME OWNER_PUBKEY (sha256 my_id (sha256tree args)))
        aggsig_msg = std_hash(current_coin.name() + Program.to(authorized_spends).get_tree_hash())
        aggsig_data = await self._get_aggsig_additional_data()
        full_signing_message = aggsig_msg + current_coin.name() + aggsig_data

        all_spends = [singleton_spend] + p2_spends
        sb_unsigned = SpendBundle(all_spends, G2Element())

        return {
            "coin_spends_json": sb_unsigned.to_json_dict()["coin_spends"],
            "signing_message_hex": full_signing_message.hex(),
            "amount": amount,
            "fee": fee_amount,
            "destination": encode_puzzle_hash(destination_puzzle_hash, self.prefix),
            "coins_spent": len(selected_coins),
        }

    async def submit_signed(
        self,
        coin_spends_json: list,
        signature_hex: str,
    ) -> Dict[str, Any]:
        """
        Submit a client-signed spend bundle to the blockchain.

        Takes the unsigned coin spends (from prepare_*) and the client's
        BLS signature, constructs the final SpendBundle, and pushes it.

        Args:
            coin_spends_json: List of coin spend dicts (from prepare_* output)
            signature_hex: BLS G2Element signature hex from client

        Returns:
            Dict with push_tx result
        """
        # Reconstruct coin spends from JSON
        coin_spends = []
        for cs_dict in coin_spends_json:
            coin = Coin.from_json_dict(cs_dict["coin"])
            from chia.types.blockchain_format.serialized_program import SerializedProgram
            puzzle_reveal = SerializedProgram.from_bytes(
                bytes.fromhex(self._strip_0x(cs_dict["puzzle_reveal"]))
            )
            solution = SerializedProgram.from_bytes(
                bytes.fromhex(self._strip_0x(cs_dict["solution"]))
            )
            coin_spends.append(CoinSpend(coin, puzzle_reveal, solution))

        sig = G2Element.from_bytes(bytes.fromhex(signature_hex))
        spend_bundle = SpendBundle(coin_spends, sig)

        status = await self._push_tx(spend_bundle)
        logger.info(f"Submit signed tx status: {status}")

        if status and status.get("success"):
            return {"success": True, "status": status}

        raise RuntimeError(f"push_tx failed: {status}")

    # ─── Legacy methods (kept for server-funded vaults) ──────────────────

    async def update_backup(
        self,
        launcher_id: bytes32,
        owner_pubkey: G1Element,
        current_cid_hashes: List[bytes32],
        new_cid: str,
        owner_sk: PrivateKey,
        fee_amount: int = 0,
    ) -> bytes32:
        """
        Legacy: server-side signed update. Only for server-funded vaults.
        For user-owned vaults, use prepare_update + submit_signed.
        """
        prepared = await self.prepare_update(
            launcher_id=launcher_id,
            owner_pubkey=owner_pubkey,
            current_cid_hashes=current_cid_hashes,
            new_cid=new_cid,
            fee_amount=fee_amount,
        )

        # Sign with the provided key (raw — matches OWNER_PUBKEY in puzzle)
        msg = bytes.fromhex(prepared["signing_message_hex"])
        sig = owner_sk.sign(msg)

        result = await self.submit_signed(
            coin_spends_json=prepared["coin_spends_json"],
            signature_hex=bytes(sig).hex(),
        )
        return result

    async def transfer_ownership(
        self,
        launcher_id: bytes32,
        current_owner_pubkey: G1Element,
        new_owner_pubkey: G1Element,
        current_state: dict,
        owner_sk: PrivateKey,
        fee_amount: int = 0,
    ) -> bytes32:
        """
        Legacy: server-side signed transfer. Only for server-funded vaults.
        For user-owned vaults, use prepare_transfer + submit_signed.
        """
        prepared = await self.prepare_transfer(
            launcher_id=launcher_id,
            current_owner_pubkey=current_owner_pubkey,
            new_owner_pubkey=new_owner_pubkey,
            current_state=current_state,
            fee_amount=fee_amount,
        )

        # Sign with raw key (matches OWNER_PUBKEY in puzzle)
        msg = bytes.fromhex(prepared["signing_message_hex"])
        sig = owner_sk.sign(msg)

        result = await self.submit_signed(
            coin_spends_json=prepared["coin_spends_json"],
            signature_hex=bytes(sig).hex(),
        )
        return result

    # ─── Recovery: Scan Chain for KeyVault State ────────────────────────

    async def recover_keyvault(
        self, launcher_id: bytes32
    ) -> Optional[Dict[str, Any]]:
        """
        Recover KeyVault state by scanning the blockchain.

        Follows the singleton chain from launcher to current unspent coin,
        extracting the latest state from the inner puzzle.

        Args:
            launcher_id: The singleton launcher ID

        Returns:
            Dict with owner_pubkey, backups_merkle_root, backup_count,
            latest_cid_hash, all_cid_hashes (from solution history)
        """
        try:
            # Find the launcher coin record
            launcher_record = await self._get_coin_record_by_name(launcher_id)
            if launcher_record is None:
                logger.warning(f"KeyVault launcher not found: {launcher_id.hex()}")
                return None

            # Get launcher spend to extract initial state
            launcher_spend = await self._get_puzzle_and_solution(
                launcher_id, launcher_record.spent_block_index
            )
            launcher_sol = Program.from_bytes(bytes(launcher_spend.solution))

            # Extract initial extra_data: [owner_pubkey, initial_cid_hash]
            extra_data = launcher_sol.at("rrf")
            initial_owner_pubkey_bytes = extra_data.at("f").as_atom()
            initial_cid_hash = bytes32(extra_data.at("rf").as_atom())

            # Follow the singleton chain to find current state
            all_cid_hashes = [initial_cid_hash]
            current_coin_id = launcher_id
            owner_pubkey_bytes = initial_owner_pubkey_bytes

            while True:
                coin_record = await self._get_coin_record_by_name(current_coin_id)
                if coin_record is None:
                    break

                if not coin_record.spent:
                    # This is the current unspent singleton
                    break

                # Get the spend to extract state transitions
                coin_spend = await self._get_puzzle_and_solution(
                    current_coin_id, coin_record.spent_block_index
                )

                # Parse inner solution to find spend case and new state
                sol = Program.from_bytes(bytes(coin_spend.solution))
                try:
                    inner_sol = sol.at("rrf")  # lineage_proof, amount, inner_solution
                    spend_case = inner_sol.at("rrrf").as_atom().decode("utf-8")

                    if spend_case == "u":
                        # Update: extract new CID hash from args
                        args = inner_sol.at("rrrrf")
                        new_cid_hash = bytes32(args.at("rrf").as_atom())
                        all_cid_hashes.append(new_cid_hash)
                    elif spend_case == "t":
                        # Transfer: extract new owner pubkey
                        args = inner_sol.at("rrrrf")
                        owner_pubkey_bytes = args.at("f").as_atom()
                except Exception as e:
                    logger.debug(f"Could not parse spend at {current_coin_id.hex()}: {e}")

                # Find the next coin in the singleton chain
                additions = compute_additions(coin_spend)
                # The singleton child is the one with amount == 1
                next_coin = None
                for added in additions:
                    if added.amount == SINGLETON_AMOUNT:
                        next_coin = added
                        break

                if next_coin is None:
                    logger.warning("Singleton chain broken — no amount-1 child found")
                    break

                current_coin_id = next_coin.name()

            # Build current Merkle root from collected CID hashes
            merkle_root, _ = self.build_backup_merkle_tree(all_cid_hashes)

            return {
                "launcher_id": launcher_id.hex(),
                "owner_pubkey": owner_pubkey_bytes.hex(),
                "backups_merkle_root": merkle_root.hex(),
                "backup_count": len(all_cid_hashes),
                "latest_cid_hash": all_cid_hashes[-1].hex(),
                "all_cid_hashes": [h.hex() for h in all_cid_hashes],
                "status": "active",
            }
        except Exception as e:
            logger.error(f"Error recovering KeyVault: {e}")
            return None

    async def get_keyvault_status(self, launcher_id: bytes32) -> str:
        """Check if a KeyVault singleton exists and is active."""
        try:
            record = await self._get_coin_record_by_name(launcher_id)
            if record is None:
                return "not_found"

            # Follow chain to find unspent
            coin_id = launcher_id
            while True:
                rec = await self._get_coin_record_by_name(coin_id)
                if rec is None:
                    return "not_found"
                if not rec.spent:
                    return "active"

                cs = await self._get_puzzle_and_solution(
                    coin_id, rec.spent_block_index
                )
                additions = compute_additions(cs)
                next_coin = None
                for a in additions:
                    if a.amount == SINGLETON_AMOUNT:
                        next_coin = a
                        break
                if next_coin is None:
                    return "melted"
                coin_id = next_coin.name()

        except Exception as e:
            logger.error(f"Error checking KeyVault status: {e}")
            return "error"

    # ─── Internal Helpers ───────────────────────────────────────────────

    async def _find_current_singleton(
        self, launcher_id: bytes32, expected_inner_puzzle: Program
    ) -> Tuple[Coin, LineageProof]:
        """
        Follow the singleton chain to find the current unspent coin
        and its lineage proof.
        """
        coin_id = launcher_id
        parent_spend = None

        while True:
            record = await self._get_coin_record_by_name(coin_id)
            assert record is not None, f"Coin record not found: {coin_id.hex()}"

            if not record.spent:
                # This is the current unspent singleton
                current_coin = record.coin

                # Verify puzzle hash matches
                full_puzzle = self.build_keyvault_full_puzzle(launcher_id, expected_inner_puzzle)
                assert current_coin.puzzle_hash == full_puzzle.get_tree_hash(), \
                    f"Puzzle hash mismatch! Expected {full_puzzle.get_tree_hash().hex()}, got {current_coin.puzzle_hash.hex()}"

                # Build lineage proof from parent spend
                if parent_spend is None:
                    # Eve coin — parent is the launcher
                    lineage_proof = LineageProof(
                        parent_name=launcher_id,
                        inner_puzzle_hash=None,
                        amount=uint64(SINGLETON_AMOUNT),
                    )
                else:
                    lineage_proof = lineage_proof_for_coinsol(parent_spend)

                return current_coin, lineage_proof

            # Get spend and follow chain
            parent_spend = await self._get_puzzle_and_solution(
                coin_id, record.spent_block_index
            )
            additions = compute_additions(parent_spend)
            next_coin = None
            for a in additions:
                if a.amount == SINGLETON_AMOUNT:
                    next_coin = a
                    break
            assert next_coin is not None, "Singleton chain broken"
            coin_id = next_coin.name()

    async def puzzle_for_coin(self, coin: Coin) -> Program:
        """Get the puzzle for a coin from the blockchain."""
        coin_record = await self._get_coin_record_by_name(coin.name())
        if coin_record is None:
            raise ValueError(f"Coin not found: {coin.name().hex()}")

        parent_record = await self._get_coin_record_by_name(
            coin.parent_coin_info
        )
        if parent_record and parent_record.spent:
            parent_spend = await self._get_puzzle_and_solution(
                coin.parent_coin_info, parent_record.spent_block_index
            )
            # Find the creation of our coin in additions
            for addition in compute_additions(parent_spend):
                if addition.name() == coin.name():
                    return Program.from_bytes(bytes(parent_spend.puzzle_reveal))

        raise ValueError(f"Could not determine puzzle for coin: {coin.name().hex()}")

    async def _sign_coin_spends(self, coin_spends: List[CoinSpend]) -> SpendBundle:
        """Sign coin spends using wallet client."""
        if self.wallet_client is None:
            # Return unsigned bundle
            return SpendBundle(coin_spends, G2Element())

        # Use wallet client signing
        from chia.rpc.wallet_request_types import (
            GatherSigningInfo,
            ExecuteSigningInstructions,
            ApplySignatures,
            Spend,
        )

        spends = [
            Spend(
                coin_spend.coin,
                coin_spend.puzzle_reveal,
                coin_spend.solution,
            )
            for coin_spend in coin_spends
        ]

        signing_info = await self.wallet_client.gather_signing_info(
            GatherSigningInfo(spends=spends)
        )
        signing_result = await self.wallet_client.execute_signing_instructions(
            ExecuteSigningInstructions(
                signing_instructions=signing_info.signing_instructions,
                partial_allowed=True,
            )
        )
        applied = await self.wallet_client.apply_signatures(
            ApplySignatures(
                spends=spends,
                signing_responses=signing_result.signing_responses,
            )
        )
        return applied.spend_bundle

    async def get_coin_records_by_puzzle_hash(
        self, puzzle_hash: bytes32, include_spent_coins: bool = False
    ) -> List[CoinRecord]:
        """Get coin records by puzzle hash."""
        return await self._get_coin_records_by_puzzle_hash(
            puzzle_hash, include_spent_coins=include_spent_coins
        )

    async def wait_for_coin_record(
        self, coin_id: bytes32, timeout: int = 120
    ) -> Optional[CoinRecord]:
        """Wait for a coin record to appear on chain."""
        import asyncio

        for _ in range(timeout):
            record = await self._get_coin_record_by_name(coin_id)
            if record is not None:
                return record
            await asyncio.sleep(1)
        return None
