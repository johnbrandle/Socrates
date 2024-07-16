/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { type Value } from "../../../../../../../shared/src/library/utils/SerializationUtil";
import { SerializationHelper as SharedSerializationHelper } from "../../../../../../../shared/src/library/helpers/SerializationHelper";
import type { IError } from "../../../../../../../shared/src/library/error/IError";
import type { KnownLengthReadableStream } from "../../../../../../../shared/src/library/stream/KnownLengthReadableStream";
import type { MinLengthReadableStream } from "../../../../../../../shared/src/library/stream/MinLengthReadableStream";
import { IAbortableType, type IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import { RemoteAbortController } from "../classes/RemoteAbortController";
import type { IApp } from "../../IApp";

/**
 * @forceSuperTransformer_ignoreParent (fakeBaseClass is not supported by the transformer)
 */
export class SerializationHelper<A extends IApp<A>> extends SharedSerializationHelper<A>
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

                    if (app.typeUtil.is<IAbortable>(value, IAbortableType) === true)
                    {
                        //create the remote abort controller instance
                        const abortController = new RemoteAbortController(app);

                        //subscribe to the abort signal on the abortable, and call abort on our remote abort controller if it is triggered
                        //we do not need to unsubscribe from the signal because the remote abort controller will be collected when the abortable is collected
                        //and we cannot hold as a weak reference because we need to keep the remote abort controller alive
                        value.onAbortedSignal.subscribe(() => abortController.abort(value.reason), {weak:false, once:true});

                        //get the uid of our remote abort controller
                        const uid = await app.bridgeManager.getRemoteObjectUID(abortController);
                        if (uid === undefined) return this._app.throw('Failed to get remote object uid', []);

                        //convert the uid to a uint8Array (we will use this uid to deserialize on the other side)
                        const uint8Array = app.textUtil.toUint8Array(uid);

                        return [256, uint8Array, 1];
                    }

                    return undefined;
                }
                catch (error)
                {
                    return this._app.warn(error, 'customTypeEncoder errored', [value], {errorOnly:true, names:[this.constructor, customTypeEncoder.sync]});
                }
            },
            async:async (object:unknown):Promise<[ctype:number, Uint8Array, count:number, ReadableStream<Uint8Array> | KnownLengthReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array> | AsyncGenerator<Value, void, unknown>] | false | IError> =>
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
                    return this._app.warn(error, 'customTypeEncoder errored', [object], {errorOnly:true, names:[this.constructor, customTypeEncoder.async]});
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
                    }
        
                    return undefined;
                }
                catch (error)
                {
                    return this._app.warn(error, 'customTypeDecoder errored', [type, uint8Array], {errorOnly:true, names:[this.constructor, customTypeDecoder.sync]}); 
                }
            },
            async:async (type:number, uint8Array:Uint8Array, count:number, stream:ReadableStream<Uint8Array> | KnownLengthReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array> | AsyncGenerator<Value, void, unknown>):Promise<[unknown, number] | undefined | IError> =>
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
                    return this._app.warn(error, 'customTypeDecoder errored', [type, uint8Array], {errorOnly:true, names:[this.constructor, customTypeDecoder.async]}); 
                }
            }
        };

        super(app, customTypeEncoder, customTypeDecoder);
    }
}