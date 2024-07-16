/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @important ALL changes to this util and dependant utils must be well tested!
 */

import { SealedDecorator } from "../decorators/SealedDecorator.ts";
import { IError } from "../error/IError.ts";
import { IBaseApp } from "../IBaseApp.ts";

export type binary = string & { _binaryBrand: 'binary' };
export type base4 = string & { _base4Brand: 'base4' };
export type octal = string & { _ocatalBrand: 'octal' };
export type hex = string & { _hexBrand: 'hex' }; 
export type base24 = string & { _base24Brand: 'base24' };
export type base32 = string & { _base32Brand: 'base32' };
export type base62 = string & { _base62Brand: 'base62' };
export type base64 = string & { _base64Brand: 'base64' };

export type Binary = Uint8Array & { _binaryUintBrand: 'Binary' };
export type Base4 = Uint8Array & { _base4UintBrand: 'Base4' };
export type Octal = Uint8Array & { _ocatalUintBrand: 'Octal' };
export type Hex = Uint8Array & { _hexUintBrand: 'Hex' };
export type Base24 = Uint8Array & { _base24UintBrand: 'Base24' };
export type Base32 = Uint8Array & { _base32UintBrand: 'Base32' };
export type Base62 = Uint8Array & { _base62UintBrand: 'Base62' };
export type Base64 = Uint8Array & { _base64UintBrand: 'Base64' };

export enum BaseOutputFormat
{
    string = 'string',
    Uint8Array = 'Uint8array',
}

export enum CharSet
{
    Base2 = '01',
    Base4 = '0123',
    Base8 = '01234567',
    Base10 = '0123456789',
    Base16 = '0123456789abcdef', //we default to lowercase because the crypto.subtle API returns lowercase hex strings, and i prefer it for readability
    Base16_UPPER = '0123456789ABCDEF',
    Base24 = '234567ABCEFGHJKMNPRTVXYZ', //subset of base32 for backwards compat, without problematic 'O', 'I', 'D', 'U', or 'L' (useful for generating totp secrets)
    Base32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', //RFC 4648/3548
    Base62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    Base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', //RFC 4648

    Base32_Custom = '0123456789abcdefghjkmnpqrstuvwyz', //a bit like the base32 hex charset, but lowercase, and without the problematic 'O', 'I', or 'L' (useful for encoding hashes in a more compact, but readable way)
}

//fromBase62 uses this
const log2LookupTable:Uint8Array = new Uint8Array(62);
for (let i = 0; i < 62; ++i) log2LookupTable[i] = Math.ceil(Math.log2(i + 1));

const charsetMaps = new Map<string, Uint8Array>();
const getCharsetMap = (charset:string):Uint8Array => //getCharCode() plus this lookup is much faster than a direct character string to number lookup
{
    if (charsetMaps.has(charset)) return charsetMaps.get(charset)!;

    const charsetMap = new Uint8Array(256);
    for (let i = 0; i < charset.length; ++i) charsetMap[charset.charCodeAt(i)] = i;

    charsetMaps.set(charset, charsetMap);

    return charsetMap;
}

//base16 is case insensitive, so we use the same lookup table for both upper and lower case
const charToHexLookupTable:Uint8Array = new Uint8Array(256);
for (let i = 0; i <= 9; ++i) charToHexLookupTable[48 + i] = i; //Populate '0' to '9'
for (let i = 0; i <= 5; ++i) charToHexLookupTable[97 + i] = 10 + i; //Populate 'a' to 'f'
for (let i = 0; i <= 5; ++i) charToHexLookupTable[65 + i] = 10 + i; //Populate 'A' to 'F'
charsetMaps.set(CharSet.Base16, charToHexLookupTable);
charsetMaps.set(CharSet.Base16_UPPER, charToHexLookupTable);

@SealedDecorator()
export class BaseUtil<A extends IBaseApp<A>>
{    
    protected _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public toBinary<T extends binary=binary>(input:Uint8Array):T
    {
        const output = this._app.stringUtil.createConcatinator();
    
        for (const byte of input)
        {
            //convert each byte to an 8-character binary string, padding with zeros if necessary
            const binaryString = byte.toString(2).padStart(8, '0');
            
            //append the binary string to the output
            output.append(binaryString);
        }
    
        return output.toString() as T;
    }
    
