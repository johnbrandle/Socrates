/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @important ALL changes to this code and dependant code must be well tested!
 */

export const __toUint8Array = (input:string):Uint8Array => new TextEncoder().encode(input);

export enum __MaxRepresentableSize //we are purposely not subtracting 1 
{
    Uint8 = 256, //2^8
    Uint16 = 65536, //2^16
    Uint32 = 4294967296 //2^32
}

type RandomBuffer =
{
    length:number;
    buffer?:Uint8Array | Uint16Array | Uint32Array;
    index:number;
    class:Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor;
}

export const __fillWithRandom = (data:Uint8Array | Uint16Array | Uint32Array, maxRepresentableSize:__MaxRepresentableSize):void => 
{
    let remaining = data.length;
    let currentIndex = 0;

    const randomBuffers:{[key:number]:RandomBuffer} =
    {
        [__MaxRepresentableSize.Uint8]:{length:65536, buffer:undefined, index:0, class:Uint8Array}, //65KB
        [__MaxRepresentableSize.Uint16]:{length:32768, buffer:undefined, index:0, class:Uint16Array}, //65KB
        [__MaxRepresentableSize.Uint32]:{length:16384, buffer:undefined, index:0, class:Uint32Array} //65KB
    };

    const randomBuffer = randomBuffers[maxRepresentableSize];
    randomBuffer.buffer = crypto.getRandomValues(new randomBuffer.class(Math.min(remaining, randomBuffer.length)));

    while (remaining > 0) 
    {
        const chunkSize = Math.min(remaining, randomBuffer.buffer.byteLength - randomBuffer.index);

        if (chunkSize === 0) 
        {
            //refill the buffer
            randomBuffer.buffer = crypto.getRandomValues(remaining >= randomBuffer.buffer.byteLength ? randomBuffer.buffer : new randomBuffer.class(remaining));
            randomBuffer.index = 0;
            continue;
        }
        
        const start = randomBuffer.index;
        const end = start + chunkSize;

        data.set(randomBuffer.buffer.slice(start, end), currentIndex);
        randomBuffer.index = end;

        currentIndex += chunkSize;
        remaining -= chunkSize;
    }
};

/**
 * Fills an array with random integers within a specified range.
 * 
 * @param {number} length - The number of random numbers to generate.
 * @param {number} min - The minimum value in the range (inclusive).
 * @param {number} max - The maximum value in the range (inclusive).
 * 
 * @throws {Error} Throws an error if length is 0, if min is greater than max, or if the range is not valid.
 * 
 * @returns {Int32Array} An array of random integers within the specified range.
 */
export const __fillWithRandomIntegersWithinRange = (numbers:Int32Array, min:number, max:number):void => 
{
    const length = numbers.length;  
    if (length === 0) throw new Error('Length must be greater than 0');
  
    if (min === max) return void numbers.fill(min);
    if (min > max) throw new Error('Invalid min/max input');
    if (min < -2147483648 || max > 2147483647) throw new Error('Min/max must be between -2147483648 and 2147483647'); //-2^31 and 2^31-1
      
    const range = max - min + 1;
    if (range > 2147483647) throw new Error('Range must be less than or equal to 2147483647'); //2^31-1

    let maxRepresentableSize = __MaxRepresentableSize.Uint8;
    if (range > __MaxRepresentableSize.Uint16) maxRepresentableSize = __MaxRepresentableSize.Uint32;
    else if (range > __MaxRepresentableSize.Uint8) maxRepresentableSize = __MaxRepresentableSize.Uint16;
    
    const getRandomValues = (length:number) =>
    {
        let randomValues:Uint8Array | Uint16Array | Uint32Array;

        switch (maxRepresentableSize)
        {
            case __MaxRepresentableSize.Uint8:
                randomValues = new Uint8Array(length);
                break;
            case __MaxRepresentableSize.Uint16:
                randomValues = new Uint16Array(length);
                break;
            case __MaxRepresentableSize.Uint32:
                randomValues = new Uint32Array(length);
                break;
            default: throw new Error('Invalid maxRepresentableSize');
        }

        __fillWithRandom(randomValues, maxRepresentableSize);

        return randomValues;
    }

    if ((range & (range - 1)) === 0) //if range is a power of 2 we can do this a bit faster
    {
        const randomValues = getRandomValues(length);

        for (let i = 0; i < length; i++) numbers[i] = (randomValues[i] % range) + min;
       
        return;
    }
    
    const maxUsableValue = maxRepresentableSize - (maxRepresentableSize % range);
    const usableValueRatio = maxUsableValue / maxRepresentableSize;

    ///modulo approach is more efficient than a bitwise approach (for non-powers of 2)
    let set = 0;
    while (set < length) 
    {
        const remaining = length - set;
        const estimatedValuesNeeded = Math.ceil(remaining / usableValueRatio) + 8; //add an extra 8 as a buffer

        const randomValues = getRandomValues(estimatedValuesNeeded);
        for (let i = 0; i < estimatedValuesNeeded && set < length; i++) 
        {
            if (randomValues[i] >= maxUsableValue) continue;
            
            numbers[set] = (randomValues[i] % range) + min;
            ++set;
        }
    }
}