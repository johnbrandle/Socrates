/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @reference https://learnmeabitcoin.com/technical/general/little-endian/
 * 
 * @important ALL changes to this util and dependant utils must be well tested!
 */

import { IBaseApp } from "../IBaseApp.ts";
import { SealedDecorator } from "../decorators/SealedDecorator.ts";
import { HashType, Hex_128, hex_128, hex_96, Hex_96 } from "./HashUtil.ts";
import { uint } from "./IntegerUtil.ts";
import { type CTRKey, KeyType, type CBCKey, type HKDFKey, type PBKDF2Key, type Salt, type salt } from "./KeyUtil.ts";
import { __MaxRepresentableSize, __fillWithRandom } from "./__internal/__random.ts";

export type EmptyUint8Array = Uint8Array & { _brand: 'EmptyUint8Array' };

export type PreProcessedNeedle = [Uint8Array, Uint32Array | undefined, Uint32Array | undefined] & { _brand: 'ComputedNeedle' };

export enum IndexOfAlgorithm
{
    KMP = 'kmp',
    BM = 'bm',
}

export enum IndexOfBoundarySize
{
    KMP = 16,
    BM = 256,
}

const bytes0Through255 = new Uint8Array([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 
    10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 
    55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 
    136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 
    172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 
    208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 
    244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255
]);

@SealedDecorator()
export class ByteUtil<A extends IBaseApp<A>>
{    
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public generate<T extends Uint8Array=Uint8Array>(count:number, options?:{insecure?:boolean}):T
    {
        if (options?.insecure === true) //not cryptographically secure, but faster
        {
            //adjust the size to the next multiple of 4
            const adjustedSize = count + (4 - (count % 4)) % 4;
            const bytes = new Uint8Array(adjustedSize);

            for (let i = 0; i < adjustedSize; i += 4) 
            {
                //generate a 32-bit unsigned integer from Math.random()
                const randomUint32 = Math.floor((Math.random() * 2**32));
                
                //directly set the bytes
                bytes[i] = randomUint32 & 0xff;
                bytes[i + 1] = (randomUint32 >> 8) & 0xff;
                bytes[i + 2] = (randomUint32 >> 16) & 0xff;
                bytes[i + 3] = (randomUint32 >> 24) & 0xff;
            }

            //slice the array to the original requested size before returning
            return bytes.slice(0, count) as T;
        }

        const uint8Array = new Uint8Array(count);
        
        __fillWithRandom(uint8Array, __MaxRepresentableSize.Uint8);

        return uint8Array as T;
    }

    public async derive(hkdfKey:HKDFKey, salt:salt | Salt, bytes:number):Promise<Uint8Array>;
    public async derive(pbkdf2Key:PBKDF2Key, salt:salt | Salt | Uint8Array, bytes:number, iterations:number, hash:HashType):Promise<Uint8Array>;
    public async derive(cbcKey:CBCKey, iv:hex_128 | Hex_128, bytes:number | Uint8Array):Promise<Uint8Array>;
    public async derive(ctrKey:CTRKey, nonce:hex_96 | Hex_96, bytes:number | Uint8Array):Promise<Uint8Array>;
    public async derive(key:HKDFKey | PBKDF2Key | CBCKey | CTRKey, salt:salt | Salt | hex_96 | Uint8Array, bytes:number | Uint8Array, iterations?:number, hash?:HashType):Promise<Uint8Array>
    {
        const config = this._app.configUtil.get(true).classes.ByteUtil.frozen;

        if (this._app.typeUtil.isString(salt) === true) salt = this._app.baseUtil.fromHex<Salt>(salt);

        if (key.cryptoKey.algorithm.name === KeyType.CBC)
        {
            const cbcKey = key as CBCKey;
            const iv = salt as Hex_128;
            const uint8Array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

            return new Uint8Array(await crypto.subtle.encrypt({name:KeyType.CBC, iv}, cbcKey.cryptoKey, uint8Array)).subarray(0, uint8Array.length); //remove the padding
        }

        if (key.cryptoKey.algorithm.name === KeyType.CTR)
        {
            const ctrKey = key as CTRKey;
            const nonce = salt as Hex_96;
            const uint8Array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

            if (uint8Array.length > 2**32 * 16) this._app.throw('The maximum number of bytes that can be encrypted is 2^32 * 16', [], {correctable:true});

            const counter = new Uint8Array(16);
            counter.set(nonce);

            return new Uint8Array(await crypto.subtle.encrypt({name:KeyType.CTR, counter, length:32}, ctrKey.cryptoKey, uint8Array));
        }    

        if (key.cryptoKey.algorithm.name === KeyType.PBKDF2)
        {
            if (bytes as number > 256) this._app.throw('The maximum number of bytes that can be derived is 256', [], {correctable:true}); //blame firefox for this limitation

            const pbkdf2Key = key as PBKDF2Key;
            const pbkdf2KeyBuffer = await crypto.subtle.deriveBits({name:KeyType.PBKDF2, salt, iterations, hash}, pbkdf2Key.cryptoKey, bytes as number * 8);

            return new Uint8Array(pbkdf2KeyBuffer);
        }

        if (bytes as number > 8160) this._app.throw('The maximum number of bytes that can be derived is 8160', [], {correctable:true});

        //info is the salt in this case
        const info = salt;

        //the salt is supposed to be a fixed value or null, and the info is supposed to be unique for each use case
        const fixedSalt = this._app.baseUtil.fromHex(config.deriveLabel_hex_128 as hex_128); //fixed salt

        //derive the bits using HKDF 
        return new Uint8Array(await crypto.subtle.deriveBits({name:KeyType.HKDF, hash:HashType.SHA_256, salt:fixedSalt, info}, key.cryptoKey, bytes as number * 8));
    }

