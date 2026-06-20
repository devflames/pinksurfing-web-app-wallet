"""
PinkSurfing PayChat Offer Driver

Creates Chia offer files for pay-per-message chat.
Uses 2-step signing: server builds unsigned XCH send,
client signs locally with synthetic key.

Flow:
  1. Recipient sets ask price (mojos per message)
  2. Sender calls prepare_offer → gets unsigned spend + signing message
  3. Sender signs on device with synthetic BLS key
  4. Signed spend bundle stored as "offer" (NOT broadcast)
  5. When recipient responds, broadcast_offer pushes the spend bundle on-chain

The offer is a signed-but-unbroadcast spend bundle: sender's XCH → recipient's address.
Private key NEVER touches the server.
"""

import logging
import os
from typing import Any, Dict, List, Optional

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
)
from chia_rs import (
    G1Element,
    G2Element,
    Program as RsProgram,
    SpendBundle,
)
from chia_rs.sized_bytes import bytes32

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _make_spend(coin, puzzle_reveal, solution) -> CoinSpend:
    """Create a CoinSpend with proper types."""
    pr = RsProgram.from_bytes(bytes(puzzle_reveal)) if not isinstance(puzzle_reveal, RsProgram) else puzzle_reveal
    sol = RsProgram.from_bytes(bytes(solution)) if not isinstance(solution, RsProgram) else solution
    return CoinSpend(coin, pr, sol)