    public fromBinary<T extends Uint8Array=Uint8Array>(input:string):T
    {
        if (input.length % 8 !== 0) this._app.throw('invalid input length', [], {correctable:true});
    
        const uint8Array = new Uint8Array(input.length / 8);
    
        for (let i = 0, j = 0; i < input.length; i += 8, j++) 
        {
            //parse each 8-character binary string into a byte
            const binaryString = input.substring(i, i + 8);
            const byte = parseInt(binaryString, 2);
            if (isNaN(byte) !== false) this._app.throw('invalid input', [], {correctable:true});
    
            uint8Array[j] = byte;
        }
    
        return uint8Array as T;
    }
    
    public toBase4<T extends base4=base4>(input:Uint8Array):T
    {
        const output = this._app.stringUtil.createConcatinator();
    
        for (const byte of input)
        {
            //convert each byte to a 4-digit base-4 string, padding with zeros if necessary
            const base4String = byte.toString(4).padStart(4, '0');
            //append the base-4 string to the output
            output.append(base4String);
        }
    
        return output.toString() as T;
    }

    public fromBase4<T extends Uint8Array=Uint8Array>(input:string):T
    {
        if (input.length % 4 !== 0) this._app.throw('invalid input length', [], {correctable:true});

        const uint8Array = new Uint8Array(input.length / 4);
        for (let i = 0, j = 0; i < input.length; i += 4, j++) 
        {
            //parse each 4-digit base-4 string into a byte
            const base4Chunk = input.substring(i, i + 4);
            const byte = parseInt(base4Chunk, 4);
            if (isNaN(byte) !== false) this._app.throw('invalid input', [], {correctable:true});
            uint8Array[j] = byte;
        }

        return uint8Array as T;
    }
    
    public toOctal<T extends octal=octal>(input:Uint8Array):T
    {
        const output = this._app.stringUtil.createConcatinator();
    
        for (const byte of input)
        {
            //convert each byte to a 3-digit octal string, padding with zeros if necessary
            const octalString = byte.toString(8).padStart(3, '0');
            //append the octal string to the output
            output.append(octalString);
        }
    
        return output.toString() as T;
    }

    public fromOctal<T extends Uint8Array=Uint8Array>(input:string):T
    {
        if (input.length % 3 !== 0) this._app.throw('invalid input length', [], {correctable:true});
    
        const uint8Array = new Uint8Array(input.length / 3);
    
        for (let i = 0, j = 0; i < input.length; i += 3, j++) 
        {
            //parse each 3-digit octal string into a byte
            const octalDigit = input.substring(i, i + 3);
            const byte = parseInt(octalDigit, 8);
            if (isNaN(byte) !== false) this._app.throw('invalid input', [], {correctable:true});
    
            uint8Array[j] = byte;
        }
    
        return uint8Array as T;
    }
    
    /**
     * Converts a Uint8Array to a lowercase hexadecimal string.
     * @param input The Uint8Array to convert.
     * @returns The hexadecimal string representation of the input.
     * @throws An error if the input cannot be converted to a hex string.
     */
    public toHex<T extends hex=hex>(input:Uint8Array):T
    {
        const length = input.length;
        const output = this._app.stringUtil.createConcatinator();
        const charset = CharSet.Base16;
            
        for (let i = 0; i < length; i++) 
        {
            const byte = input[i];

            const a = charset[(byte >>> 4) & 0x0f];
            const b = charset[byte & 0x0f];

            if (a === undefined || b === undefined) this._app.throw('invalid input', [], {correctable:true});

            output.append(a + b);
        }
        
        return output.toString() as T;
    }

