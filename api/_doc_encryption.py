"""Stessa identica cifratura di src/lib/crypto/docEncryption.ts (AES-256-GCM
+ HKDF-SHA256) e di KEVIN_ONLY_NON_DISTRIBUIRE/doc_encryption.py — copiata qui
perché le funzioni serverless Python di Vercel non possono importare da
fuori la cartella api/. Se cambi una delle tre copie, cambia anche le altre.
"""
import base64
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

HKDF_SALT = b'themis-doc-key'
IV_LENGTH = 12
SYSTEM_SCOPE = 'system'


def _master_key():
    return base64.b64decode(os.environ['DOCUMENT_ENCRYPTION_MASTER_KEY'])


def derive_key(scope: str) -> bytes:
    hkdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=HKDF_SALT, info=scope.encode('utf-8'))
    return hkdf.derive(_master_key())


def encrypt_bytes(plaintext: bytes, scope: str) -> bytes:
    key = derive_key(scope)
    iv = os.urandom(IV_LENGTH)
    return iv + AESGCM(key).encrypt(iv, plaintext, None)


def decrypt_bytes(blob: bytes, scope: str) -> bytes:
    key = derive_key(scope)
    iv = blob[:IV_LENGTH]
    return AESGCM(key).decrypt(iv, blob[IV_LENGTH:], None)
