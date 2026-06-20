"""
Pydantic models for the KeyVault REST API.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DeployKeyvaultRequest(BaseModel):
    """Request to deploy a new KeyVault singleton."""
    owner_pubkey_hex: str = Field(
        ..., description="Owner's BLS public key in hex"
    )
    initial_cid: str = Field(
        ..., description="IPFS CID of the initial encrypted backup blob"
    )
    funding_coin: Dict[str, Any] = Field(
        ..., description="Coin dict with parent_coin_info, puzzle_hash, amount"
    )
    fee_amount: int = Field(
        default=0, description="Transaction fee in mojos"
    )


class ServerFundedDeployRequest(BaseModel):
    """Request for server-funded KeyVault singleton deployment."""
    owner_pubkey_hex: str = Field(
        ..., description="Owner's BLS public key in hex"
    )
    initial_cid: str = Field(
        ..., description="IPFS CID of the initial encrypted backup"
    )
    fee_amount: int = Field(
        default=0, description="Transaction fee in mojos"
    )


class UpdateBackupRequest(BaseModel):
    """Request to update the KeyVault with a new backup version."""
    launcher_id: str = Field(
        ..., description="KeyVault singleton launcher ID (hex)"
    )
    owner_pubkey_hex: str = Field(
        ..., description="Owner's BLS public key in hex"
    )
    current_cid_hashes: List[str] = Field(
        ..., description="List of all existing backup CID hashes (hex)"
    )
    new_cid: str = Field(
        ..., description="New IPFS CID to commit"
    )
    owner_sk_hex: str = Field(
        ..., description="Owner's private key in hex (for signing)"
    )
    fee_amount: int = Field(
        default=0, description="Transaction fee in mojos"
    )


class TransferOwnershipRequest(BaseModel):
    """Request to transfer KeyVault ownership to a new pubkey."""
    launcher_id: str = Field(
        ..., description="KeyVault singleton launcher ID (hex)"
    )
    current_owner_pubkey_hex: str = Field(
        ..., description="Current owner's BLS public key in hex"
    )
    new_owner_pubkey_hex: str = Field(
        ..., description="New owner's BLS public key in hex"
    )
    current_state: Dict[str, Any] = Field(
        ..., description="Current vault state (backups_merkle_root, backup_count, latest_cid_hash)"
    )
    owner_sk_hex: str = Field(
        ..., description="Current owner's private key in hex"
    )
    fee_amount: int = Field(
        default=0, description="Transaction fee in mojos"
    )


class RecoverKeyvaultRequest(BaseModel):
    """Request to recover KeyVault state from the blockchain."""
    launcher_id: str = Field(
        ..., description="KeyVault singleton launcher ID (hex)"
    )


class KeyvaultStatusRequest(BaseModel):
    """Request to check KeyVault status."""
    launcher_id: str = Field(
        ..., description="KeyVault singleton launcher ID (hex)"
    )


class VerifyBackupRequest(BaseModel):
    """Request to verify a backup CID is in the Merkle tree."""
    cid: str = Field(
        ..., description="IPFS CID to verify"
    )
    all_cid_hashes: List[str] = Field(
        ..., description="All CID hashes in the tree (hex)"
    )
    expected_root: str = Field(
        ..., description="Expected Merkle root (hex)"
    )


class VaultAddressRequest(BaseModel):
    """Request to get the vault's deposit address."""
    launcher_id: str = Field(
        ..., description="KeyVault singleton launcher ID (hex)"
    )


class VaultBalanceRequest(BaseModel):
    """Request to get vault balance."""
    launcher_id: str = Field(
        ..., description="KeyVault singleton launcher ID (hex)"
    )


class VaultWithdrawRequest(BaseModel):
    """Request to withdraw XCH from the vault."""
    launcher_id: str = Field(
        ..., description="KeyVault singleton launcher ID (hex)"
    )
    destination_address: str = Field(
        ..., description="Chia bech32m address to send XCH to"
    )
    amount: int = Field(
        ..., description="Amount to withdraw in mojos"
    )
    owner_pubkey_hex: str = Field(
        ..., description="Owner's BLS public key in hex"
    )
    current_cid_hashes: List[str] = Field(
        ..., description="All backup CID hashes (hex) to rebuild inner puzzle state"
    )
    owner_sk_hex: Optional[str] = Field(
        default=None, description="Owner's private key hex (omit for server-funded vaults)"
    )
    fee_amount: int = Field(
        default=0, description="Transaction fee in mojos"
    )


class VaultDepositRequest(BaseModel):
    """Request to send XCH from the server wallet to the vault."""
    launcher_id: str = Field(
        ..., description="KeyVault singleton launcher ID (hex)"
    )
    amount: int = Field(
        ..., description="Amount to deposit in mojos"
    )
    fee_amount: int = Field(
        default=0, description="Transaction fee in mojos"
    )


# ── 2-Step Signing Models (solslot pattern) ──────────────────────────
# Client never sends private key. Server prepares unsigned spend,
# client signs locally, client sends signature back.

