/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @important ALL changes to this util and dependant utils must be well tested!
 */

import { Hex, type hex } from './BaseUtil.ts';
import { SealedDecorator } from '../decorators/SealedDecorator.ts';
import { __toUint8Array } from './__internal/__random.ts';
import { __derivePAE } from './__internal/__pae.ts';
import { PAE } from './HMACUtil.ts';
import { emptystring } from './StringUtil.ts';
import { HMACKey, KeyType } from './KeyUtil.ts';
import { IBaseApp } from '../IBaseApp.ts';

export type hex_96 = hex & { _brand:'hex_96' }; //96 bits
export type hex_128 = hex & { _brand:'hex_128' }; //128 bits 
export type hex_160 = hex & { _brand:'hex_160' }; //sha-1
export type hex_256 = hex & { _brand:'hex_256' }; //sha-256
export type hex_384 = hex & { _brand:'hex_384' }; //sha-384
export type hex_512 = hex & { _brand:'hex_512' }; //sha-512
export type hex_1024 = hex & { _brand:'hex_1024' }; //1024 bits

export type Hex_96 = Hex & { _brand:'Hex_96' };
export type Hex_128 = Hex & { _brand:'Hex_128' };
export type Hex_160 = Hex & { _brand:'Hex_160' };
export type Hex_256 = Hex & { _brand:'Hex_256' };
export type Hex_384 = Hex & { _brand:'Hex_384' };
export type Hex_512 = Hex & { _brand:'Hex_512' };
export type Hex_1024 = Hex & { _brand:'Hex_1024' };

export type HashableData = Uint8Array & { _brand:'hashabledata' };
export type EncodedHashableData = PAE;

export enum HashType
{
    SHA_512 = 'SHA-512',
    SHA_384 = 'SHA-384',
    SHA_256 = 'SHA-256',
    SHA_1 = 'SHA-1',
}

export type HashSize = 128 | 160 | 256 | 384 | 512;

export enum HashOutputFormat
{
    hex = 'hex',
    Hex = 'Hex',
}

@SealedDecorator()
export class HashUtil<A extends IBaseApp<A>> 
{
    protected _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public async derive(input:HashableData | EncodedHashableData, type:HashType.SHA_1, format:HashOutputFormat.Hex):Promise<Hex_160>;
    public async derive(input:HashableData | EncodedHashableData, type:HashType.SHA_1, format:HashOutputFormat.hex):Promise<hex_160>;
    public async derive(input:HashableData | EncodedHashableData, type:HashType.SHA_256, format:HashOutputFormat.Hex):Promise<Hex_256>;
    public async derive(input:HashableData | EncodedHashableData, type:HashType.SHA_256, format:HashOutputFormat.hex):Promise<hex_256>;
    public async derive(input:HashableData | EncodedHashableData, type:HashType.SHA_384, format:HashOutputFormat.Hex):Promise<Hex_384>;
    public async derive(input:HashableData | EncodedHashableData, type:HashType.SHA_384, format:HashOutputFormat.hex):Promise<hex_384>;
    public async derive(input:HashableData | EncodedHashableData, type:HashType.SHA_512, format:HashOutputFormat.Hex):Promise<Hex_512>;
    public async derive(input:HashableData | EncodedHashableData, type:HashType.SHA_512, format:HashOutputFormat.hex):Promise<hex_512>;
    public async derive(input:HashableData | EncodedHashableData, type:HashType.SHA_1 | HashType.SHA_256 | HashType.SHA_384 | HashType.SHA_512, format:HashOutputFormat)
    {
        const arrayBuffer = await crypto.subtle.digest(type, input);

        return (format === HashOutputFormat.hex) ? this._app.baseUtil.toHex(new Uint8Array(arrayBuffer)) : new Uint8Array(arrayBuffer);
    }

    /**
     * Compares two strings or two Uint8Arrays in constant time to avoid timing attacks.
     * @param a - The first string/Uint8Array to compare.
     * @param b - The second string/Uint8Array to compare.
     * @returns Whether the two strings or Uint8Arrays are equal.
     */
    public verify(a:Uint8Array, b:Uint8Array):boolean;
    public verify(a:string, b:string):boolean;
    public verify(a:string | Uint8Array, b:string | Uint8Array):boolean;
    public verify(hmacKey:HMACKey<HashType.SHA_256 | HashType.SHA_384 | HashType.SHA_512>, pae:PAE, signature:Hex_256 | Hex_384 | Hex_512):Promise<boolean>;
    public verify(...args:any[]):boolean | Promise<boolean>
    {
        if (args.length === 3) 
        {
            const [hmacKey, pae, signature] = args as [HMACKey<HashType.SHA_256 | HashType.SHA_384 | HashType.SHA_512>, PAE, Hex_256 | Hex_384 | Hex_512];

            return crypto.subtle.verify(KeyType.HMAC, hmacKey.cryptoKey, signature, pae);
        }

        const [a, b] = args as [string | Uint8Array, string | Uint8Array];

        if (a.length !== b.length) return false;
        
        let result = 0;
        if (a instanceof Uint8Array === true) for (let i = 0, length = a.length; i < length; i++) result |= a[i] ^ (b as Uint8Array)[i];
        else for (let i = 0, length = a.length; i < length; i++) result |= a.charCodeAt(i) ^ (b as string).charCodeAt(i);
        
        return result === 0;
    }