    public toString(uint8Array:Uint8Array):string 
    {
        return uint8Array.join(',');
    }

    public fromString(string:string):Uint8Array
    {
        const parts = string.split(',');
        const result = new Uint8Array(parts.length);

        for (let i = 0; i < parts.length; i++) result[i] = parseInt(parts[i]);

        return result;
    }
    
    /**
     * Injects the given data into the target Uint8Array at the specified offset.
     * If the data fits within the remaining space in the target array, it is set directly.
     * If the data does not fit, it is split into two parts and wrap around to the start of the target array.
     * @param target The target Uint8Array to inject the data into.
     * @param data The data to be injected as a Uint8Array.
     * @param offset The offset at which to inject the data in the target array.
     * @returns The number of elements injected into the target array.
     */
    public inject(target:Uint8Array, data:Uint8Array, offset:number):number
    {
        const spaceRemaining = target.length - offset;
    
        if (data.length <= spaceRemaining) 
        {
            //if the data fits in the remaining space, set it directly
            target.set(data, offset);
            
            return (offset + data.length) % target.length;
        } 
        else 
        {
            //if the data doesn't fit, split it into two parts
            const part1 = data.subarray(0, spaceRemaining);
            const part2 = data.subarray(spaceRemaining);
    
            target.set(part1, offset);
            target.set(part2); //this sets at the start of the buffer
    
            return part2.length;
        }
    }

    /**
     * Selects a portion of a Uint8Array, and returns it.
     * If the selected portion exceeds the length of the source array, it wraps around to the start of the array.
     * 
     * @param source The source Uint8Array.
     * @param bytes The length of the extracted portion.
     * @param offset The offset from which to start extracting.
     * @returns The extracted Uint8Array.
     */
    public select(source:Uint8Array, bytes:number, offset:number):Uint8Array
    {
        const extractedData = new Uint8Array(bytes);
        let currentIndex = 0;
    
        while (currentIndex < bytes) 
        {
            let index = (offset + currentIndex) % source.length;
            extractedData[currentIndex] = source[index];
            currentIndex++;
        }
    
        return extractedData;
    }

    /**
     * Return the first x number of bytes from the Uint8Array, and remove them from the original array.
     * Return both as a tuple.
     */
    public shift(array:Uint8Array, bytes:number, options?:{slice?:boolean}):[Uint8Array, Uint8Array]
    {
        const operation = options?.slice === false ? 'subarray' : 'slice';

        const extractedData = array[operation](0, bytes);
        const remainingData = array[operation](extractedData.length);

        return [extractedData, remainingData];
    }

    public concat(arrays:Uint8Array[]):Uint8Array
    {
        let totalLength = 0;
        for (const array of arrays) totalLength += array.length;

        const result = new Uint8Array(totalLength);
        let currentIndex = 0;
        for (const array of arrays) 
        {
            result.set(array, currentIndex);
            currentIndex += array.length;
        }

        return result;
    }

    public xor<T extends Uint8Array>(buffer1:T, buffer2:T):T
    {
        if (buffer1.length !== buffer2.length) this._app.throw('Buffers are not the same length', [], {correctable:true});
    
        const result = new Uint8Array(buffer1.length) as T;
        for (let i = 0; i < buffer1.length; i++) result[i] = buffer1[i] ^ buffer2[i];
        
        return result;
    }