class PrepareUpdateRequest(BaseModel):
    """Request to prepare an unsigned backup update spend."""
    launcher_id: str = Field(
        ..., description="KeyVault singleton launcher ID (hex)"
    )
    owner_pubkey_hex: str = Field(
        ..., description="Owner's BLS public key in hex"
    )
    current_cid_hashes: List[str] = Field(
        ..., description="List of all existing backup CID hashes (hex)"
    )
    new_cid: str = Field(
        ..., description="New IPFS CID to commit"
    )
    fee_amount: int = Field(
        default=0, description="Transaction fee in mojos"
    )


class PrepareTransferRequest(BaseModel):
    """Request to prepare an unsigned ownership transfer spend."""
    launcher_id: str = Field(
        ..., description="KeyVault singleton launcher ID (hex)"
    )
    current_owner_pubkey_hex: str = Field(
        ..., description="Current owner's BLS public key in hex"
    )
    new_owner_pubkey_hex: str = Field(
        ..., description="New owner's BLS public key in hex"
    )
    current_state: Dict[str, Any] = Field(
        ..., description="Current vault state (backups_merkle_root, backup_count, latest_cid_hash)"
    )
    fee_amount: int = Field(
        default=0, description="Transaction fee in mojos"
    )


class PrepareWithdrawRequest(BaseModel):
    """Request to prepare an unsigned vault withdrawal spend."""
    launcher_id: str = Field(
        ..., description="KeyVault singleton launcher ID (hex)"
    )
    destination_address: str = Field(
        ..., description="Chia bech32m address to send XCH to"
    )
    amount: int = Field(
        ..., description="Amount to withdraw in mojos"
    )
    owner_pubkey_hex: str = Field(
        ..., description="Owner's BLS public key in hex"
    )
    current_cid_hashes: List[str] = Field(
        ..., description="All backup CID hashes (hex) to rebuild inner puzzle state"
    )
    fee_amount: int = Field(
        default=0, description="Transaction fee in mojos"
    )


class SubmitSignedRequest(BaseModel):
    """Request to submit a client-signed spend bundle."""
    coin_spends_json: List[Dict[str, Any]] = Field(
        ..., description="Serialized coin spends from prepare_* response"
    )
    signature_hex: str = Field(
        ..., description="BLS G2Element signature hex from client"
    )


class KeyvaultResponse(BaseModel):
    """Standard response from the KeyVault API."""
    success: bool
    message: str = ""
    data: Optional[Dict[str, Any]] = None


# ── DID Models ───────────────────────────────────────────────────────

class PrepareCreateDidRequest(BaseModel):
    """Request to prepare an unsigned DID creation spend."""
    owner_pubkey_hex: str = Field(
        ..., description="Owner's BLS public key in hex"
    )
    fee_amount: int = Field(
        default=0, description="Transaction fee in mojos"
    )


class PrepareMintNftRequest(BaseModel):
    """Request to prepare an unsigned NFT1 business card mint spend."""
    owner_pubkey_hex: str = Field(
        ..., description="Minter's BLS public key in hex (for signing + funding)"
    )
    recipient_address: str = Field(
        ..., description="Recipient's Chia bech32m address"
    )
    metadata_uris: List[str] = Field(
        ..., description="IPFS URIs for card metadata JSON"
    )
    metadata_hash: str = Field(
        ..., description="SHA-256 hash of metadata content (hex)"
    )
    image_uris: List[str] = Field(
        ..., description="IPFS URIs for card image"
    )
    image_hash: str = Field(
        ..., description="SHA-256 hash of image content (hex)"
    )
    license_uris: Optional[List[str]] = Field(
        default=None, description="Optional license URIs"
    )
    license_hash: Optional[str] = Field(
        default=None, description="Optional license hash (hex)"
    )
    royalty_percentage: int = Field(
        default=0, description="Royalty basis points (0 = no royalty)"
    )
    fee_amount: int = Field(
        default=0, description="Transaction fee in mojos"
    )


class DidStatusRequest(BaseModel):
    """Request to check DID status on-chain."""
    launcher_id: str = Field(
        ..., description="DID singleton launcher ID (hex)"
    )


# ── PayChat Models ────────────────────────────────────────────────────

class PreparePayChatOfferRequest(BaseModel):
    """Request to prepare an unsigned PayChat offer (XCH send)."""
    sender_pubkey_hex: str = Field(
        ..., description="Sender's BLS public key in hex"
    )
    recipient_address: str = Field(
        ..., description="Recipient's Chia bech32m address"
    )
    amount_mojos: int = Field(
        ..., description="Amount to offer in mojos"
    )
    memo: Optional[str] = Field(
        default=None, description="Optional message memo"
    )
    fee_amount: int = Field(
        default=0, description="Transaction fee in mojos"
    )


class BroadcastPayChatOfferRequest(BaseModel):
    """Request to broadcast a signed PayChat offer on-chain."""
    coin_spends_json: List[Dict[str, Any]] = Field(
        ..., description="Serialized coin spends from prepare_offer response"
    )
    signature_hex: str = Field(
        ..., description="BLS G2Element aggregated signature hex from sender"
    )


class CheckOfferCoinsRequest(BaseModel):
    """Request to check if offer coins are still unspent."""
    coin_ids: List[str] = Field(
        ..., description="List of coin ID hex strings to check"
    )
