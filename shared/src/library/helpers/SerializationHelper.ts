/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IError } from '../../../../shared/src/library/error/IError.ts';
import { FilePath, FolderPath } from '../../../../shared/src/library/file/Path.ts';
import { CustomTypeDecoder, CustomTypeEncoder, ValueType, type Value } from '../../../../shared/src/library/utils/SerializationUtil.ts';
import { Data } from '../data/Data.ts';
import { KnownLengthReadableStream } from '../stream/KnownLengthReadableStream.ts';
import { MinLengthReadableStream } from '../stream/MinLengthReadableStream.ts';
import { Aborted } from '../abort/Aborted.ts';
import { IBaseApp } from '../IBaseApp.ts';
import { Error } from '../error/Error.ts';

export class SerializationHelper<A extends IBaseApp<A>>
{
    protected _app:A;

    #_customTypeEncoder:CustomTypeEncoder;
    #_customTypeDecoder:CustomTypeDecoder;

    constructor(app:A, customTypeEncoder?:CustomTypeEncoder, customTypeDecoder?:CustomTypeDecoder)
    {
        this._app = app;

        const thisCustomTypeEncoder = this.#_customTypeEncoder = this.customTypeEncoder;
        const thisCustomTypeDecoder = this.#_customTypeDecoder = this.customTypeDecoder;

        if (customTypeDecoder === undefined || customTypeEncoder === undefined) return;

        this.#_customTypeEncoder = 
        {
            typeByteSize:Math.max(thisCustomTypeEncoder.typeByteSize, customTypeEncoder.typeByteSize),
            sync:async (value:unknown):Promise<[ctype:number, Uint8Array, count:number] | undefined | IError> => 
            {
                const result = await customTypeEncoder.sync(value);
                if (result !== undefined) return result;

                return thisCustomTypeEncoder.sync(value);
            },
            stream:async (value:unknown):Promise<[ctype:number, Uint8Array, count:number, ReadableStream<Uint8Array> | KnownLengthReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array> | AsyncGenerator<Value, void, unknown>] | false | IError> =>
            {
                if (customTypeEncoder.stream !== undefined)
                {
                    const result = await customTypeEncoder?.stream(value);
                    if (result !== false) return result;
                }

                return await thisCustomTypeEncoder.stream(value);
            }
        };
        
        this.#_customTypeDecoder = 
        {
            typeByteSize:Math.max(thisCustomTypeDecoder.typeByteSize, customTypeDecoder.typeByteSize),
            sync:async (type:number, uint8Array:Uint8Array, count:number):Promise<[unknown, count:number] | undefined | IError> =>
            {
                const result = await customTypeDecoder.sync(type, uint8Array, count);
                if (result !== undefined) return result;

                return thisCustomTypeDecoder.sync(type, uint8Array, count);
            },
            stream:async (type:number, uint8Array:Uint8Array, count:number, stream:ReadableStream<Uint8Array> | KnownLengthReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array> | AsyncGenerator<Value, void, unknown>):Promise<[unknown, number] | undefined | IError> =>
            {
                if (customTypeDecoder.stream !== undefined)
                {
                    const result = await customTypeDecoder?.stream(type, uint8Array, count, stream);
                    if (result !== undefined) return result;
                }

                return await thisCustomTypeDecoder.stream(type, uint8Array, count, stream);
            }
        };
    }

