/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @important ALL changes to this util and dependant utils must be well tested!
 */

import { SealedDecorator } from '../decorators/SealedDecorator.ts';
import { HashType, Hex_256, Hex_384, Hex_512, hex_256, hex_384, hex_512 } from './HashUtil.ts';
import { HMACKey, KeyType } from './KeyUtil.ts';
import { __derivePAE } from './__internal/__pae.ts';
import { IBaseApp } from '../IBaseApp.ts';

export type PAE = Uint8Array & { _brand: 'PAE' };

export enum HMACOutputFormat
{
    hex = 'hex',
    Hex = 'Hex',
}

@SealedDecorator()
export class HMACUtil<A extends IBaseApp<A>>
{
    protected _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Derives a Hash-based Message Authentication Code (HMAC) signature for the given data using a cryptographic key.
     * This method provides both data integrity and authentication by ensuring that the data has not been altered and
     * verifying its origin. HMAC signatures are crucial in scenarios where the security of data transmission or storage
     * is paramount, offering a higher level of security than simple hashing by incorporating a secret key into the process.
     * 
     * This method is designed to work with Pre-Authentication Encoding (PAE) formatted data, ensuring that complex data
     * structures are encoded in a secure and unambiguous manner before signing. The use of PAE helps mitigate potential
     * security risks such as length extension attacks, making the HMAC signature more robust.
     * 
     * @param {HMACKey} hmacKey - The cryptographic key used for generating the HMAC signature. The security of the HMAC
     *        signature relies on the secrecy and strength of this key.
     * @param {PAE} data - The data to be signed, encoded using Pre-Authentication Encoding. PAE ensures that the data
     *        is structured in a way that is secure and unambiguous for cryptographic operations.
     * @param {HMACOutputFormat.Hex | HMACOutputFormat.hex} format - Specifies the output format of the signature:
     *        `HMACOutputFormat.Hex` for uppercase hexadecimal, or `HMACOutputFormat.hex` for lowercase hexadecimal.
     *        This choice affects only the representation of the resulting signature, not its cryptographic strength.
     * @returns {Promise<Hex_256 | hex_256 | Hex_384 | hex_384 | Hex_512 | hex_512>} A promise that resolves with the HMAC signature in the specified
     *          hexadecimal format. The signature ensures the integrity and authenticity of the PAE-encoded data with
     *          respect to the provided key.
     */
    public async derive(hmacKey:HMACKey<HashType.SHA_256>, data:PAE, format:HMACOutputFormat.Hex):Promise<Hex_256>; 
    public async derive(hmacKey:HMACKey<HashType.SHA_256>, data:PAE, format:HMACOutputFormat.hex):Promise<hex_256>; 
    public async derive(hmacKey:HMACKey<HashType.SHA_384>, data:PAE, format:HMACOutputFormat.Hex):Promise<Hex_384>; 
    public async derive(hmacKey:HMACKey<HashType.SHA_384>, data:PAE, format:HMACOutputFormat.hex):Promise<hex_384>; 
    public async derive(hmacKey:HMACKey<HashType.SHA_512>, data:PAE, format:HMACOutputFormat.Hex):Promise<Hex_512>; 
    public async derive(hmacKey:HMACKey<HashType.SHA_512>, data:PAE, format:HMACOutputFormat.hex):Promise<hex_512>; 
    public async derive(hmacKey:HMACKey<HashType.SHA_256> | HMACKey<HashType.SHA_384> | HMACKey<HashType.SHA_512>, data:PAE, format:HMACOutputFormat)
    {
        const signature = new Uint8Array(await crypto.subtle.sign({name:KeyType.HMAC, hash:hmacKey.outputHashType}, hmacKey.cryptoKey, data));

        return format === HMACOutputFormat.hex ? this._app.baseUtil.toHex(signature) : signature;
    }

    /**
     * Derives a Pre-Authentication Encoding (PAE) output from an array of data inputs.
     * This method is designed to encode multiple pieces of data into a single byte stream
     * in a clear and unambiguous format. Each piece of data's length is encoded alongside the data itself,
     * ensuring there is no ambiguity about data boundaries. This is particularly useful in cryptographic
     * contexts where the integrity of structured data needs to be maintained, such as before hashing or
     * generating a Hash-based Message Authentication Code (HMAC).
     * 
     * The PAE encoding is crucial for scenarios involving multiple data elements (e.g., nonces, ciphertexts,
     * and additional authenticated data) that need to be securely combined and processed.
     *
     * @param {Uint8Array[]} dataParts - An array of `Uint8Array` objects representing the data pieces to be encoded.
     * @returns {PAE} A `Uint8Array` marked with a '_brand' property of 'PAE', representing the PAE-encoded output.
     *                This output includes the encoded lengths of each input data piece followed by the data itself,
     *                ensuring each element is unambiguously separable from the rest.
     */
    public derivePAE = __derivePAE;
}