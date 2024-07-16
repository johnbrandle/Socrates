/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { HashOutputFormat, HashType, HashUtil as Shared, type EncodedHashableData, type HashableData, type Hex_160, type Hex_256, type Hex_384, type Hex_512, type hex_160, type hex_256, type hex_384, type hex_512 } from '../../../../../../shared/src/library/utils/HashUtil.ts';
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import { ResolvePromise } from '../../../../../../shared/src/library/promise/ResolvePromise.ts';
import type { ITransformer } from './StreamUtil.ts';
import { __hashSHA256 } from './__internal/__sha256.ts';
import { createSHA256 } from 'hash-wasm';
import type { IAborted } from '../../../../../../shared/src/library/abort/IAborted.ts';
import type { IError } from '../../../../../../shared/src/library/error/IError.ts';
import type { IBaseApp } from '../IBaseApp.ts';

export * from '../../../../../../shared/src/library/utils/HashUtil.ts';

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
@SealedDecorator()
export class HashUtil<A extends IBaseApp<A>> extends Shared<A> 
{
    public constructor(app:A)
    {
        super(app);
    }

    /**
     * Computes a hash of the given data using the specified hash algorithm. This method is suitable for scenarios
     * where ensuring the integrity of data is necessary, but authentication (verifying the data's origin or ensuring 
     * it hasn't been tampered with by unauthorized parties) is not required. Hashing can be useful for creating 
     * digital fingerprints of data, checking data integrity after transmission or storage, or securely storing 
     * information like passwords (although for passwords, consider using specialized password hashing algorithms).
     * 
     * Note: This method does not involve a secret key and therefore does not provide data authentication. If your 
     * application requires not only verifying that the data has not changed but also ensuring that it comes from a 
     * trusted source, consider using methods that involve cryptographic keys for authentication, such as HMAC.
     */
    public override derive(data:HashableData | EncodedHashableData, type:HashType.SHA_1, format:HashOutputFormat.Hex):Promise<Hex_160>;
    public override derive(data:HashableData | EncodedHashableData, type:HashType.SHA_1, format:HashOutputFormat.hex):Promise<hex_160>;
    public override derive(data:HashableData | EncodedHashableData, type:HashType.SHA_256, format:HashOutputFormat.Hex, sync:true):Hex_256;
    public override derive(data:HashableData | EncodedHashableData, type:HashType.SHA_256, format:HashOutputFormat.hex, sync:true):hex_256;
    public override derive(data:HashableData | EncodedHashableData, type:HashType.SHA_256, format:HashOutputFormat.Hex):Promise<Hex_256>;
    public override derive(data:HashableData | EncodedHashableData, type:HashType.SHA_256, format:HashOutputFormat.hex):Promise<hex_256>;
    public override derive(data:HashableData | EncodedHashableData, type:HashType.SHA_384, format:HashOutputFormat.Hex):Promise<Hex_384>;
    public override derive(data:HashableData | EncodedHashableData, type:HashType.SHA_384, format:HashOutputFormat.hex):Promise<hex_384>;
    public override derive(data:HashableData | EncodedHashableData, type:HashType.SHA_512, format:HashOutputFormat.Hex):Promise<Hex_512>;
    public override derive(data:HashableData | EncodedHashableData, type:HashType.SHA_512, format:HashOutputFormat.hex):Promise<hex_512>; 
    public override derive(data:HashableData | EncodedHashableData, type:HashType.SHA_1 | HashType.SHA_256 | HashType.SHA_384 | HashType.SHA_512, format:HashOutputFormat, sync:boolean=false)
    {
        if (sync === true) return __hashSHA256(data, format as any);

        return super.derive(data, type as any, format as any) as any;
    }

    /**
     * Checks the integrity of the provided data against the provided integrity string.
     *
     * @async
     * @function
     * @param {string|Uint8Array} data - The script data to be checked, either as a string or Uint8Array.
     * @param {string} integrityString - The integrity string in the format "algorithm-hashInBase64", e.g., "sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC".
     * @returns {Promise<boolean>} A promise that resolves to `true` if the integrity check passes, `false` otherwise.
     * @throws {Error} If data or integrityString are not provided or if data is not a string or Uint8Array.
     * 
     * create sri hashes https://sri-gen.henkverlinde.com/
     */
    public async verifySubresourceIntegrity(data:string | Uint8Array, integrityString:string):Promise<boolean>
    {
        //check if data and integrityString are provided
        if (data.length === 0 || integrityString.length === 0) return false;
        
        //convert the data to a Uint8Array if it's not already
        let dataBytes;
        if (this._app.typeUtil.isString(data) === true) dataBytes = new TextEncoder().encode(data);
        else if (data instanceof Uint8Array) dataBytes = data;
        else 
        {
            console.error('Data must be a string or Uint8Array.');
            return false;
        }
    
        //extract the algorithm and the expected hash from the integrityString
        const [algorithm, expectedHashBase64] = integrityString.split('-', 2);
        const expectedHashBytes = Uint8Array.from(atob(expectedHashBase64), c => c.charCodeAt(0));
    
        //compute the hash of the data
        const hashBytes = new Uint8Array(await crypto.subtle.digest(algorithm, dataBytes));
    
        //compare the computed hash to the expected hash
        if (hashBytes.length !== expectedHashBytes.length) return false;
        
        for (let i = 0; i < hashBytes.length; i++) 
        {
            if (hashBytes[i] !== expectedHashBytes[i]) return false;
        }

        return true;
    }

    public createTransformer = ():[ITransformer, Promise<hex_256 | IAborted | IError>] =>
    {        
        const ref = this;

        const getHashDerivationFunctions = async ():Promise<[update:(chunk:Uint8Array) => void, digest:() => hex_256]> =>
        {
            const hasher = await createSHA256();
    
            hasher.init();
            
            const update = (chunk:Uint8Array) => hasher.update(chunk);
            const digest = ():hex_256 => hasher.digest('hex') as hex_256;

            return [update, digest];
        }

        let update:(chunk:Uint8Array) => void;
        let digest:() => hex_256;

        const resolvePromise = new ResolvePromise<hex_256 | IAborted | IError>();

        let initialized = false;

        async function transformer(chunk:Uint8Array, flush:false):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined, flush:true, success:true):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:IAborted | IError, flush:true, success:false):Promise<undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined | IAborted | IError, flush:boolean, success?:boolean):Promise<Uint8Array | undefined | IAborted | IError>
        {
            try
            {
                if (flush === true) 
                {
                    resolvePromise.resolve(success === true ? digest() : chunk as IAborted | IError);
                    
                    return chunk;
                }
                
                if (initialized === false) 
                {
                    [update, digest] = await getHashDerivationFunctions();
                    initialized = true;
                }
                
                update(chunk as Uint8Array);

                return chunk;
            }
            catch (e)
            {
                const error = ref._app.warn(e, 'An error occurred while creating the hash transformer.', [chunk, flush, success], {names:[HashUtil, ref.createTransformer, transformer]});

                resolvePromise.resolve(error);

                return error;
            } 
        }
        
        return [transformer as unknown as ITransformer, resolvePromise];
    }
}