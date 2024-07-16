/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { MultipartUint8Array } from "../multipart/MultipartUint8Array";
import { IError } from "../error/IError";
import { IAborted } from "../abort/IAborted";
import { IBaseApp } from "../IBaseApp";

export class StreamReaderHelper<A extends IBaseApp<A>>
{
    #_app:A;

    #_reader:ReadableStreamDefaultReader<Uint8Array>;
    #_controller?:ReadableStreamDefaultController<Uint8Array>;

    #_done:boolean = false;
    #_bytes:MultipartUint8Array;

    constructor (app:A, stream:ReadableStream<Uint8Array>, controller?:ReadableStreamDefaultController<Uint8Array>)
    {
        this.#_app = app;

        this.#_reader = stream.getReader();
        this.#_controller = controller;

        this.#_bytes = new MultipartUint8Array();
    }

    /**
     * Asynchronously reads a specified number of bytes from the stream. If the `count` is not provided,
     * the method attempts to read an amount based on the stream controller's `desiredSize` or reads
     * until the buffer has more data than the current number of bytes in the buffer.
     * 
     * If the `desiredSize` is less than or equal to 0 and `count` is not specified, it implies that the 
     * downstream consumer is currently not ready for more data, so an empty Uint8Array is returned to 
     * indicate this condition.
     * 
     * If `count` is specified and the stream ends before fulfilling the requested number of bytes, or if
     * `count` is not specified and the stream ends, the method returns `true` to indicate no more data 
     * can be read.
     * 
     * @param {number} [count] - Optional. The number of bytes to read from the stream. If undefined,
     *                           the method reads data based on the controller's `desiredSize` or until
     *                           the end of the stream if `desiredSize` is not defined.
     * @returns {Promise<Uint8Array | true | IError>} - A promise that resolves to the bytes read as a Uint8Array,
     *                                                  `true` if the end of the stream is reached or if `desiredSize`
     *                                                  indicates no more data is requested (and no `count` was provided),
     *                                                  or an `IError` object if an error occurs during the operation.
     */
    public async read(count:number):Promise<Uint8Array | IError>;
    public async read(count?:number):Promise<Uint8Array | true | IError>;
    public async read(count?:number):Promise<Uint8Array | true | IError>
    {
        try
        {
            const bytes = this.#_bytes;
            const reader = this.#_reader;
            const controller = this.#_controller;
            
            const countWasDefined = count !== undefined;
            const desiredSize = controller?.desiredSize ?? 0;

            //the controller wants no more data, and they didn't specify a count, so we can return an empty array
            if (desiredSize <= 0 && countWasDefined === false) return new Uint8Array(0);

            count = count ?? (desiredSize || bytes.length + 1);

            while (bytes.length < count)
            {
                if (this.#_done === true) 
                {
                    if (countWasDefined === true) this.#_app.throw('there are no more bytes to read, and not enough bytes have been read to satisfy the desired count.', []);
                    return true;
                }

                const {done, value} = await reader.read();
                if (done === true) 
                {
                    this.#_done = true;
                    if (countWasDefined === true) continue;
                    break;
                }
                if (value === undefined) this.#_app.throw('value must not be undefined', []);

                bytes.push(value);
            }

            const uint8Array = bytes.splice(0, Math.min(bytes.length, count));

            if (bytes.length === 0 && this.#_done !== true)
            { 
                const {done, value} = await this.#_reader.read();
                if (done === true) this.#_done = true;
                else if (value === undefined) this.#_app.throw('value must not be undefined', []);
                else bytes.push(value);
            }

            return uint8Array;
        }
        catch (e)
        {
            const error = this.#_app.warn(e, 'error reading stream', [count], {errorOnly:true, names:[StreamReaderHelper, this.read]});

            //close the stream with the error, as we will not be consuming any more data due to the error
            await this.#_reader.cancel(error);

            return error;
        }
    }

    /**
     * Asynchronously peeks at a specified number of bytes from the stream without consuming them. 
     * This allows you to inspect the data at the current stream position up to the specified count
     * while leaving the stream's internal state and buffer unchanged.
     * 
     * If the available bytes in the buffer are less than the requested count, this method attempts to
     * read more data from the stream until the desired count is reached or the end of the stream is encountered.
     * If the end of the stream is reached before accumulating the requested number of bytes, the method
     * returns whatever bytes are available up to that point.
     * 
     * @param {number} count - The number of bytes to peek from the stream.
     * @returns {Promise<Uint8Array | IError>} A promise that resolves to a Uint8Array containing the peeked bytes.
     *                                         If an error occurs during the operation, an `IError` object is returned.
     */
    public async peek(count?:number):Promise<Uint8Array | IError>
    {
        try
        {
            const bytes = this.#_bytes;
            const reader = this.#_reader;
            const controller = this.#_controller;

            const countWasDefined = count !== undefined;
            const desiredSize = controller?.desiredSize ?? 0;

            //the controller wants no more data, and they didn't specify a count, so we can return an empty array
            if (desiredSize <= 0 && countWasDefined === false) return new Uint8Array(0);

            count = count ?? (desiredSize || bytes.length + 1);
            
            while (bytes.length < count)
            {
                if (this.#_done === true) return bytes.slice(0, Math.min(bytes.length, count));

                const {done, value} = await reader.read();
                if (done === true) 
                {
                    this.#_done = true;
                    break;
                }
                if (value === undefined) this.#_app.throw('value must not be undefined', []);

                bytes.push(value);
            }

            const uint8Array = bytes.slice(0, Math.min(bytes.length, count));

            if (bytes.length === count && this.#_done !== true)
            {
                const {done, value} = await this.#_reader.read();
                if (done === true) this.#_done = true;
                else if (value === undefined) this.#_app.throw('value must not be undefined', []);
                else bytes.push(value);
            }

            return uint8Array;
        }
        catch (e)
        {
            const error = this.#_app.warn(e, 'error peeking stream', [count], {errorOnly:true, names:[StreamReaderHelper, this.peek]});

            //close the stream with the error, as we will not be consuming any more data due to the error
            await this.#_reader.cancel(error);

            return error;
        }
    }

    public consume(count:number):Uint8Array
    {
        const bytes = this.#_bytes;
        
        if (bytes.length < count) this.#_app.throw('not enough bytes to consume, {}', [count], {correctable:true});

        return bytes.splice(0, count);
    }

    public get done():boolean
    {
        return this.#_done && this.#_bytes.length === 0;
    }

    public cancel = async (reason:IAborted | IError):Promise<void> =>
    {
        if (this.#_done === true) return;
        this.#_done = true;

        return await this.#_reader.cancel(reason);
    }

    public releaseLock()
    {
        if (this.#_done === true) return;
        this.#_done = true;

        this.#_reader.releaseLock();
    }

    public extract():[ReadableStreamDefaultReader<Uint8Array> | undefined, Uint8Array]
    {
        const wasDone = this.#_done;

        this.releaseLock();

        return [wasDone === true ? undefined : this.#_reader, this.#_bytes.slice()];
    }

    public set controller(controller:ReadableStreamDefaultController<Uint8Array> | undefined)
    {
        this.#_controller = controller;
    }
}