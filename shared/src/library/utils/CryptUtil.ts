/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * This util is meant to provide a general encryption method that abstracts the complexities of cryptographic operations, as developer error in 
 * employing cryptographic operations is a substantial, often overlooked, security risk. Ideally, developers would not need to:
 * 
 *   1) Understand the intricacies/limitations of cryptographic operations, e.g., GHASH issues, CBC's lack of parallelism, key commitment, etc.
 *   2) Manage ivs/nonces/counters.
 *   3) Rotate symmetric keys.
 *   4) Track how many bytes/messages have been encrypted using a single key.
 *   5) Ensure integrity and authenticity of encrypted data.
 *   6) Have knowledge of some types of side-channel attacks, e.g., timing, meet-in-the-middle, padding oracle, etc.
 *
 * @reference https://www.w3.org/TR/WebCryptoAPI/
 * @reference https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf
 * @reference https://www.ietf.org/rfc/rfc3394.txt
 * @reference https://csrc.nist.gov/csrc/media/projects/block-cipher-techniques/documents/bcm/comments/cwc-gcm/ferguson2.pdf
 * @reference https://eprint.iacr.org/2011/202.pdf
 * @reference https://csrc.nist.rip/groups/ST/toolkit/BCM/documents/proposedmodes/ctr/ctr-spec.pdf
 * @reference https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf
 * @reference https://datatracker.ietf.org/doc/html/rfc5869
 * @reference https://www.trustedfirmware.org/docs/2_ConstantTimeCode.pdf
 * @rererence https://www.bsdcan.org/2010/schedule/attachments/135_crypto1hr.pdf
 * @reference https://www.daemonology.net/blog/2011-01-18-tarsnap-critical-security-bug.html
 * @reference https://csrc.nist.gov/files/pubs/sp/800/90/c/3pd/docs/draft-sp800-90c.pdf
 * @reference https://en.wikipedia.org/wiki/Alice_and_Bob
 * @reference https://en.wikipedia.org/wiki/Security_protocol_notation
 * 
 * @important ALL changes to this util and dependant utils must be well tested!
 * 
 * @important Any and all critical feedback is highly desired and welcomed!
 */

import { ITransformer, type IVariableTransformer } from './StreamUtil.ts';
import { SealedDecorator } from '../decorators/SealedDecorator.ts';
import { GCMKey, HKDFKey, HMACKey, KeyType, CRYPTKey, CBCKey, Salt, CTRKey } from './KeyUtil.ts';
import { HMACOutputFormat, PAE } from './HMACUtil.ts';
import { HashOutputFormat, HashType, Hex_128, Hex_256, Hex_384, Hex_512, Hex_96 } from './HashUtil.ts';
import { uint } from './IntegerUtil.ts';
import { ResolvePromise } from '../promise/ResolvePromise.ts';
import { IError } from '../error/IError.ts';
import { IAborted } from '../abort/IAborted.ts';
import { IBaseApp } from '../IBaseApp.ts';

export type CRYPT<T extends Uint8Array> = Uint8Array & { _brand: 'CRYPT_Encrypted' };
export type GCM<T extends Uint8Array> = Uint8Array & { _brand: 'GCM_Encrypted' };
export type CBC<T extends Uint8Array> = Uint8Array & { _brand: 'CBC_Encrypted' };
export type CTR<T extends Uint8Array> = Uint8Array & { _brand: 'CTR_Encrypted' };

export type CRYPT_StreamHeader = Uint8Array & { _brand: 'CRYPT_StreamHeader' };

export enum CRYPTFormat //0-255
{
    CTR_0 = 0, //version 0 of CTR based encryption
}
const CURRENT_CRYPT_FORMAT = CRYPTFormat.CTR_0;