    public pad<T extends Uint8Array>(buffer:T, length:number):T
    {
        if (buffer.length >= length) return buffer;
    
        const result = new Uint8Array(length) as T;
        result.set(buffer);
    
        return result;
    }

    public equals(buffer1:Uint8Array, buffer2:Uint8Array):boolean
    {
        if (buffer1.length !== buffer2.length) return false;
        
        for (let i = 0; i < buffer1.length; i++) if (buffer1[i] !== buffer2[i]) return false;
        
        return true;
    }

    public randomize(array:Uint8Array):void;
    public randomize(array:Uint8Array, options?:{salt?:Hex_96}):Promise<void>;
    public randomize(array:Uint8Array, options?:{salt?:Hex_96}):Promise<void> | void 
    {
        const length = array.length; 

        if (length <= 1) return;

        const salt = options?.salt;
        
        if (salt === undefined)
        {
            const randomIntegers = this._app.integerUtil.generate(length as uint, 0 as uint, length - 1 as uint);
        
            for (let i = length; i--;) 
            {
                const j = randomIntegers[i];
        
                //swap the elements.
                [array[i], array[j]] = [array[j], array[i]];
            }

            return;
        }

        return this._app.keyUtil.__CTR_KEY.then(ctrKey => this.derive(ctrKey, salt, length * 4).then((derivedBytes) =>
        {
            const min = 0;
            const max = length - 1;
            const range = max - min + 1;

            //verify the range is a power of two if a salt is provided.
            if ((range & (range - 1)) !== 0) this._app.throw('The array must be a power of two if a salt is provided', [], {correctable:true});

            const derivedIntegers = new Int32Array(derivedBytes);
            
            for (let i = length; i--;) 
            {
                const j = (derivedIntegers[i] % range) + min;
        
                //swap the elements.
                [array[i], array[j]] = [array[j], array[i]];
            }
        }));
    }

    private counter:uint | undefined;
    private sevenByteRandom:Uint8Array | undefined;
    public generateIndexOfBoundary(algorithm:IndexOfAlgorithm)
    {
        if (algorithm === IndexOfAlgorithm.KMP)
        {
            if (this.counter === undefined)
            {
                this.counter = this._app.integerUtil.generate(0 as uint, 0xff as uint); //random start
                this.sevenByteRandom = this.generate(7, {insecure:true}); //only need to generate this once
            }

            const sevenByteRandom = this.sevenByteRandom!;

            ///16 byte boundary
            const boundary = new Uint8Array(16);

            ///two bytes of counter
            //we use little endian to speed up byte comparison searches (the numbers that are most likely to change should come first)
            const twoByteCounter = this._app.integerUtil.toUint8Array(this.counter as uint, true).slice(0, 2); //little endian

            //this assumes we cannot exceed 65535 operations within a microsecond, which should be a safe assumption given the use of this counter, the code 
            //within this method, and javascript's performance.
            //an empty loop with 65536 interations clocked at 20 microseconds, so say 1 microsecond given the overhead of calling performance.now() twice.
            this.counter++;
            if (this.counter >= 0xff) this.counter = 0 as uint;

            boundary.set(twoByteCounter, 0);

            ///7 bytes of time
            const epochMicroseconds = Date.now() * 1000;
            const performanceNowMicroseconds = Math.floor(performance.now() * 1000);
            const totalMicroseconds = epochMicroseconds + performanceNowMicroseconds;

            if (totalMicroseconds > Number.MAX_SAFE_INTEGER) this._app.throw('total microseconds exceeds max safe integer, {microseconds}', [totalMicroseconds], {correctable:true}); //their calender might be off

            //ensure the least sigificant bytes are first, so we can speed up boundary comparison
            const timeBytes = this._app.integerUtil.toUint8Array(totalMicroseconds as uint, true); //little endian
            boundary.set(timeBytes.slice(0, 7), 2);
  
            ///seven bytes of random (does not change over the course of the execution of the program, which is intentional).
            boundary.set(sevenByteRandom, 9);

            return boundary;
        }

        //Optimization Strategy for Boyer-Moore Search with a Unique 256-Byte Boundary:
        // 1) All Unique Bytes: The boundary is intentionally constructed with unique bytes, thus eliminating any possibility of internal repeats. This distinct 
        //    uniqueness ensures the Good Suffix rule has no application, as it relies on repeated sequences to calculate possible shifts.
        // 2) We could put the most commonly used bytes at the beginning of the boundary, as this would increase the likelihood of an early mismatch.
        //    However, given the length of our boundary and its composition, i think any performance benefit would be negligible.

        //256 byte boundary (larger due to the nature of its constructon, and the fact that bm works better with larger boundaries)
        //i think 256 bytes is a good balance between size and speed, ideally giving us a O(haystack.length / 256) time complexity.
        //so for 1 million bytes, we would expect a best case of 3906 comparisons.
        const boundary = bytes0Through255.slice();

        this.randomize(boundary);

        return boundary;
    }