    /**
     * Converts a hexadecimal string to a Uint8Array. Accepts both uppercase or lowercase characters.
     * 
     * @param input - The hexadecimal string to convert.
     * @returns A Uint8Array representing the converted hexadecimal string.
     * @throws An error if the input string has an invalid length or contains invalid characters.
     */
    public fromHex<T extends Uint8Array=Uint8Array>(input:hex):T
    {
        if (input.length === 0) return new Uint8Array(0) as T;
        if (input.length % 2 !== 0) this._app.throw('invalid input length', [], {correctable:true});

        const length = input.length;

        const charsetMap = getCharsetMap(CharSet.Base16); //the returned map will support both uppercase and lowercase characters
        const uint8Array = new Uint8Array(length / 2);

        let j = 0;
        for (let i = 0; i < length; i += 2) 
        {
            const charCodeA = input.charCodeAt(i);
            const charCodeB = input.charCodeAt(i + 1);
            const a = charsetMap[charCodeA]; //a direct lookup table is significantly slower than calling charCodeAt and then charsetMap (it seems string key lookup, whether on an object or Map is very slow)
            const b = charsetMap[charCodeB];

            if (isNaN(charCodeA) === true || isNaN(charCodeB) === true || a === undefined || b === undefined) this._app.throw('invalid input', [], {correctable:true});
    
            uint8Array[j] = (a << 4) | b;
            ++j;
        }
    
        return uint8Array as T;
    }

    /**
     * Converts an array of bytes (Uint8Array) to a Base24 encoded string.
     * 
     * @static
     * @param {Uint8Array} input - The array of bytes to be encoded.
     * @param {string} [charset=CharSet.Base24] - The charset to be used for encoding.
     * @throws {Error} If the length of the input is not divisible by 4.
     * @returns {string} The Base24 encoded string.
     * 
     * Efficiency: for every 4 bytes, 7 characters are generated. 4 / 7 = 57% efficiency.
     * If padding is enabled, the efficiency is lower, but the length is always divisible by 7.
     * 
     * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
     * @copyright   (c) 2023, John Brandle
     * 
     * @license 
     * 
     * The code from which this method's implementation is derived is licensed under the:
     * 
     * MIT License 
     * 
     * Copyright (c) 2020 Nicolas Goy
     * 
     * For full license text of the original code, refer to the LICENSE file or https://github.com/kuon/js-base24/blob/master/LICENSE-MIT
     */
    public toBase24<T extends base24=base24>(input:Uint8Array, charset:string=CharSet.Base24, paddingChar?:string):T
    {
        const length = input.length;
        const chars = new Array(7);
        const output = this._app.stringUtil.createConcatinator();

        if (paddingChar === undefined || length % 4 === 0)
        {
            if (length % 4 !== 0) this._app.throw('invalid input length', [], {correctable:true});
            
            for (let i = 0; i < length; i += 4) 
            {
                let deaccumulatedValue = ((input[i] << 24) | (input[i + 1] << 16) | (input[i + 2] << 8) | input[i + 3]) >>> 0;
                for (let j = 0; j < 7; j++) 
                {
                    const charIndex = deaccumulatedValue % 24;

                    deaccumulatedValue = (deaccumulatedValue / 24) | 0;
                    const char = charset[charIndex];

                    if (char === undefined) this._app.throw('invalid input', [], {correctable:true});

                    chars[6 - j] = char;
                }
                
                output.append(chars.join(''));
            }
        
            return output.toString() as T;
        }

        let padding = '';
        for (let i = 0; i < length; i += 4) 
        {
            let deaccumulatedValue = 0;
            const remainingBytes = Math.min(4, length - i);
            for (let j = 0; j < 4; j++) 
            {
                if (i + j < length) deaccumulatedValue = (deaccumulatedValue << 8) | input[i + j];
            }

            deaccumulatedValue >>>= 0; //ensure it's unsigned.
            
            for (let j = 0; j < 7; j++) 
            {
                if (j < remainingBytes * 7 / 4) 
                {
                    const charIndex = deaccumulatedValue % 24;
                
                    deaccumulatedValue = (deaccumulatedValue / 24) | 0;
                    const char = charset[charIndex];

                    if (char === undefined) this._app.throw('invalid input', [], {correctable:true});

                    chars[6 - j] = char;
                }
                else padding += chars[6 - j] = paddingChar;
            }
        
            for (const char of chars) 
            {
                if (char !== paddingChar) output.append(char);
            }
        }
    
        output.append(padding);

        return output.toString() as T;
    }
    
