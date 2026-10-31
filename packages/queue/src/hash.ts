/** Hashing now lives in `core` (the service needs it too); re-exported for the queue's callers. */
export { hashJson, sha256Hex } from '@tapestry/core';
