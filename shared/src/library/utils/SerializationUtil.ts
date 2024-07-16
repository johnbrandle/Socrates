/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { KnownLengthReadableStream } from "../stream/KnownLengthReadableStream.ts";
import { MinLengthReadableStream } from "../stream/MinLengthReadableStream.ts";
import { SealedDecorator } from "../decorators/SealedDecorator.ts";
import { IError } from "../error/IError.ts";
import { StreamReaderHelper } from "../helpers/StreamReaderHelper.ts";
import { ResolvePromise } from "../promise/ResolvePromise.ts";
import { BaseOutputFormat, base62, base64 } from "./BaseUtil.ts";
import { IndexOfAlgorithm, IndexOfBoundarySize, PreProcessedNeedle } from "./ByteUtil.ts";
import { int, type uint } from "./IntegerUtil.ts";
import { json } from "./JSONUtil.ts";
import { TypeOf } from "./TypeUtil.ts";
import { IBaseApp } from "../IBaseApp.ts";

const hasStreamsValue = Symbol('hasStreams');

type CustomTypeEncoderSync = (object:unknown) => Promise<[ctype:number, Uint8Array, count:number] | undefined | IError> | [ctype:number, Uint8Array, count:number] | undefined | IError;

export interface CustomTypeEncoder
{
    sync:CustomTypeEncoderSync;
    stream?:(object:unknown) => Promise<[ctype:number, Uint8Array, count:number, ReadableStream<Uint8Array> | KnownLengthReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array> | AsyncGenerator<Value, void, unknown>] | false | IError>;
    typeByteSize:number
}

export interface CustomTypeDecoder
{
    sync:(type:number, uint8Array:Uint8Array, count:number) => Promise<[unknown, count:number] | undefined | IError> | [unknown, count:number] | undefined | IError;
    stream?:(type:number, uint8Array:Uint8Array, count:number, stream:ReadableStream<Uint8Array> | KnownLengthReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array> | AsyncGenerator<Value, void, unknown>) => Promise<[unknown, count:number] | undefined | IError>;
    typeByteSize:number
}

export interface ValueArray extends Array<Value> {}
  
export interface ValueRecord extends Record<string, Value> {}
  
export type Value = undefined | 
                    string | 
                    boolean | 
                    number | 
                    int | 
                    uint | 
                    bigint | 
                    
                    ValueArray | 
                    ValueRecord | 
                    
                    Uint8Array | 
                    
                    ReadableStream<Uint8Array> | 
                    KnownLengthReadableStream<Uint8Array> | 
                    MinLengthReadableStream<Uint8Array> |

                    AsyncGenerator<Value, void, unknown> |
                    Generator<Value, void, unknown>;

export enum ValueType //we do not recognize null or NaN as valid types
{
    undefined = 10,
    string = 11,
    boolean = 12,
    number = 13,
    bigint = 14,
    
    Array = 15,
    Object = 16,
    
    Uint8Array = 17,

    ReadableStream = 20,
    KnownLengthReadableStream = 21,
    MinLengthReadableStream = 22,

    AsyncGenerator = 23,
    Generator = 24,

    Custom = 49,

    //types 50-255 are reserved for internal use
}

const isAsyncIterableDataType = (type:ValueType | InternalValueType):boolean =>
{
    switch (type)
    {
        case ValueType.ReadableStream:
        case ValueType.KnownLengthReadableStream:
        case ValueType.MinLengthReadableStream:
        case ValueType.AsyncGenerator:
            return true;
        default:
            return false;
    }
}

enum InternalValueType
{
    //values 0-49 are reserved for ValueType

    true = 50,
    false = 51,
    emptystring = 52,
    EmptyArray = 53,
    EmptyObject = 54,
    zero = 55,
    one = 56,
    negativeone = 57,

    hasStreams = 58, //indicates a serialized value has streams
    
    //these values must be sequential
    int_1byte = 100,
    int_2byte = 101,
    int_3byte = 102,
    int_4byte = 103,
    int_5byte = 104,
    int_6byte = 105,
    int_7byte = 106,

    //these values must be sequential
    uint_1byte = 107,
    uint_2byte = 108,
    uint_3byte = 109,
    uint_4byte = 110,
    uint_5byte = 111,
    uint_6byte = 112,
    uint_7byte = 113,

    float_32 = 114,
    float_64 = 115,

    //up to 255
}