    public toStream(values:Value[], options?:{allowAsyncValues?:true, splitSyncAndAsyncStreams?:false}):Promise<ReadableStream<Uint8Array> | IError>;
    public toStream(values:Value[], options:{splitSyncAndAsyncStreams:true}):Promise<[ReadableStream<Uint8Array>, ReadableStream<Uint8Array>, count:number] | IError>;
    public toStream(values:Value[], options:{allowAsyncValues:false}):ReadableStream<Uint8Array>;
    public toStream(values:Value[], options:{count:true}):[ReadableStream<Uint8Array>, count:Promise<number | IError>];
    public toStream(values:Generator<Value> | AsyncGenerator<Value>, options:{allowAsyncValues:false}):ReadableStream<Uint8Array>;
    public toStream(values:Value[] | Generator<Value> | AsyncGenerator<Value>, options?:{allowAsyncValues?:boolean, splitSyncAndAsyncStreams?:boolean, count?:boolean, boundary?:Uint8Array}):ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array> | IError> | Promise<[ReadableStream<Uint8Array>, ReadableStream<Uint8Array>, count:number] | IError> | [ReadableStream<Uint8Array>, count:Promise<number | IError>]
    {
        return this._app.serializationUtil.toStream(values as any, {...options, customTypeEncoder:this.#_customTypeEncoder} as any);
    }

    public fromStream(stream:ReadableStream<Uint8Array>, options?:{allowAsyncValues?:boolean, count?:number}):AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | IError>;
    public fromStream(stream:ReadableStream<Uint8Array>, options?:{allowAsyncValues?:boolean, count:number}):AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | number | IError>;
    public fromStream(streams:[syncStream:ReadableStream<Uint8Array>, asyncStream:ReadableStream<Uint8Array>], options?:{allowAsyncValues?:boolean, count?:number}):AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | IError>;
    public fromStream(streams:[syncStream:ReadableStream<Uint8Array>, asyncStream:ReadableStream<Uint8Array>], options?:{allowAsyncValues?:boolean, count:number}):AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | number | IError>;
    public async *fromStream(stream:ReadableStream<Uint8Array> | [syncStream:ReadableStream<Uint8Array>, asyncStream:ReadableStream<Uint8Array>], options?:{allowAsyncValues?:boolean, count?:number}):AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | IError> | AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | number | IError>
    {
        return yield* this._app.serializationUtil.fromStream(stream as any, {...options, customTypeDecoder:this.#_customTypeDecoder});
    }

    public async toUint8Array(value:Value, options?:{}):Promise<Uint8Array | IError>;
    public async toUint8Array(value:Value, options:{count:true}):Promise<[Uint8Array, number] | IError>;
    public async toUint8Array(value:Value, options?:{count?:boolean}):Promise<Uint8Array | [Uint8Array, number] | IError>
    {
       return this._app.serializationUtil.toUint8Array(value, {...options, customTypeEncoder:this.#_customTypeEncoder});
    }

    public async fromUint8Array<T extends Value>(bytes:Uint8Array, options?:{}):Promise<T | IError>;
    public async fromUint8Array<T extends Value>(bytes:Uint8Array, options:{count:number}):Promise<[{type:ValueType, value:T} | {type:ValueType.Custom, ctype:number, value:T}, Uint8Array, number] | IError>;
    public async fromUint8Array<T extends Value>(bytes:Uint8Array | undefined, options?:{count?:number}):Promise<T | [{type:ValueType, value:T} | {type:ValueType.Custom, ctype:number, value:T}, Uint8Array, number] | [{type:ValueType, value:T} | {type:ValueType.Custom, ctype:number, value:T}, undefined, number] | IError>
    {
        return this._app.serializationUtil.fromUint8Array(bytes as any, {...options, customTypeDecoder:this.#_customTypeDecoder} as any);
    }
  
    public customTypeEncoder = 
    {
        typeByteSize:1, //0-127 for sync, and 128-255 for async
        sync:(value:unknown):[ctype:number, Uint8Array, count:number] | undefined | IError =>
        {
            const app = this._app;

            try
            {
                if (value === undefined) return undefined;
    
                switch (value!.constructor)
                {
                    case FolderPath:
                    {
                        const folderPath = value as FolderPath;
                        return [0, app.textUtil.toUint8Array(folderPath.toString()), 1];
                    }
                    case FilePath:
                        const filePath = value as FilePath;
                        return [1, app.textUtil.toUint8Array(filePath.toString()), 1];
                    case Error:
                    {
                        const error = value as Error;
    
                        const {message, stack, name} = error;
                        const obj = {message, stack, name}
    
                        const string = this._app.serializationUtil.toString(obj);
    
                        return [2, app.textUtil.toUint8Array(string), 1];
                    }
                }

                if (app.typeUtil.isAborted(value) === true) return [3, app.textUtil.toUint8Array(value.reason), 1];
    
                return undefined;
            }
            catch (error)
            {
                return this._app.warn(error, 'customTypeEncoder errored', [value], {errorOnly:true, names:[this.constructor, 'customTypeEncoder', 'sync']});
            }
        },
        stream:async (object:unknown):Promise<[ctype:number, Uint8Array, count:number, ReadableStream<Uint8Array> | KnownLengthReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array> | AsyncGenerator<Value, void, unknown>] | false | IError> =>
        {
            try
            {
                const app = this._app;

                const constructor = object?.constructor;

                if (constructor === undefined) return false;

                switch (constructor)
                {
                    case Data:
                    {
                        const data = object as Data<A, ReadableStream<Uint8Array>>;
                        const stream = await data.get();

                        if (app.typeUtil.isError(stream) === true) 
                        {
                            //serialize the error
                            const result = this._app.extractOrRethrow(await this.toUint8Array(stream as unknown as Value, {count:true}));

                            const [uint8Array, count] = result;

                            return [127, uint8Array, count + 1, this._app.streamUtil.createEmpty()];
                        }
                        if (app.typeUtil.isAborted(stream) === true)
                        {
                            const result = this._app.extractOrRethrow(await this.toUint8Array(stream as unknown as Value, {count:true}));

                            const [uint8Array, count] = result;

                            return [128, uint8Array, count + 1, this._app.streamUtil.createEmpty()];
                        }

                        return [129, new Uint8Array(0), 1, stream];
                    }
                }
                
                return false;
            }
            catch (error)
            {
                return this._app.warn(error, 'customTypeEncoder errored', [object], {errorOnly:true, names:[this.constructor, 'customTypeEncoder', 'stream']});
            }
        }
    };
    
    public customTypeDecoder = 
    {
        typeByteSize:1,
        sync:(type:number, uint8Array:Uint8Array, count:number):[unknown, count:number] | undefined | IError =>
        {
            const app = this._app;

            try
            {
                switch (type)
                {
                    case 0:
                        return [new FolderPath(app.textUtil.fromUint8Array(uint8Array)), --count];
                    case 1:
                        return [new FilePath(app.textUtil.fromUint8Array(uint8Array)), --count];
                    case 2:
                    {
                        const string = app.textUtil.fromUint8Array(uint8Array);
                        const obj = this._app.extractOrRethrow(this._app.serializationUtil.fromString(string)) as {message:string, stack:string, name:string};
                     
                        const {message, stack, name} = obj;
    
                        return [Error.__getNewError(message, undefined, undefined, stack, name), --count];
                    }
                    case 3:
                    {
                        return [new Aborted(this._app, app.textUtil.fromUint8Array(uint8Array)), --count];
                    }
                }
    
                return undefined;
            }
            catch (error)
            {
                return this._app.warn(error, 'customTypeDecoder errored', [type, uint8Array], {errorOnly:true, names:[this.constructor, 'customTypeDecoder', 'sync']}); 
            }
        },
        stream:async (type:number, uint8Array:Uint8Array, count:number, stream:ReadableStream<Uint8Array> | KnownLengthReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array> | AsyncGenerator<Value, void, unknown>):Promise<[unknown, number] | undefined | IError> =>
        {
            try
            {
                switch (type)
                {
                    case 127:
                    {
                        const app = this._app;
                        const [result, _uint8Array, thisCount] = app.extractOrRethrow(await this.fromUint8Array(uint8Array, {count}));

                        return [new Data(app, async () => result.value), thisCount - 1];
                    }
                    case 128:
                    {
                        const app = this._app;
                        const [result, _uint8Array, thisCount] = app.extractOrRethrow(await this.fromUint8Array(uint8Array, {count}));

                        return [new Data(app, async () => result.value), thisCount - 1];
                    }
                    case 129:
                    {
                        const app = this._app;
                        return [new Data(app, async () => stream), --count];
                    }
                }
    
                return undefined;
            }
            catch (error)
            {
                return this._app.warn(error, 'customTypeDecoder errored', [type, uint8Array], {errorOnly:true, names:[this.constructor, 'customTypeDecoder', 'stream']}); 
            }
        }
    };

    public extractValueFromStream = async (stream:ReadableStream<Uint8Array>):Promise<unknown | IError> =>
    {
        try
        {
            const generator = this._app.serializationUtil.fromStream(stream, {customTypeDecoder:this.#_customTypeDecoder});

            let next;
            for await (const value of generator) next = this._app.extractOrRethrow(value).value;

            return next;
        }
        catch (error)
        {
            return this._app.warn(error, 'extractCallResult errored', [stream], {names:[this.constructor, this.extractValueFromStream]});
        }
    }
}