    /**
     * Searches for the needle within the haystack using the optimized Boyer-Moore (BM) or Knuth-Morris-Pratt (KMP)
     * algorithm, based on the specified options. Returns the index at which the needle is found along with the 
     * preprocessed needle data for potential reuse.
     * 
     * @param {Uint8Array} haystack - The array of bytes in which to search for the needle.
     * @param {Uint8Array | PreProcessedNeedle} needle - The search pattern array or a preprocessed pattern
     *                                                   containing the needle and its preprocessing data.
     * @param {Object} [options] - Optional parameters to customize the search:
     *   @param {number} [options.fromIndex=0] - The index within the haystack at which to start the search.
     *   @param {'kmp'|'bm'} [options.algorithm='bm'] - The algorithm to use for the search. Defaults to 'kmp'.
     * 
     * @returns {[number, PreProcessedNeedle]} - A tuple with the index at which the needle was found (or -1 if not found)
     *                                           and the needle or preprocessed needle. The preprocessed needle allows
     *                                           reuse in subsequent searches, enhancing efficiency.
     * 
     * Throws:
     * - Throws an error if the needle length exceeds 2^32 (KMP), or 2^32 - 1 (BM) bytes
     */
    public indexOf(haystack:Uint8Array, needle:Uint8Array | PreProcessedNeedle, options?:{fromIndex?:number, algorithm?:IndexOfAlgorithm}):[number, PreProcessedNeedle]
    {
        let preProcessedNeedle:PreProcessedNeedle | undefined;
        let preprocessedNeedle1:Uint32Array | undefined;
        let preprocessedNeedle2:Uint32Array | undefined;
        if (this._app.typeUtil.isArray(needle) === true) 
        {
            preProcessedNeedle = needle as PreProcessedNeedle;
            [needle, preprocessedNeedle1, preprocessedNeedle2] = [needle[0], needle[1], needle[2]];
        }

        const fromIndex = options?.fromIndex ?? 0;
        const algorithm = options?.algorithm ?? IndexOfAlgorithm.KMP;

        const haystackLength = haystack.length;
        const needleLength = needle.length;

        if (needleLength === 0) return [0, preProcessedNeedle ?? [needle, undefined, undefined] as PreProcessedNeedle];
        if (haystackLength === 0 || needleLength > haystackLength) return [-1, preProcessedNeedle ?? [needle, undefined, undefined] as PreProcessedNeedle];

        if (algorithm === IndexOfAlgorithm.KMP)
        {
            if (needleLength >= 2**32) this._app.throw('The "needle" must be less than 2^32 bytes long', [], {correctable:true});

            const computeLPSArray = (needle:Uint8Array):Uint32Array => 
            {
                const needleLength = needle.length;
    
                const lps = new Uint32Array(needleLength); //automatically initialized to 0
                let length = 0; //length of the previous longest prefix suffix
                let i = 1;
            
                //the loop calculates lps[i] for i = 1 to search.length - 1
                while (i < needleLength) 
                {
                    if (needle[i] === needle[length]) 
                    {
                        length++;
                        lps[i] = length;
                        i++;
    
                        continue;
                    } 
    
                    if (length !== 0) 
                    {
                        length = lps[length - 1];
    
                        continue; //we do not increment i here
                    } 
    
                    lps[i] = 0;
                    i++;
                }
            
                return lps;
            }
    
            //compute the LPS array (longest prefix suffix) for the needle
            const lps = preprocessedNeedle1 ?? computeLPSArray(needle);
        
            let i = fromIndex; //index for buffer[]
            let j = 0; //index for search[]
        
            while (i < haystackLength) 
            {
                if (needle[j] === haystack[i]) 
                {
                    j++;
                    i++;
                }
        
                if (j === needleLength) return [i - j, preProcessedNeedle ?? [needle, lps, undefined] as PreProcessedNeedle]; //found the pattern
                
                if (i < haystackLength && needle[j] !== haystack[i]) 
                {
                    //do not match LPS[0..LPS[j-1]] characters, they will match anyway
                    if (j !== 0) j = lps[j - 1];
                    else i = i + 1;
                }
            }

            return [-1, preProcessedNeedle ?? [needle, lps, undefined] as PreProcessedNeedle]; //did not find the pattern
        }

        //boyer-Moore algorithm. we subtract 1 from the max needle length because we use 0xFFFFFFFF to represent -1
        if (needleLength >= (2**32) - 1) this._app.throw('The "needle" must be less than 2^32 - 1 bytes long', [], {correctable:true});

        //function to create the bad character shift table using Uint32Array
        const createBadCharacterShift = (needle:Uint8Array):[Uint32Array, boolean] => 
        {
            let needleHasOnlyUniqueBytes = true; //we assume the needle has only unique bytes until proven otherwise

            //initialize all values to -1 (we'll use 0xFFFFFFFF to represent -1)
            const set = new Set();
            const badCharShift = new Uint32Array(256).fill(0xFFFFFFFF);
            for (let i = 0; i < needleLength; i++) 
            {
                const needleValue = needle[i];

                if (needleHasOnlyUniqueBytes === true)
                {
                    if (set.has(needleValue) === true) needleHasOnlyUniqueBytes = false;
                    set.add(needleValue);
                }

                badCharShift[needleValue] = i;
            }
            
            return [badCharShift, needleHasOnlyUniqueBytes];
        };

        const createStrongSuffixShift = (needle:Uint8Array):Uint32Array =>
        {
            const needleLength = needle.length;
            const shift = new Uint32Array(needleLength + 1);
            const bpos = new Uint32Array(needleLength + 1);

            let i = needleLength;
            let j = needleLength + 1;
            
            bpos[i] = j;
            
            while (i > 0) 
            {
                while (j <= needleLength && needle[i - 1] !== needle[j - 1]) 
                {
                    if (shift[j] === 0) shift[j] = j - i;
                    
                    j = bpos[j];
                }
               
                --i;
                --j;
                bpos[i] = j;
            }

            j = bpos[0];
            for (let i = 0; i <= needleLength; i++) 
            {
                if (shift[i] === 0) shift[i] = j;
                if (i === j) j = bpos[j];
            }

            return shift;
        };

        let badCharShift:Uint32Array | undefined;
        let needleHasOnlyUniqueBytes = false;
        let goodSuffixShift:Uint32Array | undefined;
        if (preprocessedNeedle1 !== undefined)
        {
            badCharShift = preprocessedNeedle1;
            goodSuffixShift = preprocessedNeedle2;

            if (goodSuffixShift === undefined) needleHasOnlyUniqueBytes = true;
        }
        else
        {
            [badCharShift, needleHasOnlyUniqueBytes] = createBadCharacterShift(needle);

            goodSuffixShift = (needleHasOnlyUniqueBytes === false) ? createStrongSuffixShift(needle) : undefined;
        }

        let shift = fromIndex;
        while (shift <= (haystackLength - needleLength)) 
        {
            let j = needleLength - 1;
            
            while (j >= 0 && needle[j] === haystack[shift + j]) j--;
            
            if (j < 0) return [shift, preProcessedNeedle ?? [needle, badCharShift, goodSuffixShift] as PreProcessedNeedle]; //found the pattern

            const badChar = haystack[shift + j];
            const shiftIndex = badCharShift[badChar];

            if (goodSuffixShift === undefined)
            {
                if (shiftIndex !== 0xFFFFFFFF) shift += Math.max(1, j - shiftIndex); //check if the value is not our representation of -1
                else shift += 1; //move by one position if the mismatched character is not in the bad character table
                continue;
            }

            shift += Math.max(goodSuffixShift[j + 1], j - (shiftIndex !== 0xFFFFFFFF ? shiftIndex : -1));
        }
        
        return [-1, preProcessedNeedle ?? [needle, badCharShift, goodSuffixShift] as PreProcessedNeedle]; //did not find the pattern
    }
    
    public toArrayBuffer(uint8Array:Uint8Array):ArrayBuffer
    {
        return uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteLength + uint8Array.byteOffset);
    }

    public fromArrayBuffer(arrayBuffer:ArrayBuffer):Uint8Array
    {
        return new Uint8Array(arrayBuffer);
    }

    public toDataView(uint8Array:Uint8Array):DataView
    {
        return new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
    }

    public fromDataView(dataView:DataView):Uint8Array
    {
        return new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
    }
}