@SealedDecorator()
export class SerializationUtil<A extends IBaseApp<A>>
{    
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Converts a mixed array of items into a ReadableStream<Uint8Array> following a specific serialization format.
     * This method supports a variety of data types, including primitives, complex objects, generators, and streams.
     * 
     * Serialization Format Overview:
     * 
     *  If the values array contains async values, it prepends to the values array:
     * 
     *   [internal hasStreams Symbol, number of values number[], stream indexes number[], boundary Uint8Array]
     * 
     *   These added values are not included in the count.
     * 
     * Simple types (undefined, boolean, etc.):
     *   [type (1 byte)]
     * 
     * Known Length Types (string, bigint, Uint8Array, etc.):
     *   [type (1 byte)]
     *   [number of bytes needed to store data length (1 byte)]
     *   [length of data (1-7 bytes)]
     *   [data (variable length)]
     * 
     * Custom Type:
     *   [type (1 byte)] (always ValueType.Custom)
     *   [ctype (1-7 bytes)] (value and length up to the custom implementer)
     *   [number of bytes needed to store data length (1 byte)]
     *   [length of data (1-7 bytes)]
     *   [data (variable length)]
     * 
     * All async value types are moved to the end of the values array, and are processed last.
     * 
     * Async Types With Known Length (KnownLengthReadableStream<Uint8Array>):
     *   [data (variable length)]
     *     
     * Async Types With unknown Length (ReadableStream<Uint8Array>, AsyncGenerator<Value, void, unknown>, etc.):
     *   [data (variable length)]
     *   [X byte boundary] (only included if there is more than one async value with an unknown length, or the single async value with an unknown length is not the last async value)
     * 
     * @note A boundary is only used if an async type with an unknown length is encountered, and: there is more than one 
     * async type with an unknown length, or the single async type with an unknown length is not the last async type. For 
     * performance reasons, recommend avoiding situations where a boundary is required, especially for long streams.
     * 
     * @note Async values are moved to the end of the values list, and are processed last. However, placeholders are put
     * in their place, so they will be yielded in the original order when deserializing. The placeholders are serializized
     * as strings, an contain info about the type of async value and the length (if one is defined). This allows the 
     * deserializer to know what kind of value to yield, and how to create it, without having to read in the async data first.
     * 
     * @note Deserializing using async: yield all values first, read all async values to completion, and read them in order
     * to avoid excessive memory usage or gc issues.
     *
     * @param {Value[] | Generator<Value> | AsyncGenerator<Value>} values - The items to be serialized. Each item can be
     *        any supported type, including custom types if a customTypeEncoder is provided.
     * @param {Object} [options] - Optional parameters to control serialization behavior.
     * @param {CustomTypeEncoder} [options.customTypeEncoder] - An async function for encoding custom types. It should accept
     *        a value and return a Promise that resolves to an array containing the custom type identifier (number) and
     *        its Uint8Array representation, or `undefined` for non-custom types.
     * @param {boolean} [options.allowAsyncValues=true] - Whether to permit the serialization of async values. If false,
     *        attempting to serialize async values will result in an error.
     * @param {boolean} [options.splitSyncAndAsyncStreams=false] - When true, synchronous and asynchronous values are
     *        serialized into separate streams. The method then returns both streams along with the total count of serialized values.
     * @param {boolean} [options.count=false] - If true, the method returns the count of serialized values alongside the stream.
     * @returns {ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array> | IError> | Promise<[ReadableStream<Uint8Array>, ReadableStream<Uint8Array>, number]> | [ReadableStream<Uint8Array>, Promise<number | IError>]} Depending on the options, this method returns either a single ReadableStream, a stream and a count of serialized values, or in the case of splitting sync and async values, two streams and a count.
     */
    public toStream(values:Value[], options?:{customTypeEncoder?:CustomTypeEncoder, allowAsyncValues?:true, splitSyncAndAsyncStreams?:false}):Promise<ReadableStream<Uint8Array> | IError>;
    public toStream(values:Value[], options:{customTypeEncoder?:CustomTypeEncoder, splitSyncAndAsyncStreams:true}):Promise<[ReadableStream<Uint8Array>, ReadableStream<Uint8Array>, count:number] | IError>;
    public toStream(values:Value[], options:{customTypeEncoder?:CustomTypeEncoder, allowAsyncValues:false}):ReadableStream<Uint8Array>;
    public toStream(values:Value[], options:{customTypeEncoder?:CustomTypeEncoder, count:true}):[ReadableStream<Uint8Array>, count:Promise<number | IError>];
    public toStream(values:Generator<Value> | AsyncGenerator<Value>, options:{customTypeEncoder?:CustomTypeEncoder, allowAsyncValues:false}):ReadableStream<Uint8Array>;
    public toStream(values:Value[] | Generator<Value> | AsyncGenerator<Value>, options?:{customTypeEncoder?:CustomTypeEncoder, allowAsyncValues?:boolean, splitSyncAndAsyncStreams?:boolean, count?:boolean, boundary?:Uint8Array}):ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array> | IError> | Promise<[ReadableStream<Uint8Array>, ReadableStream<Uint8Array>, count:number] | IError> | [ReadableStream<Uint8Array>, count:Promise<number | IError>]
    {
        const ref = this;
        const app = this._app;
        const getValueType = this.#getValueType;
        const customTypeEncoder = options?.customTypeEncoder;
        const customTypeEncoderAsync = customTypeEncoder?.stream;
       
        const splitSyncAndAsyncStreams = options?.splitSyncAndAsyncStreams ?? false;
        const allowAsyncValues = ((options?.allowAsyncValues ?? true) || splitSyncAndAsyncStreams) && options?.count !== true;

        //move streams to the end if there are any
        //othewise streams would need to be completely read before the next value is yielded (when deserializing)
        async function preProcessValues(values:Value[]):Promise<[Generator<Value> | AsyncGenerator<Value>, syncValues:Value[], asyncValues:Value[], boundary:Uint8Array, customCount:number]>
        {
            let customCount = 0;
            let boundary = new Uint8Array(0);
            const streamIndexes:Array<number> = [];
            const syncValuesWithAsyncPlaceholders:Value[] = [hasStreamsValue as any, values.length.toString(), streamIndexes, boundary]; //we convert values.length to a string so we know what type it will be come deserialization
            const syncValues:Value[] = [];
            const asyncValues = [];

            let requiresBoundaryCount = 0;
            let isLast = false;
            
            for (let i = 0; i < values.length; i++)
            {
                let arg = values[i];

                let isCustomType = false;
                let isAsyncType = false;
                if (customTypeEncoderAsync !== undefined) 
                {
                    const async = app.extractOrRethrow(await customTypeEncoderAsync(arg));
                    if (async !== false) 
                    {
                        const [ctype, uint8Array, thisCount, stream] = async;
                        if (thisCount < 1) app.throw('count must be greater than 0', []);
                        customCount += (thisCount - 1); //subtract one to prevent double counting
                        arg = stream;

                        const stringValue = String(arg);
                        if (stringValue === '[object AsyncGenerator]') 
                        {
                            syncValuesWithAsyncPlaceholders.push(JSON.stringify([ValueType.AsyncGenerator, ctype, Array.from(uint8Array)]));
                            requiresBoundaryCount++;
                            isLast = true;
                        }
                        else
                        {
                            if (arg instanceof KnownLengthReadableStream) 
                            {
                                syncValuesWithAsyncPlaceholders.push(JSON.stringify([ValueType.KnownLengthReadableStream, ctype, Array.from(uint8Array), arg.length]));
                                isLast = false;
                            }
                            else if (arg instanceof MinLengthReadableStream) 
                            {
                                syncValuesWithAsyncPlaceholders.push(JSON.stringify([ValueType.MinLengthReadableStream, ctype, Array.from(uint8Array), arg.minLength]));
                                requiresBoundaryCount++;
                                isLast = true;
                            }
                            else 
                            {
                                syncValuesWithAsyncPlaceholders.push(JSON.stringify([ValueType.ReadableStream, ctype, Array.from(uint8Array)]));
                                requiresBoundaryCount++;
                                isLast = true;
                            }
                        }

                        isCustomType = true;
                        isAsyncType = true;
                    }
                }

                if (isCustomType === false)
                {
                    const stringValue = String(arg);
                    if (stringValue === '[object AsyncGenerator]') 
                    {
                        syncValuesWithAsyncPlaceholders.push(`${ValueType.AsyncGenerator}`);
                        isAsyncType = true;
                        requiresBoundaryCount++;
                        isLast = true;
                    }
                    else if (arg instanceof ReadableStream)
                    {
                        if (arg instanceof KnownLengthReadableStream) 
                        {
                            syncValuesWithAsyncPlaceholders.push(`${ValueType.KnownLengthReadableStream}:${arg.length}`); //push the length of the stream rather than the stream itself, which serves as a placeholder
                            isLast = false;
                        }
                        else if (arg instanceof MinLengthReadableStream) 
                        {
                            syncValuesWithAsyncPlaceholders.push(`${ValueType.MinLengthReadableStream}:${arg.minLength}`); //push the min length of the stream rather than the stream itself, which serves as a placeholder
                            requiresBoundaryCount++;
                            isLast = true;
                        }
                        else 
                        {
                            syncValuesWithAsyncPlaceholders.push(`${ValueType.ReadableStream}`); //push the type rather than the stream itself, which serves as a placeholder
                            requiresBoundaryCount++;
                            isLast = true;
                        }

                        isAsyncType = true;
                    }
                }

                if (isAsyncType === false)
                {
                    syncValuesWithAsyncPlaceholders.push(arg);
                    syncValues.push(arg);
                    continue;  
                }

                asyncValues.push(arg);
                streamIndexes.push(i);
            }

            //generate and set the boundary if one is required
            if (requiresBoundaryCount > 1 || (requiresBoundaryCount === 1 && isLast !== true)) boundary = syncValuesWithAsyncPlaceholders[3] = app.byteUtil.generateIndexOfBoundary(IndexOfAlgorithm.BM);

            const hasStreams = asyncValues.length > 0;

            if (hasStreams === true)
            {
                //slice the toSerializeA array because we will need the original array later
                values = syncValuesWithAsyncPlaceholders.slice();

                //push the streams to the end of the values array
                for (const stream of asyncValues) values.push(stream);
            }
            else values = syncValues;            

            const generator = (function* ():Generator<Value, void, unknown> { for (const value of values) yield value; })();

            return [generator, hasStreams === true ? syncValuesWithAsyncPlaceholders : syncValues, asyncValues, boundary, customCount];
        }

        let generator:Generator<Value> | AsyncGenerator<Value>;
        if (app.typeUtil.isArray(values) === true) 
        {
            if (allowAsyncValues === true)
            {
                return (async ():Promise<any> =>
                {
                    const [generator, syncValues, asyncValues, boundary, customCount] = await preProcessValues(values);

                    if (splitSyncAndAsyncStreams === true) 
                    {
                        //this is a bit of a hack. we don't allow async values in generators, but if we pass the asyncValues in as an array, it will be processed. we can pass them in as a generator to avoid this
                        const asyncGenerator = (function* ():Generator<Value, void, unknown> { for (const value of asyncValues) yield value; })();
        
                        let syncStream:ReadableStream<Uint8Array> | undefined;
                        let count:number = customCount;
                        if (asyncValues.length === 0)
                        {
                            const [stream0, promise] = ref.toStream(syncValues as any, {customTypeEncoder, count:true});
                            const uint8Array = app.extractOrRethrow(await app.streamUtil.toUint8Array(stream0)); 
                            count = app.extractOrRethrow(await promise);
                            
                            syncStream = app.streamUtil.fromUint8Array(uint8Array);
                        }
                        else
                        {
                            //we don't want to include the first 4 sync values in the count, as they were added by preProcessValues
                            const syncValues1 = syncValues.slice(0, 4);
                            const syncValues2 = syncValues.slice(4);

                            const stream0 = ref.toStream(syncValues1 as any, {allowAsyncValues:false}); //we don't want these values to be included in the count

                            const [stream1, promise] = ref.toStream(syncValues2 as any, {customTypeEncoder, count:true});
                            const uint8Array = app.extractOrRethrow(await app.streamUtil.toUint8Array(stream1)); //we read the sync values to get the count
                            count = app.extractOrRethrow(await promise);

                            syncStream = app.streamUtil.join([stream0, app.streamUtil.fromUint8Array(uint8Array)]); //and then join the streams
                        }

                        const asyncStream = ref.toStream(asyncGenerator as unknown as Value[], {...options, allowAsyncValues:true, splitSyncAndAsyncStreams:false, boundary} as any);
                        return [syncStream, asyncStream, count];
                    }
                    
                    //using the hack again, only to be used internally because there is no private overload option
                    return ref.toStream(generator as any, {...options, allowAsyncValues:true, boundary} as any) as Promise<ReadableStream<Uint8Array>>;
                })();
            }
            else generator = (function* ():Generator<Value, void, unknown> { for (const value of values) yield value; })();
        }
        else generator = values;

        let boundary:Uint8Array | undefined = options?.boundary; //only the first ReadableStream with an undefined length needs to begin with a boundary
        let addEndBoundary = false; //only ReadableStreams with undefined lengths need to end with a boundary
        let currentValueIndex = 0; //the current value index being processed (minus the ones added by preProcessValues)
        let streamReader:StreamReaderHelper<any> | undefined;
        
        let count = 0;
        let countPromise = new ResolvePromise<number | IError>();
        
        let lastResult:IteratorResult<Value, any> | undefined = undefined;

        const stream = app.streamUtil.create({pull, excludeController:true});

        return options?.count === true ? [stream, countPromise] : stream;

        function enqueue(controller:ReadableStreamDefaultController<Uint8Array>, value:Uint8Array)
        {
            if (controller.desiredSize ?? 0 >= value.length)
            {
                controller.enqueue(value);
                currentValueIndex++;
                return;
            }

            streamReader = new StreamReaderHelper(app, app.streamUtil.fromUint8Array(value), controller);
        }

        async function pull(controller:ReadableStreamDefaultController<Uint8Array>)
        {
            try
            {
                while (true)
                {
                    //the previous value has not finished delivering it's bytes, so we need to wait for it to finish before processing the next value
                    if (streamReader !== undefined)
                    {
                        const value = app.extractOrRethrow(await streamReader.read());

                        //if the reader is not done, enqueue the value, return, and we wait for the next pull
                        if (value !== true)
                        {
                            if (value === undefined) app.throw('value is undefined', []);

                            //add the previous value's data to the stream
                            controller.enqueue(value);
                            return;
                        }
                        
                        //the previous value is done, set the stream reader to undefined, and increment the current value index,
                        //add an end boundary if needed, and continue processing the next value
                        streamReader = undefined;

                        //this task needs to add a boundary before processing the next value (meaning it is a value with an undefined length, such as a ReadableStream)
                        if (addEndBoundary === true && boundary !== undefined) controller.enqueue(boundary);
                        addEndBoundary = false; //we reset this
                        
                        //increment the current value index, as we are done processing the previous value
                        currentValueIndex++;
                    }

                    const next = await generator.next();
                    lastResult = next;

                    //check if we are done processing all values. if so, close the stream and we are done with this task
                    if (next.done === true) 
                    {
                        countPromise.resolve(count);
                        
                        return controller.close();
                    }

                    const value = next.value;

                    const result1 = app.extractOrRethrow(await ref.__toUint8Array(value, {customTypeEncoder, returnUndefined:true, count:true}));
                    if (result1 !== undefined)
                    {
                        const [result2, thisCount] = result1;
                        count += thisCount;

                        controller.enqueue(result2);
                        currentValueIndex++;
                        continue;
                    }

                    const type = app.extractOrRethrow(getValueType(value));

                    if (allowAsyncValues !== true && isAsyncIterableDataType(type) === true) app.throw('async values are not allowed', []);

                    switch (type)
                    {
                        case ValueType.ReadableStream:
                        case ValueType.MinLengthReadableStream: //we use a boundary for this type too since we don't know the exact length
                        case ValueType.AsyncGenerator:
                            addEndBoundary = true;
                            break;
                    }

                    switch (type)
                    {
                        //the count option is only available for sync
                        case ValueType.ReadableStream:
                        case ValueType.MinLengthReadableStream:
                        case ValueType.KnownLengthReadableStream:
                        {
                            const stream = value as ReadableStream<Uint8Array>;
                            streamReader = new StreamReaderHelper(app, stream, controller);
                            break;
                        }
                        case ValueType.AsyncGenerator: 
                        {
                            const stream = ref.toStream(value as AsyncGenerator<Value, void, unknown>, {customTypeEncoder, allowAsyncValues:false});
                            streamReader = new StreamReaderHelper(app, stream, controller);
                            break;
                        }
                        case ValueType.Array:
                        case ValueType.Generator:
                        case ValueType.Object:
                        {
                            const [result, thisCount] = app.extractOrRethrow(await ref.__toUint8Array(value, {customTypeEncoder, type, count:true}));
                            count += thisCount;

                            enqueue(controller, result);
                            break;
                        }
                        default:
                        {
                            const [result, thisCount] = app.extractOrRethrow(await ref.__toUint8Array(value, {customTypeEncoder, type, count:true}));
                            count += thisCount;

                            enqueue(controller, result);
                            break;
                        }
                    }
                }
            }
            catch (e)
            {
                const error = app.warn(e, 'unable to process value, {}', [lastResult?.value], {errorOnly:true, names:[SerializationUtil, ref.toStream]});

                streamReader?.cancel(error);
                streamReader = undefined;

                try { generator.throw(error); } catch (error) {}

                //we close the stream, as we cannot continue processing
                controller.error(error);

                if (countPromise.resolved !== true) countPromise.resolve(error);
            }
        }
    }
    