class PayChatDriver:
    """
    Driver for PayChat offer creation on the Chia blockchain.

    Creates signed-but-unbroadcast XCH send transactions as "offers".
    When the recipient responds, the offer is broadcast to settle payment.
    """

    def __init__(self):
        self.node_client = None
        self.prefix = "xch"

    async def init(self, node_client):
        """Initialize with RPC client."""
        self.node_client = node_client
        logger.info("PayChat driver initialized")

    # ─── RPC Helpers (same pattern as DID driver) ──────────────────

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

    async def _get_aggsig_additional_data(self):
        try:
            resp = await self._fetch_rpc("get_blockchain_state", {})
            gc = resp.get("blockchain_state", {}).get("genesis_challenge_initialized")
            if gc:
                return bytes.fromhex(gc)
        except Exception:
            pass
        return DEFAULT_CONSTANTS.AGG_SIG_ME_ADDITIONAL_DATA

    # ─── Offer Preparation (2-Step Signing) ────────────────────────

    async def prepare_offer(
        self,
        sender_pubkey: G1Element,
        recipient_address: str,
        amount_mojos: int,
        memo: str = "",
        fee_amount: int = 0,
    ) -> Dict[str, Any]:
        """
        Prepare an unsigned XCH send as a PayChat offer.

        This builds an unsigned spend bundle that sends `amount_mojos` XCH
        from the sender to the recipient. The client signs it locally,
        and the signed bundle is stored as an "offer" — NOT broadcast
        until the recipient responds.

        Args:
            sender_pubkey: Sender's BLS public key
            recipient_address: Recipient's bech32m Chia address
            amount_mojos: Amount to offer in mojos
            memo: Optional message memo (hex-encoded or plain text)
            fee_amount: Transaction fee in mojos

        Returns:
            Dict with coin_spends_json, signing_message_hex, offer details
        """
        # 1. Derive sender's puzzle
        sender_puzzle = puzzle_for_pk(sender_pubkey)
        sender_puzzle_hash = sender_puzzle.get_tree_hash()

        # 2. Decode recipient puzzle hash
        recipient_puzzle_hash = bytes32(decode_puzzle_hash(recipient_address))

        logger.info(
            f"Preparing PayChat offer: {amount_mojos} mojos "
            f"from {encode_puzzle_hash(sender_puzzle_hash, self.prefix)} "
            f"to {recipient_address}"
        )

        # 3. Find sender's unspent coins
        records = await self._get_coin_records_by_puzzle_hash(
            sender_puzzle_hash, include_spent=False
        )

        if not records:
            raise ValueError(
                f"No spendable coins found for sender. "
                f"Send XCH to {encode_puzzle_hash(sender_puzzle_hash, self.prefix)} first."
            )

        # 4. Select coins (greedy: pick largest first)
        required = amount_mojos + fee_amount
        records.sort(key=lambda r: r.coin.amount, reverse=True)

        selected_coins = []
        total_selected = 0
        for record in records:
            selected_coins.append(record.coin)
            total_selected += record.coin.amount
            if total_selected >= required:
                break

        if total_selected < required:
            raise ValueError(
                f"Insufficient balance: have {total_selected} mojos, need {required}"
            )

        logger.info(
            f"Selected {len(selected_coins)} coins totaling {total_selected} mojos"
        )

        # 5. Build conditions for the primary coin spend
        conditions = []

        # Payment to recipient
        payment_condition = [51, recipient_puzzle_hash, amount_mojos]
        # Add memo if provided
        if memo:
            memo_bytes = memo.encode("utf-8") if isinstance(memo, str) else memo
            payment_condition.append(memo_bytes)
        conditions.append(payment_condition)

        # Change back to sender
        change = total_selected - amount_mojos - fee_amount
        if change > 0:
            conditions.append([51, sender_puzzle_hash, change])

        # Fee
        if fee_amount > 0:
            conditions.append([52, fee_amount])

        # 6. Build delegated puzzle (same pattern as DID creation)
        delegated_puzzle = Program.to((1, conditions))
        primary_solution = Program.to([[], delegated_puzzle, []])

        # 7. Build coin spends
        coin_spends = []

        # Primary coin (carries the conditions)
        primary_spend = _make_spend(selected_coins[0], sender_puzzle, primary_solution)
        coin_spends.append(primary_spend)

        # Additional coins (empty conditions, just need AGG_SIG_ME)
        for extra_coin in selected_coins[1:]:
            empty_delegated = Program.to((1, []))
            empty_solution = Program.to([[], empty_delegated, []])
            extra_spend = _make_spend(extra_coin, sender_puzzle, empty_solution)
            coin_spends.append(extra_spend)

        # 8. Compute signing messages
        # For p2_delegated_puzzle_or_hidden_puzzle:
        #   AGG_SIG_ME: message = sha256tree(delegated_puzzle) + coin_id + AGG_SIG_ME_ADDITIONAL_DATA
        # The client must sign with their SYNTHETIC key
        aggsig_data = await self._get_aggsig_additional_data()

        # Primary coin signing message
        signing_message = (
            delegated_puzzle.get_tree_hash()
            + selected_coins[0].name()
            + aggsig_data
        )

        # If multiple coins, we need aggregated signatures
        # Each coin needs: sha256tree(its_delegated_puzzle) + coin_id + aggsig_data
        extra_signing_messages = []
        for extra_coin in selected_coins[1:]:
            empty_delegated = Program.to((1, []))
            extra_msg = (
                empty_delegated.get_tree_hash()
                + extra_coin.name()
                + aggsig_data
            )
            extra_signing_messages.append(extra_msg.hex())

        # 9. Build unsigned spend bundle
        sb_unsigned = SpendBundle(coin_spends, G2Element())

        sender_address = encode_puzzle_hash(sender_puzzle_hash, self.prefix)

        logger.info(
            f"Prepared PayChat offer — {amount_mojos} mojos, "
            f"{len(coin_spends)} coin spends, "
            f"signing_message={signing_message.hex()[:32]}..."
        )

        return {
            "coin_spends_json": sb_unsigned.to_json_dict()["coin_spends"],
            "signing_message_hex": signing_message.hex(),
            "extra_signing_messages_hex": extra_signing_messages,
            "sender_address": sender_address,
            "recipient_address": recipient_address,
            "amount_mojos": amount_mojos,
            "fee_amount": fee_amount,
            "coin_ids": [c.name().hex() for c in selected_coins],
        }

    async def broadcast_offer(
        self,
        coin_spends_json: list,
        signature_hex: str,
    ) -> Dict[str, Any]:
        """
        Broadcast a signed offer spend bundle on-chain.

        Called when the recipient responds (accepts the offer).
        The spend bundle was previously signed by the sender.

        Args:
            coin_spends_json: Serialized coin spends from prepare_offer
            signature_hex: BLS G2Element aggregated signature from sender

        Returns:
            Dict with success status
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

        logger.info(f"Broadcasting PayChat offer — {len(coin_spends)} coin spends")

        status = await self._fetch_rpc("push_tx", {
            "spend_bundle": spend_bundle.to_json_dict(),
        })
        logger.info(f"PayChat broadcast status: {status}")

        if status and status.get("success"):
            return {"success": True, "status": status}

        raise RuntimeError(f"push_tx failed: {status}")

    async def check_coins_unspent(self, coin_ids: List[str]) -> bool:
        """
        Check if the offer's coins are still unspent (offer still valid).

        Args:
            coin_ids: List of coin ID hex strings

        Returns:
            True if ALL coins are still unspent (offer valid)
        """
        for coin_id_hex in coin_ids:
            coin_id = bytes.fromhex(self._strip_0x(coin_id_hex))
            resp = await self._fetch_rpc("get_coin_record_by_name", {"name": coin_id.hex()})
            cr = resp.get("coin_record")
            if not cr:
                logger.warning(f"Coin {coin_id_hex} not found — offer invalid")
                return False
            if cr.get("spent", False):
                logger.warning(f"Coin {coin_id_hex} already spent — offer invalid")
                return False
        return True
