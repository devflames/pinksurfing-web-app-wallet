/**
 * @noble/ed25519 v3 requires hashes.sha512 to be set before sync/async use.
 */
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2';

type EdSha512 = NonNullable<typeof ed.hashes.sha512>;
type EdSha512Async = NonNullable<typeof ed.hashes.sha512Async>;

function hashSha512(message: Uint8Array): Uint8Array {
  return sha512(message);
}

// Noble's Bytes type is stricter than @noble/hashes return type — cast at the boundary.
ed.hashes.sha512 = ((message: Uint8Array) => hashSha512(message)) as EdSha512;
ed.hashes.sha512Async = ((message: Uint8Array) =>
  Promise.resolve(hashSha512(message))) as EdSha512Async;

export { ed };