    /**
     * Deserializes data from a ReadableStream<Uint8Array> or a tuple of ReadableStreams (synchronous and asynchronous)
     * into an asynchronous generator yielding deserialized values. This method supports deserialization of primitive types,
     * complex objects, and custom types if a customTypeDecoder is provided. Additionally, it can handle mixed data streams
     * containing both synchronous and asynchronous values.
     * 
     * The `count` option serves as a safeguard against unbounded deserialization, limiting the maximum number of values
     * the method will process. This is particularly useful for preventing resource exhaustion from maliciously crafted
     * data streams.
     * 
     * @param {ReadableStream<Uint8Array> | [ReadableStream<Uint8Array>, ReadableStream<Uint8Array>]} stream - The input stream
     *        to deserialize from. Can either be a single stream or a tuple containing a synchronous and an asynchronous stream.
     * @param {Object} [options] - Optional parameters to customize the deserialization process.
     * @param {CustomTypeDecoder} [options.customTypeDecoder] - An optional function for decoding custom types. It should
     *        accept a custom type identifier (ctype), the serialized data as Uint8Array, a count of how many items to process,
     *        and possibly an async generator for handling nested async values, then return a deserialized value.
     * @param {boolean} [options.allowAsyncValues=true] - Indicates whether the deserialization process should handle
     *        asynchronous values. When set to false, encountering an asynchronous value will result in an error.
     * @param {number} [options.count] - The maximum number of values to deserialize from the stream, serving as a security
     *        measure against data stream abuse. Attempts to process more than this number will result in an error, halting
     *        further deserialization.
     * 
     * @yields {{type: ValueType.Custom, ctype: number, value: unknown} | {type: ValueType, value: Value} | IError} - Yields
     *         deserialized values as they are read from the stream. Each value is an object with `type` and `value` properties,
     *         where `type` indicates the data type and `value` is the actual deserialized data. If a custom type is encountered,
     *         `ctype` will also be included to indicate the custom type identifier. In case of errors during deserialization,
     *         an `IError` object may be yielded.
     * 
     * @returns {AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | number | IError>}
     *          Returns an async generator. The generator yields objects containing deserialized data. If the `count` option is
     *          provided, the remaining count will be yielded last.
     * 
     * @note This method is designed to seamlessly integrate with streams containing mixed types of data, offering
     *       flexibility in handling real-world data streaming scenarios. Special care has been taken to support streams
     *       with embedded asynchronous data, allowing for complex, nested asynchronous structures to be deserialized
     *       in a memory-efficient and orderly manner.
     */  
    public fromStream(stream:ReadableStream<Uint8Array>, options?:{customTypeDecoder?:CustomTypeDecoder, allowAsyncValues?:boolean, count?:number}):AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | IError>;
    public fromStream(stream:ReadableStream<Uint8Array>, options?:{customTypeDecoder?:CustomTypeDecoder, allowAsyncValues?:boolean, count:number}):AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | number | IError>;
    public fromStream(streams:[syncStream:ReadableStream<Uint8Array>, asyncStream:ReadableStream<Uint8Array>], options?:{customTypeDecoder?:CustomTypeDecoder, allowAsyncValues?:boolean, count?:number}):AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | IError>;
    public fromStream(streams:[syncStream:ReadableStream<Uint8Array>, asyncStream:ReadableStream<Uint8Array>], options?:{customTypeDecoder?:CustomTypeDecoder, allowAsyncValues?:boolean, count:number}):AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | number | IError>;
    public async *fromStream(stream:ReadableStream<Uint8Array> | [syncStream:ReadableStream<Uint8Array>, asyncStream:ReadableStream<Uint8Array>], options?:{customTypeDecoder?:CustomTypeDecoder, allowAsyncValues?:boolean, count?:number}):AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | IError> | AsyncGenerator<{type:ValueType.Custom, ctype:number, value:unknown} | {type:ValueType, value:Value} | number | IError>
    {
        const ref = this;
        const app = this._app;
        
        let streamReader:StreamReaderHelper<any> | undefined;
        let streams:{stream:KnownLengthReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array> | ReadableStream<Uint8Array> | AsyncGenerator<Value, void, unknown>, controller:ReadableStreamDefaultController<Uint8Array>, type:ValueType.KnownLengthReadableStream | ValueType.MinLengthReadableStream | ValueType.ReadableStream | ValueType.AsyncGenerator}[] = [];
        let allValuesYieldedPromise:ResolvePromise<boolean> = new ResolvePromise<boolean>();
        let error:IError | undefined = undefined;

        try
        {
            if (app.typeUtil.isArray(stream) === true) stream = app.streamUtil.join(stream);

            const customTypeDecoder = options?.customTypeDecoder;
            const customTypeDecoderAsync = customTypeDecoder?.stream;
            const allowAsyncValues = options?.allowAsyncValues ?? true;
            
            let count = options?.count ?? Number.MAX_SAFE_INTEGER;

            streamReader = new StreamReaderHelper(app, stream);

            let step = 0;

            let valueIndex = -1;

            let numberOfValues:undefined | number = undefined;
    
            let hasStreams:undefined | boolean = undefined;
            let expectedNumberOfStreams:undefined | number = undefined;
            let streamIndexArray:undefined | number[] = undefined;
            let pull:undefined | ((controller:ReadableStreamDefaultController<Uint8Array>) => Promise<void>) = undefined;

            let boundary:Uint8Array | undefined = undefined;
            
            let type:undefined | ValueType | InternalValueType = undefined;
            let length:number | undefined;
    
            const extractType = async function(streamReader:StreamReaderHelper<any>):Promise<ValueType | InternalValueType>
            {
                return app.extractOrRethrow(await streamReader.read(1))[0];
            }

            const extractLength = async function(streamReader:StreamReaderHelper<any>):Promise<uint>
            {
                const numberOfBytes = app.extractOrRethrow(await streamReader.read(1))[0]; 

                const uint8Array = app.extractOrRethrow(await streamReader.read(numberOfBytes)); 
                const length = app.integerUtil.fromUint8Array(uint8Array, false);

                return length;
            }

            const checkCount = (decrement:number) => 
            {
                count -= decrement;
                
                if (count < 0) app.throw('count exceeded', []);

                return count;
            }

            outer: while (true) 
            {
                if (streamReader === undefined) app.throw('reader is undefined', []);

                while (true)
                {
                    switch (step)
                    {
                        //initialization step 1. check if we have any streams. if we do, goto step 1, otherwise goto step 2
                        case 0:
                        {
                            const byte = app.extractOrRethrow(await streamReader.peek(1))[0];

                            //check if the first byte is the special hasStreams byte
                            if (byte !== InternalValueType.hasStreams)
                            {
                                hasStreams = false;
                                step = 2;
                                continue;
                            }

                            if (allowAsyncValues !== true) app.throw('async values are not allowed', []);

                            app.extractOrRethrow(await streamReader.read(1)); //consume the byte

                            hasStreams = true;
                            step = 1;
                            continue;
                        }

                        //initialization step 2. we have streams. extract the number of args, and the stream indexes array
                        case 1:
                        {
                            let type = await extractType(streamReader);
                            let length = await extractLength(streamReader);
                            let bytes = app.extractOrRethrow(await streamReader.read(length));
                            
                            //the number of values we are expecting
                            numberOfValues = parseInt(app.extractOrRethrow(await ref.__fromUint8Array<string>(bytes, {type, length})));

                            type = await extractType(streamReader);
                            length = await extractLength(streamReader);
                            bytes = app.extractOrRethrow(await streamReader.read(length));

                            //the value indexes where the streams are located
                            streamIndexArray = app.extractOrRethrow(await ref.__fromUint8Array<number[]>(bytes, {type, length}));
                            expectedNumberOfStreams = streamIndexArray.length;

                            type = await extractType(streamReader);
                            length = await extractLength(streamReader);
                            bytes = app.extractOrRethrow(await streamReader.read(length));

                            //the boundary value
                            boundary = bytes;
  
                            step = 2;
                            continue;
                        }

                        //step 2. process the values
                        case 2:
                        {
                            //this is specifically to support streams. we have to know when all args have been yielded, so we can break out of this loop and start processing stream data in pull
                            if (numberOfValues !== undefined && valueIndex === numberOfValues! - 1) 
                            {
                                if (options?.count !== undefined) yield count;
                                allValuesYieldedPromise.resolve(true);
                            }
                            if (allValuesYieldedPromise.resolved === true) break outer;

                            //check if we have any more bytes to read
                            const uint8Array = app.extractOrRethrow(await streamReader.peek(1));
                            if (uint8Array.length === 0) break outer; //end of stream

                            type = await extractType(streamReader);
                           
                            valueIndex++;
                           
                            switch (type)
                            {
                                case ValueType.Custom:
                                case ValueType.string:
                                case ValueType.bigint:
                                case ValueType.Uint8Array:
                                case ValueType.Array:
                                case ValueType.Generator:
                                case ValueType.Object:
                                    step = 3;
                                    continue;
                                case InternalValueType.EmptyArray:
                                case InternalValueType.EmptyObject:
                                case InternalValueType.emptystring:
                                case InternalValueType.zero:
                                case InternalValueType.one:
                                case InternalValueType.negativeone:
                                case InternalValueType.false:
                                case InternalValueType.true:
                                case ValueType.undefined:
                                case InternalValueType.uint_1byte:
                                case InternalValueType.uint_2byte:
                                case InternalValueType.uint_3byte:
                                case InternalValueType.uint_4byte:
                                case InternalValueType.uint_5byte:
                                case InternalValueType.uint_6byte:
                                case InternalValueType.uint_7byte:
                                case InternalValueType.int_1byte:
                                case InternalValueType.int_2byte:
                                case InternalValueType.int_3byte:
                                case InternalValueType.int_4byte:
                                case InternalValueType.int_5byte:
                                case InternalValueType.int_6byte:
                                case InternalValueType.int_7byte:
                                case InternalValueType.float_32:
                                case InternalValueType.float_64:
                                    step = 4;
                                    continue;
                                default: app.throw('unsupported part type, {}', [type]);
                            }
                        }
                        case 3:
                        {
                            length = await extractLength(streamReader);

                            step = 4;
                            continue;
                        }
                        case 4:
                        {
                            if (streamIndexArray !== undefined && streamIndexArray.length !== 0)
                            {
                                if (pull === undefined)
                                {
                                    const boundarySize = IndexOfBoundarySize.BM;

                                    let preprocessedBoundary = undefined as PreProcessedNeedle | undefined;
                                    let remainingBytes = undefined as number | undefined;

                                    let controllerMismatch = false;
                                    let current:typeof streams[0] | undefined = undefined;
                                    let streamIndex = 0;
                                    let pullingController:ReadableStreamDefaultController<Uint8Array> | undefined = undefined;
                                    let closedControllers:Set<ReadableStreamDefaultController<Uint8Array>> = new Set();
                                    let lastByteCount = -1;

                                    const pulling = function(controller:ReadableStreamDefaultController<Uint8Array>):boolean
                                    {
                                        if (pullingController === undefined) 
                                        {
                                            pullingController = controller;
                                            return true;
                                        }

                                        if (pullingController === controller) return true;
                                        
                                        if ((controller.desiredSize ?? 0) > 0 && closedControllers.has(controller) !== true) controller.enqueue(new Uint8Array(0));
                                        return false;
                                    }

                                    pull = async function(controller1:ReadableStreamDefaultController<Uint8Array>) 
                                    {
                                        try
                                        {
                                            if (allValuesYieldedPromise.resolved === false)
                                            {
                                                const success = await allValuesYieldedPromise;
                                                if (success !== true) return;
                                            }

                                            outer: while (true)
                                            {
                                                //if another controller is currently pulling, return before reading from the reader
                                                if (pulling(controller1) !== true) return;

                                                if (streamReader === undefined) return app.throw('stream reader is undefined', []);
                                                
                                                streamReader.controller = controller1;
                                                let peeked = app.extractOrRethrow(await streamReader.peek());
                                                
                                                //pull could be called out of order, so we need to do this after awaiting the reader
                                                if (current === undefined) current = streams[streamIndex++];
                                                const {stream, type, controller} = current;

                                                //we will use this later to determine if we should enqueue an empty array
                                                if (controller1 !== controller) controllerMismatch = true;

                                                //pull is shared between streams, which complicates things a bit.
                                                //this means controller1 may have been closed, errored, or enqueued by another pull while we were waiting for the reader
                                                //so, we need to check, and return if it has been closed, errored, or doesn't need any more bytes
                                                if ((controller1.desiredSize ?? 0) <= 0 || closedControllers.has(controller1) !== false) break outer;

                                                //ensure we are not stuck in an infinite loop
                                                //if all bytes have been read from the reader, then the byte count should always decrease with every iteration or pull
                                                //staying the same means we are in an infinite loop and should throw an error due to corrupt data
                                                if (streamReader.done === true && lastByteCount === peeked.length) app.throw('something is wrong. no bytes were enqueued, even though all bytes have been read. possibly the input stream is corrupted', []);
                                                
                                                lastByteCount = peeked.length;

                                                switch (type)
                                                {
                                                    case ValueType.MinLengthReadableStream:
                                                    case ValueType.ReadableStream:
                                                    case ValueType.AsyncGenerator:
                                                    {
                                                        if (type == ValueType.MinLengthReadableStream)
                                                        {
                                                            if (remainingBytes === undefined) remainingBytes = (stream as MinLengthReadableStream).minLength;
                                                            
                                                            if (remainingBytes !== 0)
                                                            {
                                                                const index = Math.min(remainingBytes, peeked.length);
                                                                const uint8Array = streamReader.consume(index);
                                                                
                                                                remainingBytes -= index;
                                                                
                                                                controller!.enqueue(uint8Array);

                                                                break outer; //we already enqueued some data, so make them call pull again
                                                            }
                                                        }

                                                        let bytesToEnqueue:Uint8Array;

                                                        //if there is no boundary, it is because this is the last (or only) stream, and the only stream that would need a boundary, so we can just read till the end as the end is our boundary
                                                        if (boundary!.length !== 0) 
                                                        {
                                                            if (peeked.length < boundarySize) peeked = app.extractOrRethrow(await streamReader.peek(boundarySize * 2));
                                                            
                                                            let index;
                                                            [index, preprocessedBoundary] = app.byteUtil.indexOf(peeked, preprocessedBoundary ?? boundary!, {algorithm:IndexOfAlgorithm.BM});
                                                            if (index === -1)
                                                            {
                                                                //enqueue the safe portion of the accumulated bytes, as we know it doesn't contain the boundary
                                                                const uint8Array = streamReader.consume(peeked.length - boundarySize);
                                                                controller!.enqueue(uint8Array);
                                                                
                                                                break outer;
                                                            }

                                                            bytesToEnqueue = streamReader.consume(index);
                                                            streamReader.consume(boundarySize);
                                                        }
                                                        else
                                                        {
                                                            bytesToEnqueue = streamReader.consume(peeked.length);
                                                            
                                                            if (streamReader.done !== true)
                                                            {
                                                                controller.enqueue(bytesToEnqueue);

                                                                break outer;
                                                            }
                                                        }
                                                        
                                                        //need to do this before calling enqueue, as it may call pull again
                                                        current = undefined; 
                                                        remainingBytes = undefined;

                                                        closedControllers.add(controller);
                                                        controller.enqueue(bytesToEnqueue);
                                                        controller.close();

                                                        break outer;
                                                    }
                                                    case ValueType.KnownLengthReadableStream:
                                                    {
                                                        if (remainingBytes === undefined) remainingBytes = (stream as KnownLengthReadableStream).length;

                                                        let bytesToEnqueue:Uint8Array;

                                                        if (remainingBytes !== 0) 
                                                        {
                                                            const index = Math.min(remainingBytes, peeked.length);
                                                            bytesToEnqueue = streamReader.consume(index);
                                                            
                                                            remainingBytes -= index;

                                                            if (remainingBytes !== 0)
                                                            {
                                                                controller!.enqueue(bytesToEnqueue); //call last

                                                                break outer; //we already enqueued some data, so make them call pull again
                                                            }
                                                        }
                                                        else bytesToEnqueue = new Uint8Array(0);

                                                        //need to do this before calling enqueue, as it may call pull again
                                                        remainingBytes = undefined;
                                                        current = undefined;

                                                        closedControllers.add(controller);
                                                        controller!.enqueue(bytesToEnqueue);
                                                        controller.close();
                                                        break outer;
                                                    }
                                                    default: app.throw('unsupported part type: {}', [type]);
                                                }
                                            }

                                            //say there are three streams, and the user tries to read stream 2 before stream 1
                                            //this is fine, as the order streams are read is always the original order they were yielded,
                                            //but if they are pulling for stream 2 and stream 1 is not yet done, we still need to enqueue
                                            //something or the stream will hang. the only issue would be that if they wait too long to read
                                            //stream 1, it may consume a lot of memory before they read it.
                                            if (controllerMismatch === true && (controller1.desiredSize ?? 0) > 0 && closedControllers.has(controller1) !== true) controller1.enqueue(new Uint8Array(0));
                                            
                                            pullingController = undefined;
                                        }
                                        catch (e)
                                        {
                                            error = app.warn(e, 'unable to pull stream', arguments, {errorOnly:true, names:[SerializationUtil, ref.fromStream, pull!]});

                                            streamReader?.cancel(error);

                                            for (const stream of streams) try { stream.controller.error(error); } catch {}
                                            streams.length = 0;
                                        }
                                    }
                                }

                                if (streamIndexArray[0] === valueIndex)
                                {                  
                                    let readableStream:ReadableStream<Uint8Array> | KnownLengthReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array>;
                                    let readableStreamController:ReadableStreamDefaultController<Uint8Array>;

                                    if (type !== ValueType.string) app.throw('unsupported part type', []);

                                    let uint8Array = app.extractOrRethrow(await streamReader.read(length!));

                                    const streamInfo = app.extractOrRethrow(await ref.__fromUint8Array<string>(uint8Array, {type, length}));

                                    let ctype:number | undefined;

                                    let streamType:ValueType | InternalValueType;
                                    let streamLength:number | undefined;
                                    if (streamInfo[0] === '[') //we store it as json so that it counts as a single value (as opposed to an array), making counting easier when serializing
                                    {
                                        let byteArray:number[];
                                        [streamType, ctype, byteArray, streamLength] = app.extractOrRethrow(app.jsonUtil.parse(streamInfo as json)) as [ValueType, number, number[], number?];
                                        uint8Array = new Uint8Array(byteArray);
                                    }
                                    else
                                    {
                                        let [typeString, lengthString] = streamInfo.split(':');

                                        streamType = parseInt(typeString) as ValueType;
                                        streamLength = lengthString ? parseInt(lengthString) : undefined;
                                    }

                                    switch (streamType)
                                    {
                                        case ValueType.ReadableStream:
                                            [readableStream, readableStreamController] = app.streamUtil.create({pull}); //normal stream with undefined length
                                            break;
                                        case ValueType.KnownLengthReadableStream:
                                            [readableStream, readableStreamController] = app.streamUtil.create(streamLength as number, {pull});
                                            break;
                                        case ValueType.MinLengthReadableStream:
                                            [readableStream, readableStreamController] = app.streamUtil.create(streamLength as number, {pull, isMinLength:true});
                                            break;
                                        case ValueType.AsyncGenerator:
                                            [readableStream, readableStreamController] = app.streamUtil.create({pull}); //normal stream with undefined length
                                            break;
                                        default:
                                            return app.throw('unsupported stream type: {}', [streamType]);
                                    }
   
                                    streams.push({stream:readableStream, controller:readableStreamController, type:streamType});

                                    streamIndexArray.shift();

                                    let toYield;
                                    if (streamType === ValueType.AsyncGenerator)
                                    {
                                        async function* asyncGenerator():AsyncGenerator<Value, void, unknown> 
                                        {
                                            for await (const value of ref.fromStream(readableStream, {customTypeDecoder, allowAsyncValues:false})) //do not allow async values or we will allow recursive async, which we do not want to allow
                                            {
                                                yield app.extractOrRethrow(value).value as Value;
                                            }
                                        }

                                        if (ctype !== undefined)
                                        {
                                            const result = app.extractOrRethrow(await customTypeDecoderAsync!(ctype, uint8Array, count, asyncGenerator()));
                                            if (result === undefined) return app.throw('custom type decoder did not return a value', []);
                                            
                                            const [value, thisCount] = result;
                                            if (thisCount >= count) app.throw('invalid count value given', [thisCount]);

                                            count = thisCount;
                                            checkCount(0);

                                            toYield = {type:streamType, value:value as Value};
                                        }
                                        else 
                                        {
                                            checkCount(1);
                                            toYield = {type:streamType, value:asyncGenerator()};
                                        }
                                    }
                                    else 
                                    {
                                        if (ctype !== undefined)
                                        {
                                            const result = app.extractOrRethrow(await customTypeDecoderAsync!(ctype, uint8Array, count, readableStream));
                                            if (result === undefined) return app.throw('custom type decoder did not return a value', []);
                                            
                                            const [value, thisCount] = result;
                                            if (thisCount >= count) app.throw('invalid count value given', [thisCount]);

                                            count = thisCount;
                                            checkCount(0);
                                            
                                            toYield = {type:streamType, value:value as Value};
                                        }
                                        else 
                                        {
                                            checkCount(1);
                                            toYield = {type:streamType, value:readableStream};
                                        }
                                    }

                                    step = 2;

                                    //we need to set all args yielded before we yield in case there are no more args left. they may not actually complete reading from the generator
                                    if (streams.length === expectedNumberOfStreams && valueIndex === numberOfValues! - 1) allValuesYieldedPromise.resolve(true);

                                    yield toYield;
                                    
                                    //we are done... we don't want any more bytes handled by the outer loop as the pull method is now handling it
                                    if (allValuesYieldedPromise.resolved === true) 
                                    {
                                        if (options?.count !== undefined) yield count;
                                        return;
                                    }

                                    //there are more values to process, so continue
                                    continue;
                                }
                            }

                            switch (type!)
                            {
                                case ValueType.Array:
                                case ValueType.Generator:
                                case ValueType.Object:
                                {
                                    const uint8Array = app.extractOrRethrow(await streamReader.read(length!));

                                    const [value, _remainingBytes, thisCount] = app.extractOrRethrow(await ref.__fromUint8Array(uint8Array, {type, length, customTypeDecoder, count}));
                                    count = thisCount;
                                    yield value;

                                    step = 2;
                                    continue;
                                }
                                case ValueType.Custom:
                                {
                                    const uint8Array = app.extractOrRethrow(await streamReader.read(length!));

                                    const [value, _remainingBytes, thisCount] = app.extractOrRethrow(await ref.__fromUint8Array(uint8Array, {type, length, customTypeDecoder, count}));
                                    count = thisCount;
                                    yield value;
                                    
                                    step = 2;
                                    continue;
                                }
                                case InternalValueType.EmptyArray:
                                case InternalValueType.EmptyObject:
                                case InternalValueType.emptystring:
                                case InternalValueType.zero:
                                case InternalValueType.one:
                                case InternalValueType.negativeone:
                                case InternalValueType.true:
                                case InternalValueType.false:
                                case ValueType.undefined:
                                {
                                    const [value, _uint8Array, thisCount] = app.extractOrRethrow(await ref.__fromUint8Array(undefined, {type, count}));
                                    count = thisCount;
                                    yield value;

                                    step = 2;
                                    continue;
                                }
                                case InternalValueType.uint_1byte:
                                case InternalValueType.uint_2byte:
                                case InternalValueType.uint_3byte:
                                case InternalValueType.uint_4byte:
                                case InternalValueType.uint_5byte:
                                case InternalValueType.uint_6byte:
                                case InternalValueType.uint_7byte:
                                {
                                    const numberOfBytes = (type + 1) - InternalValueType.uint_1byte;
                                    const uint8Array = app.extractOrRethrow(await streamReader.read(numberOfBytes));

                                    const [value, _uint8Array, thisCount] = app.extractOrRethrow(await ref.__fromUint8Array(uint8Array, {type, count}));
                                    count = thisCount;
                                    yield value;

                                    step = 2;
                                    continue;
                                }
                                case InternalValueType.int_1byte:
                                case InternalValueType.int_2byte:
                                case InternalValueType.int_3byte:
                                case InternalValueType.int_4byte:
                                case InternalValueType.int_5byte:
                                case InternalValueType.int_6byte:
                                case InternalValueType.int_7byte:
                                {
                                    const numberOfBytes = (type + 1) - InternalValueType.int_1byte;
                                    const uint8Array = app.extractOrRethrow(await streamReader.read(numberOfBytes));

                                    const [value, _uint8Array, thisCount] = app.extractOrRethrow(await ref.__fromUint8Array(uint8Array, {type, count}));
                                    count = thisCount;
                                    yield value;

                                    step = 2;
                                    continue;
                                }
                                case InternalValueType.float_32:
                                {
                                    const uint8Array = app.extractOrRethrow(await streamReader.read(4));

                                    const [value, _uint8Array, thisCount] = app.extractOrRethrow(await ref.__fromUint8Array(uint8Array, {type, count}));
                                    count = thisCount;
                                    yield value;

                                    step = 2;
                                    continue;
                                }
                                case InternalValueType.float_64:
                                {
                                    const uint8Array = app.extractOrRethrow(await streamReader.read(8));

                                    const [value, _uint8Array, thisCount] = app.extractOrRethrow(await ref.__fromUint8Array(uint8Array, {type, count}));
                                    count = thisCount;
                                    yield value;

                                    step = 2;
                                    continue;
                                }
                                case ValueType.string:
                                case ValueType.bigint:
                                case ValueType.Uint8Array:
                                {
                                    const uint8Array = app.extractOrRethrow(await streamReader.read(length!));

                                    const [value, _uint8Array, thisCount] = app.extractOrRethrow(await ref.__fromUint8Array(uint8Array, {type, length, count}));
                                    count = thisCount;
                                    yield value;

                                    step = 2;
                                    continue;
                                }
                                default: app.throw('unsupported part type: {}', [type]);
                            }
                        }
                    }
                }
            }

            //we should not make it here if there are streams and we yielded the correct number of streams
            if (hasStreams && streams.length !== expectedNumberOfStreams) app.throw('stream count mismatch. input stream data appears to be corrupted', []);
            
            if (allValuesYieldedPromise.resolved === true) return; 
            
            if (options?.count !== undefined) yield count;
            allValuesYieldedPromise.resolve(true);
        }
        catch (e)
        {
            error = app.warn(e, 'failed to deserialize stream', arguments, {errorOnly:true, names:[SerializationUtil, ref.fromStream]});

            try { for (const stream of streams) stream.controller.error(error); } catch {} //suppress any errors
            streams.length = 0;

            allValuesYieldedPromise.resolve(false);

            streamReader?.cancel(error);
        }
        finally
        {
            //if all the values have been yieled, we don't need to do anything more
            if (allValuesYieldedPromise.resolved !== true)
            {
                //no streams have been yielded, so it is okay if we did not yield all values
                if (streams.length === 0) allValuesYieldedPromise.resolve(error !== undefined);
                else
                {
                    //error any streams we have yielded, as we did not yield all values, making it impossible to pull the stream data
                    for (const stream of streams) try { stream.controller.error('failed to yield all values from generator'); } catch {} //suppress any errors
                    streams.length = 0;

                    allValuesYieldedPromise.resolve(false);
                }
            }

            if (error !== undefined) yield error;
        }
    }