    /**
     * Converts a Base24 encoded string to an array of bytes (Uint8Array).
     * 
     * @static
     * @param {string} input - The Base24 encoded string to be decoded.
     * @param {string} [charset=CharSet.Base24] - The charset to be used for decoding.
     * @throws {Error} If the length of the input is not divisible by 7.
     * @returns {Uint8Array} The decoded array of bytes.
     * 
     * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
     * @copyright   (c) 2023, John Brandle
     * 
     * @license 
     * 
     * The code from which this method's implementation is derived is licensed under the:
     * 
     * MIT License 
     * 
     * Copyright (c) 2020 Nicolas Goy
     * 
     * For full license text of the original code, refer to the LICENSE file or https://github.com/kuon/js-base24/blob/master/LICENSE-MIT
     */
    public fromBase24<T extends Uint8Array=Uint8Array>(input:base24, charset:string=CharSet.Base24, paddingChar?:string):T
    {
        const length = input.length;  
        if (length % 7 !== 0) this._app.throw('invalid input length', [], {correctable:true});
    
        const charsetMap = getCharsetMap(charset);
        const output = new Uint8Array(Math.ceil((length / 7) * 4));
        let outputIndex = 0;
        
        if (paddingChar === undefined)
        {    
            for (let i = 0; i < length; i += 7) //char group
            {
                let accumulatedValue = 0;
                for (let j = 0; j < 7; j++) //char group index
                {
                    const charCode = input.charCodeAt(i + j);
                    const charIndex = charsetMap[charCode];

                    if (isNaN(charCode) === true || charIndex === undefined) this._app.throw('invalid input', [], {correctable:true});
        
                    accumulatedValue = (accumulatedValue * 24) + charIndex;
                }
        
                output[outputIndex] = accumulatedValue >>> 24;
                output[outputIndex + 1] = (accumulatedValue >>> 16) & 0xFF;
                output[outputIndex + 2] = (accumulatedValue >>> 8) & 0xFF;
                output[outputIndex + 3] = accumulatedValue & 0xFF;
                outputIndex += 4;
            }
        
            return output as T;
        }

        for (let i = 0; i < length; i += 7) 
        {
            let value = 0;
            let paddingCount = 0;
    
            for (let j = 0; j < 7; j++) 
            {
                const char = input[i + j];
                if (char === paddingChar) 
                {
                    paddingCount++;
                    continue;
                }

                const charCode = input.charCodeAt(i + j);
                const charIndex = charsetMap[charCode];
                
                if (isNaN(charCode) === true || charIndex === undefined) this._app.throw('invalid input', [], {correctable:true});
    
                value = value * 24 + charIndex;
            }
    
            const actualBytes = ((7 - paddingCount) * 4 / 7) | 0;
            for (let j = 0; j < actualBytes; j++) 
            {
                output[outputIndex + actualBytes - j - 1] = value & 0xFF;
                value >>= 8;
            }
            outputIndex += actualBytes;
        }
    
        return output.slice(0, outputIndex) as T;
    }
    
    /**
     * Converts a Uint8Array to a Base32 string.
     * 
     * The input length must be divisible by 5. This allows for a more optimized conversion. No padding is added, because
     * an input length of 5 bytes will result in a 40-bit output, which is divisible by 8.
     * 5 bytes = 40 bits = 8 * 5 bits = 8 * 5 / 5 characters = 8 characters
     * 
     * Note: good for when readability and performance are more important that space savings (but base 16 is too long).
     * Example use: truncated hashes (e.g. SHA-256 -> 255)
     *
     * @param {Uint8Array} input - The input array of bytes to be converted.
     * @returns {string} - The Base32 encoded string.
     * @throws Will throw an error if the input length is not divisible by 5.
     * 
     * Efficiency: for every 5 bytes, 8 characters are generated. 5 / 8 = 62.5% efficiency.
     * If padding is enabled, the efficiency is lower, but the length is always divisible by 8.
     */
    public toBase32<T extends base32=base32>(input:Uint8Array, charset:string=CharSet.Base32, paddingChar?:string):T
    {
        const length = input.length;
        const output = this._app.stringUtil.createConcatinator();

        if (paddingChar === undefined || length % 5 === 0)
        {
            if (length % 5 !== 0) this._app.throw('invalid input length', [], {correctable:true});
            
            for (let i = 0; i < length; i += 5) 
            {
                for (let j = 0; j < 8; j++) 
                {
                    const startBit = j * 5;
                    const byteIndex = (startBit / 8) | 0;
                    const bitIndex = startBit % 8;
                
                    let charBits = (input[i + byteIndex] << 8 | (input[i + byteIndex + 1] || 0)) >> (11 - bitIndex);
                    charBits &= 0x1F;
                
                    output.append(charset[charBits]);
                }
            }
            
            return output.toString() as T;
        }

        for (let i = 0; i < length; i += 5) 
        {
            const bytesInThisChunk = Math.min(5, length - i);
            const paddingInThisRound = (bytesInThisChunk === 5) ? 0 : 8 - Math.ceil((bytesInThisChunk * 8) / 5);
            
            for (let j = 0; j < 8 - paddingInThisRound; j++) 
            {
                const startBit = j * 5;
                const byteIndex = (startBit / 8) | 0;
                const bitIndex = startBit % 8;
            
                let charBits = (input[i + byteIndex] << 8 | (input[i + byteIndex + 1] || 0)) >> (11 - bitIndex);
                charBits &= 0x1F;
            
                output.append(charset[charBits]);
            }
            
            output.append(paddingChar.repeat(paddingInThisRound));
        }
        
        return output.toString() as T;
    }    

