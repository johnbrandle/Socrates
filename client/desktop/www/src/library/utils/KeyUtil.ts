/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { KeyUtil as Shared } from '../../../../../../shared/src/library/utils/KeyUtil.ts';
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import { HashOutputFormat, HashType, type HashableData, type Hex_512 } from './HashUtil.ts';
import type { IBaseApp } from '../IBaseApp.ts';

export type HMACSyncKey = Hex_512 & { _brandHMACSyncKey: 'HMACSyncKey' };

export * from '../../../../../../shared/src/library/utils/KeyUtil.ts';

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
@SealedDecorator()
export class KeyUtil<A extends IBaseApp<A>> extends Shared<A>
{
    /**
     * Prepares an HMAC key by ensuring it meets the required length for hashing.
     * If the key is less than 64 bytes, it is padded to 64 bytes. If it is exactly 64 bytes, 
     * it is returned as is. If it is more than 64 bytes, it is hashed using SHA-256 to 
     * bring it down to a suitable length and pad the remaining 32 bytes.
     *
     * @param {Uint8Array} key - The original key to be prepared for HMAC.
     *                           Must be an instance of Uint8Array.
     * @returns {Promise<Uint8Array>} - A promise that resolves to the prepared key, 
     *                                  which will be a Uint8Array of 64 bytes.
     * @static
     * @private
     *
     * @example
     * // Example of using prepareHMACKey
     * const originalKey = new Uint8Array([/* array of byte values *\/]);
     * CryptoClass.prepareHMACKey(originalKey).then(preparedKey => {
     *     // Use preparedKey for HMAC operations
     * });
     */
    public deriveSyncKey = async (key:Uint8Array):Promise<HMACSyncKey> =>
    {
        const byteLength = key.byteLength;
        
        if (byteLength === 64) return key as HMACSyncKey;

        const pad = (key:Uint8Array):HMACSyncKey =>
        {
            const paddedKey = new Uint8Array(64) as Hex_512;
            paddedKey.set(key);
                
            return paddedKey as HMACSyncKey;
        }

        if (byteLength < 64) return pad(key);
        
        return pad(await this._app.hashUtil.derive(key as HashableData, HashType.SHA_256, HashOutputFormat.Hex));
    }
}