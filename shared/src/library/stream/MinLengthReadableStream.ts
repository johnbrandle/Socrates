/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * Used for when you don't know the exact length of the stream, but you know the minimum length.
 * 
 * Say you have x number of bytes, and you pass it through a tranformer that will add a variable
 * number of bytes to it. You can create this type of stream to serialize the output, ensuring 
 * that during deserialization, it can safely skip the first x number of bytes (no need to check
 * for the boundary). It's basically a middle ground between a fixed length stream and an unknown
 * length stream.
 */

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
export class MinLengthReadableStream<R extends any = Uint8Array> extends ReadableStream<R> 
{
    private _minLength:number;

    constructor(minLength:number, underlyingSource:UnderlyingByteSource, strategy?:{highWaterMark?:number});
    constructor(minLength:number, underlyingSource:UnderlyingDefaultSource<R>, strategy?:QueuingStrategy<R>);
    constructor(minLength:number, underlyingSource:UnderlyingSource<R>, strategy?:QueuingStrategy<R>);
    constructor(minLength:number, underlyingSource:UnderlyingSource<R> | UnderlyingByteSource | UnderlyingDefaultSource<R>, strategy?:QueuingStrategy<R> | {highWaterMark?:number}) 
    {
        super(underlyingSource as UnderlyingSource<R>, strategy as QueuingStrategy<R>);
        
        this._minLength = minLength;
    }

    get minLength():number
    {
        return this._minLength;
    }
}