    /**
     * Converts a Base32 string to a Uint8Array.
     * 
     * The input length must be divisible by 8. This allows for a more optimized conversion (@see toBase32 for more details). 
     * No padding is expected, because an input length of 8 characters will result in a 40-bit output, which is divisible by 8.
     * 8 characters = 40 bits = 8 * 5 bits = 8 * 5 / 8 bytes = 5 bytes
     *
     * @param {string} input - The Base32 encoded string to be converted.
     * @returns {Uint8Array} - The decoded array of bytes.
     * @throws Will throw an error if the input length is not divisible by 8 or contains invalid characters.
     */
    public fromBase32<T extends Uint8Array=Uint8Array>(input:base32, charset:string=CharSet.Base32, paddingChar?:string):T
    {
        const length = input.length;
        if (length % 8 !== 0) this._app.throw('invalid input length', [], {correctable:true});
    
        const charsetMap = getCharsetMap(charset);

        if (paddingChar === undefined)
        {
            const totalBytes = (length / 8) * 5;
            const output = new Uint8Array(totalBytes);
        
            let outputIndex = 0;
            for (let i = 0; i < length; i += 8) 
            {
                let bufferHigh = 0;  //for storing the 5 most significant bits
                let bufferLow = 0;  //for storing the 35 least significant bits
            
                for (let j = 0; j < 8; j++) 
                {
                    const charCode = input.charCodeAt(i + j);
                    const index = charsetMap[charCode];
    
                    if (isNaN(charCode) === true || index === undefined) this._app.throw('invalid input', [], {correctable:true});
                    
                    bufferHigh = (bufferHigh << 5) | (bufferLow >>> 27);
                    bufferLow = (bufferLow << 5) | index;
                }
        
                //now bufferHigh contains the 5 most significant bits and bufferLow contains the 35 least significant bits. Extract bytes from buffer
                output[outputIndex + 4] = bufferLow & 0xFF;
                output[outputIndex + 3] = (bufferLow >>> 8) & 0xFF;
                output[outputIndex + 2] = (bufferLow >>> 16) & 0xFF;
                output[outputIndex + 1] = (bufferLow >>> 24) & 0xFF;
                output[outputIndex] = bufferHigh & 0xFF;
                outputIndex += 5;
            }
        
            return output as T;
        }
    
        let paddingCount = 0;
        for (let i = length - 1; i >= 0 && input[i] === paddingChar; --i) ++paddingCount;
        
        const totalBytes = ((length - paddingCount) * 5) / 8;
        const output = new Uint8Array(totalBytes | 0);
    
        let outputIndex = 0;
        let buffer = 0;
        let bitsInBuffer = 0;
    
        for (let i = 0; i < length; i++) 
        {
            if (input[i] === paddingChar) break;
    
            const charCode = input.charCodeAt(i);
            const index = charsetMap[charCode];
            if (isNaN(charCode) === true || index === undefined) this._app.throw('invalid input', [], {correctable:true});
    
            buffer = (buffer << 5) | index;
            bitsInBuffer += 5;
    
            while (bitsInBuffer >= 8) 
            {
                bitsInBuffer -= 8;
                output[outputIndex] = buffer >> bitsInBuffer;
                buffer &= (1 << bitsInBuffer) - 1;
                outputIndex++;
            }
        }
    
        return output as T;
    }