    public async toUint8Array(value:Value, options?:{customTypeEncoder?:CustomTypeEncoder}):Promise<Uint8Array | IError>;
    public async toUint8Array(value:Value, options:{customTypeEncoder?:CustomTypeEncoder, count:true}):Promise<[Uint8Array, number] | IError>;
    public async toUint8Array(value:Value, options?:{customTypeEncoder?:CustomTypeEncoder, count?:boolean}):Promise<Uint8Array | [Uint8Array, number] | IError>
    {
        return this.__toUint8Array(value, options);
    }

    /**
     * Serializes a given value to a Uint8Array according to the specified type or determined automatically. This method
     * supports serialization of various JavaScript data types, including custom types when a customTypeEncoder is provided.
     * It can return the serialized data directly or as part of a tuple including the data length, based on the options.
     * 
     * @param {Value} value - The value to serialize. Can be a primitive type, an object, a built-in type, or a custom type.
     * @param {Object} [options] - Configuration options for serialization.
     * @param {ValueType | InternalValueType} [options.type] - Optional. Explicitly specifies the type of the value to
     *        guide serialization. If omitted, the type is extracted.
     * @param {CustomTypeEncoder} [options.customTypeEncoder] - Optional. A function provided for custom type encoding. It
     *        should accept a value and return a Uint8Array representation or undefined if the value is not a custom type.
     * @param {boolean} [options.returnUndefined=false] - Determines the behavior when encountering an undefined value or
     *        when a custom type encoder returns undefined. When true, the method may return `undefined`; otherwise, it
     *        throws an error for unsupported types.
     * @param {boolean} [options.count=false] - If true, the method returns a tuple containing the serialized Uint8Array and
     *        the number of top-level items processed.
     * 
     * @returns {Uint8Array | [Uint8Array, number] | undefined | IError} The serialized data as a Uint8Array. If `count` is
     *          true, returns a tuple of the serialized data and the count of serialized values. If `returnUndefined` is
     *          true, may return `undefined` for unsupported types or custom types not handled by the encoder. May also
     *          return `IError` if serialization fails.
     * 
     */
    private async __toUint8Array(value:Value, options?:{type?:ValueType | InternalValueType, customTypeEncoder?:CustomTypeEncoder, returnUndefined?:false}):Promise<Uint8Array | IError>;
    private async __toUint8Array(value:Value, options:{type?:ValueType | InternalValueType, customTypeEncoder?:CustomTypeEncoder, returnUndefined:true}):Promise<Uint8Array | undefined | IError>;
    private async __toUint8Array(value:Value, options:{type?:ValueType | InternalValueType, customTypeEncoder?:CustomTypeEncoder, returnUndefined?:false, count:true}):Promise<[Uint8Array, number] | IError>;
    private async __toUint8Array(value:Value, options:{type?:ValueType | InternalValueType, customTypeEncoder?:CustomTypeEncoder, returnUndefined:true, count:true}):Promise<[Uint8Array, number] | undefined | IError>;
    private async __toUint8Array(value:Value, options?:{type?:ValueType | InternalValueType, customTypeEncoder?:CustomTypeEncoder, returnUndefined?:boolean, count?:boolean}):Promise<Uint8Array | [Uint8Array, number] | undefined | IError>
    {
        const returnUndefined = options?.returnUndefined === true;
        const customTypeEncoder = options?.customTypeEncoder;
        const customTypeSyncEncoder = customTypeEncoder?.sync;
        const customTypeByteSize = customTypeEncoder?.typeByteSize ?? 7;
        const app = this._app;
        const ref = this;
        const getValueType = this.#getValueType;

        let count = 0;

        function prepare(valueType:ValueType | InternalValueType, options?:{headers?:Uint8Array[], value?:Uint8Array, dontStoreLength?:boolean}):Uint8Array | IError
        {
            try
            {
                const value = options?.value;
                let length = value?.length;
                const headers = options?.headers;
                const storeLength = options?.dontStoreLength !== true;

                const chunks = [];

                //add the value type
                chunks.push(app.integerUtil.toUint8Array(valueType as uint, false).slice(7, 8)); //value type value cannot exceed 255

                //add any additional headers if defined
                const headerChunks = [];
                if (headers !== undefined) for (const header of headers) 
                {
                    if (length === undefined) return app.throw('length must be defined if headers are defined', []);

                    length += header.length;
                    headerChunks.push(header);
                }

                //add the value length if a length is defined and storeLength is true
                if (length !== undefined && storeLength === true) 
                {
                    const bytesNeededToRepresent = app.integerUtil.calculateBytesNeededToRepresent(length as uint);

                    const uint8Array = new Uint8Array(1 + bytesNeededToRepresent);
                    uint8Array[0] = bytesNeededToRepresent;
                    uint8Array.set(app.integerUtil.toUint8Array(length as uint, false).slice(8 - bytesNeededToRepresent, 8), 1);

                    chunks.push(uint8Array);
                }
                //add the headers
                for (const header of headerChunks) chunks.push(header);

                //if there is a value, push it
                if (value !== undefined && value.length > 0) chunks.push(value);
                
                const result = app.byteUtil.concat(chunks);

                return result;
            }
            catch (error)
            {
                return app.warn(error, 'unable to prepare value', [valueType, options], {errorOnly:true, names:[SerializationUtil, ref.__toUint8Array, prepare]});
            }
        }

        async function processCustomValue(value:Value, customTypeEncoder:CustomTypeEncoderSync | undefined):Promise<Uint8Array | undefined | IError>
        {
            try
            {
                if (customTypeEncoder === undefined) return undefined;
                
                const result = app.extractOrRethrow(await customTypeEncoder(value));
                if (result === undefined) return undefined;
    
                const [type, uint8Array, thisCount] = result;
                if (type < 0 || type > (2**(customTypeByteSize * 8) - 1)) app.throw('custom type value exceeds limit, given: {}, limit: {}', [type, 2**(customTypeByteSize * 8) - 1]);
                const headers = [app.integerUtil.toUint8Array(type as uint, false).slice(8 - customTypeByteSize, 8)];
    
                count += Math.max(1, thisCount);

                return app.extractOrRethrow(prepare(ValueType.Custom, {headers, value:uint8Array}));
            }
            catch (error)
            {
                return app.warn(error, 'unable to process custom value, constructor: {}', [value?.constructor?.name, value], {errorOnly:true, names:[SerializationUtil, ref.__toUint8Array, processCustomValue]});
            }
        }

        function processSimpleValue(value:Value, type:ValueType | InternalValueType):Uint8Array | IError
        {
            try
            {
                count++;

                switch (type)
                {
                    case InternalValueType.emptystring:
                    case InternalValueType.zero:
                    case InternalValueType.one:
                    case InternalValueType.negativeone:
                    case InternalValueType.EmptyArray:
                    case InternalValueType.EmptyObject:
                    case InternalValueType.true:
                    case InternalValueType.false:
                    case InternalValueType.hasStreams:
                    case ValueType.undefined:
                        return app.extractOrRethrow(prepare(type));
                    case InternalValueType.int_1byte:
                    case InternalValueType.int_2byte:
                    case InternalValueType.int_3byte:
                    case InternalValueType.int_4byte:
                    case InternalValueType.int_5byte:
                    case InternalValueType.int_6byte:
                    case InternalValueType.int_7byte:
                    case InternalValueType.uint_1byte:
                    case InternalValueType.uint_2byte:
                    case InternalValueType.uint_3byte:
                    case InternalValueType.uint_4byte:
                    case InternalValueType.uint_5byte:
                    case InternalValueType.uint_6byte:
                    case InternalValueType.uint_7byte:
                        const integer = Math.abs(value as int) as uint;

                        const uint8Array = app.integerUtil.toUint8Array(integer, false);

                        if (value as number >= 0)
                        {
                            const length = (type + 1) - InternalValueType.uint_1byte;
                            value = uint8Array.slice(8 - length, 8);
                        }
                        else
                        {
                            const length = (type + 1) - InternalValueType.int_1byte;
                            value = uint8Array.slice(8 - length, 8);
                        }

                        return app.extractOrRethrow(prepare(type, {value:value as Uint8Array, dontStoreLength:true}));
                    case InternalValueType.float_32:
                        value = app.numberUtil.toUint8Array(value as number, false, 32);
                        return app.extractOrRethrow(prepare(type, {value, dontStoreLength:true}));
                    case InternalValueType.float_64:
                        value = app.numberUtil.toUint8Array(value as number, false, 64);
                        return app.extractOrRethrow(prepare(type, {value, dontStoreLength:true}));
                    case ValueType.bigint:
                        value = app.bigIntUtil.toUint8Array(value as bigint, false);
                        return app.extractOrRethrow(prepare(type, {value}));
                    case ValueType.string:
                        value = app.textUtil.toUint8Array(value as string);
                        return app.extractOrRethrow(prepare(type, {value}));
                    case ValueType.Uint8Array:
                        return app.extractOrRethrow(prepare(type, {value:value as Uint8Array}));
                    default: return app.throw('unexpected type given, {type}', [type, value]);
                }
            }
            catch (error)
            {
                return app.warn(error, 'unable to process simple value', [value], {errorOnly:true, names:[SerializationUtil, ref.__toUint8Array, processSimpleValue]});
            }
        }

        async function processComplexValue_iterative(value:Value, customTypeEncoder:CustomTypeEncoderSync | undefined, type:ValueType.Array | ValueType.Object | ValueType.Generator):Promise<Uint8Array | IError>
        {
            try
            {
                const results:Uint8Array[] = [];

                type Item = {value:Value, type:ValueType | InternalValueType, parentResults:Uint8Array[], results:Uint8Array[][], resultIndex:number, depth:number};
                
                const initialItem:Item = {value, type, parentResults:results, results:[], resultIndex:0, depth:0};
                let stack:Array<{objects:Array<Item>, index:number, finalizer:undefined, parent:undefined} | {objects:undefined, index:number, finalizer:Function, parent:Item}> = [{objects:[initialItem], index:0, finalizer:undefined, parent:undefined}];
                while (stack.length > 0)
                {
                    const next = stack.pop()!;
                
                    if (next.finalizer !== undefined) //time to finalize this object
                    {
                        count++;

                        const finalizer = next.finalizer;
                        const objectToFinalize = next.parent;

                        //first combine the results
                        const result = app.arrayUtil.concat(objectToFinalize.results);

                        //then compute our result, and update the parent's results at the correct index
                        objectToFinalize.parentResults[objectToFinalize.resultIndex] = finalizer(app.byteUtil.concat(result));
                        continue;
                    }

                    let objects:Item[] = [];
                    let finalizer = undefined;

                    for (let i = next.objects.length; i--;)
                    {
                        const object = next.objects[i] as any;

                        const value = object.value;
                        const type = object.type;

                        switch (type)
                        {
                            case ValueType.Generator:
                            case ValueType.Array:
                            {
                                const values = value as ValueArray;
                                
                                const results = [];
                                for (const value of values) 
                                {
                                    let result:Uint8Array | undefined;
                                    let type:ValueType | InternalValueType | undefined;

                                    result = app.extractOrRethrow(await processCustomValue(value, customTypeEncoder));
                                    if (result === undefined)
                                    {
                                        type = app.extractOrRethrow(getValueType(value));
                            
                                        if (isAsyncIterableDataType(type) === true) app.throw('streams are not allowed in arrays', []);
                                        if (type !== ValueType.Array && type !== ValueType.Generator && type !== ValueType.Object) result = app.extractOrRethrow(processSimpleValue(value, type));
                                    }

                                    if (result !== undefined) results.push(result);
                                    else 
                                    {
                                        objects.push({value, type:type!, parentResults:results, results:[], resultIndex:results.length, depth:object.depth + 1});

                                        //placeholder position (see finalizer)
                                        results.push(undefined!);
                                    }
                                }

                                //add this object's results array to the parent's results
                                object.results.push(results);

                                finalizer = (uint8Array:Uint8Array):Uint8Array => app.extractOrRethrow(prepare(type, {value:uint8Array}));
                                break;
                            }
                            case ValueType.Object:
                            {
                                const keys:Array<any> = [];
                                const values:Array<any> = [];
                                for (const key in value as ValueRecord)
                                {
                                    keys.push(key);
                                    values.push((value as ValueRecord)[key]);
                                }

                                if (keys.length > 65535) app.throw('keys length exceeds 65535, length {length}', [keys.length]);
            
                                const keysJSONString = app.jsonUtil.stringify(keys);
                                const keysHeader = app.textUtil.toUint8Array(keysJSONString);
            
                                if (keysHeader.length > 2**27) app.throw('keys header length exceeds 2**27, given {given}', [keysHeader.length]);
            
                                const keysLengthHeader = app.integerUtil.toUint8Array(keysHeader.length as uint, false).slice(4, 8);
                                
                                const headers = [keysLengthHeader, keysHeader];
        
                                const results = [];
                                for (const value of values) 
                                {
                                    let result:Uint8Array | undefined;
                                    let type:ValueType | InternalValueType | undefined;

                                    result = app.extractOrRethrow(await processCustomValue(value, customTypeEncoder));
                                    if (result === undefined)
                                    {
                                        type = app.extractOrRethrow(getValueType(value));
                            
                                        if (isAsyncIterableDataType(type) === true) app.throw('streams are not allowed in objects', []);
                                        if (type !== ValueType.Array && type !== ValueType.Generator && type !== ValueType.Object) result = app.extractOrRethrow(processSimpleValue(value, type));
                                    }

                                    if (result !== undefined) results.push(result);
                                    else 
                                    {
                                        objects.push({value, type:type!, parentResults:results, results:[], resultIndex:results.length, depth:object.depth + 1});

                                        //placeholder position (see finalizer)
                                        results.push(undefined!);
                                    }
                                }

                                //add this object's results array to the parent's results
                                object.results.push(results);

                                finalizer = (uint8Array:Uint8Array):Uint8Array => app.extractOrRethrow(prepare(type, {headers, value:uint8Array}));
                                break;
                            }
                            default: return app.throw('unexpected type', [type]);
                        }

                        //processed 2nd
                        stack.push({objects:undefined, index:0, finalizer, parent:object});
                    }

                    if (objects.length === 0) continue;

                    //processed 1st
                    stack.push({objects, index:0, finalizer:undefined, parent:undefined});
                }

                return results[0];
            }
            catch (error)
            {
                return app.warn(error, 'unable to process complex value', [value], {errorOnly:true, names:[SerializationUtil, ref.__toUint8Array, processComplexValue_iterative]});
            }
        }

        ///recursive version to be used for testing, debugging, and as a reference for the iterative version (does not contain any limiting code)
        ///we do not comment it out, as if we do so, refactoring changes will not be detected
        if (false)
        {
            async function __processComplexValue_recursive(value:Value, customTypeEncoder:CustomTypeEncoderSync | undefined, type:ValueType.Array | ValueType.Generator | ValueType.Object):Promise<Uint8Array | IError>
            {
                try
                {
                    switch (type)
                    {
                        case ValueType.Generator:
                        case ValueType.Array:
                        {
                            const values = value as ValueArray;
                            const uint8Arrays:Array<Uint8Array> = [];
                            for (const value of values) 
                            {
                                let result:Uint8Array | undefined;

                                result = app.extractOrRethrow(await processCustomValue(value, customTypeEncoder));
                                if (result === undefined)
                                {
                                    const type = app.extractOrRethrow(getValueType(value));
                        
                                    if (type === ValueType.Array || type === ValueType.Object) result = app.extractOrRethrow(await __processComplexValue_recursive(value, customTypeEncoder, type));
                                    else result = app.extractOrRethrow(processSimpleValue(value, type));
                                }
                                
                                uint8Arrays.push(result);
                            }

                            const uint8Array = app.byteUtil.concat(uint8Arrays);

                            const result = prepare(type, {value:uint8Array});

                            return result;
                        }
                        case ValueType.Object:
                        {
                            const keys:Array<any> = Object.keys(value as ValueRecord);
                            const values:Array<any> = Object.values(value as ValueRecord);

                            if (keys.length > 65535) app.throw('keys length exceeds 65535', [keys.length]); //because we should have a reasonable limit

                            const keysJSONString = app.jsonUtil.stringify(keys);

                            if (keysJSONString.length > 2**32 - 1) app.throw('keys length exceeds 2**32 - 1', [keysJSONString.length]);

                            const keysHeader = app.textUtil.toUint8Array(keysJSONString);

                            if (keysHeader.length > 2**32 - 1) app.throw('keys header length exceeds 2**32 - 1', [keysHeader.length]);

                            const keysLengthHeader = app.integerUtil.toUint8Array(keysHeader.length as uint, false).slice(4, 8); //cannot exceed 2**32 - 1
                            
                            const headers = [keysLengthHeader, keysHeader];

                            //we can no treat it like we would an array
                            const uint8Arrays:Array<Uint8Array> = [];
                            for (const value of values) 
                            {
                                let result:Uint8Array | undefined;

                                result = app.extractOrRethrow(await processCustomValue(value, customTypeEncoder));
                                if (result === undefined)
                                {
                                    const type = app.extractOrRethrow(getValueType(value));
                        
                                    if (type === ValueType.Array || type === ValueType.Object) result = app.extractOrRethrow(await __processComplexValue_recursive(value, customTypeEncoder, type));
                                    else result = app.extractOrRethrow(processSimpleValue(value, type));
                                }
                                
                                uint8Arrays.push(result);
                            }

                            const uint8Array = app.byteUtil.concat(uint8Arrays);

                            const result = prepare(type, {headers, value:uint8Array});

                            return result;
                        }
                        default: return app.throw('unexpected type, {type}', [type]);
                    }
                }
                catch (error)
                {
                    return app.warn(error, 'unable to process complex value', [value], {errorOnly:true, names:[SerializationUtil, ref.__toUint8Array, __processComplexValue_recursive]});
                }
            }
        }

        try
        {
            let type = options?.type;
            if (type === undefined)
            {
                const result = app.extractOrRethrow(await processCustomValue(value, customTypeSyncEncoder));
                if (result !== undefined) return options?.count === true ? [result, count] : result;

                type = app.extractOrRethrow(this.#getValueType(value));
            }

            switch (type)
            {
                case ValueType.Custom:
                    return returnUndefined ? undefined : app.throw('custom types should have already been handled, {}', [type]);
                case ValueType.ReadableStream:
                case ValueType.MinLengthReadableStream:
                case ValueType.KnownLengthReadableStream:
                case ValueType.AsyncGenerator: 
                return returnUndefined ? undefined : app.throw('async values are not allowed, {}', [type]);
                case ValueType.Array:
                case ValueType.Generator:
                case ValueType.Object:
                {
                    const result = app.extractOrRethrow(await processComplexValue_iterative(value, customTypeSyncEncoder, type));
                    ///const result = app.extractOrRethrow(await processComplexValue_recursive(value, customTypeEncoder, type));

                    return options?.count === true ? [result, count] : result;
                }
                case ValueType.Uint8Array:
                case ValueType.string:
                case ValueType.bigint:
                case ValueType.boolean:
                case ValueType.number:
                case ValueType.undefined:
                case InternalValueType.emptystring:
                case InternalValueType.zero:
                case InternalValueType.one:
                case InternalValueType.negativeone:
                case InternalValueType.EmptyArray:
                case InternalValueType.EmptyObject:
                case InternalValueType.true:
                case InternalValueType.false:
                case InternalValueType.float_32:
                case InternalValueType.float_64:
                case InternalValueType.int_1byte:
                case InternalValueType.int_2byte:
                case InternalValueType.int_3byte:
                case InternalValueType.int_4byte:
                case InternalValueType.int_5byte:
                case InternalValueType.int_6byte:
                case InternalValueType.int_7byte:
                case InternalValueType.uint_1byte:
                case InternalValueType.uint_2byte:
                case InternalValueType.uint_3byte:
                case InternalValueType.uint_4byte:
                case InternalValueType.uint_5byte:
                case InternalValueType.uint_6byte:
                case InternalValueType.uint_7byte:
                case InternalValueType.hasStreams:
                {
                    const result = app.extractOrRethrow(processSimpleValue(value, type));
                    return options?.count === true ? [result, count] : result;
                }
                default: app.throw('unexpected type given, {type}', [type, value]);
            }
        }
        catch (error)
        {
            app.warn(error, 'unable serialize value', [value], {errorOnly:true, names:[SerializationUtil, ref.__toUint8Array]});
        }
    }

    public async fromUint8Array<T extends Value>(bytes:Uint8Array, options?:{customTypeDecoder?:CustomTypeDecoder}):Promise<T | IError>;
    public async fromUint8Array<T extends Value>(bytes:Uint8Array, options:{customTypeDecoder?:CustomTypeDecoder, count:number}):Promise<[{type:ValueType, value:T} | {type:ValueType.Custom, ctype:number, value:T}, Uint8Array, number] | IError>;
    public async fromUint8Array<T extends Value>(bytes:Uint8Array, options?:{customTypeDecoder?:CustomTypeDecoder, count?:number}):Promise<T | [{type:ValueType, value:T} | {type:ValueType.Custom, ctype:number, value:T}, Uint8Array, number] | [{type:ValueType, value:T} | {type:ValueType.Custom, ctype:number, value:T}, undefined, number] | IError>
    {
        return this.__fromUint8Array(bytes, options);
    }

    /**
     * Deserializes a Uint8Array into its original value(s) according to the specified type or automatically inferred type.
     * This method supports a wide range of ValueType and InternalValueType, including custom types through the use of a
     * customTypeDecoder function. It can optionally return remaining bytes from the input array and the number of processed
     * items for further processing or analysis.
     *
     * @param {Uint8Array | undefined} bytes - The byte array to deserialize. If undefined, the method expects a ValueType
     *        or InternalValueType that does not require input bytes (e.g., undefined, true, false).
     * @param {Object} [options] - Configuration options for deserialization.
     * @param {ValueType | InternalValueType} [options.type] - The ValueType or InternalValueType to use for deserialization.
     *        If not specified, the type will be inferred from the bytes array.
     * @param {number} [options.length] - The length of the data to deserialize from the bytes array.
     * @param {CustomTypeDecoder} [options.customTypeDecoder] - An optional function provided for decoding custom types.
     *        It should accept the custom type identifier, the serialized data as Uint8Array, and the max count of items to process,
     *        then return a deserialized value or throw an error if decoding fails.
     * @param {number} [options.count] - The maximum number of values to deserialize from the bytes array, acting as a safeguard
     *        against attempting to deserialize overly large or malicious data. Exceeding this count results in an error.
     *
     * @returns {T | [{type:ValueType, value:T} | {type:ValueType.Custom, ctype:number, value:T}, Uint8Array, number] | IError}
     *          - If `options.count` is undefined, returns the deserialized value directly or an IError object in case of failure.
     *          - Else, returns an array containing the deserialized value, any remaining bytes, and the remaining count, or an IError.
     *
     * @note This method provides a flexible and powerful way to deserialize data from byte arrays, supporting both built-in
     *       and custom data types. The inclusion of a count option and the ability to return additional information makes it
     *       suitable for processing complex data structures and implementing security measures against data stream abuse.
     */
    private async __fromUint8Array<T extends Value>(bytes:Uint8Array, options?:{type?:ValueType | InternalValueType, length?:number, customTypeDecoder?:CustomTypeDecoder}):Promise<T | IError>;
    private async __fromUint8Array<T extends Value>(bytes:Uint8Array, options:{type?:ValueType | InternalValueType, length?:number, customTypeDecoder?:CustomTypeDecoder, count:number}):Promise<[{type:ValueType, value:T} | {type:ValueType.Custom, ctype:number, value:T}, Uint8Array, number] | IError>;
    private async __fromUint8Array<T extends Value>(bytes:undefined, options:{type:ValueType | InternalValueType, customTypeDecoder?:CustomTypeDecoder, count:number}):Promise<[{type:ValueType, value:T} | {type:ValueType.Custom, ctype:number, value:T}, undefined, number] | IError>;
    private async __fromUint8Array<T extends Value>(bytes:Uint8Array | undefined, options?:{type?:ValueType | InternalValueType, length?:number, customTypeDecoder?:CustomTypeDecoder, count?:number}):Promise<T | [{type:ValueType, value:T} | {type:ValueType.Custom, ctype:number, value:T}, Uint8Array, number] | [{type:ValueType, value:T} | {type:ValueType.Custom, ctype:number, value:T}, undefined, number] | IError>
    {
        const ref = this;
        const app = this._app;

        try
        {   
            const returnRemainingBytes = options?.count ?? false;
            const customTypeDecoder = options?.customTypeDecoder;
            const customTypeDecoderSync = customTypeDecoder?.sync;
            const customTypeByteSize = customTypeDecoder?.typeByteSize ?? 7;

            let count = options?.count ?? Number.MAX_SAFE_INTEGER;

            const checkCount = (decrement:number) => 
            {
                count -= decrement;
                
                if (count < 0) app.throw('allowed count exceeded', []);

                return count;
            }

            const extractSimpleType = (type:ValueType | InternalValueType, bytes:Uint8Array | undefined):{type:ValueType, value:T} | IError =>
            {
                try
                {
                    if (bytes === undefined)
                    {
                        switch (type)
                        {
                            case InternalValueType.zero:
                                return {type:ValueType.number, value:0 as T};
                            case InternalValueType.one:
                                return {type:ValueType.number, value:1 as T};
                            case InternalValueType.negativeone:
                                return {type:ValueType.number, value:-1 as T};
                            case InternalValueType.EmptyArray:
                                return {type:ValueType.Array, value:[] as unknown as T};
                            case InternalValueType.EmptyObject:
                                return {type:ValueType.Object, value:{} as T};
                            case InternalValueType.emptystring:
                                return {type:ValueType.string, value:'' as T};
                            case InternalValueType.true:
                                return {type:ValueType.boolean, value:true as T};
                            case InternalValueType.false:
                                return {type:ValueType.boolean, value:false as T};
                            case ValueType.undefined:
                                return {type, value:undefined as T};
                            default: return app.throw('unsupported part type', []);
                        }
                    }

                    switch (type)
                    {
                        case ValueType.string: 
                            return {type, value:app.textUtil.fromUint8Array(bytes) as T};
                        case InternalValueType.uint_1byte:
                        case InternalValueType.uint_2byte:
                        case InternalValueType.uint_3byte:
                        case InternalValueType.uint_4byte:
                        case InternalValueType.uint_5byte:
                        case InternalValueType.uint_6byte:
                        case InternalValueType.uint_7byte:
                            return {type:ValueType.number, value:app.integerUtil.fromUint8Array(bytes, false) as T};
                        case InternalValueType.int_1byte:
                        case InternalValueType.int_2byte:
                        case InternalValueType.int_3byte:
                        case InternalValueType.int_4byte:
                        case InternalValueType.int_5byte:
                        case InternalValueType.int_6byte:
                        case InternalValueType.int_7byte:
                            return {type:ValueType.number, value:(-(app.integerUtil.fromUint8Array(bytes, false))) as T};   
                        case InternalValueType.float_32:
                        case InternalValueType.float_64:
                            return {type:ValueType.number, value:app.numberUtil.fromUint8Array(bytes, false) as T};
                        case ValueType.bigint: 
                            return {type, value:app.bigIntUtil.fromUint8Array(bytes, false) as T};
                        case ValueType.Uint8Array: 
                            return {type, value:bytes as T};
                        default: return app.throw('unsupported part type', []);
                    }
                }
                catch (error)
                {
                    return app.warn(error, 'unable to extract simple type', arguments, {errorOnly:true, names:[SerializationUtil, ref.__fromUint8Array, extractSimpleType]});
                }
            }

            const extractCustomType = async function(bytes:Uint8Array):Promise<{type:ValueType.Custom, ctype:number, value:T} | IError>
            {
                try
                {
                    const ctype = app.integerUtil.fromUint8Array(bytes.subarray(0, customTypeByteSize), false);                    
                    const part = bytes.subarray(customTypeByteSize);

                    const result = app.extractOrRethrow(await customTypeDecoderSync!(ctype, part, count));
                    if (result === undefined) return app.throw('custom type decoder did not return a value', []);
                    
                    const [value, thisCount] = result;

                    count = thisCount;
                    checkCount(0);

                    return {type:ValueType.Custom, ctype, value:value as T};
                }
                catch (error)
                {
                    return app.warn(error, 'unable to extract custom type', arguments, {errorOnly:true, names:[SerializationUtil, ref.__fromUint8Array, extractCustomType]});
                }
            }

            const extractComplexType_iterative = async function(type:ValueType.Array | ValueType.Generator | ValueType.Object, bytes:Uint8Array):Promise<{type:ValueType.Array | ValueType.Generator | ValueType.Object, value:T}>
            {
                const rootObject:ValueArray | ValueRecord = type === ValueType.Object ? {} : [];
                const stack:Array<{type:ValueType, value:Value, bytes:Uint8Array, depth:number}> = [];
                
                stack.push({type, value:rootObject, bytes, depth:0});
                
                const extract = (bytes:Uint8Array):[remainingBytes:Uint8Array, extractedBytes:Uint8Array] =>
                {
                    bytes = bytes.subarray(1);
                    const numberOfBytes = app.integerUtil.fromUint8Array(bytes.subarray(0, 1), false);
                    const length = app.integerUtil.fromUint8Array(bytes.subarray(1, 1 + numberOfBytes), false);
                    
                    const value = bytes.subarray(1 + numberOfBytes, 1 + numberOfBytes + length);
                    bytes = bytes.subarray(1 + numberOfBytes + length);

                    return [bytes, value];
                }

                while (stack.length > 0)
                {
                    const item = stack.pop()!;

                    const type = item.type;
                    const value = item.value;
                    let bytes = item.bytes;

                    checkCount(1);

                    if (type === ValueType.Array || type === ValueType.Generator)
                    {
                        const array = value as ValueArray;

                        while (bytes.length > 0) 
                        {
                            const type = bytes[0];

                            if (type !== ValueType.Array && type !== ValueType.Generator && type !== ValueType.Object)
                            {
                                const [value, updatedBytes, thisCount] = app.extractOrRethrow(await ref.__fromUint8Array(bytes, {...options, type:undefined, length:undefined, count}));
                                array.push(value.value);
                                bytes = updatedBytes;
                                count = thisCount;
                                continue;
                            }

                            if (type === ValueType.Generator)
                            {
                                const [remainingBytes, extractedBytes] = extract(bytes);
                                bytes = remainingBytes;
                                
                                const subArray:Value[] = [];

                                function* generator(): Generator<Value, void, unknown> 
                                {
                                    for (const value of subArray) yield value;
                                }

                                array.push(generator());
                                
                                stack.push({type, value:subArray, bytes:extractedBytes, depth:item.depth + 1});
                                continue;
                            }

                            if (type === ValueType.Array)
                            {
                                const [remainingBytes, extractedBytes] = extract(bytes);
                                bytes = remainingBytes;

                                const subArray:Value[] = [];
                                array.push(subArray);
                                
                                stack.push({type, value:subArray, bytes:extractedBytes, depth:item.depth + 1});
                                continue;
                            }

                            if (type === ValueType.Object)
                            {
                                const [remainingBytes, extractedBytes] = extract(bytes);
                                bytes = remainingBytes;
                                
                                const subObject:ValueRecord = {};
                                array.push(subObject);
                                
                                stack.push({type, value:subObject, bytes:extractedBytes, depth:item.depth + 1});
                                continue;
                            }

                            app.throw('unsupported part type', [type]);
                        }
                
                        continue;
                    }

                    if (type === ValueType.Object)
                    {
                        const keysLength = app.integerUtil.fromUint8Array(bytes.subarray(0, 4), false);
                        const keysHeader = bytes.subarray(4, 4 + keysLength);

                        const keys = JSON.parse(app.textUtil.fromUint8Array(keysHeader)) as Array<string>;

                        bytes = bytes.subarray(4 + keysLength);

                        let keyIndex = 0;
                        const object = value as ValueRecord;

                        while (bytes.length > 0) 
                        {
                            const type = bytes[0];

                            if (keys.length === keyIndex) app.throw('key index exceeds keys length {}, {}', [keyIndex, keys.length]);

                            if (type !== ValueType.Array && type !== ValueType.Generator && type !== ValueType.Object)
                            {
                                const [value, updatedBytes, thisCount] = app.extractOrRethrow(await ref.__fromUint8Array(bytes, {...options, type:undefined, length:undefined, count}));
                                bytes = updatedBytes;
                                object[keys[keyIndex++]] = value.value;
                                count = thisCount;
                                continue;
                            }

                            if (type === ValueType.Generator)
                            {
                                const [remainingBytes, extractedBytes] = extract(bytes);
                                bytes = remainingBytes;
                                
                                const subArray:Value[] = [];

                                function* generator(): Generator<Value, void, unknown> 
                                {
                                    for (const value of subArray) yield value;
                                }

                                object[keys[keyIndex++]] = generator();
                                
                                stack.push({type, value:subArray, bytes:extractedBytes, depth:item.depth + 1});
                                continue;
                            }

                            if (type === ValueType.Array)
                            {
                                const [remainingBytes, extractedBytes] = extract(bytes);
                                bytes = remainingBytes;
                                
                                const subArray:Value[] = [];
                                object[keys[keyIndex++]] = subArray;
                                
                                stack.push({type, value:subArray, bytes:extractedBytes, depth:item.depth + 1});
                                continue;
                            }

                            if (type === ValueType.Object)
                            {
                                const [remainingBytes, extractedBytes] = extract(bytes);
                                bytes = remainingBytes;
                                
                                const subObject:ValueRecord = {};
                                object[keys[keyIndex++]] = subObject;
                                
                                stack.push({type, value:subObject, bytes:extractedBytes, depth:item.depth + 1});
                                continue;
                            }

                            app.throw('unsupported part type', [type]);
                        }
                    }
                }

                let value;
                if (type === ValueType.Generator)
                {
                    function* generator(): Generator<Value, void, unknown> 
                    {
                        for (const value of rootObject as ValueArray) yield value;
                    }
                    
                    value = generator();
                }
                else value = rootObject;

                return {type, value:value as T};
            }

            ///recursive version to be used for testing, debugging, and as a reference for the iterative version
            ///we do not comment it out, as if we do so, refactoring changes will not be detected
            if (false)
            {
                const __extractComplexType_recursive = async function(type:ValueType.Array | ValueType.Generator | ValueType.Object, bytes:Uint8Array):Promise<{type:ValueType.Array | ValueType.Generator | ValueType.Object, value:T}>
                {
                    if (type === ValueType.Array || type === ValueType.Generator)
                    {
                        const array:Value[] = [];

                        while (bytes.length > 0) 
                        {
                            const [value, updatedBytes, thisCount] = app.extractOrRethrow(await ref.__fromUint8Array(bytes, {...options, type:undefined, length:undefined, count}));
                            bytes = updatedBytes;
                            count = thisCount;
                            array.push(value.value);
                        }
                
                        if (type === ValueType.Generator)
                        {
                            function* generator(): Generator<Value, void, unknown> 
                            {
                                for (const value of array) yield value;
                            }
                            
                            return {type, value:generator() as T};
                        }

                        return {type, value:array as T};
                    }

                    if (bytes.length === 0) return {type, value:{} as T};

                    const keysLength = app.integerUtil.fromUint8Array(bytes.subarray(0, 4), false);
                    const keysHeader = bytes.subarray(4, 4 + keysLength);

                    const keys = JSON.parse(app.textUtil.fromUint8Array(keysHeader)) as Array<string>;

                    bytes = bytes.subarray(4 + keysLength);

                    if (bytes.length === 0) return {type, value:{} as T};

                    let keyIndex = 0;
                    const object:ValueRecord = {};

                    while (bytes.length > 0) 
                    {
                        const [value, updatedBytes, thisCount] = app.extractOrRethrow(await ref.__fromUint8Array(bytes, {...options, type:undefined, length:undefined, count}));
                        bytes = updatedBytes;
                        count = thisCount;
                        object[keys[keyIndex++]] = value.value;
                    }

                    return {type, value:object as T};
                }
            }

            let type:ValueType | InternalValueType | undefined = options?.type;
            if (type === undefined)
            {
                if (bytes!.length === 0) app.throw('no bytes to deserialize', []);
                type = bytes![0];
                bytes = bytes!.subarray(1);
            }
        
            switch (type)
            {
                case InternalValueType.EmptyArray:
                case InternalValueType.EmptyObject:
                case InternalValueType.emptystring:
                case InternalValueType.one:
                case InternalValueType.zero:
                case InternalValueType.negativeone:
                case InternalValueType.true:
                case InternalValueType.false:
                case ValueType.undefined:
                {
                    const obj = app.extractOrRethrow(extractSimpleType(type, undefined));
                    return returnRemainingBytes ? [obj, bytes, checkCount(1)] : obj.value;
                }
            }

            if (bytes === undefined) return app.throw('no bytes to deserialize', []);

            switch (type)
            {
                case InternalValueType.uint_1byte:
                case InternalValueType.uint_2byte:
                case InternalValueType.uint_3byte:
                case InternalValueType.uint_4byte:
                case InternalValueType.uint_5byte:
                case InternalValueType.uint_6byte:
                case InternalValueType.uint_7byte:
                {
                    const numberOfBytes = (type + 1) - InternalValueType.uint_1byte;

                    const value = bytes.subarray(0, numberOfBytes);
                    bytes = bytes.subarray(numberOfBytes);

                    const obj = app.extractOrRethrow(extractSimpleType(type, value));
                    return returnRemainingBytes ? [obj, bytes, checkCount(1)] : obj.value;
                }
                case InternalValueType.int_1byte:
                case InternalValueType.int_2byte:
                case InternalValueType.int_3byte:
                case InternalValueType.int_4byte:
                case InternalValueType.int_5byte:
                case InternalValueType.int_6byte:
                case InternalValueType.int_7byte:
                {
                    const numberOfBytes = (type + 1) - InternalValueType.int_1byte;

                    const value = bytes.subarray(0, numberOfBytes);
                    bytes = bytes.subarray(numberOfBytes);

                    const obj = app.extractOrRethrow(extractSimpleType(type, value));
                    return returnRemainingBytes ? [obj, bytes, checkCount(1)] : obj.value;
                }
                case InternalValueType.float_32:
                {
                    const value = bytes.subarray(0, 4);
                    bytes = bytes.subarray(4);

                    const obj = app.extractOrRethrow(extractSimpleType(type, value));
                    return returnRemainingBytes ? [obj, bytes, checkCount(1)] : obj.value;
                }
                case InternalValueType.float_64:
                {
                    const value = bytes.subarray(0, 8);
                    bytes = bytes.subarray(8);

                    const obj = app.extractOrRethrow(extractSimpleType(type, value));
                    return returnRemainingBytes ? [obj, bytes, checkCount(1)] : obj.value;
                }
            }

            let length:number | undefined = options?.length;
            
            if (length === undefined)
            {
                const numberOfBytes = app.integerUtil.fromUint8Array(bytes.subarray(0, 1), false);
                length = app.integerUtil.fromUint8Array(bytes.subarray(1, 1 + numberOfBytes), false);
            
                bytes = bytes.subarray(1 + numberOfBytes);
            }       

            const value = bytes.subarray(0, length);
            bytes = bytes.subarray(value.length);
            
            switch (type) 
            {
                case ValueType.Custom:       
                {                    
                    const obj = app.extractOrRethrow(await extractCustomType(value));
                    return returnRemainingBytes ? [obj, bytes, count] : obj.value;
                }
                case ValueType.string:
                case ValueType.bigint:
                case ValueType.Uint8Array: 
                {
                    const obj = app.extractOrRethrow(extractSimpleType(type, value));
                    return returnRemainingBytes ? [obj, bytes, checkCount(1)] : obj.value;
                }
                case ValueType.Object:
                case ValueType.Array:
                case ValueType.Generator:
                {
                    const obj = app.extractOrRethrow(await extractComplexType_iterative(type, value));
                    return returnRemainingBytes ? [obj, bytes, count] : obj.value;
                }
                default:
                    return app.throw('unsupported part type, {}', [type]);
            }
        }
        catch (error)
        {
            return app.warn(error, 'failed to deserialize', arguments, {errorOnly:true, names:[SerializationUtil, ref.__fromUint8Array]});
        }
    }

    /**
     * Returns a string representation of the given value, which can be used for storage purposes.
     * 
     * @template T - The type of the value to convert to a string.
     * @param {T} value - The value to convert to a string.
     * @returns {string} - A string representation of the given value.
     * @throws {Error} - If the given value is of an unexpected type.
     */
    public toString<T extends BasicType>(value:T, options?:{base62?:boolean}):string
    {
        try
        {
            let type = this._app.typeUtil.getTypeOf(value);
            let write:string;

            switch(type)
            {
                case TypeOf.null:
                    this._app.throw('null type is not supported', [], {correctable:true});
                case TypeOf.undefined:
                    type = TypeOf.undefined;
                    write = '';
                    break;
                case TypeOf.string:
                    write = options?.base62 === true ? this._app.baseUtil.toBase62(value as string) : this._app.baseUtil.toBase64(value as string);
                    break;
                case TypeOf.boolean:
                case TypeOf.number:
                    write = String(value);
                    break;
                case TypeOf.Array:
                case TypeOf.Object:
                    write = options?.base62 === true ? this._app.baseUtil.toBase62(value as string) : this._app.baseUtil.toBase64(this._app.jsonUtil.stringify(value));
                    break;
                case TypeOf.bigint:
                case TypeOf.symbol:
                case TypeOf.Function:
                default:
                    this._app.throw('unexpected type, typeOf, {}', [type]);
            }

            return type.toString().padStart(2, '0') + ':' + write;
        }
        catch (error)
        {
            this._app.rethrow(error, 'failed to get value as string', arguments);
        }
    } 
  
    /**
     * Parses a string representation of a value and returns it as the specified type.
     * @param string - The string representation of the value.
     * @returns The parsed value as the specified type, or undefined if the string is not a valid representation of the type.
     * @throws An error if the type identifier in the string is not recognized.
     */
    public fromString<T extends BasicType>(string:string, options?:{base62?:boolean}):T | IError
    {
        try
        {
            const type = parseInt(string.substring(0, 2)) as TypeOf;

            switch (type)
            {
                case TypeOf.null:
                    this._app.throw('null type is not supported', []);
                case TypeOf.undefined:
                    return undefined as T;
                case TypeOf.string:
                {
                    if (options?.base62 === true) return this._app.extractOrRethrow(this._app.baseUtil.fromBase62(string.substring(3) as base62, BaseOutputFormat.string)) as T;
                    return this._app.extractOrRethrow(this._app.baseUtil.fromBase64(string.substring(3) as base64, BaseOutputFormat.string)) as T;
                }
                case TypeOf.boolean:
                    return (string.substring(3) === 'true') as T;
                case TypeOf.number:
                    return Number(string.substring(3)) as T;
                case TypeOf.Array:
                case TypeOf.Object:
                {
                    let text:json;
                    
                    if (options?.base62 === true) text = this._app.extractOrRethrow(this._app.baseUtil.fromBase62<json>(string.substring(3) as base62, BaseOutputFormat.string));
                    else text = this._app.extractOrRethrow(this._app.baseUtil.fromBase64<json>(string.substring(3) as base64, BaseOutputFormat.string));

                    const result = this._app.extractOrRethrow(this._app.jsonUtil.parse<T>(text));
                    
                    if (result === undefined) this._app.throw('invalid json, {}', [text]);
                    
                    return result;
                }
                default:
                    return this._app.throw('unexpected type, {}', [type]);
            }
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to get string as value', arguments, {errorOnly:true, names:[SerializationUtil, this.fromString]});
        }
    }

    #getValueType = (item:Value):ValueType | InternalValueType | IError =>
    {
        try
        {
            const type = this._app.typeUtil.getTypeOf(item);
    
            switch(type)
            {
                case TypeOf.undefined:
                    return ValueType.undefined;
                case TypeOf.string:
                    if (item === '') return InternalValueType.emptystring;
    
                    return ValueType.string;
                case TypeOf.boolean:
                    return item === true ? InternalValueType.true : InternalValueType.false;
                case TypeOf.number:
                    if (item === 0) return InternalValueType.zero;
                    if (item === 1) return InternalValueType.one;
                    if (item === -1) return InternalValueType.negativeone;
                    if (this._app.integerUtil.is(item) === true) 
                    {
                        const bytesNeededToRepresent = this._app.integerUtil.calculateBytesNeededToRepresent(Math.abs(item) as uint);
    
                        if (item >= 0) return (InternalValueType.uint_1byte - 1) + bytesNeededToRepresent;
                        else return (InternalValueType.int_1byte - 1) + bytesNeededToRepresent;
                    }
    
                    return this._app.numberUtil.calculateBytesNeededToRepresent(item as number) === 4 ? InternalValueType.float_32 : InternalValueType.float_64;
                case TypeOf.bigint:
                    return ValueType.bigint;
                case TypeOf.Array:
                    if ((item as ValueArray).length === 0) return InternalValueType.EmptyArray;
    
                    return ValueType.Array;
                case TypeOf.Object:
                    switch (item!.constructor) //constructor checks are faster than instanceof checks
                    {
                        case Object:
                            for (const key in item as ValueRecord) return ValueType.Object;
    
                            return InternalValueType.EmptyObject; //we only accept plain objects, otherwise it needs to be a custom type
                        case Uint8Array:
                            return ValueType.Uint8Array;
                        case KnownLengthReadableStream:
                            return ValueType.KnownLengthReadableStream;
                        case MinLengthReadableStream:
                            return ValueType.MinLengthReadableStream;
                        case ReadableStream:
                            return ValueType.ReadableStream;
                    }
    
                    const string = String(item);
                    if (string === '[object AsyncGenerator]') return ValueType.AsyncGenerator;
                    if (string === '[object Generator]') return ValueType.Generator;
    
                    //constructor checks failed, so we will check instance of just in case it extends the base classes (like "Buffer" does in node.js)
                    if (item instanceof Uint8Array) return ValueType.Uint8Array;
                    if (item instanceof KnownLengthReadableStream) return ValueType.KnownLengthReadableStream;
                    if (item instanceof MinLengthReadableStream) return ValueType.MinLengthReadableStream;
                    if (item instanceof ReadableStream) return ValueType.ReadableStream;
    
                    //fall through
                case TypeOf.symbol:
                    if ((item as unknown as symbol) === hasStreamsValue) return InternalValueType.hasStreams;
                case TypeOf.Function:
                default:
                    this._app.throw('unexpected type, {type}', [type]);
            }
        }
        catch (error)
        {
            return this._app.warn(error, 'unable to get type for value, typeof: {}, constructor: {}. Maybe you forgot to implement a custom serializer for this type?', [this._app.typeUtil.getTypeOf(item), item?.constructor?.name, item], {errorOnly:true, names:[SerializationUtil, this.#getValueType]});
        }
    }
}