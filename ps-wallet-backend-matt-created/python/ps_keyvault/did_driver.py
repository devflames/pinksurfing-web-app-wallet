"""
PinkSurfing DID Driver

Creates and manages Chia DIDs (Decentralized Identifiers) for the
business card / proof-of-contact NFT system.

Uses 2-step signing: server builds unsigned spends, client signs locally.
Private key NEVER touches the server.

Handles:
  - DID creation (singleton deployment)
  - DID state lookup / recovery
  - Business card NFT minting (with DID provenance)  [Phase 2]
  - NFT ownership verification                        [Phase 2]
"""

import hashlib
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from chia.consensus.default_constants import DEFAULT_CONSTANTS
from chia.types.blockchain_format.coin import Coin
from chia.types.blockchain_format.program import Program
from chia.types.coin_spend import CoinSpend
from chia.util.bech32m import decode_puzzle_hash, encode_puzzle_hash
from chia.util.hash import std_hash
from chia.wallet.puzzles.p2_delegated_puzzle_or_hidden_puzzle import (
    DEFAULT_HIDDEN_PUZZLE_HASH,
    calculate_synthetic_public_key,
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
from chia_rs import (
    G1Element,
    G2Element,
    Program as RsProgram,
    SpendBundle,
)
from chia_rs.sized_bytes import bytes32
from chia_rs.sized_ints import uint64

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── DID Inner Puzzle ────────────────────────────────────────────────
# Try to import from chia-blockchain; fall back to manual construction.
try:
    from chia.wallet.did_wallet.did_wallet_puzzles import (
        DID_INNERPUZ_MOD,
        create_innerpuz as _create_innerpuz,
    )
    HAS_DID_MODULE = True
    logger.info("Using chia.wallet.did_wallet.did_wallet_puzzles for DID inner puzzle")
except ImportError:
    HAS_DID_MODULE = False
    logger.warning("DID wallet puzzles not available — using fallback")

SINGLETON_AMOUNT = uint64(1)


# ── Compatibility shims ────────────────────────────────────────────
def make_spend(coin, puzzle_reveal, solution) -> CoinSpend:
    """Replacement for removed chia.types.coin_spend.make_spend."""
    pr = RsProgram.from_bytes(bytes(puzzle_reveal)) if not isinstance(puzzle_reveal, RsProgram) else puzzle_reveal
    sol = RsProgram.from_bytes(bytes(solution)) if not isinstance(solution, RsProgram) else solution
    return CoinSpend(coin, pr, sol)


class DidDriver:
    """
    Driver for PinkSurfing DID singletons on the Chia blockchain.

    Each DID is a singleton that serves as a permanent on-chain identity.
    NFTs minted under this DID carry verifiable provenance.
    """

    def __init__(self):
        self.node_client = None
        self.prefix = "xch"

    async def init(self, node_client):
        """Initialize with RPC client."""
        self.node_client = node_client
        logger.info("DID driver initialized")

    # ─── RPC Helpers (mirrors KeyVaultDriver pattern) ──────────────

    async def _fetch_rpc(self, endpoint: str, data: dict) -> dict:
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

    @staticmethod
    def _strip_0x(h: str) -> str:
        return h[2:] if h.startswith("0x") or h.startswith("0X") else h

    async def _get_coin_records_by_puzzle_hash(self, puzzle_hash, include_spent=False):
        ph_hex = puzzle_hash.hex() if isinstance(puzzle_hash, bytes) else str(puzzle_hash)
        resp = await self._fetch_rpc("get_coin_records_by_puzzle_hash", {
            "puzzle_hash": ph_hex,
            "include_spent_coins": include_spent,
        })
        records = []
        for cr in resp.get("coin_records", []):
            coin_d = cr.get("coin", {})
            strip = self._strip_0x
            coin = Coin(
                bytes.fromhex(strip(coin_d["parent_coin_info"])),
                bytes.fromhex(strip(coin_d["puzzle_hash"])),
                int(coin_d["amount"]),
            )

            class _R:
                pass

            r = _R()
            r.coin = coin
            r.spent = cr.get("spent", False)
            r.spent_block_index = cr.get("spent_block_index", 0)
            r.confirmed_block_index = cr.get("confirmed_block_index", 0)
            records.append(r)
        return records

    async def _get_coin_record_by_name(self, coin_id):
        name_hex = coin_id.hex() if isinstance(coin_id, bytes) else self._strip_0x(str(coin_id))
        resp = await self._fetch_rpc("get_coin_record_by_name", {"name": name_hex})
        cr = resp.get("coin_record")
        if not cr:
            return None
        coin_d = cr.get("coin", {})
        strip = self._strip_0x
        coin = Coin(
            bytes.fromhex(strip(coin_d["parent_coin_info"])),
            bytes.fromhex(strip(coin_d["puzzle_hash"])),
            int(coin_d["amount"]),
        )

        class _R:
            pass

        r = _R()
        r.coin = coin
        r.spent = cr.get("spent", False)
        r.spent_block_index = cr.get("spent_block_index", 0)
        r.confirmed_block_index = cr.get("confirmed_block_index", 0)
        return r

    async def _get_puzzle_and_solution(self, coin_id, height: int):
        name_hex = coin_id.hex() if isinstance(coin_id, bytes) else self._strip_0x(str(coin_id))
        resp = await self._fetch_rpc("get_puzzle_and_solution", {
            "coin_id": name_hex,
            "height": height,
        })
        cs = resp.get("coin_solution")
        if not cs:
            return None
        coin_d = cs.get("coin", {})
        coin = Coin(
            bytes.fromhex(self._strip_0x(coin_d["parent_coin_info"])),
            bytes.fromhex(self._strip_0x(coin_d["puzzle_hash"])),
            int(coin_d["amount"]),
        )
        from chia.types.blockchain_format.serialized_program import SerializedProgram
        puzzle_reveal = SerializedProgram.from_bytes(
            bytes.fromhex(self._strip_0x(cs["puzzle_reveal"]))
        )
        solution = SerializedProgram.from_bytes(
            bytes.fromhex(self._strip_0x(cs["solution"]))
        )
        return CoinSpend(coin, puzzle_reveal, solution)

    async def _get_aggsig_additional_data(self):
        try:
            resp = await self._fetch_rpc("get_blockchain_state", {})
            gc = resp.get("blockchain_state", {}).get("genesis_challenge_initialized")
            if gc:
                return bytes.fromhex(gc)
        except Exception:
            pass
        return DEFAULT_CONSTANTS.AGG_SIG_ME_ADDITIONAL_DATA

    # ─── DID Puzzle Construction ──────────────────────────────────────

    def _build_did_inner_puzzle(
        self,
        owner_pubkey: G1Element,
        launcher_id: bytes32,
        metadata: Program = None,
    ) -> Program:
        """
        Build the DID inner puzzle.

        Args:
            owner_pubkey: Owner's BLS public key (raw, not synthetic)
            launcher_id: The DID singleton launcher ID
            metadata: Optional CLVM metadata program
        """
        if metadata is None:
            metadata = Program.to([])

        # Owner's standard p2 puzzle (the inner-most puzzle)
        synthetic_pk = calculate_synthetic_public_key(owner_pubkey, DEFAULT_HIDDEN_PUZZLE_HASH)
        p2_puzzle = puzzle_for_pk(owner_pubkey)

        if HAS_DID_MODULE:
            return _create_innerpuz(
                p2_puzzle_or_hash=p2_puzzle,
                recovery_list=[],
                num_of_backup_ids_needed=uint64(0),
                launcher_id=launcher_id,
                metadata=metadata,
            )
        else:
            # Manual construction fallback
            # DID_INNERPUZ_MOD.curry(p2_puzzle, recovery_hash, num_required, singleton_struct, metadata)
            recovery_list_hash = Program.to([]).get_tree_hash()
            singleton_struct = Program.to(
                (SINGLETON_MOD_HASH, (launcher_id, SINGLETON_LAUNCHER_HASH))
            )
            raise RuntimeError(
                "DID wallet puzzles not available. Install chia-blockchain >= 2.1.0"
            )

    def _build_did_full_puzzle(
        self,
        launcher_id: bytes32,
        inner_puzzle: Program,
    ) -> Program:
        """Wrap DID inner puzzle in singleton top layer."""
        return puzzle_for_singleton(launcher_id, inner_puzzle)

    # ─── DID Creation (2-Step Signing) ────────────────────────────────

    async def prepare_create_did(
        self,
        owner_pubkey: G1Element,
        fee_amount: int = 0,
        metadata: Program = None,
    ) -> Dict[str, Any]:
        """
        Prepare an unsigned DID creation spend bundle.

        2-step signing: this builds the unsigned spend, client signs
        with their synthetic BLS key, then calls submit_signed().

        Args:
            owner_pubkey: Owner's BLS public key
            fee_amount: Transaction fee in mojos
            metadata: Optional DID metadata (CLVM program)

        Returns:
            Dict with coin_spends_json, signing_message_hex, launcher_id, did_id
        """
        # 1. Find a funding coin owned by the user
        owner_puzzle = puzzle_for_pk(owner_pubkey)
        owner_puzzle_hash = owner_puzzle.get_tree_hash()

        logger.info(f"Looking for coins at puzzle hash: {owner_puzzle_hash.hex()}")

        records = await self._get_coin_records_by_puzzle_hash(
            owner_puzzle_hash, include_spent=False
        )

        if not records:
            raise ValueError(
                f"No spendable coins found for this public key. "
                f"Send XCH to {encode_puzzle_hash(owner_puzzle_hash, self.prefix)} first."
            )

        # Pick the largest coin
        best_record = max(records, key=lambda r: r.coin.amount)
        funding_coin = best_record.coin

        required = SINGLETON_AMOUNT + fee_amount
        if funding_coin.amount < required:
            raise ValueError(
                f"Insufficient balance: {funding_coin.amount} mojos, need {required}"
            )

        logger.info(
            f"Funding coin: {funding_coin.name().hex()} ({funding_coin.amount} mojos)"
        )

        # 2. Compute launcher coin and launcher_id
        launcher_coin = Coin(
            funding_coin.name(), SINGLETON_LAUNCHER_HASH, SINGLETON_AMOUNT
        )
        launcher_id = bytes32(launcher_coin.name())

        # 3. Build DID inner puzzle
        did_inner = self._build_did_inner_puzzle(
            owner_pubkey=owner_pubkey,
            launcher_id=launcher_id,
            metadata=metadata,
        )

        # 4. Build full singleton puzzle
        full_puzzle = self._build_did_full_puzzle(launcher_id, did_inner)
        full_puzzle_hash = full_puzzle.get_tree_hash()

        # 5. Build launcher solution
        # Extra data: [owner_pubkey] for recovery/identification
        extra_data = Program.to([bytes(owner_pubkey)])
        genesis_launcher_solution = Program.to(
            [full_puzzle_hash, SINGLETON_AMOUNT, extra_data]
        )

        # 6. Build funding coin delegated puzzle (conditions)
        change_amount = funding_coin.amount - fee_amount - SINGLETON_AMOUNT
        conditions = []

        # Change output
        if change_amount > 0:
            conditions.append([51, funding_coin.puzzle_hash, change_amount])

        # Launcher coin output
        conditions.append([51, SINGLETON_LAUNCHER_HASH, SINGLETON_AMOUNT])

        # Fee
        if fee_amount > 0:
            conditions.append([52, fee_amount])

        # Assert launcher coin announcement
        ann_hash = std_hash(
            launcher_coin.name() + genesis_launcher_solution.get_tree_hash()
        )
        conditions.append([61, ann_hash])

        # Build delegated puzzle for p2_delegated_puzzle_or_hidden_puzzle
        delegated_puzzle = Program.to((1, conditions))
        funding_solution = Program.to([[], delegated_puzzle, []])

        # 7. Build coin spends
        funding_spend = make_spend(funding_coin, owner_puzzle, funding_solution)
        launcher_spend = make_spend(
            launcher_coin, SINGLETON_LAUNCHER, genesis_launcher_solution
        )

        # 8. Compute signing message
        # p2_delegated_puzzle_or_hidden_puzzle AGG_SIG_ME:
        #   message = delegated_puzzle.get_tree_hash()
        #   full = message + coin_id + AGG_SIG_ME_ADDITIONAL_DATA
        aggsig_data = await self._get_aggsig_additional_data()
        signing_message = (
            delegated_puzzle.get_tree_hash()
            + funding_coin.name()
            + aggsig_data
        )

        # 9. Build unsigned spend bundle
        sb_unsigned = SpendBundle(
            [funding_spend, launcher_spend], G2Element()
        )

        # DID identifier: did:chia:<bech32m(launcher_id)>
        did_id = f"did:chia:{encode_puzzle_hash(launcher_id, self.prefix)}"

        logger.info(f"Prepared DID creation — launcher_id={launcher_id.hex()}, did={did_id}")

        return {
            "coin_spends_json": sb_unsigned.to_json_dict()["coin_spends"],
            "signing_message_hex": signing_message.hex(),
            "launcher_id": launcher_id.hex(),
            "did_id": did_id,
            "full_puzzle_hash": full_puzzle_hash.hex(),
            "inner_puzzle_hash": did_inner.get_tree_hash().hex(),
            "funding_coin_id": funding_coin.name().hex(),
        }

    # ─── Submit Signed (shared with KeyVault) ────────────────────────

    async def submit_signed(
        self,
        coin_spends_json: list,
        signature_hex: str,
    ) -> Dict[str, Any]:
        """
        Submit a client-signed spend bundle to the blockchain.
        """
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

        status = await self._fetch_rpc("push_tx", {
            "spend_bundle": spend_bundle.to_json_dict(),
        })
        logger.info(f"DID submit_signed tx status: {status}")

        if status and status.get("success"):
            return {"success": True, "status": status}

        raise RuntimeError(f"push_tx failed: {status}")

    # ─── DID State Recovery ──────────────────────────────────────────

    async def get_did_state(self, launcher_id: bytes32) -> Optional[Dict[str, Any]]:
        """
        Get the current state of a DID from the blockchain.

        Traces the singleton from launcher to current tip.
        """
        # 1. Check launcher coin
        launcher_record = await self._get_coin_record_by_name(launcher_id)
        if not launcher_record:
            return None

        if not launcher_record.spent:
            return {"status": "pending", "launcher_id": launcher_id.hex()}

        # 2. Trace singleton chain
        current_coin_id = launcher_id
        current_record = launcher_record

        while current_record.spent:
            # Get the spend to find the child
            coin_spend = await self._get_puzzle_and_solution(
                current_coin_id, current_record.spent_block_index
            )
            if not coin_spend:
                break

            # Find the singleton child (odd amount = singleton continuation)
            sb = SpendBundle([coin_spend], G2Element())
            additions = list(sb.additions())

            singleton_child = None
            for child in additions:
                if child.amount % 2 == 1:  # Singleton = odd amount
                    singleton_child = child
                    break

            if not singleton_child:
                return {"status": "melted", "launcher_id": launcher_id.hex()}

            current_coin_id = singleton_child.name()
            current_record = await self._get_coin_record_by_name(current_coin_id)
            if not current_record:
                break

        did_id = f"did:chia:{encode_puzzle_hash(launcher_id, self.prefix)}"

        return {
            "status": "active" if not current_record.spent else "spent",
            "launcher_id": launcher_id.hex(),
            "did_id": did_id,
            "current_coin_id": current_coin_id.hex() if isinstance(current_coin_id, bytes) else current_coin_id,
        }

    # ─── NFT1 Business Card Minting (2-Step Signing) ─────────────────

    async def prepare_mint_nft(
        self,
        owner_pubkey: G1Element,
        recipient_puzzle_hash: bytes32,
        metadata_uris: List[str],
        metadata_hash: bytes32,
        image_uris: List[str],
        image_hash: bytes32,
        license_uris: Optional[List[str]] = None,
        license_hash: Optional[bytes32] = None,
        royalty_percentage: int = 0,
        royalty_puzzle_hash: Optional[bytes32] = None,
        fee_amount: int = 0,
    ) -> Dict[str, Any]:
        """
        Prepare an unsigned NFT1 mint spend bundle using official Chia helpers.

        2-step signing: builds unsigned spend, client signs with their
        synthetic BLS key, then calls submit_signed().

        Uses the standard intermediate-launcher → launcher → singleton pattern
        matching the official Chia wallet's mint_from_xch approach.
        """
        from chia.wallet.did_wallet.did_wallet_puzzles import INTERMEDIATE_LAUNCHER_MOD
        from chia.wallet.nft_wallet.nft_puzzles import NFT_METADATA_UPDATER
        from chia.wallet.nft_wallet.nft_puzzle_utils import (
            create_full_puzzle,
            create_ownership_layer_puzzle,
        )
        from chia_rs.sized_ints import uint16

        mint_number = 1
        mint_total = 1

        # 1. Find funding coin
        owner_puzzle = puzzle_for_pk(owner_pubkey)
        owner_puzzle_hash = owner_puzzle.get_tree_hash()

        logger.info(f"[NFT] Looking for coins at puzzle hash: {owner_puzzle_hash.hex()}")

        records = await self._get_coin_records_by_puzzle_hash(
            owner_puzzle_hash, include_spent=False
        )

        if not records:
            raise ValueError(
                f"No spendable coins found for this public key. "
                f"Send XCH to {encode_puzzle_hash(owner_puzzle_hash, self.prefix)} first."
            )

        best_record = max(records, key=lambda r: r.coin.amount)
        funding_coin = best_record.coin

        required = SINGLETON_AMOUNT + fee_amount
        if funding_coin.amount < required:
            raise ValueError(
                f"Insufficient balance: {funding_coin.amount} mojos, need {required}"
            )

        logger.info(f"[NFT] Funding coin: {funding_coin.name().hex()} ({funding_coin.amount} mojos)")

        # 2. Intermediate launcher (official currying: launcher_hash, mint_number, mint_total)
        intermediate_launcher_puzzle = INTERMEDIATE_LAUNCHER_MOD.curry(
            SINGLETON_LAUNCHER_HASH, mint_number, mint_total
        )
        intermediate_launcher_ph = intermediate_launcher_puzzle.get_tree_hash()

        intermediate_launcher_coin = Coin(
            funding_coin.name(), intermediate_launcher_ph, SINGLETON_AMOUNT
        )

        launcher_coin = Coin(
            intermediate_launcher_coin.name(), SINGLETON_LAUNCHER_HASH, SINGLETON_AMOUNT
        )
        nft_launcher_id = bytes32(launcher_coin.name())

        logger.info(f"[NFT] Launcher ID: {nft_launcher_id.hex()}")

        # 3. Build NFT metadata program
        metadata_list = [
            ("u", image_uris),
            ("h", image_hash),
            ("mu", metadata_uris),
            ("mh", metadata_hash),
        ]
        if license_uris:
            metadata_list.append(("lu", license_uris))
        if license_hash:
            metadata_list.append(("lh", license_hash))
        metadata_list.append(("sn", 1))
        metadata_list.append(("st", 1))

        nft_metadata = Program.to(metadata_list)

        # 4. Build NFT puzzles using official helpers
        # p2_inner: minter's own puzzle (they control the NFT, recipient in metadata)
        p2_inner = owner_puzzle

        # Ownership layer (official helper)
        inner_puzzle = create_ownership_layer_puzzle(
            nft_launcher_id,
            b"",  # no DID owner
            p2_inner,
            uint16(royalty_percentage),
            royalty_puzzle_hash=royalty_puzzle_hash,
        )

        # Full singleton puzzle (official helper)
        updater_hash = NFT_METADATA_UPDATER.get_tree_hash()
        eve_fullpuz = create_full_puzzle(
            nft_launcher_id, nft_metadata, updater_hash, inner_puzzle
        )

        eve_fullpuz_hash = eve_fullpuz.get_tree_hash()

        # 5. Launcher solution & spend
        genesis_launcher_solution = Program.to(
            [eve_fullpuz_hash, SINGLETON_AMOUNT, []]
        )
        launcher_spend = make_spend(
            launcher_coin, SINGLETON_LAUNCHER, genesis_launcher_solution
        )

        # 6. Intermediate launcher solution & spend
        intermediate_launcher_solution = Program.to([])
        intermediate_spend = make_spend(
            intermediate_launcher_coin, intermediate_launcher_puzzle, intermediate_launcher_solution
        )

        # 7. Funding coin spend with proper announcements
        # Assert announcement from intermediate launcher: sha256(mint_number + mint_total)
        from chia.util.casts import int_to_bytes
        intermediate_ann_msg = std_hash(int_to_bytes(mint_number) + int_to_bytes(mint_total))
        intermediate_ann_hash = std_hash(intermediate_launcher_coin.name() + intermediate_ann_msg)

        # Assert announcement from launcher: sha256tree([full_puzzle_hash, amount, []])
        launcher_ann_msg = genesis_launcher_solution.get_tree_hash()
        launcher_ann_hash = std_hash(launcher_coin.name() + launcher_ann_msg)

        change_amount = funding_coin.amount - fee_amount - SINGLETON_AMOUNT
        conditions = []

        if change_amount > 0:
            conditions.append([51, funding_coin.puzzle_hash, change_amount])

        # CREATE_COIN for the intermediate launcher
        conditions.append([51, intermediate_launcher_ph, SINGLETON_AMOUNT, [intermediate_launcher_ph]])

        if fee_amount > 0:
            conditions.append([52, fee_amount])

        # Assert both announcements
        conditions.append([61, intermediate_ann_hash])
        conditions.append([61, launcher_ann_hash])

        delegated_puzzle = Program.to((1, conditions))
        funding_solution = Program.to([[], delegated_puzzle, []])
        funding_spend = make_spend(funding_coin, owner_puzzle, funding_solution)

        # 8. Signing message (AGG_SIG_ME: delegated_puzzle_hash + coin_id + agg_sig_data)
        aggsig_data = await self._get_aggsig_additional_data()
        signing_message = (
            delegated_puzzle.get_tree_hash()
            + funding_coin.name()
            + aggsig_data
        )

        sb_unsigned = SpendBundle(
            [funding_spend, intermediate_spend, launcher_spend], G2Element()
        )

        logger.info(f"[NFT] Prepared mint — launcher_id={nft_launcher_id.hex()}")

        return {
            "coin_spends_json": sb_unsigned.to_json_dict()["coin_spends"],
            "signing_message_hex": signing_message.hex(),
            "nft_launcher_id": nft_launcher_id.hex(),
            "full_puzzle_hash": eve_fullpuz_hash.hex(),
            "funding_coin_id": funding_coin.name().hex(),
        }

    async def lookup_did_by_address(self, wallet_address: str) -> Optional[str]:
        """
        Look up a DID launcher_id by wallet address.
        This checks local DB (via the Node.js layer), not the chain.
        Returns None — actual lookup happens at the Node.js layer.
        """
        return None