    /**
     * Encodes a given Uint8Array into a Base62 string representation.
     *
     * This method is optimized for both performance and compactness. It uses a bitwise manipulation
     * technique to convert each 6 bits in the input array into Base62 characters. The method performs 
     * better than BigInt-based implementations and is competitive with typical Base64 implementations.
     * 
     * @remarks
     * The algorithm checks each 6-bit chunk against a predefined mask (0b00011110) to identify if the chunk
     * should be encoded using just the lower 5 bits. This ensures efficient encoding while retaining the
     * ability to decode the string back accurately.
     * 
     * @param input - The Uint8Array to be encoded.
     * @param charset - The charset to be used for Base62 encoding. Defaults to CharSet.Base62.
     * 
     * @returns The Base62 string representation of the input array.
     * 
     * @example
     * const result = BaseUtil.toBase62(new Uint8Array([10, 20]), "customBase");
     *
     * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
     * @copyright   (c) 2023, John Brandle
     *
     * @license
     * 
     * The code from which this method's implementation is derived is licensed under the:
     * 
     * MIT License 
     * 
     * Copyright (c) 2019 Shawn Wang <jxskiss@126.com>
     * 
     * For full license text of the original code, refer to the LICENSE file or https://github.com/jxskiss/base62/blob/master/LICENSE
     */
    public toBase62<T extends base62=base62>(input:Uint8Array, charset?:CharSet):T;
    public toBase62<T extends base62=base62>(input:string, charset?:CharSet):T;
    public toBase62<T extends base62=base62>(input:Uint8Array | string, charset=CharSet.Base62):T
    {
        if (this._app.typeUtil.isString(input) === true) input = new TextEncoder().encode(input);

        const MASK = 0b00011110; //0x1E 
        const FIVE_BIT_MASK = 0b00011111; //0x1F 
        const SIX_BIT_MASK = 0b00111111; //0x3F 

        let position = input.length * 8;
        const output = this._app.stringUtil.createConcatinator();
        
        while (position > 0) 
        {  
            let chunkSize = 6;

            let remainderBits = position & 7;
            let byteIndex = position >>> 3;
        
            if (remainderBits === 0)
            {
                byteIndex -= 1;
                remainderBits = 8;
            }
        
            let extractedBits = input[byteIndex] >> (8 - remainderBits);
        
            if (remainderBits < 6 && byteIndex > 0) extractedBits |= input[byteIndex - 1] << remainderBits;
        
            let bits = extractedBits & SIX_BIT_MASK;
            
            if ((bits & MASK) === MASK) 
            {
                if (position > 6 || bits > FIVE_BIT_MASK) chunkSize = 5;
                
                bits &= FIVE_BIT_MASK;
            }
            
            output.append(charset[bits]); //appends character to end of string
            position -= chunkSize;
        }
        
        return output.toString() as T;
    }

