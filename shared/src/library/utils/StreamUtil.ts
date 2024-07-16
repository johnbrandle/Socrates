/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * Refresher:
 * 
 * controller.error(): Closes the stream because something went wrong. It's a signal to the stream's consumer that no more data can be read because of an error.
 * stream.cancel(): Closes the stream because the stream's consumer decided they no longer need data. It's a voluntary stop, signaling to the stream's producer to stop producing data.
 * reader.cancel(): Same as stream.cancel(), but tidies up by releasing the reader’s lock.
 */

import { SealedDecorator } from "../decorators/SealedDecorator.ts";
import { KnownLengthReadableStream } from "../stream/KnownLengthReadableStream.ts";
import { IError, IErrorType } from "../error/IError.ts";
import { IAbortable } from "../abort/IAbortable.ts";
import { IAborted } from "../abort/IAborted.ts";
import { ResolvePromise } from "../promise/ResolvePromise.ts";
import { IDatable, IDatableType } from "../data/IDatable.ts";
import { Aborted } from "../abort/Aborted.ts";
import { MinLengthReadableStream } from "../stream/MinLengthReadableStream.ts";
import { IBaseApp } from "../IBaseApp.ts";

interface ITransformerBase 
{
    (chunk:Uint8Array, flush:false):Promise<Uint8Array | undefined | IAborted | IError>;
    (chunk:Uint8Array | undefined, flush:true, success:true):Promise<Uint8Array | undefined | IAborted | IError>;
    (chunk:IAborted | IError, flush:true, success:false):Promise<undefined | IAborted | IError>;
}

export type ITransformer = ITransformerBase & { _brand: 'strict' };
export type IVariableTransformer = ITransformerBase & {_brand:'variable'};

type OnEnd = (success:true | IAborted | IError) => Promise<true | IAborted | IError | void>;