@SealedDecorator()
export class CryptUtil<A extends IBaseApp<A>> 
{
    protected _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Encrypts data with a randomly generated key and nonce using AES-CTR mode, secured with an HMAC signature.
     *
     * | Segment                              | Size (Bytes) | Purpose                                                                                   |
     * |--------------------------------------|--------------|-------------------------------------------------------------------------------------------|
     * | Salt                                 | 64           | Salt used for deriving the key and nonce, @see generateSalt and @see deriveCTRKeyAndNonce |
     * | Encrypted Header                     | 16           | 1 byte, format; 4 bytes, padding size value; 11 bytes, random (reserved for future use).  | 
     * | Encrypted (Padding + Data + Padding) | Variable     | Data and padding encrypted using the derived key and nonce.                               |
     * | HMAC signature                       | 48           | Signature ensuring the integrity and authenticity of the output.                          |
     * 
     * The output will be at least 128 bytes larger than the input.
     *
     * By treating the nonce as secret and incorporating it as part of the cryptographic basis, the system effectively uses an "extended key" for 
     * encryption. @see CryptUtil.deriveCTRKeyAndNonce for more information.
     * 
     * This method is suitable for encrypting up to 256 MB of data per operation, with no practical limit to the number of operations. The 256 MB 
     * limitation is imposed for performance reasons only. To encrypt more data, consider using the stream encryption methods.
     * 
     * CRYPT keys can be used 1^147 times before requiring rotation (2^-32 chance of a key/nonce collision):
     *
     *   Key used for streaming:
     * 
     *     2^-32 = (n^2) / (2 * 2^326)   //setting up the equation from the birthday paradox
     *     n^2 = 2^-32 * 2 * 2^326       //rearranging the equation to solve for n^2
     *     n^2 = 2^295                   //simplifying the right-hand side
     *     n ≈ 2^147                     //taking the square root of both sides to solve for n
     * 
     *   Key never used for streaming (worst case):
     * 
     *     2^358 = 2^(359 - 1)           //we reserve one bit to determine header/data
     * 
     *     2^-32 = (n^2) / (2 * 2^358)   //setting up the equation from the birthday paradox
     *     n^2 = 2^-32 * 2 * 2^358       //rearranging the equation to solve for n^2
     *     n^2 = 2^327                   //simplifying the right-hand side
     *     n ≈ 2^163                     //taking the square root of both sides to solve for n
     *
     *   Average case (key used for both streaming and non-streaming):
     * 
     *     (2^147 + 2^163) / 2 = 2^155
     * 
     * In order to prevent attackers from forcing downgrades to weaker encryption schemes, the format cannot be downgraded.
     * 
     * The variable padding option (up to 256 MB):
     * 
     *   1) Obscures the data's size at rest, thwarting size-based heuristic analysis.
     *   2) Will increase memory usage and encryption time, decryption time should be unaffected.
     *   3) Makes detecting a HKDF deriveBits output collision of unique salts infeasible. In order to have a reasonable chance at detecting such a 
     *      collision, the padding values of the two messages would need to be within 16 bytes of each other. And, at least one data block at the 
     *      same 16 byte offset would need to match, or the header would need to match (which is unlikely given the 11 random bytes).
     *   4) Does not protect against known plaintext attacks when an attacker knows there is a key/nonce collision. Either due to a salt collision; 
     *      or, a HKDF deriveBits output collision where the padding values are within 16 bytes of each other.
     * 
     *      —Even if an attacker is somehow lucky enough for a key/nonce collision to occur and somehow detected it, they would still need to guess 
     *      like values within the data.
     *   5) Does not conceal the actual data size if an attacker can trigger multiple encryptions of the data.
     *  
     * Encryption Process ->
     * 
     *   1) Generates a 64-byte random salt.
     *   2) Derives 48 bytes from the CRYPTKey and the salt.
     *   3) Splits derived bytes into 32-byte CTR key material and nonce.
     *   4) Imports the CTR key from the derived key material.
     *   5) Creates a header with the format byte and padding size (if any), and encrypts it using the derived CTR key and nonce.
     *   6) Appends padding to the data, if any.
     *   7) Encrypts data using the derived CTR key and nonce.
     *   8) Computes an HMAC signature from the salt, header, and encrypted data.
     *
     * Decryption Process ->
     * 
     *   1) Extracts the salt, header, data, and signature.
     *   2) Computes and verifies the HMAC signature.
     *   3) Derives 48 bytes from the CRYPTKey and the salt.
     *   4) Splits derived bytes into 32-byte CTR key material and nonce.
     *   5) Imports the CTR key from the derived key material.
     *   6) Decrypts the header using the derived CTR key and nonce.
     *   7) Removes any padding from the data, if any.
     *   8) Decrypts the data using the derived CTR key and nonce.
     * 
     * Secruity assumptions:
     * 
     *   1) A mostly secure random number generator.
     *   2) The supplied CRYPTKey provides 512 bits of entropy, and has not been compromised.
     *   3) All used Web Crypto operations are secure and operate in constant time. 
     *   4) The CRYPTKey is not used for other purposes outside of this util.
     *   5) The hardware, operating system, and browser are not significantly compromised.
     *   6) Collisions involving entropies greater than 256 bits are not a realistic concern.
     * 
     * @note A 64 byte salt ensures we can produce approx. all combinations within the available key/nonce space. Additionally, a salt collision implies a 
     * key/nonce collision. Thus, the very large salt size.
     * 
     * @note Although GCM/GHASH is significantly faster than CTR->HMAC, GHASH has security issues, @see https://soatok.blog/2020/05/13/why-aes-gcm-sucks/
     *
     * @note Ideally, we would use a 512 bit HMAC signature, truncated to 256 bits. However, Web Crypto verify does not support truncated signatures, and 
     * although we could use a custom constant time comparison function, it's safer not to.
     * 
     * @important CTR nonce format:
     * 
     * The first bit of the first byte is always 0, the non-streaming bit
     * The second bit of the first byte is the original bit for the header, and the opposite bit for the data
     * The last three bytes are X or 0, depending on the amount of data being encrypted
     * 
     * N = non-streaming bit
     * H = header or data bit (data bit value is the opposite of the header bit value)
     * X = random bits
     * V = X or 0, depending on the amount of data being encrypted
     * 
     * NHXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX VVVVVVVV VVVVVVVV VVVVVVVV
     *
     * @param {CRYPTKey} cryptKey - The crypt key for encrypting the data.
     * @param {Uint8Array} data - The plaintext data to encrypt.
     * @param {Object} options - The options for encrypting the data.
     * @param {uint} options.maxPaddingSize - The maximum amount of padding to add to the data. Defaults to 255.
     * @param {Uint8Array} options.additionalAuthenticatedData - Additional data to authenticate with the HMAC signature. Defaults to an empty array.
     * @returns {Promise<CRYPT<T> | undefined>} A promise that resolves with the encrypted data or undefined.
     */
    public async encrypt<T extends Uint8Array=Uint8Array>(cryptKey:CRYPTKey, data:T, options?:{maxPaddingSize?:uint, additionalAuthenticatedData?:PAE}):Promise<CRYPT<T>>
    {
        try    
        {
            //don't allow more than 256 MB for performance reasons
            const MAX_BYTES = 2**24 * 16;
            if (data.length > MAX_BYTES) this._app.throw('data size must be <= {MAX_BYTES}', [MAX_BYTES], {correctable:true});

            //get the options
            const maxPaddingSize = options?.maxPaddingSize ?? 255;
            const additionalAuthenticatedData = options?.additionalAuthenticatedData ?? new Uint8Array(0);

            //verify max padding size is not greater than the max bytes
            if (maxPaddingSize > MAX_BYTES) this._app.throw('max padding size must be <= {MAX_BYTES}', [MAX_BYTES], {correctable:true});

            //the salt used for deriving our ctr key and counter
            const salt = await this.generateSalt();

            //create a header array to hold the format byte and padding size
            const header = this._app.byteUtil.generate(16);

            //set the format byte on the header (1 byte, 0-255)
            header[0] = CURRENT_CRYPT_FORMAT;
            
            //determine how much padding we should add, and set padding size on the header (4 bytes)
            const paddingSize = this._app.integerUtil.generate(0 as uint, Math.min(MAX_BYTES - data.length, maxPaddingSize) as uint);
            const dataView = new DataView(new Uint8Array(4).buffer);
            dataView.setUint32(0, paddingSize, false);
            const paddingSizeBytes = new Uint8Array(dataView.buffer);
            header.set(paddingSizeBytes, 1);

            //calculate the padding lengths
            const prefixPaddingLength = paddingSize & ~0xF; //clear the lower 4 bits, equivalent to: Math.floor(paddingSize / 16) * 16
            const suffixPaddingLength = paddingSize & 0xF; //extract the lower 4 bits, equivalent to: paddingSize % 16

            //derive the ctr key, nonce, and counter bit length
            const {ctrKey, nonce, bitsReservedForCounter} = await this.deriveCTRKeyAndNonce(cryptKey, salt, Math.max(data.length + prefixPaddingLength + suffixPaddingLength, header.length), false); //the Math.max code is very important

            //calculate padding segments, and concatenate prefix padding, data, and suffix padding
            const paddingBytes = await this._app.byteUtil.derive(ctrKey, this._app.byteUtil.generate(12) as Hex_96, prefixPaddingLength + suffixPaddingLength); //so padding won't facilitate known plaintext attacks in the increadibly unlikely event of a salt collision
            const dataWithPadding = this._app.byteUtil.concat([paddingBytes.subarray(0, prefixPaddingLength), data, paddingBytes.subarray(prefixPaddingLength)]);
            
            //flip the second bit (from the left) of the first byte to create the data nonce
            const dataNonce = nonce.slice() as Hex_128;
            dataNonce[0] ^= 0b01000000;

            //encrypt the header and data using the ctr key
            const [encryptedHeader, encryptedDataWithPadding] = await Promise.all([this.__encryptCTR(ctrKey, header, nonce, bitsReservedForCounter), this.__encryptCTR(ctrKey, dataWithPadding, dataNonce, bitsReservedForCounter)]);

            //sign the salt, encrypted header, encrypted data, and additional authenticated data
            const pae = this._app.hmacUtil.derivePAE([salt, encryptedHeader, encryptedDataWithPadding, additionalAuthenticatedData]);
            const signature = (await this._app.hmacUtil.derive(cryptKey.hmacKey, pae, HMACOutputFormat.Hex));

            //concatenate the salt, encrypted header, encrypted data, and signature
            return this._app.byteUtil.concat([salt, encryptedHeader, encryptedDataWithPadding, signature]) as CRYPT<T>;
        }
        catch (error)
        {
            this._app.throw('encryption failed', [], {correctable:true});
        }
    }

    /**
     * Decrypts data encrypted with the 'encrypt' method.
     * 
     * The output will be at least 128 bytes smaller than the input.
     *
     * @param {CryptKey} cryptKey - The crypt key for decrypting the data.
     * @param {Uint8Array} encrypted - The encrypted data.
     * @param {Object} options - The options for decrypting the data.
     * @param {Uint8Array} options.additionalAuthenticatedData - Additional data to authenticate with the HMAC signature. Defaults to an empty array.
     * @returns {Promise<T> | undefined} A promise that resolves with the decrypted plaintext data or undefined.
     */
    public async decrypt<T extends Uint8Array=Uint8Array>(cryptKey:CRYPTKey, encrypted:CRYPT<T>, options?:{additionalAuthenticatedData?:PAE}):Promise<T | IError>
    {
        try    
        {
            //get the options
            const additionalAuthenticatedData = options?.additionalAuthenticatedData ?? new Uint8Array(0);

            //extract the salt
            const salt = encrypted.slice(0, 64) as Hex_512;
        
            //extract the encrypted header
            const encryptedHeader = encrypted.subarray(64, 80) as CTR<Uint8Array>;
        
            //extract the encrypted data with padding
            const encryptedDataWithPadding = encrypted.subarray(80, -48);

            //extract the hmac signature
            const signature = encrypted.subarray(-48) as Hex_384;

            //verify the signature
            const pae = this._app.hmacUtil.derivePAE([salt, encryptedHeader, encryptedDataWithPadding, additionalAuthenticatedData]);
            if (await this._app.hashUtil.verify(cryptKey.hmacKey, pae, signature) === false) this._app.throw('HMAC verification failed', []);

            //derive the ctr key, nonce, and counter bit length
            const {ctrKey, nonce, bitsReservedForCounter} = await this.deriveCTRKeyAndNonce(cryptKey, salt, Math.max(encryptedDataWithPadding.length, encryptedHeader.length), false); //the Math.max code is very important

            //decrypt the header using the ctr key
            const header = this._app.extractOrRethrow(await this.__decryptCTR(ctrKey, encryptedHeader, nonce, bitsReservedForCounter));

            //extract the format byte
            const format = header.slice(0, 1);

            //verify the format byte
            if (format[0] !== CURRENT_CRYPT_FORMAT) this._app.throw('Invalid format byte', [], {correctable:true});

            //extract the padding size
            const paddingSize = new DataView(header.slice(1, 5).buffer).getUint32(0, false);

            //flip the second bit (from the left) of the first byte to create the data nonce
            nonce[0] ^= 0b01000000;

            //calculate padding lengths; and, extract the counter portion of the nonce, increment it by the number of full blocks skipped due to prefix padding, and update the nonce with the new counter value
            const prefixPaddingLength = paddingSize & ~0xF; //clear the lower 4 bits, equivalent to: Math.floor(paddingSize / 16) * 16
            const suffixPaddingLength = paddingSize & 0xF; //extract the lower 4 bits, equivalent to: paddingSize % 16
            const blocksToSkip = (prefixPaddingLength + 15) >> 4; // equivalent to Math.ceil(prefixPaddingLength / 16)
            const counter = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
            const initialCounterValue = counter.getUint32(12, false); //use the last 4 bytes of the nonce as the counter value
            counter.setUint32(12, initialCounterValue + blocksToSkip, false);

            //removing any padding before decrypting
            const encryptedData = encryptedDataWithPadding.subarray(prefixPaddingLength, encryptedDataWithPadding.length - suffixPaddingLength) as CTR<T>;

            //decrypt the data using the ctr key, 
            return await this.__decryptCTR(ctrKey, encryptedData, nonce, bitsReservedForCounter);
        }
        catch (error)
        {
            return this._app.warn({}, 'decryption failed', [], {errorOnly:true, names:[CryptUtil, this.decrypt]});
        }
    }

    /**
     * Generates a cryptographically secure salt by combining random bytes with high-resolution timestamps. This method ensures 
     * the salt is indistinguishable from random data by using a hash function.
     * 
     * The randomness is assumed to be sourced from a high-quality generator, sufficient to prevent guessability by attackers, 
     * but not necessarily sufficient to guarantee uniqueness for every use across different periods, sessions, browsers, apps, 
     * or operating systems. The timing data is included to ensure that, even in the event of an unlikely random byte collision, 
     * the chances of the output being unique is still high.
     * 
     * If the random number generator was significantly compromised, the timestamp could theoretically aid in a timing attack 
     * by revealing patterns or execution times; however, such a scenario would imply much broader security vulnerabilities.
     * 
     * Probability of collision:
     *
     * 2^-32 = (n^2) / (2 * 2^512)   //setting up the equation from the birthday paradox
     * n^2 = 2^-32 * 2 * 2^512       //rearranging the equation to solve for n^2
     * n^2 = 2^480                   //simplifying the right-hand side
     * n = 2^240                     //taking the square root of both sides to solve for n
     *
     * Approximately 2^240 salts can be generated before the probability of a collision exceeds 2^-32.
     * 
     * @returns {Promise<Hex_512>} A promise that resolves to the generated salt.
     */
    private async generateSalt():Promise<Hex_512>
    {
        try
        {
            //128 bytes of random
            const randomBytes = this._app.byteUtil.generate(128); //double the size of the hash output

            //data view for the time operations
            const dataView = new DataView(new ArrayBuffer(8));
            
            //8 bytes from the epoch time
            dataView.setBigUint64(0, BigInt(Date.now()), false);
            const dateNowBytes = new Uint8Array(dataView.buffer.slice(0));

            //8 bytes from the high-resolution time since page load
            dataView.setFloat64(0, performance.now(), false);
            const performanceNowBytes = new Uint8Array(dataView.buffer.slice(0));

            //encode and hash the bytes
            return await this._app.hashUtil.derive(this._app.hashUtil.encodeData([randomBytes, dateNowBytes, performanceNowBytes]), HashType.SHA_512, HashOutputFormat.Hex);
        }
        catch (error)
        {
            this._app.throw('salt generation failed', [], {correctable:true});
        }
    }

    /**
     * @note By treating the nonce as secret and incorporating it as part of the cryptographic basis, the system effectively uses an 
     * "extended key" for encryption. The combined security ranges from 330-382 bits (165-191 bits post-quantum), depending on the 
     * provided maxBytesToEncrypt value:
     *
     *  1 - 32 bytes: 382 bits
     *  33 - 64 bytes: 381 bits
     *  65 - 128 bytes: 380 bits
     *  129 - 256 bytes: 379 bits
     *  257 - 512 bytes: 378 bits
     *  513 - 1024 bytes: 377 bits
     *  1025 - 2048 bytes: 376 bits, >1KB - 2KB
     *  2049 - 4096 bytes: 375 bits, >2KB - 4KB
     * 
     *  4097 - 8192 bytes: 374 bits, >4KB - 8KB
     *  8193 - 16384 bytes: 373 bits, >8KB - 16KB
     *  16385 - 32768 bytes: 372 bits, >16KB - 32KB
     *  32769 - 65536 bytes: 371 bits, >32KB - 64KB
     *  65537 - 131072 bytes: 370 bits, >64KB - 128KB
     *  131073 - 262144 bytes: 369 bits, >128KB - 256KB
     *  262145 - 524288 bytes: 368 bits, >256KB - 512KB
     *  524289 - 1048576 bytes: 367 bits, >512KB - 1MB
     * 
     *  1048577 - 2097152 bytes: 366 bits, >1MB - 2MB
     *  2097153 - 4194304 bytes: 365 bits, >2MB - 4MB
     *  4194305 - 8388608 bytes: 364 bits, >4MB - 8MB
     *  8388609 - 16777216 bytes: 363 bits, >8MB - 16MB
     *  16777217 - 33554432 bytes: 362 bits, >16MB - 32MB
     *  33554433 - 67108864 bytes: 361 bits, >32MB - 64MB
     *  67108865 - 134217728 bytes: 360 bits, >64MB - 128MB
     *  134217729 - 268435456 bytes: 359 bits, >128MB - 256MB
     * 
     *  268435457 - 536870912 bytes: 358 bits, >256MB - 512MB
     *  536870913 - 1073741824 bytes: 357 bits, >512MB - 1GB
     *  1073741825 - 2147483648 bytes: 356 bits, >1GB - 2GB
     *  2147483649 - 4294967296 bytes: 355 bits, >2GB - 4GB
     *  4294967297 - 8589934592 bytes: 354 bits, >4GB - 8GB
     *  8589934593 - 17179869184 bytes: 353 bits, >8GB - 16GB
     *  17179869185 - 34359738368 bytes: 352 bits, >16GB - 32GB
     *  34359738369 - 68719476736 bytes: 351 bits, >32GB - 64GB
     * 
     *  68719476737 - 137438953472 bytes: 350 bits, >64GB - 128GB
     *  137438953473 - 274877906944 bytes: 349 bits, >128GB - 256GB
     *  274877906945 - 549755813888 bytes: 348 bits, >256GB - 512GB
     *  549755813889 - 1099511627776 bytes: 347 bits, >512GB - 1TB
     *  1099511627777 - 2199023255552 bytes: 346 bits, >1TB - 2TB
     *  2199023255553 - 4398046511104 bytes: 345 bits, >2TB - 4TB
     *  4398046511105 - 8796093022208 bytes: 344 bits, >4TB - 8TB
     *  8796093022209 - 17592186044416 bytes: 343 bits, >8TB - 16TB
     * 
     *  17592186044417 - 35184372088832 bytes: 342 bits, >16TB - 32TB
     *  35184372088833 - 70368744177664 bytes: 341 bits, >32TB - 64TB
     *  70368744177665 - 140737488355328 bytes: 340 bits, >64TB - 128TB
     *  140737488355329 - 281474976710656 bytes: 339 bits, >128TB - 256TB
     *  281474976710657 - 562949953421312 bytes: 338 bits, >256TB - 512TB
     *  562949953421313 - 1125899906842624 bytes: 337 bits, >512TB - 1PB
     *  1125899906842625 - 2251799813685248 bytes: 336 bits, >1PB - 2PB
     *  2251799813685249 - 4503599627370496 bytes: 335 bits, >2PB - 4PB
     * 
     *  4503599627370497 - 9007199254740992 bytes: 334 bits, >4PB - 8PB
     *  9007199254740993 - 18014398509481984 bytes: 333 bits, >8PB - 16PB
     *  18014398509481985 - 36028797018963968 bytes: 332 bits, >16PB - 32PB
     *  36028797018963969 - 72057594037927936 bytes: 331 bits, >32PB - 64PB
     *  72057594037927937 - 144115188075855872 bytes: 330 bits, >64PB - 128PB 
     * 
     * @note streaming security is fixed at 326 bits, see CryptUtil.createTransformer for more information.
     * 
     * @note the security for non-streaming key/nonce pairs is the lowest value for a given generated ctr key, so if two 
     * identical ctr keys are generated, one for encrypting 32 bytes and the other 268435456 bytes, the security for that 
     * particular ctr key will be 359 bits, not 382 bits.
     *  
     *   Explained: Suppose one encrypted something extremely large, leaving only 1 bit left for the nonce. This means we 
     *   can only encrypt one more time before the nonce is reused, even if we only encrypt 1 byte. The first operation 
     *   would have used every possible nonce value besides one. Therefore, the security using the same CTR key is set to 
     *   the lowest value determined by the largest data size encrypted with it.
     * 
     * @important The first bit of the first byte of the generated nonce is flipped to 1 for streaming encryption, and 0 for 
     * non-streaming encryption. This way the security level of the non-streaming encryption is not limited by the streaming 
     * encryption's security level.
     * 
     * @important CTR nonce format:
     * 
     * The first bit of the first byte is 0 if not streaming, 1 if streaming
     * The last 53 bits are X or 0, depending on the maxBytesToEncrypt value
     * 
     * S = streaming/non-streaming bit
     * X = random bits
     * V = X or 0, depending on the maxBytesToEncrypt value
     * 
     * SXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXVVVVV VVVVVVVV VVVVVVVV VVVVVVVV VVVVVVVV VVVVVVVV VVVVVVVV
     * 
     * @param cryptKey The crypt key for encrypting the data.
     * @param salt The salt used for deriving the CTR key and nonce.
     * @param maxBytesToEncrypt The maximum number of bytes we are allowed to encrypt, or are encrypting.
     * @returns The derived CTR key, nonce, and the number of bits required for the counter.
     */
    private async deriveCTRKeyAndNonce(cryptKey:CRYPTKey, salt:Hex_512, maxBytesToEncrypt:number, streaming:boolean):Promise<{ctrKey:CTRKey, nonce:Hex_128, bitsReservedForCounter:uint}>
    {
        try
        {
            //derive bytes using supplied crypt key and salt
            const derivedBytes = await this._app.byteUtil.derive(cryptKey as unknown as HKDFKey, salt, 48); //we don't want other parts of the app to treat crypt keys as hkdf keys, so we cast it here

            //extract the ctr key material
            const ctrKeyMaterial = derivedBytes.slice(0, 32) as Hex_256;

            //extract the nonce
            const nonce = derivedBytes.slice(32, 48) as Hex_128;

            //create the counter by clearing the appropriate number of bits
            const blocksToEncrypt = Math.ceil(maxBytesToEncrypt / 16) as uint; //divide by 16 and ceil to get the number of blocks
            const bitsReservedForCounter = this._app.integerUtil.calculateBitsNeededToRepresent(blocksToEncrypt); 

            //we do not allow greater than 2^53 - 1 blocks to be encrypted
            if (bitsReservedForCounter > 53) this._app.throw('too many bytes', [], {correctable:true}); 

            //clear the bits needed for the counter
            this._app.bitUtil.set(nonce, 0, 128 - bitsReservedForCounter as uint);

            //if streaming, set the first bit to 1, otherwise set the bit to 0
            nonce[0] = (streaming === true) ? nonce[0] | 0b10000000 : nonce[0] & 0b01111111;
            
            //import the ctr key from the ctr key material
            const ctrKey = await this._app.keyUtil.import(ctrKeyMaterial, KeyType.CTR, false);

            return {ctrKey, nonce, bitsReservedForCounter};
        }
        catch (error)
        {
            this._app.throw('ctr key and nonce derivation failed', [], {correctable:true});
        }
    }

    /**
     * Retrieves a transformer for encrypting or decrypting data streams based on the given CRYPT key and part index. 
     * For encryption without a provided stream header, it returns a transformer and a promise that resolves with a new CRYPT stream header.
     * For decryption with a provided stream header, it returns a transformer for the decryption process.
     *
     * Stream Header Format for Encryption:
     * | Segment                                 | Size (Bytes) | Description                                                                       |
     * |-----------------------------------------|--------------|-----------------------------------------------------------------------------------|
     * | Salt                                    | 64           | Salt used to derive the CTR key and nonce.                                        |
     * | Header Data                             | 12           | Encrypted metadata including chunk size, last chunk size, and chunk count.        |
     * | HMAC Signature 1                        | 48           | HMAC signature covering the salt and header data.                                 |
     * | Chunk Signatures                        | Variable     | Concatenation of all signature tags for the encrypted chunks.                     |
     * | HMAC Signature 2                        | 48           | HMAC signature covering the chunk signatures.                                     |
     * | ....Chunk Data                          | Variable     | Encrypted chunk data                                                              |
     *
     * Header Data Format:
     * | Segment         | Size (Bytes) | Description                                            |
     * |-----------------|--------------|--------------------------------------------------------|
     * | Chunk Size      | 4            | Size of each chunk, excluding the last one.            |
     * | Last Chunk Size | 4            | Size of the last chunk in the stream.                  |
     * | Chunk Count     | 4            | Total number of chunks in the encrypted stream.        |
     * 
     * The maximum amount of data that can be encrypted depends on the chunk size, with a maximum chunk size of 256 MB, and a maximum amount of data that can be encrypted of 1 Exabyte.
     * 
     *   65536 chunks maxiumum per stream. (2^16)
     *   65536 parts maximum per stream. (2^16)
     *   256 MB maximum chunk size. (2^24 * 16)
     * 
     *   Assuming a chunk size of 256 MB:
     *   Maximum part size: 256 MB * 65536 = 16 TB
     *   Maximum amount of data that can be encrypted: 16 TB * 65536 = 1 EX
     * 
     *   Assuming a chunk size of 512 KB:
     *   Maximum part size: 512 KB * 65536 = 32 GB
     *   Maximum amount of data that can be encrypted: 32 GB * 65536 = 2 PB
     * 
     *   Assuming a chunk size of 1 KB:
     *   Maximum part size: 1 KB * 65536 = 64 MB
     *   Maximum amount of data that can be encrypted: 64 MB * 65536 = 4 TB
     * 
     * The security level is a fixed 326 bits:
     *   256 bit key + 128 bit nonce = 384 bits
     *   384 bits - 24 bits for the counter = 360 bits
     *   360 bits - 16 bits for the chunk index = 344 bits
     *   344 bits - 16 bits for the part index = 328 bits
     *   328 bits - 1 bit for the header/chunk differentiation = 327 bits
     *   327 bits - 1 bit for the streaming/non-streaming differentiation = 326 bits
     * 
     * @important CTR nonce format:
     * 
     * The first bit of the first byte is always 1, the streaming bit
     * The second and third bytes are reserved for the part index
     * The fourth and fifth bytes are reserved for the chunk index
     * The first bit of the sixth byte is a 0 for header, 1 for chunk
     * The last three bytes are reserved for the counter
     * 
     * S = streaming bit
     * X = random bits
     * P = part index
     * C = chunk index
     * Y = header/chunk bit
     * 
     * SXXXXXXX PPPPPPPP PPPPPPPP CCCCCCCC CCCCCCCC YXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX 00000000 00000000 00000000
     * 
     * @param {CryptKey} cryptKey - The master key for encryption and decryption.
     * @param {number} partIndex - The index of the data part within the stream, used for counter derivation.
     * @param {CRYPT_StreamHeader} [streamHeader] - The stream header for decryption. If not provided, assumed encryption operation.
     * @returns {[ITransformer, Promise<CRYPT_StreamHeader>] | ITransformer} For encryption, returns an array containing the transformer and a promise for the stream header. For decryption, returns the transformer directly.
     */
    public createTransformer(cryptKey:CRYPTKey, partIndex:number):[ITransformer, Promise<CRYPT_StreamHeader | IAborted | IError>, format:CRYPTFormat];
    public createTransformer(cryptKey:CRYPTKey, partIndex:number, streamHeader:CRYPT_StreamHeader, format:CRYPTFormat):ITransformer;
    public createTransformer(cryptKey:CRYPTKey, partIndex:number, streamHeader?:CRYPT_StreamHeader, format?:CRYPTFormat):[ITransformer, Promise<CRYPT_StreamHeader | IAborted | IError>, format:CRYPTFormat] | ITransformer
    {
        const MAXIMUM_SIZE = 2**24 * 16; //2^24 blocks * 16 bytes each = 256 MB
        const ref = this;
        const app = this._app;

        //encrypt
        if (streamHeader === undefined)
        {
            const encrypt =
            {
                initialized:false,
                chunkSize:0,
                lastChunkSize:0,
                chunkSignatures:[] as Hex_384[],
                encryptedSize:0,
    
                salt:undefined as Salt | undefined,
    
                ctrKey:undefined as CTRKey | undefined,
                counter:undefined as Hex_128 | undefined,
                bitsReservedForCounter:-1,
            }

            const promise = new ResolvePromise<CRYPT_StreamHeader | IAborted | IError>();

            async function transformer(chunk:Uint8Array, flush:false):Promise<Uint8Array | undefined | IAborted | IError>;
            async function transformer(chunk:Uint8Array | undefined, flush:true, success:true):Promise<Uint8Array | undefined | IAborted | IError>;
            async function transformer(chunk:IAborted | IError, flush:true, success:false):Promise<undefined | IAborted | IError>;
            async function transformer(chunk:Uint8Array | undefined | IAborted | IError, flush:boolean, success?:boolean):Promise<Uint8Array | undefined | IAborted | IError>
            {
                try
                {
                    //check if we need to create the stream header
                    if (flush === true) 
                    {
                        //we need to resolve the promise if the transform failed
                        if (success === false)
                        {
                            promise.resolve(chunk as IAborted | IError);
                            return chunk;
                        }

                        const counter = encrypt.counter!.slice() as Hex_128;
                        const ctrKey = encrypt.ctrKey!;
                        const salt = encrypt.salt!;
                        const chunkAuthTags = encrypt.chunkSignatures;
                        const chunkSize = encrypt.chunkSize;
                        const lastChunkSize = encrypt.lastChunkSize;
                        const bitsReservedForCounter = encrypt.bitsReservedForCounter;

                        //flip the 1st bit of the 6th byte to 0 to indicate a stream header iv
                        counter[5] &= 0b01111111;

                        const header = [] as Uint8Array[];

                        //create the initial data for the stream (first 4 bytes is the chunk size, next 4 bytes is the last chunk size, next 4 bytes is the chunk count)
                        const initialData = new Uint8Array(12);
                        initialData.set(app.integerUtil.toUint8Array(chunkSize as uint, false).slice(4), 0);
                        initialData.set(app.integerUtil.toUint8Array(lastChunkSize as uint, false).slice(4), 4);
                        initialData.set(app.integerUtil.toUint8Array(chunkAuthTags.length as uint, false).slice(4), 8);

                        //encrypt the initial data, 12 bytes
                        const encryptedHeader = await ref.__encryptCTR(ctrKey, initialData, counter, bitsReservedForCounter as uint); 

                        header.push(salt);
                        header.push(encryptedHeader);

                        //derive signature for the salt and encrypted initial data
                        const pae1 = app.hmacUtil.derivePAE([salt, encryptedHeader]);
                        const signature1 = await app.hmacUtil.derive(cryptKey.hmacKey, pae1, HMACOutputFormat.Hex);
                        header.push(signature1);

                        //derive signature from chunk auth tags
                        const pae2 = app.hmacUtil.derivePAE(chunkAuthTags);
                        const signature2 = await app.hmacUtil.derive(cryptKey.hmacKey, pae2, HMACOutputFormat.Hex);
                        
                        //add the chunk auth tags to the header
                        header.push(...chunkAuthTags);

                        //add the second signature to the header
                        header.push(signature2);

                        //resolve the promise with the stream header
                        promise.resolve(app.byteUtil.concat(header) as CRYPT_StreamHeader);

                        return chunk;
                    }

                    if (chunk === undefined) return chunk;

                    //check if we have initialized the encryption process
                    if (encrypt.initialized !== true) 
                    {
                        //generate the salt
                        const salt = await ref.generateSalt();

                        //derive the ctr key and counter           
                        const {ctrKey, nonce: counter, bitsReservedForCounter} = await ref.deriveCTRKeyAndNonce(cryptKey, salt, MAXIMUM_SIZE, true);

                        encrypt.chunkSize = (chunk as Uint8Array).length;

                        encrypt.salt = salt;

                        encrypt.ctrKey = ctrKey;
                        encrypt.counter = counter;
                        encrypt.bitsReservedForCounter = bitsReservedForCounter;

                        encrypt.initialized = true;
                    }

                    //this will be the correct last chunk size once we are done
                    encrypt.lastChunkSize = (chunk as Uint8Array).length;

                    const ctrKey = encrypt.ctrKey!;
                    const counter = encrypt.counter!.slice();
                    const chunkAuthTags = encrypt.chunkSignatures;
                    const chunkIndex = chunkAuthTags.length;
                    const bitsReservedForCounter = encrypt.bitsReservedForCounter;

                    //verify that neither the part or chunk index are greater than 2^16
                    if (partIndex > 2**16 || chunkIndex > 2**16) app.throw('part or chunk index too large', [], {correctable:true});

                    //ensure we don't encrypt too many bytes
                    if ((chunk as Uint8Array).length > MAXIMUM_SIZE) app.throw('too many bytes', [], {correctable:true});

                    //set the second and third bytes of the counter to the part index
                    counter.set(app.integerUtil.toUint8Array(partIndex as uint, false).slice(6), 1);

                    //set the next 2 bytes of the counter to the chunk index
                    counter.set(app.integerUtil.toUint8Array(chunkIndex as uint, false).slice(6), 3);

                    //flip the 1st bit of the 6th byte to 1 to indicate a chunk counter
                    counter[5] |= 0b10000000;

                    //encrypt the chunk
                    const encryptedChunk = await ref.__encryptCTR(ctrKey, chunk as Uint8Array, counter as Hex_128, bitsReservedForCounter as uint);

                    //derive signature from the encrypted data
                    const pae = app.hmacUtil.derivePAE([encryptedChunk]);
                    const signature = await app.hmacUtil.derive(cryptKey.hmacKey, pae, HMACOutputFormat.Hex);

                    //add the signatures to the chunkSignatures array
                    encrypt.chunkSignatures.push(signature);

                    //return the encrypted chunk
                    return encryptedChunk;
                }
                catch (e)
                {
                    const error = app.warn({}, 'encryption failed', [], {names:[CryptUtil, ref.createTransformer]});
                    
                    return promise.resolve(error);
                }
            }

            return [transformer as unknown as ITransformer, promise, CURRENT_CRYPT_FORMAT];
        }

        //decrypt
        const decrypt =
        {
            initialized:false,
            bytes:new Uint8Array(0),

            chunkSize:0,
            lastChunkSize:0,
            chunkSignatures:[] as Hex_384[],

            ctrKey:undefined as CTRKey | undefined,
            counter:undefined as Hex_128 | undefined,
            bitsReservedForCounter:-1,
            
            chunks:[] as Uint8Array[],
            chunksProcessed:0, 

            streamHeader:streamHeader,
        }

        if (format !== CURRENT_CRYPT_FORMAT) app.throw('Invalid format given', [], {correctable:true});

        async function transformer(chunk:Uint8Array, flush:false):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined, flush:true, success:true):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:IAborted | IError, flush:true, success:false):Promise<undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined | IAborted | IError, flush:boolean, success?:boolean):Promise<Uint8Array | undefined | IAborted | IError>
        {
            try
            {
                if (flush === true) return chunk;
                
                if (decrypt.initialized !== true)
                {
                    const streamHeader = decrypt.streamHeader;

                    let offset = 0;

                    //extract the salt
                    const salt = streamHeader.slice(offset, offset + 64) as Hex_512;
                    offset += 64;

                    //extract the encrypted header data
                    const encryptedHeader = streamHeader.slice(offset, offset + 12) as CTR<Uint8Array>;
                    offset += 12;

                    //extract the hmac signature
                    const signature1 = streamHeader.slice(offset, offset + 48) as Hex_384;
                    offset += 48;

                    //verify the signature from the salt and encrypted header
                    const pae1 = app.hmacUtil.derivePAE([salt, encryptedHeader]);
                    if (await app.hashUtil.verify(cryptKey.hmacKey, pae1, signature1) === false) app.throw('HMAC verification failed', []);

                    //derive the ctr key and counter
                    const {ctrKey, nonce: counter, bitsReservedForCounter} = await ref.deriveCTRKeyAndNonce(cryptKey, salt, MAXIMUM_SIZE, true);

                    //flip the 1st bit of the 6th byte to 0 to indicate a stream header iv
                    counter[5] &= 0b01111111;

                    //decrypt the initial data
                    const decryptedHeader = app.extractOrRethrow(await ref.__decryptCTR(ctrKey, encryptedHeader, counter, bitsReservedForCounter));
                    
                    //extract the chunk size
                    const chunkSize = app.integerUtil.fromUint8Array(decryptedHeader.slice(0, 4), false);

                    //extract the last chunk size
                    const lastChunkSize = app.integerUtil.fromUint8Array(decryptedHeader.slice(4, 8), false);

                    //extract the chunk count
                    const chunkCount = app.integerUtil.fromUint8Array(decryptedHeader.slice(8, 12), false);

                    //extract the chunk signatures
                    const chunkSignatureData = streamHeader.slice(offset, offset + (chunkCount * 48));
                    offset += chunkCount * 48;

                    //fill the chunk signatures array
                    const chunkSignatures = decrypt.chunkSignatures;
                    for (let i = 0; i < chunkCount; i++) chunkSignatures[i] = chunkSignatureData.slice(i * 48, (i + 1) * 48) as Hex_384;
        
                    //extract the hmac
                    const signature2 = streamHeader.slice(offset, offset + 48) as Hex_384;
                    offset += 48;

                    //verify the signature from the chunk signatures
                    const pae2 = app.hmacUtil.derivePAE(chunkSignatures);
                    if (await app.hashUtil.verify(cryptKey.hmacKey, pae2, signature2) === false) app.throw('HMAC verification failed', []);

                    decrypt.chunkSize = chunkSize;
                    decrypt.lastChunkSize = lastChunkSize;
                    decrypt.ctrKey = ctrKey;
                    decrypt.counter = counter;
                    decrypt.bitsReservedForCounter = bitsReservedForCounter;

                    decrypt.initialized = true;
                }

                let chunks:Uint8Array[] = [];

                const bytes = new Uint8Array(decrypt.bytes.length + (chunk as Uint8Array).length);
                bytes.set(decrypt.bytes);
                bytes.set(chunk as Uint8Array, decrypt.bytes.length);
                decrypt.bytes = bytes;

                //due to the variable length of the encrypted data, decypting is going to take a bit more work
                while (true)
                {
                    const totalChunkCount = decrypt.chunkSignatures.length;
                    const chunksProcessed = decrypt.chunksProcessed;
                    const chunkSize = decrypt.chunkSize;
                    const lastChunkSize = decrypt.lastChunkSize;
                    const bitsReservedForCounter = decrypt.bitsReservedForCounter;

                    //figure out how many bytes we need to process the next chunk
                    const bytesNeededToProcessChunk = chunksProcessed === totalChunkCount - 1 ? lastChunkSize : chunkSize;

                    //check if we have enough bytes to process the next chunk. if not, return undefined
                    if (decrypt.bytes.length < bytesNeededToProcessChunk) return undefined;

                    const ctrKey = decrypt.ctrKey!;
                    const counter = decrypt.counter!.slice();

                    //set the second and third bytes of the counter to the part index
                    counter.set(app.integerUtil.toUint8Array(partIndex as uint, false).slice(6), 1);

                    //set the next 2 bytes of the counter to the chunk index
                    counter.set(app.integerUtil.toUint8Array(decrypt.chunksProcessed as uint, false).slice(6), 3);

                    //flip the 1st bit of the 6th byte to 1 to indicate a chunk iv
                    counter[5] |= 0b10000000;

                    //extract the encrypted chunk
                    const encryptedChunk = decrypt.bytes.slice(0, bytesNeededToProcessChunk) as CTR<Uint8Array>;

                    //verify the signature
                    const signature = decrypt.chunkSignatures[decrypt.chunksProcessed];
                    const pae = app.hmacUtil.derivePAE([encryptedChunk]);
                    if (await app.hashUtil.verify(cryptKey.hmacKey, pae, signature) === false) app.throw('HMAC verification failed', []);

                    //decrypt the chunk
                    const decryptedChunk = app.extractOrRethrow(await ref.__decryptCTR(ctrKey, encryptedChunk, counter as Hex_128, bitsReservedForCounter as uint));

                    decrypt.chunks.push(decryptedChunk);
                    decrypt.bytes = decrypt.bytes.slice(bytesNeededToProcessChunk);
                    decrypt.chunksProcessed++;

                    //if bytes is greater than 0 we have more chunks to process, otherwise we might have more chunks to process
                    if (decrypt.bytes.length > 0) 
                    {
                        //we need to go through the while loop again, as we may have enough bytes to process another chunk
                        continue;
                    }

                    //return what we have and reset the chunks
                    chunks = decrypt.chunks;
                    decrypt.chunks = [];
                
                    break;
                }
                
                return app.byteUtil.concat(chunks);
            }
            catch (error)
            {
                return app.warn({}, 'decryption failed', [], {names:[CryptUtil, ref.createTransformer]});
            }
        }
        
        return transformer as unknown as ITransformer;
    }

    /**
     * Encrypt/Decrypt a data stream using AES-CTR with a random key and nonce.
     * 
     * Stream Header (112 bytes) | [[Chunk header (52 bytes) | Chunk Data (n bytes)], ...]
     * 
     * The Stream Header format is detailed in the table below:
     * 
     * | Segment                             | Size (Bytes) | Purpose                                              |
     * |-------------------------------------|--------------|------------------------------------------------------|
     * | Salt                                | 64           | Salt used to derive the CTR key and nonce            |
     * | HMAC                                | 48           | HMAC signature for salt.                             |
     * 
     * The Chunk Header format is detailed in the table below:
     * 
     * | Segment                        | Size (Bytes) | Purpose                                           |
     * |--------------------------------|--------------|---------------------------------------------------|
     * | Chunk data length              | 4            | The length of the chunk data, CTR encrypted.      |
     * | HMAC signature                 | 48           | Signature of encrypted chunk data length.         |
     * 
     * The Chunk Data format is detailed in the table below:
     * 
     * | Segment                        | Size (Bytes) | Purpose                                           |
     * |--------------------------------|--------------|---------------------------------------------------|
     * | Chunk data                     | Variable     | Chunk data, CTR encrypted.                        |
     * | HMAC signature                 | 48           | Signature of encrypted chunk data                 |
     * 
     * The maximum amount of data that can be encrypted depends on the chunk size, with a maximum chunk size of 256 MB, and a maximum amount of data that can be encrypted of 1 Exabyte.
     * 
     *   65536 chunks maxiumum per stream. (2^16)
     *   65536 parts maximum per stream. (2^16)
     *   256 MB maximum chunk size. (2^24 * 16)
     * 
     *   Assuming a chunk size of 256 MB:
     *   Maximum part size: 256 MB * 65536 = 16 TB
     *   Maximum amount of data that can be encrypted: 16 TB * 65536 = 1 EX
     * 
     *   Assuming a chunk size of 512 KB:
     *   Maximum part size: 512 KB * 65536 = 32 GB
     *   Maximum amount of data that can be encrypted: 32 GB * 65536 = 2 PB
     * 
     *   Assuming a chunk size of 1 KB:
     *   Maximum part size: 1 KB * 65536 = 64 MB
     *   Maximum amount of data that can be encrypted: 64 MB * 65536 = 4 TB
     * 
     * The security level is a fixed 326 bits:
     *   256 bit key + 128 bit nonce = 384 bits
     *   384 bits - 24 bits for the counter = 360 bits
     *   360 bits - 16 bits for the chunk index = 344 bits
     *   344 bits - 16 bits for the part index = 328 bits
     *   328 bits - 1 bit for the header/chunk differentiation = 327 bits
     *   327 bits - 1 bit for the streaming/non-streaming differentiation = 326 bits
     * 
     * @important nonce format:
     * 
     * The first bit of the first byte is always 1, the streaming bit
     * The second and third bytes are reserved for the part index
     * The fourth and fifth bytes are reserved for the chunk index
     * The first bit of the sixth byte is a 0 for header, 1 for chunk
     * The last three bytes are reserved for the counter
     * 
     * S = streaming bit
     * X = random bits
     * P = part index
     * C = chunk index
     * Y = header/chunk bit
     * 
     * SXXXXXXX PPPPPPPP PPPPPPPP CCCCCCCC CCCCCCCC YXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX XXXXXXXX 00000000 00000000 00000000
     */
    public createVariableTransformer(cryptKey:CRYPTKey, partIndex:number):[IVariableTransformer, format:CRYPTFormat];
    public createVariableTransformer(cryptKey:CRYPTKey, partIndex:number, format:CRYPTFormat):IVariableTransformer;
    public createVariableTransformer(cryptKey:CRYPTKey, partIndex:number, format?:CRYPTFormat):[IVariableTransformer, format:CRYPTFormat] | IVariableTransformer
    {
        const MAXIMUM_SIZE = 2**24 * 16; //2^24 blocks * 16 bytes each = 256 MB
        const ref = this;
        const app = this._app;

        //encrypt if format is undefined
        if (format === undefined)
        {
            const encrypt =
            {
                initialized:false,
                ctrKey:undefined as CTRKey | undefined,
                counter:undefined as Hex_128 | undefined,
                bitsReservedForCounter:-1,
                chunkIndex:0,
            }

            async function transformer(chunk:Uint8Array, flush:false):Promise<Uint8Array | undefined | IAborted | IError>;
            async function transformer(chunk:Uint8Array | undefined, flush:true, success:true):Promise<Uint8Array | undefined | IAborted | IError>;
            async function transformer(chunk:IAborted | IError, flush:true, success:false):Promise<undefined | IAborted | IError>;
            async function transformer(chunk:Uint8Array | undefined | IAborted | IError, flush:boolean, success?:boolean):Promise<Uint8Array | undefined | IAborted | IError>
            {
                try
                {
                    if (flush === true) return chunk;

                    const results = [];

                    //check if we have initialized the encryption process
                    if (encrypt.initialized !== true) 
                    {
                        //generate the salt
                        const salt = await ref.generateSalt();

                        //derive the ctr key and counter            
                        const {ctrKey, nonce: counter, bitsReservedForCounter} = await ref.deriveCTRKeyAndNonce(cryptKey, salt, MAXIMUM_SIZE, true);

                        //derive signature from salt
                        const pae = app.hmacUtil.derivePAE([salt]);
                        const signature = (await app.hmacUtil.derive(cryptKey.hmacKey, pae, HMACOutputFormat.Hex));

                        //concatenate salt and signature
                        const header = new Uint8Array(salt.length + signature.length);
                        header.set(salt);
                        header.set(signature, salt.length);

                        //push the stream header
                        results.push(header);

                        encrypt.ctrKey = ctrKey;
                        encrypt.counter = counter;
                        encrypt.bitsReservedForCounter = bitsReservedForCounter;

                        encrypt.initialized = true;
                    }

                    const ctrKey = encrypt.ctrKey!;
                    const counter = encrypt.counter!;
                    const bitsReservedForCounter = encrypt.bitsReservedForCounter;

                    //verify that neither the part or chunk index are greater than 2^16
                    if (partIndex > 2**16 || encrypt.chunkIndex > 2**16) app.throw('part or chunk index too large', [], {correctable:true});

                    //ensure we don't encrypt too many bytes
                    if ((chunk as Uint8Array).length > MAXIMUM_SIZE) app.throw('too many bytes', [], {correctable:true});

                    //set the second and third bytes of the counter to the part index
                    counter.set(app.integerUtil.toUint8Array(partIndex as uint, false).slice(6), 1);

                    //set the next 2 bytes of the counter to the chunk index
                    counter.set(app.integerUtil.toUint8Array(encrypt.chunkIndex as uint, false).slice(6), 3);

                    //be sure to increment the chunk index
                    encrypt.chunkIndex++; 

                    //create a header, add the length of the encrypted chunk data
                    const decryptedHeader = new Uint8Array(4);
                    decryptedHeader.set(app.integerUtil.toUint8Array(((chunk as Uint8Array).length) as uint, false).slice(4), 0);

                    //flip the 1st bit of the 6th byte to 1 for the header iv
                    const headerCounter = new Uint8Array(counter);
                    headerCounter[5] |= 0b10000000;

                    //flip the 1st bit of the 6th byte to 0 for the data iv
                    const dataCounter = new Uint8Array(counter);
                    dataCounter[5] &= 0b01111111;

                    const promises = new Array(2);

                    //encrypt the header. the result should be 4 bytes
                    promises[0] = ref.__encryptCTR(ctrKey, decryptedHeader, headerCounter as Hex_128, bitsReservedForCounter as uint);

                    //encrypt the chunk
                    promises[1] = ref.__encryptCTR(ctrKey, chunk as Uint8Array, dataCounter as Hex_128, bitsReservedForCounter as uint);
                
                    //wait for both promises to resolve
                    const [encryptedHeader, encryptedData] = await Promise.all(promises);

                    //create a signature for the encrypted header
                    const pae1 = app.hmacUtil.derivePAE([encryptedHeader]);
                    promises[0] = app.hmacUtil.derive(cryptKey.hmacKey, pae1, HMACOutputFormat.Hex);

                    //create a signature for the encrypted data
                    const pae2 = app.hmacUtil.derivePAE([encryptedData]);
                    promises[1] = app.hmacUtil.derive(cryptKey.hmacKey, pae2, HMACOutputFormat.Hex);

                    //wait for both promises to resolve
                    const [signature1, signature2] = await Promise.all(promises);

                    results.push(encryptedHeader, signature1, encryptedData, signature2);

                    return app.byteUtil.concat(results);
                }
                catch (error)
                {
                    return app.warn({}, 'encryption failed', [], {names:[CryptUtil, ref.createVariableTransformer]});
                }
            }

            return [transformer as unknown as IVariableTransformer, 0 as uint];
        }

        //decrypt
        const decrypt =
        {
            state:0,
            bytes:new Uint8Array(0),
            
            bytesNeeded:Number.MAX_SAFE_INTEGER,
            chunks:[] as Uint8Array[],
            chunksProcessed:0,
            ctrKey:undefined as CTRKey | undefined,
            counter:undefined as Hex_128 | undefined,
            bitsReservedForCounter:-1,
        }

        async function transformer(chunk:Uint8Array, flush:false):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined, flush:true, success:true):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:IAborted | IError, flush:true, success:false):Promise<undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined | IAborted | IError, flush:boolean, success?:boolean):Promise<Uint8Array | undefined | IAborted | IError>
        {
            try
            {
                if (flush === true) return chunk;

                const encryptedStreamHeaderByteLength = 112;
                const encryptedChunkHeaderByteLength = 52;

                let chunks:Uint8Array[] = [];

                const bytes = new Uint8Array(decrypt.bytes.length + (chunk as Uint8Array).length);
                bytes.set(decrypt.bytes);
                bytes.set(chunk as Uint8Array, decrypt.bytes.length);
                decrypt.bytes = bytes;

                //due to the variable length of the encrypted data, decrypting is going to take a bit more work
                while (true)
                {
                    if (decrypt.state === 0)
                    {
                        //check if we have enough bytes to process the stream header. if not, return undefined
                        if (decrypt.bytes.length < encryptedStreamHeaderByteLength) return undefined;

                        //extract the encrypted header
                        const encryptedHeader = decrypt.bytes.slice(0, encryptedStreamHeaderByteLength);

                        //extract salt
                        const salt = encryptedHeader.slice(0, 64) as Hex_512;

                        //extract the hmac
                        const signature = encryptedHeader.slice(64, 112) as Hex_384;

                        //verify the signature
                        const pae = app.hmacUtil.derivePAE([salt]);
                        if (await app.hashUtil.verify(cryptKey.hmacKey, pae, signature) === false) app.throw('HMAC verification failed', []);

                        //derive the ctr key and counter
                        const {ctrKey, nonce: counter, bitsReservedForCounter} = await ref.deriveCTRKeyAndNonce(cryptKey, salt, MAXIMUM_SIZE, true);

                        decrypt.ctrKey = ctrKey;
                        decrypt.counter = counter;
                        decrypt.bitsReservedForCounter = bitsReservedForCounter;

                        decrypt.bytes = decrypt.bytes.slice(encryptedStreamHeaderByteLength);

                        decrypt.state = 1; //set the state to 1
                    }

                    //decrypt the chunk header, so we know how much data we need in order to decrypt
                    if (decrypt.state === 1)
                    {
                        //check if we have enough bytes to process the chunk header. if not, return undefined
                        if (decrypt.bytes.length < encryptedChunkHeaderByteLength) return undefined;

                        const ctrKey = decrypt.ctrKey!;
                        const counter = decrypt.counter!;
                        const bitsReservedForCounter = decrypt.bitsReservedForCounter;

                        //set the second and third bytes of the counter to the part index
                        counter.set(app.integerUtil.toUint8Array(partIndex as uint, false).slice(6), 1);

                        //set the next 2 bytes of the counter to the chunk index
                        counter.set(app.integerUtil.toUint8Array(decrypt.chunksProcessed as uint, false).slice(6), 3);

                        const headerCounter = new Uint8Array(counter) as Hex_128;

                        //flip the 1st bit of the 6th byte to 1 for the header iv
                        headerCounter[5] |= 0b10000000;

                        //extract the encrypted chunk header
                        const encryptedHeaderLength = decrypt.bytes.slice(0, 4) as CTR<Uint8Array>;

                        //extract the encrypted chunk header signature
                        const encryptedHeaderSignature = decrypt.bytes.slice(4, 52) as Hex_384;

                        //verify the signature
                        const pae = app.hmacUtil.derivePAE([encryptedHeaderLength]);
                        if (await app.hashUtil.verify(cryptKey.hmacKey, pae, encryptedHeaderSignature) === false) app.throw('HMAC verification failed', []);

                        //decrypt the chunk header
                        const decryptedHeader = app.extractOrRethrow(await ref.__decryptCTR(ctrKey, encryptedHeaderLength, headerCounter, bitsReservedForCounter as uint));

                        decrypt.bytesNeeded = app.integerUtil.fromUint8Array(decryptedHeader.slice(0, 4), false) + 48; //add 48 bytes for the chunk header signature
                        
                        decrypt.bytes = decrypt.bytes.slice(encryptedChunkHeaderByteLength);

                        decrypt.chunksProcessed++;

                        decrypt.state = 2; //set the state to 1
                    }

                    //check if the state is 2, if not, return undefined. we must wait for more bytes
                    if (decrypt.state !== 2) return undefined;

                    //check if we have enough bytes to process the next chunk. if not, return undefined
                    if (decrypt.bytes.length < decrypt.bytesNeeded) return undefined;

                    const ctrKey = decrypt.ctrKey!;
                    const counter = decrypt.counter!.slice();
                    const bitsReservedForCounter = decrypt.bitsReservedForCounter;

                    const encryptedChunkData = decrypt.bytes.slice(0, decrypt.bytesNeeded - 48) as CTR<Uint8Array>;

                    //verify the signature
                    const signature = decrypt.bytes.slice(decrypt.bytesNeeded - 48, decrypt.bytesNeeded) as Hex_384;
                    const pae = app.hmacUtil.derivePAE([encryptedChunkData]);
                    if (await app.hashUtil.verify(cryptKey.hmacKey, pae, signature) === false) app.throw('HMAC verification failed', []);

                    //update bytes to have the remaining data
                    decrypt.bytes = decrypt.bytes.slice(decrypt.bytesNeeded);

                    //flip the 1st bit of the 6th byte to 0 for the data iv
                    const dataCounter = new Uint8Array(counter);
                    dataCounter[5] &= 0b01111111;

                    const chunk = app.extractOrRethrow(await ref.__decryptCTR(ctrKey, encryptedChunkData, dataCounter as Hex_128, bitsReservedForCounter as uint));

                    decrypt.chunks.push(chunk);

                    if (decrypt.bytes.length > 0) 
                    {
                        //reset everything but bytes and chunks...there are more chunks to decrypt
                        decrypt.state = 1;
                        decrypt.bytesNeeded = Number.MAX_SAFE_INTEGER;

                        continue;
                    }

                    decrypt.state = 1; //reset the state
                    decrypt.bytesNeeded = Number.MAX_SAFE_INTEGER;

                    chunks = decrypt.chunks;
                    decrypt.chunks = [];
                
                    break;
                }
                
                return app.byteUtil.concat(chunks);
            }
            catch (error)
            {
                return app.warn({}, 'decryption failed', [], {names:[CryptUtil, ref.createVariableTransformer]});
            }
        }
        
        return transformer as unknown as IVariableTransformer;
    }

    /**
    * Encrypts data using AES-CBC.
    * 
    * This method encrypts the provided data using AES-CBC with the specified cryptographic key and a 16-byte IV.
    * It generates an HMAC for the encrypted data and IV for integrity verification.
    * The output includes the IV, the encrypted data, and the HMAC.
    * 
    * @note Includes HMAC for integrity verification, which is critical.
    * 
    * @note this will always add some padding to the data, even if the data is already a multiple of 16 bytes.
    * @see https://en.wikipedia.org/wiki/Padding_(cryptography)#PKCS7 for more details
    * 
    * @param {Uint8Array} data - The plaintext data to be encrypted.
    * @param {CBCKey} cbcKey - The cryptographic key for AES-CBC encryption.
    * @param {HMACKey} hmacKey - The cryptographic key for HMAC generation (optional).
    * @returns {Promise<Uint8Array>}
    */
    public async __encryptCBC<T extends Uint8Array>(cbcKey:CBCKey, data:T, hmacKey:HMACKey<HashType.SHA_256 | HashType.SHA_512>, options?:{iv?:Hex_128, additionalAuthenticatedData?:Uint8Array}):Promise<CBC<T>>
    {
        try
        {
            const additionalAuthenticatedData = options?.additionalAuthenticatedData ?? new Uint8Array(0);

            const iv = options?.iv ?? this._app.byteUtil.generate(16) as Hex_128;
            if (iv.length !== 16) this._app.throw('IV must be 16 bytes long', [], {correctable:true});

            //encrypt the data using AES-CBC
            const encryptedData = new Uint8Array(await crypto.subtle.encrypt({name:KeyType.CBC, iv}, cbcKey.cryptoKey, data)) as CBC<T>;
            
            //generate HMAC for the additionalAuthenticatedData + iv + encrypted data
            const pae = this._app.hmacUtil.derivePAE([additionalAuthenticatedData, iv, encryptedData]);
            const hmac = (await this._app.hmacUtil.derive(hmacKey as HMACKey<HashType.SHA_256>, pae, HMACOutputFormat.Hex));

            //concatenate iv, encrypted data, and HMAC
            const result = new Uint8Array(iv.length + encryptedData.length + hmac.length);
            result.set(iv);
            result.set(encryptedData, iv.length);
            result.set(hmac, iv.length + encryptedData.length);

            return result as CBC<T>;
        }
        catch (error)
        {
            this._app.throw('encryption failed', [], {correctable:true});
        }
    }

    /**
     * Encrypts data using AES-CTR without appending an HMAC for integrity verification.
     * 
     * @note this will always add some padding to the data, even if the data is already a multiple of 16 bytes.
     * @see https://en.wikipedia.org/wiki/Padding_(cryptography)#PKCS7 for more details
     */
    public async __encryptCBCWithoutHMAC<T extends Uint8Array>(cbcKey:CBCKey, data:T, options?:{iv?:Hex_128, embedIV?:false}):Promise<[CBC<T>, Hex_128]>;
    public async __encryptCBCWithoutHMAC<T extends Uint8Array>(cbcKey:CBCKey, data:T, options:{iv?:Hex_128, embedIV:true}):Promise<CBC<T>>;
    public async __encryptCBCWithoutHMAC<T extends Uint8Array>(cbcKey:CBCKey, data:T, options?:{iv?:Hex_128, embedIV?:boolean}):Promise<CBC<T> | [CBC<T>, Hex_128]>
    {
        try
        {
            const embedIV = options?.embedIV ?? false;

            const iv = options?.iv ?? this._app.byteUtil.generate(16) as Hex_128;
            if (iv.length !== 16) this._app.throw('IV must be 16 bytes long', [], {correctable:true});

            if (embedIV === true)
            { 
                //embed the id by prepending it to the data
                data = this._app.byteUtil.concat([iv, data]) as T;

                //encrypt the data using AES-CBC
                return new Uint8Array(await crypto.subtle.encrypt({name:KeyType.CBC, iv}, cbcKey.cryptoKey, data)) as CBC<T>;
            }

            //encrypt the data using AES-CBC
            return [new Uint8Array(await crypto.subtle.encrypt({name:KeyType.CBC, iv}, cbcKey.cryptoKey, data)) as CBC<T>, iv];
        }
        catch (error)
        {
            this._app.throw('encryption failed', [], {correctable:true});
        }
    }

    /**
     * Decrypts data encrypted using AES-CBC with HMAC verification for integrity.
     *
     * This method first extracts the IV and HMAC from the input data, then verifies the HMAC to ensure the integrity
     * of the encrypted data. Upon successful HMAC verification, it proceeds to decrypt the data using AES-CBC.
     * This approach ensures that the data has not been tampered with before attempting decryption, enhancing security.
     *
     * @param {Uint8Array} encrypted - The encrypted data to be decrypted, including the IV, ciphertext, and HMAC.
     * @param {CBCKey} cbcKey - The cryptographic key for AES-CBC decryption.
     * @param {HMACKey} hmacKey - The cryptographic key used for HMAC verification.
     * @returns {Promise<Uint8Array>} The decrypted plaintext data, if HMAC verification succeeds. Throws an error if HMAC verification fails.
     * @throws {Error} Throws an error if HMAC verification fails, indicating potential data tampering.
     *
     * @note The integrity of the decrypted data is dependent on the HMAC verification step. If verification fails,
     * it indicates that the data may have been tampered with, and the decryption process will halt with an error.
     */
    public async __decryptCBC<T extends Uint8Array=Uint8Array>(cbcKey:CBCKey, encrypted:CBC<T>, hmacKey:HMACKey<HashType.SHA_256 | HashType.SHA_512>, options?:{additionalAuthenticatedData?:Uint8Array}):Promise<T | IError>
    {
        try
        {
            const additionalAuthenticatedData = options?.additionalAuthenticatedData ?? new Uint8Array(0);

            //extract the IV
            const iv = encrypted.subarray(0, 16);

            //extract encrypted data
            const encryptedData = encrypted.subarray(16, -32);

            //extract the hmac signature
            const signature = encrypted.subarray(-32) as Hex_256;

            //verify signature before decrypting
            const pae = this._app.hmacUtil.derivePAE([additionalAuthenticatedData, iv, encryptedData]);
            if (await this._app.hashUtil.verify(hmacKey as HMACKey<HashType.SHA_256 | HashType.SHA_512>, pae, signature) === false) this._app.throw('HMAC verification failed', []);
        
            //decrypt the data using AES-CBC
            return new Uint8Array(await crypto.subtle.decrypt({name:KeyType.CBC, iv}, cbcKey.cryptoKey, encryptedData)) as T;
        }
        catch (error)
        {
            return this._app.warn({}, 'decryption failed', [], {errorOnly:true, names:[CryptUtil, this.__decryptCBC]});
        }
    }

    /**
     * Decrypts data encrypted using AES-CBC without HMAC verification.
     */
    public async __decryptCBCWithoutHMAC<T extends Uint8Array=Uint8Array>(cbcKey:CBCKey, encrypted:CBC<T>, options?:{iv?:Hex_128}):Promise<T | IError>
    {
        try
        {
            //if they supply an iv, that means the iv was not embedded in the data
            if (options?.iv !== undefined) return new Uint8Array(await crypto.subtle.decrypt({name:KeyType.CBC, iv:options.iv}, cbcKey.cryptoKey, encrypted)) as T;

            //decrypt the data using AES-CBC, and remove the "decrypted" iv from the result
            return new Uint8Array(await crypto.subtle.decrypt({name:KeyType.CBC, iv:new Uint8Array(16)}, cbcKey.cryptoKey, encrypted)).slice(16) as T;
        }
        catch (error)
        {
            return this._app.warn({}, 'decryption failed', [], {errorOnly:true, names:[CryptUtil, this.__decryptCBCWithoutHMAC]});
        }
    }

    /**
     * Encrypts data using AES-GCM.
     * 
     * This method encrypts the provided data using AES-GCM with the specified cryptographic key,
     * generating a random 12-byte IV for each encryption operation if one is not provided. The encrypted data
     * includes the IV followed by the encrypted message and the authentication tag.
     *
     * @note A 12 byte IV is essentially a requirement for AES-GCM, due to the way larger IVs are handled internally.
     *  
     * @important Do not use this in scenarios where an attacker can trigger encryption or if encrypting a large amounts of data (>32GB).
     * 
     * @param {Uint8Array} data - The plaintext data to be encrypted.
     * @param {GCMKey} gcmKey - The cryptographic key for AES-GCM encryption.
     * @returns {Promise<Uint8Array>} The AES-GCM encrypted data, including the IV, ciphertext, and authentication tag.
     */
    public async __encryptGCM<T extends Uint8Array=Uint8Array>(gcmKey:GCMKey, data:T, options?:{iv?:Hex_96, additionalAuthenticatedData?:Uint8Array}):Promise<GCM<T>>
    {
        try
        {
            const additionalAuthenticatedData = options?.additionalAuthenticatedData ?? new Uint8Array(0);
            
            const iv = options?.iv ?? this._app.byteUtil.generate(12) as Hex_96; //must be 12 bytes long or you introduce a chance at collision given how AES-GCM arbitrary-length IVs are constructed
            if (iv.length !== 12) this._app.throw('IV must be 12 bytes long', [], {correctable:true});

            const encryptedDataWithTag = new Uint8Array(await crypto.subtle.encrypt({name:KeyType.GCM, iv, additionalData:additionalAuthenticatedData, tagLength:128}, gcmKey.cryptoKey, data)); //do not use less than 128 for tagLength due to security concerns
            
            //concatenate iv, encrypted data and auth tag
            const result = new Uint8Array(iv.length + encryptedDataWithTag.length);
            result.set(iv);
            result.set(encryptedDataWithTag, iv.length);

            return result as GCM<T>;
        }
        catch (error)
        {
            this._app.throw('encryption failed', [], {correctable:true});
        }
    }

    /**
     * Decrypts data encrypted using AES-GCM.
     * 
     * This method decrypts the provided data, which includes the IV, ciphertext, and authentication tag,
     * using AES-GCM with the specified cryptographic key. The IV is extracted from the beginning of the data,
     * and the decryption operation verifies the authentication tag to ensure data integrity and authenticity.
     * 
     * @param {Uint8Array} encrypted - The AES-GCM encrypted data to be decrypted.
     * @param {GCMKey} gcmKey - The cryptographic key for AES-GCM decryption.
     * @returns {Promise<Uint8Array>} The decrypted plaintext data.
     */
    public async __decryptGCM<T extends Uint8Array=Uint8Array>(gcmKey:GCMKey, encrypted:GCM<T>, options?:{additionalAuthenticatedData?:Uint8Array}):Promise<T | IError>
    {  
        try
        {
            const additionalAuthenticatedData = options?.additionalAuthenticatedData ?? new Uint8Array(0);

            //extract the iv, authTag and encrypted data
            const iv = encrypted.subarray(0, 12);
            const encryptedDataWithTag = encrypted.subarray(12);

            return new Uint8Array(await crypto.subtle.decrypt({name:KeyType.GCM, iv, additionalData:additionalAuthenticatedData, tagLength:128}, gcmKey.cryptoKey, encryptedDataWithTag)) as T; //do not use less than 128 for tagLength due to security concerns
        }
        catch (error)
        {
            return this._app.warn({}, 'decryption failed', [], {errorOnly:true, names:[CryptUtil, this.__decryptGCM]});
        }
    }

    /**
     * Encrypts data using AES-CTR.
     * 
     * This method encrypts the provided data using AES-CTR with the specified cryptographic key and nonce.
     * 
     * @param {Uint8Array} data - The plaintext data to be encrypted.
     * @param {CTRKey} ctrKey - The cryptographic key for AES-CTR encryption.
     * @param {Hex_128} nonce - The nonce to use for encryption.
     * @param {uint} bitsReservedForCounter - The number of bits reserved for the counter.
     * @returns {Promise<Uint8Array>} The AES-CTR encrypted data.
     */
    private async __encryptCTR<T extends Uint8Array=Uint8Array>(key:CTRKey, data:T, nonce:Hex_128, bitsReservedForCounter:uint):Promise<CTR<T>>
    {
        try
        {
            return new Uint8Array(await crypto.subtle.encrypt({name:KeyType.CTR, counter:nonce, length:bitsReservedForCounter}, key.cryptoKey, data)) as CTR<T>;
        }
        catch (error)
        {
            this._app.throw('encryption failed', [], {correctable:true});
        }
    }

    /**
     * Decrypts data encrypted using AES-CTR.
     * 
     * This method decrypts the provided data using AES-CTR with the specified cryptographic key and nonce/counter.
     * 
     * @param {Uint8Array} encrypted - The encrypted data to be decrypted.
     * @param {CTRKey} ctrKey - The cryptographic key for AES-CTR decryption.
     * @param {Hex_128} nonce - The nonce used for encryption.
     * @param {uint} bitsReservedForCounter - The number of bits reserved for the counter.
     * @returns {Promise<Uint8Array>} The decrypted plaintext data.
     */
    private async __decryptCTR<T extends Uint8Array=Uint8Array>(key:CTRKey, encrypted:CTR<T>, nonce:Hex_128, bitsReservedForCounter:uint):Promise<T | IError>
    {
        try
        {
            return new Uint8Array(await crypto.subtle.decrypt({name:KeyType.CTR, counter:nonce, length:bitsReservedForCounter}, key.cryptoKey, encrypted)) as T;
        }
        catch (error)
        {
            return this._app.warn({}, 'decryption failed', [], {errorOnly:true, names:[CryptUtil, this.__decryptCTR]});
        }
    }
}