    /**
     * Decodes a given Base62 string into a Uint8Array.
     *
     * The decoding algorithm uses a lookup table to convert each Base62 character in the input string
     * back to its corresponding 6-bit or 5-bit integer representation. This enables fast and accurate
     * decoding with O(n) time complexity.
     * 
     * @remarks
     * This method also utilizes bitwise manipulation to store the decoded bits efficiently in a Uint8Array. 
     * The algorithm is designed to be compatible with strings encoded by this library's toBase62 method.
     * 
     * @param input - The Base62 string to be decoded.
     * @param charset - The charset to be used for Base62 decoding. Defaults to CharSet.Base62.
     * 
     * @returns The Uint8Array decoded from the input Base62 string.
     * 
     * @throws {Error} When an invalid character is encountered in the input string.
     * 
     * @example
     * const byteArray = BaseUtil.fromBase62("encodedString", "customBase");
     *
     * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
     * @copyright   (c) 2023, John Brandle
     * 
     * @license
     * 
     * The code from which this method's implementation is derived is licensed under the:
     * 
     * MIT License 
     * 
     * Copyright (c) 2019 Shawn Wang <jxskiss@126.com>
     * 
     * For full license text of the original code, refer to the LICENSE file or https://github.com/jxskiss/base62/blob/master/LICENSE
     */
    public fromBase62<T extends Uint8Array>(input:base62, format?:BaseOutputFormat.Uint8Array, charset?:CharSet):T | IError;
    public fromBase62<T extends string>(input:base62, format?:BaseOutputFormat.string, charset?:CharSet):T | IError;
    public fromBase62<T extends Uint8Array | string>(input:base62, format:BaseOutputFormat=BaseOutputFormat.Uint8Array, charset=CharSet.Base62):T | IError
    {        
        try
        {
            const MASK = 0b00011110; //0x1E;
            const charsetMap = getCharsetMap(charset);

            const inputLength = input.length;
            
            const maxOutputLength = Math.ceil((input.length * 6) / 8);
            const output = new Uint8Array(maxOutputLength);
            
            let writeIndex = maxOutputLength;
            let bitPosition = 0;
            let buffer = 0;
            
            for (let readIndex = 0; readIndex < inputLength; readIndex++) 
            {
                const charCode = input.charCodeAt(readIndex);
                const value = charsetMap[charCode];

                if (isNaN(charCode) === true || value === undefined) this._app.throw('invalid input', []);

                buffer |= value << bitPosition;

                if (readIndex === inputLength - 1) bitPosition += log2LookupTable[value] ?? (() => this._app.throw('invalid input', []))();
                else if ((value & MASK) === MASK) bitPosition += 5;
                else bitPosition += 6;

                if (bitPosition >= 8) 
                {
                    output[--writeIndex] = buffer;
                    bitPosition &= 7;
                    buffer >>= 8;
                }
            }
            
            if (bitPosition > 0) output[--writeIndex] = buffer;
            
            const result = output.slice(writeIndex);

            //convert the decoded bytes back to string, if required
            if (format === BaseOutputFormat.string) return new TextDecoder('utf-8').decode(result) as T;
        
            return result as T;
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to decode Base62 string', [input, format, charset], {errorOnly:true, names:[BaseUtil, this.fromBase62]});
        }
    }

    /**
     * Converts a Uint8Array to a Base64-encoded string.
     * 
     * @static
     * @async
     * @param {Uint8Array} input - The Uint8Array to be converted to Base64.
     * @returns {Promise<string>} A Promise that resolves to a Base64-encoded string.
     * @throws {TypeError} If `uint8Array` is not a Uint8Array.
     * @example
     * const uint8Array = new Uint8Array([0x66, 0x6f, 0x6f]);
     * const base64String = await MyClass.toBase64(uint8Array);
     */
    public toBase64<T extends base64=base64>(input:Uint8Array):T;
    public toBase64<T extends base64=base64>(input:string, isLatin1?:boolean):T;
    public toBase64<T extends base64=base64>(input:Uint8Array | string, isLatin1=false):T 
    {
        if (isLatin1 === true)
        {
            const text = btoa(input as string);

            if (this._app.debugUtil.isDebug !== true) return text as T;
        
            for (const char of input as string) //verify that the input is valid latin1 if debug is enabled
            {
                if (char.charCodeAt(0) > 255) this._app.throw('invalid input', [], {correctable:true});
            }
        
            return text as T;
        }

        if (this._app.typeUtil.isString(input) === true) input = new TextEncoder().encode(input);
    
        if (false)
        {
            const _old = (input:Uint8Array) => //this may be faster than the bitwise implementation below. keep it here for reference. btw, webassembly is just slow... (i understand why, but wow)
            {
                const output = this._app.stringUtil.createConcatinator();
                for (let i = 0, length = input.length; i < length; ++i) output.append(String.fromCharCode(input[i])); //for loop is significantly faster than for of in this instance
                
                return btoa(output.toString()) as T;
            }
        }

        const result = this._app.stringUtil.createConcatinator();
        const charset = CharSet.Base64; //string lookups appear to be twice as fast as map lookups and just as fast as array lookups
        const length = input.length;
    
        for (let i = 0; i < length; i += 3) 
        {
            const remaining = length - i;
    
            const byte1 = input[i];
            const byte2 = remaining > 1 ? input[i + 1] : 0;
            const byte3 = remaining > 2 ? input[i + 2] : 0;

            //concatenate the next four characters to the result string
            const index1 = byte1 >> 2;
            const index2 = ((byte1 & 3) << 4) | (byte2 >> 4);
            const index3 = ((byte2 & 15) << 2) | (byte3 >> 6);
            const index4 = byte3 & 63;
        
            result.append(charset[index1] + charset[index2]);
        
            //add the third and fourth characters, if present, or padding
            const paddingLength = (remaining < 3) ? 3 - remaining : 0;
        
            result.append(paddingLength > 1 ? '=' : charset[index3]);
            result.append(paddingLength > 0 ? '=' : charset[index4]);
        }
    
        return result.toString() as T;
    }
    
