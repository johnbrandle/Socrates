/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
export class KnownLengthReadableStream<R extends any = Uint8Array> extends ReadableStream<R> 
{
    private _length:number;

    constructor(length:number, underlyingSource:UnderlyingByteSource, strategy?:{highWaterMark?:number});
    constructor(length:number, underlyingSource:UnderlyingDefaultSource<R>, strategy?:QueuingStrategy<R>);
    constructor(length:number, underlyingSource:UnderlyingSource<R>, strategy?:QueuingStrategy<R>);
    constructor(length:number, underlyingSource:UnderlyingSource<R> | UnderlyingByteSource | UnderlyingDefaultSource<R>, strategy?:QueuingStrategy<R> | {highWaterMark?:number}) 
    {
        super(underlyingSource as UnderlyingSource<R>, strategy as QueuingStrategy<R>);
        
        this._length = length;
    }

    get length():number
    {
        return this._length;
    }
}