@SealedDecorator()
export class StreamUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Transforms a ReadableStream of binary data into a new ReadableStream. The transformation adheres to the following rules:
     * - Applies the given `transformers` to the binary data before chunking.
     * - Splits the binary data into chunks of `chunkSize` size.
     * - Throws an error if the total number of bytes exceeds `expectedBytes`.
     * 
     * @param {ReadableStream<Uint8Array>} stream - The ReadableStream of binary data to transform.
     * @param {Array<ITransformer>} [transformers=[]] - An array of functions to apply transformations to the binary data.
     * @param {number} [chunkSize=524288] - The size in bytes of each data chunk in the transformed stream.
     * @returns {ReadableStream<Uint8Array>} The transformed ReadableStream.
     * @throws {Error} If the actual number of bytes processed exceeds `expectedBytes`.
     * @throws {Error} If a transformer changes the length of a data chunk.
     */
    public transform(stream:ReadableStream<Uint8Array>, transformers:Array<ITransformer | IVariableTransformer>, options?:{chunkSize?:number, onEnd?:OnEnd, allowVariableByteLengthTransformers:true}):ReadableStream<Uint8Array>;
    public transform(stream:ReadableStream<Uint8Array>, transformers:Array<ITransformer>, options?:{chunkSize?:number, onEnd?:OnEnd, allowVariableByteLengthTransformers?:false}):ReadableStream<Uint8Array>;
    public transform(stream:ReadableStream<Uint8Array>, transformers:Array<ITransformer | IVariableTransformer>, options?:{chunkSize?:number, onEnd?:OnEnd, allowVariableByteLengthTransformers?:boolean}):ReadableStream<Uint8Array>
    {
        options = options ?? {};

        const app = this._app;
        
        const chunkSize = options.chunkSize ?? this._app.configUtil.get(true).classes.StreamUtil.frozen.chunkSize;
        const allowVariableByteLengthTransformers = options.allowVariableByteLengthTransformers ?? false;
        
        let aborted = false;
        let ended = false;
        
        let byteCount = 0;
        let chunkIndex = 0;
        let remainingData:Uint8Array | undefined = new Uint8Array(0); //empty array buffer to initialize

        let transformerController:TransformStreamDefaultController<Uint8Array> | undefined;

        const transformersLength = transformers.length;
        const transformersLeftToFlush = transformers.slice().reverse();

        const abortController = new AbortController();

        const abort = async (controller:TransformStreamDefaultController<Uint8Array>, abortable:IAborted):Promise<void> =>
        {
            if (aborted === true) return void app.consoleUtil.error(StreamUtil, 'transform() called on an already aborted stream.'); //we can't really do anything besides log to the console
            aborted = true;

            const error = app.abort(abortable, 'aborted', [], {names:[StreamUtil, this.transform, abort]});

            await onEnd(controller, error);
        }

        const onEnd = async (controller:TransformStreamDefaultController<Uint8Array>, result:true | IError):Promise<void> =>
        {
            if (ended === true) return void app.consoleUtil.error(StreamUtil, 'transform() called on an already ended stream.'); //we can't really do anything besides log to the console
            ended = true;

            //we need to ensure flush is called on all transformers as some of them may have promises that need to be resolved or other cleanup needs
            while (transformersLeftToFlush.length > 0)
            {
                const transformer = transformersLeftToFlush.pop()!;

                try
                {
                    //if there were transformers left to flush, then result must be an error. we don't care if a transformer returns an IAborted here because we already errored and erroring trumps aborting
                    const inputResult = (result as IError).aborted ?? (result as IError);
                    const outputResult = await transformer(inputResult, true, false);

                    if (outputResult === inputResult) continue; //if they passed back the same value, just continue

                    app.extractOrRethrow(outputResult);
                }
                catch (error)
                {
                    result = app.warn(result, 'failed to flush transformer', [error], {errorOnly:true, names:[StreamUtil, this.transform, onEnd]});
                }
            }

            if (options.onEnd !== undefined)
            {
                //call the callback and pass in the aborted object if there is one, otherwise pass in the error or true
                let processedResult = (await options.onEnd(result === true ? true : (result.aborted ?? result))) ?? result;
                
                //if we passed in an error, we must get an error back
                if (app.typeUtil.isError(result) === true && app.typeUtil.isError(processedResult) !== true) processedResult = app.warn(result, 'must return an error if the result is an error.', [processedResult], {names:[StreamUtil, this.transform, onEnd]});
                
                //if we passed in an aborted, we must either get an aborted or an error back
                if (app.typeUtil.isAborted(result) === true && processedResult === true) processedResult = app.warn(result, 'must return an abortable or an error if the result is an abortable.', [processedResult], {names:[StreamUtil, this.transform, onEnd]});
            
                //if we got an aborted but the original result was true, we need to create a new abort error to use with controller.error
                if (app.typeUtil.isAborted(processedResult) === true && result === true) processedResult = app.abort(processedResult, 'aborted', [processedResult], {names:[StreamUtil, this.transform, onEnd]});
                
                //if we got an error, we need to call controller.error
                if (app.typeUtil.isError(processedResult) === true) controller.error(processedResult);

                return;
            }
            
            if (result !== true) controller.error(result);
        }

        const ref = this;

        const transformStream = new TransformStream(
        {
            start(controller)
            {
                transformerController = controller;
            },
            async transform(chunk:Uint8Array, controller:TransformStreamDefaultController<Uint8Array>) 
            {        
                try
                {
                    byteCount += chunk.length;

                    const merged = new Uint8Array(remainingData!.length + chunk.length);
                    merged.set(remainingData!);
                    merged.set(chunk, remainingData!.length);
                    remainingData = merged;

                    while (remainingData.length >= chunkSize) 
                    {
                        let chunk:Uint8Array | undefined = remainingData.slice(0, chunkSize);
                        
                        let length = chunk.length;
                        for (let i = 0; i < transformersLength; i++) 
                        {
                            const data:Uint8Array | IAborted | undefined = app.extractOrRethrow(await transformers[i](chunk, false));

                            if (app.typeUtil.isAborted(data) === true) return await abort(controller, data);

                            chunk = data;

                            if (chunk === undefined) break;
                        }
                        if (allowVariableByteLengthTransformers !== true && chunk?.length !== length) app.throw('non variable transformers must not modify the chunk length', [], {correctable:true});

                        //it's possible for a transformer to return undefined, so we need to check for that
                        if (chunk !== undefined) controller.enqueue(chunk); 

                        remainingData = remainingData.slice(chunkSize);
                        
                        chunkIndex++;
                    }
                }
                catch (error)
                {
                    await onEnd(controller, (app.warn(error, 'failed to transform', [chunk], {errorOnly:true, names:[StreamUtil, ref.transform]})));
                }
            },
            async flush(controller)
            {    
                try
                {
                    //handle remaining data, if any, that does not form a complete chunk
                    if (remainingData !== undefined && remainingData.length > 0) 
                    {
                        for (let i = 0; i < transformersLength; i++) 
                        {
                            const data:Uint8Array | IAborted | undefined = app.extractOrRethrow(await transformers[i](remainingData, false));

                            if (app.typeUtil.isAborted(data) === true) return await abort(controller, data);

                            remainingData = data;

                            if (remainingData === undefined) break;
                        }

                         //it's possible for a transformer to return undefined, so we need to check for that
                        if (remainingData !== undefined) controller.enqueue(remainingData); 
                    }

                    //send a flush signal to the transformers. this is their last chance to return data
                    let flushData:Uint8Array | undefined;
                    while (transformersLeftToFlush.length > 0)
                    {
                        const transformer = transformersLeftToFlush.pop()!;

                        const data = app.extractOrRethrow(await transformer(flushData, true, true));

                        if (app.typeUtil.isAborted(data) === true) return await abort(controller, data);

                        flushData = data;
                    }

                    if (flushData !== undefined) controller.enqueue(flushData);

                    await onEnd(controller, true);
                }
                catch (error)
                {                    
                    await onEnd(controller, (app.warn(error, 'failed to flush', [remainingData], {errorOnly:true, names:[StreamUtil, ref.transform]})));
                }
            }
        });
        
        //we wrap the stream so we can catch any errors that occur when reading from the original stream, and call onEnd with the error
        let reader:ReadableStreamDefaultReader<Uint8Array> | undefined;
        
        let errored:unknown;
        let canceled = false;
        const wrappedStream = this.create(
        {
            start(_controller)
            {
                try
                {
                    reader = stream.getReader();
                }
                catch (error)
                {
                    //if we errored getting the reader, wait till the first pull to deal with it
                    errored = error;
                }
            },

            async pull(controller)
            {
                try
                {
                    if (errored !== undefined) throw errored;

                    const {done, value} = await reader!.read();
                    
                    //they may have canceled the stream while we were waiting for the read to complete
                    if (canceled === true) return;

                    if (done === true) 
                    {
                        //if the stream is done, we need to release the lock on the reader and close the controller
                        reader!.releaseLock();
                        reader = undefined;
                        
                        controller.close();
                        return;
                    }
                    if (value === undefined) app.throw('value must not be undefined', []);
    
                    //pass the value to the wrapped stream
                    controller.enqueue(value);
                }
                catch (e)
                {
                    //error the controller first so the wrapped stream ends, and pull stops being called
                    let error;
                    if (transformerController !== undefined && aborted !== true && ended !== true) 
                    {
                        error = await onEnd(transformerController, (app.warn(e, 'failed to pull in wrapped stream, so ending transform', [], {errorOnly:true, names:[StreamUtil, ref.transform]})));
                        if (canceled === true) return; //if we were canceled, while waiting for onEnd to complete, we need to return as there is no need to notify the reader of the error

                        //we need to let the pipe operator know we are ending
                        error = controller.error(error);
                    }
                    else error = controller.error(app.warn(e, 'failed to pull in wrapped stream, transform already ended', [], {names:[StreamUtil, ref.transform]}));
                    
                    //now we need to close the wrapped stream, and let the producer of the stream know we are canceling
                    await reader?.cancel(error);
                }    
            },

            async cancel(reason)
            {
                //cancel called by wrapped stream reader
                canceled = true;

                const error = ref.createCancelationError(reason, [StreamUtil, ref.transform], []);
                
                //let the pipe operator know we are canceling
                abortController.abort(error); 

                //close the wrapped stream, and let the producer of the stream know we are canceling
                await reader?.cancel(error);

                //call onEnd with the error if it hasn't already been called
                if (transformerController !== undefined && aborted !== true && ended !== true) await onEnd(transformerController, error);                
            },

            excludeController:true
        });
        
        //we need to know when the stream is done, so we can call our onAbort or onEnd functions, so we wrap it before piping it through the transform stream
        return wrappedStream.pipeThrough(transformStream, {signal:abortController.signal});
    }

    public createAbortableTransformer = (abortable:IAbortable):ITransformer =>
    {
        const ref = this;
        const app = this._app;

        async function transformer(chunk:Uint8Array, flush:false):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined, flush:true, success:true):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:IAborted | IError, flush:true, success:false):Promise<undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined | IAborted | IError, flush:boolean, success?:boolean):Promise<Uint8Array | undefined | IAborted | IError>
        {
            try
            {
                if (abortable.aborted === true) return abortable as IAborted;
                
                return chunk;
            }
            catch (error)
            {
                return app.warn(error, 'error in abortable transformer', [chunk], {names:[StreamUtil, ref.createAbortableTransformer, transformer]});
            }
        }

        return transformer as unknown as ITransformer;
    }

    public createLimitTransformer = (maxBytes:number):ITransformer =>
    {
        const ref = this;
        const app = this._app;

        let byteCount = 0;

        async function transformer(chunk:Uint8Array, flush:false):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined, flush:true, success:true):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:IAborted | IError, flush:true, success:false):Promise<undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined | IAborted | IError, flush:boolean, success?:boolean):Promise<Uint8Array | undefined | IAborted | IError>
        {
            try
            {
                if (flush === true) return chunk;

                byteCount += (chunk as Uint8Array).length;

                if (byteCount > maxBytes) app.throw('Byte limit exceeded.', []);

                return chunk;
            }
            catch (error)
            {
                return app.warn(error, 'error in limit transformer', [chunk], {names:[StreamUtil, ref.createLimitTransformer, transformer]});
            } 
        }

        return transformer as unknown as ITransformer;
    }

    public createCountTransformer = ():[ITransformer, Promise<number | IAborted | IError>] =>
    {
        const ref = this;
        const app = this._app;

        const promise = new ResolvePromise<number | IAborted | IError>();

        let byteCount = 0;

        async function transformer(chunk:Uint8Array, flush:false):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined, flush:true, success:true):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:IAborted | IError, flush:true, success:false):Promise<undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined | IAborted | IError, flush:boolean, success?:boolean):Promise<Uint8Array | undefined | IAborted | IError>
        {
            try
            {
                if (flush === true) 
                {
                    if (promise.resolved === false) promise.resolve(success === true ? byteCount : (chunk as IAborted | IError));

                    return chunk;
                }

                byteCount += (chunk as Uint8Array).length;

                return chunk;
            }
            catch (e)
            {
                const error = app.warn(e, 'error in count transformer.', [chunk], {names:[StreamUtil, ref.createCountTransformer, transformer]});

                if (promise.resolved === false) promise.resolve(error);

                return error;
            }
        }

        return [transformer as unknown as ITransformer, promise];
    }

    public createCustomTransformer = (pipe:ITransformerBase):ITransformer =>
    {
        const ref = this;
        const app = this._app;

        async function transformer(chunk:Uint8Array, flush:false):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined, flush:true, success:true):Promise<Uint8Array | undefined | IAborted | IError>;
        async function transformer(chunk:IAborted | IError, flush:true, success:false):Promise<undefined | IAborted | IError>;
        async function transformer(chunk:Uint8Array | undefined | IAborted | IError, flush:boolean, success?:boolean):Promise<Uint8Array | undefined | IAborted | IError>
        {
            try
            {
                return await pipe(chunk as any, flush as any, success as any);
            }
            catch (error)
            {
                return app.warn(error, 'error in pipe transformer', [chunk], {names:[StreamUtil, ref.createCustomTransformer, transformer]});
            }
        }

        return transformer as unknown as ITransformer;
    }

    /**
     * Splits a stream of binary data into parts of a specified size.
     * @param stream The ReadableStream to read from.
     * @param partSize The maximum number of bytes per part.
     * @returns An AsyncGenerator that yields Uint8Array parts of data.
     */
    public async *split(stream:ReadableStream, partSize:number):AsyncGenerator<Uint8Array | IError> 
    {
        let reader:ReadableStreamDefaultReader<Uint8Array> | undefined;

        try 
        {
            reader = stream.getReader();

            let bytes = new Uint8Array(0);

            while (true) 
            {
                const {done, value} = await reader.read();

                if (done) 
                {
                    if (bytes.length > 0) yield bytes; //yield any remaining data
                    break;
                }
                if (value === undefined) this._app.throw('value must not be undefined', []);

                const updatedBytes = new Uint8Array(bytes.length + value.length);
                updatedBytes.set(bytes);
                updatedBytes.set(value, bytes.length);
                bytes = updatedBytes;

                let byteIndex = 0;
                if (bytes.length >= partSize)
                {
                    while ((bytes.length - byteIndex) >= partSize) 
                    {
                        yield bytes.slice(byteIndex, byteIndex + partSize);
                        byteIndex += partSize;
                    }

                    bytes = bytes.slice(byteIndex);
                }
            }

            reader = undefined;
        } 
        catch (e)
        {
            const error = this._app.warn(e, 'error reading stream', arguments, {errorOnly:true, names:[StreamUtil, this.split]});

            //close the reader stream and signal to the stream's producer that an error occurred
            await reader?.cancel(error);
            reader = undefined;

            //yield the error
            yield error;
        }
        finally 
        {
            //if the reader is still defined, then they did not consume the entire stream, essentially aborting the operation, so we need to cancel it with an abort error in order to notify the producer
            if (reader !== undefined) await reader.cancel(this._app.abort(new Aborted(this._app, 'exited before reading entire stream'), 'stream split aborted', arguments, {names:[StreamUtil, this.split]}));
        }  
    }

    public join(parts:(IDatable<ReadableStream<Uint8Array> | Uint8Array> | ReadableStream<Uint8Array> | Uint8Array)[], options?:{chunkSize?:number}):ReadableStream<Uint8Array>
    {
        const app = this._app;

        const chunkSize = options?.chunkSize ?? app.configUtil.get(true).classes.StreamUtil.frozen.chunkSize;

        parts = parts.slice();

        let reader:ReadableStreamDefaultReader<Uint8Array> | undefined;
        let bytes:Uint8Array = new Uint8Array(0);

        const pull = async (controller:ReadableStreamDefaultController<Uint8Array>) =>
        {
            try
            {
                outer: while (true)
                {
                    if (reader !== undefined)
                    {
                        if (bytes.length >= chunkSize)
                        {
                            controller.enqueue(bytes.slice(0, chunkSize));
                            bytes = bytes.slice(chunkSize);
                            return;
                        }

                        const {done, value} = await reader.read();
                            
                        if (done === true) reader = undefined;
                        else if (value === undefined) app.throw('value must not be undefined', []);
                        else 
                        {
                            const updatedBytes = new Uint8Array(bytes.length + value.length);
                            updatedBytes.set(bytes);
                            updatedBytes.set(value, bytes.length);
                            bytes = updatedBytes;
                            
                            continue outer;
                        }
                    }

                    if (parts.length > 0)
                    {
                        let item = parts.shift()!;

                        if (app.typeUtil.is<IDatable<ReadableStream<Uint8Array> | Uint8Array>>(item, IDatableType) === true) 
                        {
                            const value = app.extractOrRethrow(await item.get());

                            if (app.typeUtil.isAborted(value) === true) throw app.abort(value, 'stream part aborted', [item], {names:[StreamUtil, this.join, pull]});

                            item = value;
                        }

                        if (item instanceof Uint8Array)
                        {
                            const stream = this.fromUint8Array(item, chunkSize);
                            reader = stream.getReader();
                            continue outer;
                        }

                        reader = item.getReader();
                        continue outer;
                    }

                    //enqueue any remaining bytes
                    if (bytes.length > 0) controller.enqueue(bytes);

                    //close the stream, notifying the consumer that we're done
                    controller.close();

                    return;
                }
            }
            catch (e)
            {
                const error = app.warn(e, 'error while pulling the stream:', arguments, {names:[StreamUtil, this.join, pull]});

                //first, close the stream, notifying the stream's consumer of the error
                controller.error(error);

                //then, cancel the reader stream, as we will not be consuming any more data due to the error
                await reader?.cancel(error);
                reader = undefined;
            }
        }

        const cancel = (reason?:any) =>
        {
            const error = this.createCancelationError(reason, [StreamUtil, this.join, cancel], []);

            //cancel the reader stream, as we will not be consuming any more data due to the error
            reader?.cancel(error);
            reader = undefined;
        }

        return this.create({pull, cancel, excludeController:true});
    }
    
    /**
     * Converts a ReadableStream of Uint8Arrays to a single Uint8Array.
     * @param stream The ReadableStream to convert.
     * @returns A Promise that resolves to a Uint8Array containing all the data from the stream.
     */
    public async toUint8Array<T extends Uint8Array>(stream:ReadableStream<Uint8Array>, options?:{maxLength?:number}):Promise<T | IError> 
    {
        let reader:ReadableStreamDefaultReader<Uint8Array> | undefined;
     
        const maxLength = options?.maxLength;
        
        let totalLength = 0;
     
        if (maxLength !== undefined) //we can use a more efficient method if a limit is specified
        {
            try
            {
                reader = stream.getReader();
                    
                let result = new Uint8Array(maxLength);
                
                while (true) 
                {
                    const {done, value} = await reader.read();

                    if (done) break;
                    if (value === undefined) this._app.throw('Value must not be undefined.', []);

                    if ((totalLength + value.length) > maxLength) 
                    {
                        //if the incoming chunk will exceed the limit, only take the necessary part of it.
                        const remainingLength = maxLength - totalLength;
                        result.set(value.subarray(0, remainingLength), totalLength);
                        totalLength += remainingLength;
                        break;
                    } 
                    else 
                    {
                        //if the chunk doesn't exceed the limit, set it in the result array.
                        result.set(value, totalLength);
                        totalLength += value.length;
                    }
                }

                //if totalLength is less than the initial limit, create a new Uint8Array with the exact length.
                if (totalLength < result.length) result = result.subarray(0, totalLength);

                return result as T;
            }
            catch (e)
            {
                const error = this._app.warn(e, 'failed while reading stream', arguments, {errorOnly:true, names:[StreamUtil, this.toUint8Array]});
                
                //close the stream with the error, as we will not be consuming any more data due to the error
                await reader?.cancel(error);

                return error;
            }
            finally
            {
                reader?.releaseLock();
            }
        }

        try
        {
            reader = stream.getReader();

            //if no limit is provided, concatenate all chunks to a single Uint8Array
            const chunks:Array<Uint8Array> = [];

            while (true) 
            {
                const {done, value} = await reader.read();

                if (done) break;
                if (value === undefined) this._app.throw('value must not be undefined', []);

                chunks.push(value);
                totalLength += value.length;
            }

            const result = new Uint8Array(totalLength);
        
            //copy all chunks into the result uint8array
            let offset = 0;
            for (const chunk of chunks) 
            {
                result.set(chunk, offset);
                offset += chunk.length;
            }
        
            return result as T;
        }
        catch (e)
        {
            const error = this._app.warn(e, 'failed while reading stream', arguments, {errorOnly:true, names:[StreamUtil, this.toUint8Array]});

            //close the stream with the error, as we will not be consuming any more data due to the error
            await reader?.cancel(error);

            return error;
        }
        finally
        {
            reader?.releaseLock();
        }
    }
    
    /**
     * Converts a Uint8Array to a ReadableStream, with chunking.
     * @param array The Uint8Array to convert.
     * @param chunkSize The size of each chunk.
     * @returns A ReadableStream containing the data from the Uint8Array in chunks.
     */
    public fromUint8Array = (array:Uint8Array, chunkSize?:number):KnownLengthReadableStream<Uint8Array> =>
    {
        chunkSize = chunkSize ?? this._app.configUtil.get(true).classes.StreamUtil.frozen.chunkSize;

        let position = 0;

        const ref = this;
      
        const stream = new KnownLengthReadableStream(array.length,
        {
            start(controller)
            {
                //immediately close the stream if the array is empty
                if (array.length === 0) controller.close();
            },
            pull(controller) 
            {
                try
                {
                    //check if we've reached the end of the array.
                    if (position < array.length) 
                    {
                        //get the next chunk to enqueue.
                        const chunk = array.subarray(position, Math.min(position + chunkSize, array.length));
                        controller.enqueue(chunk);
            
                        //update the position.
                        position += chunkSize;
            
                        //if the position reaches the end, close the stream.
                        if (position >= array.length) controller.close();
                    }
                }
                catch (error)
                {
                    //close the stream, notifying the consumer of the error
                    controller.error(ref._app.warn(error, 'error in pull', arguments, {names:[StreamUtil, ref.fromUint8Array]}));
                }
            },
            cancel(reason)
            {
                //nothing to do but log the reason the consumer canceled the stream
                ref.createCancelationError(reason, [StreamUtil, ref.fromUint8Array], []);
            }
        }, {highWaterMark:chunkSize});

        return stream;
    }

    private createCancelationError(reason:any, names:{name:string}[], objects:ArrayLike<any>):IError
    {
        const app = this._app;

        if (app.typeUtil.isError(reason) === true) 
        {
            if (app.typeUtil.is<IError>(reason, IErrorType) !== true) return app.warn(reason, 'stream cancelled with error', objects, {stackTraceFunctionToExclude:this.createCancelationError, errorOnly:true, names});
            
            if (reason.aborted !== undefined) return app.warn(reason, 'stream aborted', objects, {stackTraceFunctionToExclude:this.createCancelationError, errorOnly:true, names});
            
            return app.warn(reason, 'stream cancelled with error', objects, {stackTraceFunctionToExclude:this.createCancelationError, errorOnly:true, names});
        }

        if (app.typeUtil.isAborted(reason) === true) return app.abort(reason, 'stream aborted, given aborted object', objects, {stackTraceFunctionToExclude:this.createCancelationError, names});

        return app.abort(new Aborted(this._app, String(reason)), 'stream aborted via non error or aborted object', objects, {stackTraceFunctionToExclude:this.createCancelationError, names});
    }

    public create():[ReadableStream<Uint8Array>, ReadableStreamDefaultController<Uint8Array>];
    public create(options:{start?:(controller:ReadableStreamDefaultController<Uint8Array>) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>) => void | PromiseLike<void>, cancel?:(reason?:any) => void | PromiseLike<void>, excludeController:true}):ReadableStream<Uint8Array>;
    public create<Args extends any[] = []>(options:{start?:(controller:ReadableStreamDefaultController<Uint8Array>, ...args:Args) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>, ...args:Args) => void | PromiseLike<void>, cancel?:(reason?:any, ...args:Args) => void | PromiseLike<void>, args:Args, excludeController:true}):ReadableStream<Uint8Array>;
    public create(options:{start?:(controller:ReadableStreamDefaultController<Uint8Array>) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>) => void | PromiseLike<void>, cancel?:(reason?:any) => void | PromiseLike<void>}):[ReadableStream<Uint8Array>, ReadableStreamDefaultController<Uint8Array>];
    public create<Args extends any[] = []>(options:{start?:(controller:ReadableStreamDefaultController<Uint8Array>, ...args:Args) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>, ...args:Args) => void | PromiseLike<void>, cancel?:(reason?:any, ...args:Args) => void | PromiseLike<void>, args:Args}):[ReadableStream<Uint8Array>, ReadableStreamDefaultController<Uint8Array>];
    
    public create(length:number):[KnownLengthReadableStream<Uint8Array>, ReadableStreamDefaultController<Uint8Array>];
    public create(length:number, options:{start?:(controller:ReadableStreamDefaultController<Uint8Array>) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>) => void | PromiseLike<void>, cancel?:(reason?:any) => void | PromiseLike<void>, excludeController:true}):KnownLengthReadableStream<Uint8Array>;
    public create<Args extends any[] = []>(length:number, options:{start?:(controller:ReadableStreamDefaultController<Uint8Array>, ...args:Args) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>, ...args:Args) => void | PromiseLike<void>, cancel?:(reason?:any, ...args:Args) => void | PromiseLike<void>, args:Args, excludeController:true}):KnownLengthReadableStream<Uint8Array>;
    public create(length:number, options:{start?:(controller:ReadableStreamDefaultController<Uint8Array>) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>) => void | PromiseLike<void>, cancel?:(reason?:any) => void | PromiseLike<void>}):[KnownLengthReadableStream<Uint8Array>, ReadableStreamDefaultController<Uint8Array>];
    public create<Args extends any[] = []>(length:number, options:{start?:(controller:ReadableStreamDefaultController<Uint8Array>, ...args:Args) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>, ...args:Args) => void | PromiseLike<void>, cancel?:(reason?:any, ...args:Args) => void | PromiseLike<void>, args:Args}):[KnownLengthReadableStream<Uint8Array>, ReadableStreamDefaultController<Uint8Array>];    
    
    public create(length:number, options:{start?:(controller:ReadableStreamDefaultController<Uint8Array>) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>) => void | PromiseLike<void>, cancel?:(reason?:any) => void | PromiseLike<void>, excludeController:true, isMinLength:true}):MinLengthReadableStream<Uint8Array>;
    public create<Args extends any[] = []>(length:number, options:{start?:(controller:ReadableStreamDefaultController<Uint8Array>, ...args:Args) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>, ...args:Args) => void | PromiseLike<void>, cancel?:(reason?:any, ...args:Args) => void | PromiseLike<void>, args:Args, excludeController:true, isMinLength:true}):MinLengthReadableStream<Uint8Array>;
    public create(length:number, options:{start?:(controller:ReadableStreamDefaultController<Uint8Array>) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>) => void | PromiseLike<void>, cancel?:(reason?:any) => void | PromiseLike<void>, isMinLength:true}):[MinLengthReadableStream<Uint8Array>, ReadableStreamDefaultController<Uint8Array>];
    public create<Args extends any[] = []>(length:number, options:{start?:(controller:ReadableStreamDefaultController<Uint8Array>, ...args:Args) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>, ...args:Args) => void | PromiseLike<void>, cancel?:(reason?:any, ...args:Args) => void | PromiseLike<void>, args:Args}, isMinLength:true):[MinLengthReadableStream<Uint8Array>, ReadableStreamDefaultController<Uint8Array>];    
    
    public create(...args:any[]):any
    {
        const highWaterMark = this._app.configUtil.get(true).classes.StreamUtil.frozen.chunkSize;

        let readableStreamController:ReadableStreamDefaultController<Uint8Array>;

        let length = undefined as number | undefined;
        let options = undefined as undefined | {start?:(controller:ReadableStreamDefaultController<Uint8Array>) => any, pull?:(controller:ReadableStreamDefaultController<Uint8Array>) => void | PromiseLike<void>, cancel?:(reason?:any) => void | PromiseLike<void>, args?:[], excludeController?:boolean, isMinLength?:true};
        if (args.length > 0 && this._app.typeUtil.isNumber(args[0]) === true)
        {
            length = args[0];
            options = args[1];
        }
        else options = args[0];
        
        const excludeController = options?.excludeController === true;

        const startCallback = options?.start;
        const pullCallback = options?.pull;
        const cancelCallback = options?.cancel;

        const args2 = options?.args ?? [];

        const start = (controller:ReadableStreamDefaultController<Uint8Array>) =>
        {
            readableStreamController = controller;

            return startCallback?.(controller, ...args2);
        }

        const pull = pullCallback === undefined ? undefined : (controller:ReadableStreamDefaultController<Uint8Array>) => pullCallback(controller, ...args2);
        const cancel = cancelCallback === undefined ? undefined : async (reason:any) => cancelCallback(reason, ...args2);
        
        let readableStream:ReadableStream<Uint8Array> | MinLengthReadableStream<Uint8Array> | KnownLengthReadableStream<Uint8Array>;

        if (length === undefined) readableStream = new ReadableStream<Uint8Array>({start, pull, cancel}, {highWaterMark});
        else if (options?.isMinLength === true) readableStream = new MinLengthReadableStream(length, {start, pull, cancel}, {highWaterMark});
        else readableStream = new KnownLengthReadableStream(length, {start, pull, cancel}, {highWaterMark});

        if (excludeController === true) return readableStream;
    
        return [readableStream, readableStreamController!];
    }

    public createEmpty():KnownLengthReadableStream<Uint8Array>
    {
        return new KnownLengthReadableStream(0, 
        { 
            start(controller) 
            {
                //immediately close the stream
                controller.close();
            }
        }); 
    }

    public async consume(stream:ReadableStream<Uint8Array>):Promise<true | IError>
    {
        let reader:ReadableStreamDefaultReader<Uint8Array> | undefined;

        try
        {
            reader = stream.getReader();

            while (true) 
            {
                const {done} = await reader.read();
                if (done) break;
            }

            return true;
        }
        catch (e)
        {
            const error = this._app.warn(e, 'error consuming stream', arguments, {errorOnly:true, names:[StreamUtil, this.consume]});
            
            //close the stream with the error, as we will not be consuming any more data due to the error
            await reader?.cancel(error);

            return error;
        }
        finally
        {
            reader?.releaseLock();
        }
    }
}