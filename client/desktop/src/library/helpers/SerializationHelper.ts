/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SerializationHelper as SharedSerializationHelper } from "../../../../../shared/src/library/helpers/SerializationHelper";
import type { IError } from "../../../../../shared/src/library/error/IError";
import type { KnownLengthReadableStream } from "../../../../../shared/src/library/stream/KnownLengthReadableStream";
import type { MinLengthReadableStream } from "../../../../../shared/src/library/stream/MinLengthReadableStream";
import type { Value } from "../../../../../shared/src/library/utils/SerializationUtil";
import type { uid } from "../../../www/src/library/utils/UIDUtil";
import type { IBaseApp } from "../IBaseApp";

/**
 * @forceSuperTransformer_ignoreParent (fakeBaseClass is not supported by the transformer)
 */
export class SerializationHelper<A extends IBaseApp<A>> extends SharedSerializationHelper<A>
{
    constructor(app:A)
    {
        const customTypeEncoder = 
        {
            typeByteSize:2, //256-65535 (0-255 is reserved by the super class)
            sync:async (value:unknown):Promise<[ctype:number, Uint8Array, count:number] | undefined | IError> =>
            {
                try
                {
                    const constructor = value?.constructor;

                    if (constructor === undefined) return undefined;

                    return undefined;
                }
                catch (error)
                {
                    return app.warn(error, 'customTypeEncoder errored', [value], {errorOnly:true, names:[SerializationHelper, customTypeEncoder.sync]});
                }
            },
            stream:async (object:unknown):Promise<[ctype:number, Uint8Array, count:number, ReadableStream<Uint8Array> | KnownLengthReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array> | AsyncGenerator<Value, void, unknown>] | false | IError> =>
            {
                try
                {
                    const constructor = object?.constructor;
    
                    if (constructor === undefined) return false;
    
                    //todo
                    
                    return false;
                }
                catch (error)
                {
                    return app.warn(error, 'customTypeEncoder errored', [object], {errorOnly:true, names:[SerializationHelper, customTypeEncoder.stream]});
                }
            }
        };
        
        const customTypeDecoder = 
        {
            typeByteSize:2,
            sync:async (type:number, uint8Array:Uint8Array, count:number):Promise<[unknown, count:number] | undefined | IError> =>
            {
                try
                {
                    switch (type)
                    {
                        case 256:
                        {
                            const uid = app.textUtil.fromUint8Array<uid>(uint8Array);
                            const instance = this._app.instanceManager.get(uid);

                            if (instance === undefined) return app.throw('instance not found', []);

                            return [instance, count - 1];
                        }
                    }
        
                    return undefined;
                }
                catch (error)
                {
                    return app.warn(error, 'customTypeDecoder errored', [type, uint8Array], {errorOnly:true, names:[SerializationHelper, customTypeDecoder.sync]}); 
                }
            },
            stream:async (type:number, uint8Array:Uint8Array, count:number, stream:ReadableStream<Uint8Array> | KnownLengthReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array> | AsyncGenerator<Value, void, unknown>):Promise<[unknown, number] | undefined | IError> =>
            {
                try
                {
                    switch (type)
                    {
                        //todo
                    }
        
                    return undefined;
                }
                catch (error)
                {
                    return app.warn(error, 'customTypeDecoder errored', [type, uint8Array], {errorOnly:true, names:[SerializationHelper, customTypeDecoder.stream]}); 
                }
            }
        };

        super(app, customTypeEncoder, customTypeDecoder);
    }
}