    /**
     * Encodes multiple parts of data or a single data entity into a single byte stream using Pre-Authentication Encoding (PAE).
     * This method is versatile, accepting an array of data parts represented as `Uint8Array` objects or hex strings, 
     * or a single `Uint8Array` or hex string. It ensures that each data part's length is unambiguously encoded alongside 
     * the data itself, enabling clear separation and integrity of the data parts when combined. PAE is invaluable in cryptographic 
     * contexts for maintaining the integrity of structured data, offering protection against length extension attacks by encoding 
     * the length of each data part within the output.
     *
     * @note This method is designed for use with hashing functions; inputs can be pre-concatenated hex strings or Uint8Array.
     *
     * @param {Array<Uint8Array | hex> | Uint8Array | hex} dataParts - The data to be encoded, either as individual parts or a single entity.
     * @returns {EncodedHashableData} A `Uint8Array` representing the encoded output, which includes each part's length
     *                                and data in a concatenated sequence, ensuring distinct separability and structural integrity.
     *                                This format is crucial for cryptographic security, particularly for mitigating length extension attack risks.
     */
    public encodeData(dataParts:Array<Uint8Array | hex | emptystring> | Uint8Array | hex):EncodedHashableData
    {
        const app = this._app;

        if (app.typeUtil.isString(dataParts) === true) dataParts = [this._app.baseUtil.fromHex(dataParts)];
        else if (dataParts instanceof Uint8Array === true) dataParts = [dataParts];

        if (dataParts.length === 0) this._app.throw('Data parts must not be empty.', [], {correctable:true});

        const dataArray = [];
        for (const data of dataParts)
        {
            if (app.typeUtil.isString(data) === true) dataArray.push(data.length === 0 ? new Uint8Array(0) : this._app.baseUtil.fromHex(data as hex));
            else dataArray.push(data);
        }

        return __derivePAE(dataArray);
    }

    public generate(size:128, format:HashOutputFormat.hex):hex_128;
    public generate(size:128, format:HashOutputFormat.Hex):Hex_128;
    public generate(size:160, format:HashOutputFormat.hex):hex_160;
    public generate(size:160, format:HashOutputFormat.Hex):Hex_160;
    public generate(size:256, format:HashOutputFormat.hex):hex_256;
    public generate(size:256, format:HashOutputFormat.Hex):Hex_256;
    public generate(size:384, format:HashOutputFormat.hex):hex_384;
    public generate(size:384, format:HashOutputFormat.Hex):Hex_384;
    public generate(size:512, format:HashOutputFormat.hex):hex_512;
    public generate(size:512, format:HashOutputFormat.Hex):Hex_512;
    public generate(size:HashSize, format:HashOutputFormat)
    {
        switch (size)
        {
            case 128: 
            {
                const bytes = this._app.byteUtil.generate<Hex_128>(16);
                return format === HashOutputFormat.hex ? this._app.baseUtil.toHex<hex_128>(bytes) : bytes;
            }
            case 160: 
            {
                const bytes = this._app.byteUtil.generate<Hex_160>(20);
                return format === HashOutputFormat.hex ? this._app.baseUtil.toHex<hex_160>(bytes) : bytes;
            }
            case 256: 
            {
                const bytes = this._app.byteUtil.generate<Hex_256>(32);
                return format === HashOutputFormat.hex ? this._app.baseUtil.toHex<hex_256>(bytes) : bytes;
            }
            case 384: 
            {
                const bytes = this._app.byteUtil.generate<Hex_384>(48);
                return format === HashOutputFormat.hex ? this._app.baseUtil.toHex<hex_384>(bytes) : bytes;
            }
            case 512: 
            {
                const bytes = this._app.byteUtil.generate<Hex_512>(64);
                return format === HashOutputFormat.hex ? this._app.baseUtil.toHex<hex_512>(bytes) : bytes;
            }
        }
    }
}