    /**
     * Converts a base64-encoded string to a Uint8Array.
     *
     * @param {string} input - The base64-encoded string to convert.
     * @return {Uint8Array} The resulting Uint8Array.
     * @example
     * const base64String = "SGVsbG8sIHdvcmxkIQ==";
     * const uint8Array = base64ToUint8Array(base64String);
     * console.log(uint8Array); //Uint8Array(13) [72, 101, 108, 108, 111, 44, 32, 119, 111, 114, 108, 100, 33]
     */
    public fromBase64<T extends Uint8Array>(input:base64, format?:BaseOutputFormat.Uint8Array):T | IError;
    public fromBase64<T extends string>(input:base64, format?:BaseOutputFormat.string, isLatin1?:boolean):T | IError;
    public fromBase64<T extends Uint8Array | string>(input:base64, format:BaseOutputFormat=BaseOutputFormat.Uint8Array, isLatin1=false):T | IError
    {
        try
        {
            if (isLatin1 === true) 
            {
                const text = atob(input); //atob, being a built-in browser function, is faster than our custom implementation
        
                if (this._app.debugUtil.isDebug !== true) return text as T;
                
                for (let i = text.length; i--;)
                {
                    const charCode = text.charCodeAt(i);

                    if (isNaN(charCode) || text.charCodeAt(i) > 255) this._app.throw('invalid input', []);
                }

                return text as T;
            }

            if (false) //this may be faster than the bitwise implementation below. keep it here for reference.
            {
                const _old = () =>
                {
                    const string = atob(input); 
                
                    const length = string.length;
                    const bytes = new Uint8Array(length);
                    for (let i = 0; i < length; ++i) bytes[i] = string.charCodeAt(i);

                    if (format === BaseOutputFormat.Uint8Array) return bytes;

                    return new TextDecoder('utf-8').decode(bytes) as T;
                }
            }

            const charsetMap = getCharsetMap(CharSet.Base64);

            //calculate the length of the output buffer
            const length = input.length;
            let bufferLength = length * 0.75;
            let p = 0;
        
            //ajust buffer length for padding
            if (input[length - 2] === '=') bufferLength -= 2;
            else if (input[length - 1] === '=') --bufferLength;
            
            const result = new Uint8Array(bufferLength);
            for (let i = 0; i < length; i += 4) 
            {
                const charCode1 = input.charCodeAt(i);
                const charCode2 = input.charCodeAt(i + 1);
                const charCode3 = input.charCodeAt(i + 2);
                const charCode4 = input.charCodeAt(i + 3);

                //decode each base64 character to its 6-bit binary representation. using charCodeAt plus an uint8Array lookup is faster than using a single direct string lookup table in chromium
                const encoded1 = charsetMap[charCode1];
                const encoded2 = charsetMap[charCode2];
                const encoded3 = charsetMap[charCode3];
                const encoded4 = charsetMap[charCode4];

                if (isNaN(charCode1) === true || isNaN(charCode2) === true || isNaN(charCode3) === true || isNaN(charCode4) === true || encoded1 === undefined || encoded2 === undefined || encoded3 === undefined || encoded4 === undefined) this._app.throw('invalid input', []);

                //reconstruct each byte from the 6-bit segments
                result[p] = (encoded1 << 2) | (encoded2 >> 4);
                result[p + 1] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
                result[p + 2] = ((encoded3 & 3) << 6) | (encoded4 & 63);
                p += 3;
            }
        
            //convert the decoded bytes back to string, if required
            if (format === BaseOutputFormat.string) return new TextDecoder('utf-8').decode(result) as T;
        
            return result as T;
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to decode base64 string, {}', [input, format, isLatin1], {errorOnly:true, names:[BaseUtil, this.fromBase64]});
        }
    }
}