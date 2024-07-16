/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { HMACOutputFormat, HMACUtil as Shared, type PAE } from '../../../../../../shared/src/library/utils/HMACUtil.ts';
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import { ResolvePromise } from '../../../../../../shared/src/library/promise/ResolvePromise.ts';
import type { HMACKey, HMACSyncKey } from './KeyUtil.ts';
import { HashOutputFormat, HashType, type HashSize, type HashableData, type Hex_256, type Hex_384, type Hex_512, type hex_256, type hex_384, type hex_512 } from './HashUtil.ts';
import type { ITransformer } from './StreamUtil.ts';
import { createSHA256 } from 'hash-wasm';
import type { IAborted } from '../../../../../../shared/src/library/abort/IAborted.ts';
import type { IError } from '../../../../../../shared/src/library/error/IError.ts';
import type { IBaseApp } from '../IBaseApp.ts';

export * from '../../../../../../shared/src/library/utils/HMACUtil.ts';

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
@SealedDecorator()
export class HMACUtil<A extends IBaseApp<A>> extends Shared<A>
{
    public constructor(app:A)
    {
        super(app);
    }

    public override derive(hmacKey:HMACSyncKey, data:PAE, format:HMACOutputFormat.Hex):Hex_256;
    public override derive(hmacKey:HMACSyncKey, data:PAE, format:HMACOutputFormat.hex):hex_256;
    public override derive(hmacKey:HMACKey<HashType.SHA_256>, data:PAE, format:HMACOutputFormat.Hex):Promise<Hex_256>; 
    public override derive(hmacKey:HMACKey<HashType.SHA_256>, data:PAE, format:HMACOutputFormat.hex):Promise<hex_256>; 
    public override derive(hmacKey:HMACKey<HashType.SHA_384>, data:PAE, format:HMACOutputFormat.Hex):Promise<Hex_384>; 
    public override derive(hmacKey:HMACKey<HashType.SHA_384>, data:PAE, format:HMACOutputFormat.hex):Promise<hex_384>; 
    public override derive(hmacKey:HMACKey<HashType.SHA_512>, data:PAE, format:HMACOutputFormat.Hex):Promise<Hex_512>; 
    public override derive(hmacKey:HMACKey<HashType.SHA_512>, data:PAE, format:HMACOutputFormat.hex):Promise<hex_512>; 
    public override derive(hmacKey:HMACSyncKey | HMACKey<HashType.SHA_256> | HMACKey<HashType.SHA_384>  | HMACKey<HashType.SHA_512>, data:PAE, format:HMACOutputFormat, size?:HashSize)
    {
        if (hmacKey instanceof Uint8Array === false) return super.derive(hmacKey as HMACKey<any>, data, format as any) as any;

        const blockSize = 64; //block size in bytes for SHA-256
    
        if (hmacKey.length !== blockSize) this._app.throw('Invalid key length. Must be 64 bytes.', [], {correctable:true});

        const inner = new Uint8Array(blockSize + data.byteLength);
        const outer = new Uint8Array(blockSize + 32); //32 is the length of the inner hash (see below), which is always 32 bytes for SHA-256
        
        //step 1: apply XOR operation with the key to create inner and outer padded keys
        let i = 0;
        for (const byte of hmacKey) //key is always 64 bytes long
        {
            inner[i] = 0x36 ^ byte;
            outer[i++] = 0x5c ^ byte; //notice the post-increment operator
        }
    
        //step 2: concatenate data to inner padded key and compute inner hash using SHA-256
        inner.set(data, blockSize);
        const innerHash = this._app.hashUtil.derive(inner as HashableData, HashType.SHA_256, HashOutputFormat.Hex, true);
    
        //step 3: concatenate inner hash to outer padded key and compute HMAC using SHA-256
        outer.set(innerHash, blockSize);
        const result = this._app.hashUtil.derive(outer as HashableData, HashType.SHA_256, HashOutputFormat.Hex, true); //final HMAC value

        return format === HMACOutputFormat.Hex ? result : this._app.baseUtil.toHex(result) as hex_256;
    }

    public createTransformer = (key:HMACSyncKey):[ITransformer, Promise<hex_256 | IAborted | IError>] =>
    {        
        const ref = this;

        const getHMACDerivationFunctions = async (key:HMACSyncKey):Promise<[update:(chunk:Uint8Array) => void, digest:() => hex_256]> =>
        {
            const outerHasher = await createSHA256();
    
            outerHasher.init();
            
            const innerPaddedKey = new Uint8Array(64);
            const outerPaddedKey = new Uint8Array(64);
            
            //step 1: Apply XOR operation with the key to create inner and outer padded keys
            let i = 0;
            for (const byte of key) //key is always 64 bytes long
            {
                innerPaddedKey[i] = 0x36 ^ byte;
                outerPaddedKey[i++] = 0x5c ^ byte; //notice the post-increment operator
            }
            
            //step 2: Prepare inner hash
            outerHasher.update(innerPaddedKey);
            
            const update = (chunk:Uint8Array) => outerHasher.update(chunk);
            
            const digest = ():hex_256 => 
            {
                //step 3: Finalize inner hash
                const innerHash = outerHasher.digest('binary');

                const innerHasher = outerHasher.init(); //reset the hasher

                //step 4: Prepare outer hash
                innerHasher.update(outerPaddedKey);
                innerHasher.update(innerHash);

                //step 5: Finalize outer hash
                return innerHasher.digest('hex') as hex_256;
            }

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
                    [update, digest] = await getHMACDerivationFunctions(key);
                    initialized = true;
                }

                update(chunk as Uint8Array);

                return chunk;
            }
            catch (e)
            {
                const error = ref._app.warn(e, 'An error occurred while creating the HMAC transformer.', [chunk, flush, success], {names:[HMACUtil, ref.createTransformer, transformer]});

                resolvePromise.resolve(error);

                return error;
            }
        }
        
        return [transformer as unknown as ITransformer, resolvePromise];
    }
}