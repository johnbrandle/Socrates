/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { BaseOutputFormat, CharSet, hex, type base24, type base32, type base62, type base64 } from "./BaseUtil";
import { TestSuite } from "../test/TestSuite.test";
import { IBaseApp } from "../IBaseApp";

export class BaseUtilTestSuite<A extends IBaseApp<A>> extends TestSuite<A> 
{
    public override async init():Promise<TestSuite<A>>
    {
        await super.init();

        this.addTest(this.BaseUtil_toHex);
        this.addTest(this.BaseUtil_fromHex);

        this.addTest(this.BaseUtil_toBase24);
        this.addTest(this.BaseUtil_fromBase24);

        this.addTest(this.BaseUtil_toBase32);
        this.addTest(this.BaseUtil_fromBase32);

        this.addTest(this.BaseUtil_toBase62);
        this.addTest(this.BaseUtil_fromBase62);

        this.addTest(this.BaseUtil_toBase64);
        this.addTest(this.BaseUtil_fromBase64);

        return this;
    }

    async BaseUtil_toHex():Promise<string>
    {
        let input = "Hello World!";
        let output = this._app.baseUtil.toHex(this._app.textUtil.toUint8Array(input));
        let expected = '48656c6c6f20576f726c6421';
        this.assertEquals(output, expected, {id:"toHex"});
        
        //only faster than toHex because it's inlined, otherwise this implementation should be slightly slower (chromium is making optimizations)
        const toHexInlined = (input:Uint8Array):string =>
        {
            const output = this._app.stringUtil.createConcatinator();
            for (let i = 0, length = input.length; i < length; i++) 
            {
                const hex = input[i].toString(16);

                output.append(hex.length < 2 ? '0' + hex : hex);
            }
            
            return output.toString();
        }

        let timeA = 0;
        let timeB = 0;
        for (let i = 10000; i > 1; i--)
        {
            const uint8Array = this._app.textUtil.toUint8Array(i.toString());

            const a1 = performance.now();
            const a = toHexInlined(uint8Array);
            timeA += performance.now() - a1;

            const b1 = performance.now();
            const b = this._app.baseUtil.toHex(uint8Array);
            timeB += performance.now() - b1;

            this.assertEquals(a, b, {id:"base16"});
        }

        return `toHexInlined: ${Math.floor(timeA)}, toHex: ${Math.floor(timeB)}`;
    }

    async BaseUtil_fromHex():Promise<string>
    {
        let input = "48656c6c6f20576f726c6421" as hex;
        let output = this._app.baseUtil.fromHex(input);
        let expected = this._app.textUtil.toUint8Array("Hello World!");
        this.assertEquals(output, expected, {id:"fromHex"});

        const fromHexInlined = (input:string):Uint8Array =>
        {
            const output = new Uint8Array(input.length / 2);
            for (let i = 0, length = input.length; i < length; i += 2) 
            {
                output[i / 2] = parseInt(input.substr(i, 2), 16);
            }
            
            return output;
        }

        let timeA = 0;
        let timeB = 0;
        for (let i = 10000; i > 1; i--)
        {
            const base16Encoded = this._app.baseUtil.toHex(this._app.textUtil.toUint8Array(i.toString()));

            const a1 = performance.now();
            const a = fromHexInlined(base16Encoded);
            timeA += performance.now() - a1;

            const b1 = performance.now();
            const b = this._app.baseUtil.fromHex(base16Encoded);
            timeB += performance.now() - b1;

            this.assertEquals(a, b, {id:"fromHexEquals"});
        }
        
        //ensure that fromHex can handle random bytes of various lengths
        for (let i = 1000; i-=2;) 
        {
            const bytes = i === 0 ? new Uint8Array() : this._app.byteUtil.generate(i , {insecure:true});
            
            const a = this._app.baseUtil.toHex(bytes);
            const b = this._app.baseUtil.fromHex(a);

            this.assertEquals(bytes, b, {id:"randombytes", details:`length: ${i}`, onFail: () => console.log(bytes)});
        }

        return `fromHexInlined: ${Math.floor(timeA)}, fromHex: ${Math.floor(timeB)}`;
    }

    async BaseUtil_toBase24():Promise<string>
    {
        const input = 'Hello World!!!!!';
        const output = this._app.baseUtil.toBase24(this._app.textUtil.toUint8Array(input), CharSet.Base24);
        const expected = 'ACHY5PVER5F73ZF345M634XTAV3E';
        this.assertEquals(output, expected, {id:"toBase24"});

        let bytes = new Uint8Array([0, 0, 0, 0, 127, 128, 255, 34]);
        const expected3 = '2222222G6MKH3F';
        const output3 = this._app.baseUtil.toBase24(bytes, CharSet.Base24);
        this.assertEquals(output3, expected3, {id:"toBase24_3"});

        let timeA = 0;
        for (let i = 1024; i > 1; i-=4) 
        {
            const bytes = this._app.byteUtil.generate(1024, {insecure:true});

            const a1 = performance.now();
            const b = this._app.baseUtil.toBase24(bytes, CharSet.Base24);
            const b1 = this._app.baseUtil.fromBase24(b, CharSet.Base24);
            timeA += performance.now() - a1;

            //validate that both methods produce the same output
            this.assertEquals(bytes, b1, {id:"toBasevsToBase24", details: `length: ${i}`, onFail: () => console.log(bytes)});

            //assert is multiple of 7
            this.assertEquals(b.length % 7, 0, {id:"toBase24MultipleOf7"});
        }

        let timeB = 0;
        for (let i = 256; i > 1; i--) 
        {
            const bytes = this._app.byteUtil.generate(1025, {insecure:true});

            const b2 = performance.now();
            const b = this._app.baseUtil.toBase24(bytes, CharSet.Base24, '=');
            const b1 = this._app.baseUtil.fromBase24(b, CharSet.Base24, '=');
            timeB += performance.now() - b2;

            //validate that both methods produce the same output
            this.assertEquals(bytes, b1, {id:"toBasevsToBase24", details: `length: ${i}`, onFail: () => console.log(bytes)});

            //assert is multiple of 7
            this.assertEquals(b.length % 7, 0, {id:"toBase24MultipleOf7"});
        }

        for (let i = 256; i > 1; i--)  //ensure it can handle various lengths
        {
            const bytes = this._app.byteUtil.generate(i, {insecure:true});

            const b = this._app.baseUtil.toBase24(bytes, CharSet.Base24, '=');
            const b1 = this._app.baseUtil.fromBase24(b, CharSet.Base24, '=');
        
            //validate that both methods produce the same output
            this.assertEquals(bytes, b1, {id:"toBasevsToBase24", details: `length: ${i}`, onFail: () => console.log(bytes)});

            //assert is multiple of 7
            this.assertEquals(b.length % 7, 0, {id:"toBase24MultipleOf7"});
        }

        return `base24: ${Math.floor(timeA)}, base24_padding: ${Math.floor(timeB)}`;
    }

    async BaseUtil_fromBase24():Promise<void>
    {
        let input = 'ACHY5PVER5F73ZF345M634XTAV3E'as base24;
        let output = this._app.baseUtil.fromBase24(input, CharSet.Base24);
        let expected = this._app.textUtil.toUint8Array('Hello World!!!!!');
        this.assertEquals(output, expected, {id:"fromBase24"});

        expected = new Uint8Array([0, 0, 0, 0, 127, 128, 255, 34]);
        output = this._app.baseUtil.fromBase24('2222222G6MKH3F' as base24, CharSet.Base24);
        this.assertEquals(output, expected, {id:"fromBase24_3"});
    }

    async BaseUtil_toBase32():Promise<void>
    {
        const input = 'Hello World!!!!';
        const output = this._app.baseUtil.toBase32(this._app.textUtil.toUint8Array(input), CharSet.Base32);
        const expected = 'JBSWY3DPEBLW64TMMQQSCIJB'

        this.assertEquals(output, expected, {id:"toBase32"});

        let bytes = new Uint8Array([6, 154, 195, 217, 29]);
        const expected3 = 'A2NMHWI5';
        const output3 = this._app.baseUtil.toBase32(bytes, CharSet.Base32);
        this.assertEquals(output3, expected3, {id:"toBase32_3"});

        //multiple of 5, no padding, test
        for (let i = 1000; i > 1; i-=5) 
        {
            const bytes = this._app.byteUtil.generate(i, {insecure:true});
            
            const b = this._app.baseUtil.toBase32(bytes, CharSet.Base32);
            const b1 = this._app.baseUtil.fromBase32(b, CharSet.Base32);

            //validate that both methods produce the same output
            this.assertEquals(bytes, b1, {id:"toBasevsToBase32", details: `length: ${i}`, onFail: () => console.log(bytes)});

            //assert is multiple of 8
            this.assertEquals(b.length % 8, 0, {id:"toBase32MultipleOf8"});
        }

        //any byte length, with padding, test
        for (let i = 6; i > 1; i--) 
        {
            const bytes = this._app.byteUtil.generate(i, {insecure:true});
            
            const b = this._app.baseUtil.toBase32(bytes, CharSet.Base32, '=');
            const b1 = this._app.baseUtil.fromBase32(b, CharSet.Base32, '=');

            //validate that both methods produce the same output
            this.assertEquals(bytes, b1, {id:"toBasevsToBase32", details: `length: ${i}`, onFail: () => console.log(bytes)});

            //assert is multiple of 8
            this.assertEquals(b.length % 8, 0, {id:"toBase32MultipleOf8"});
        }
    }

    async BaseUtil_fromBase32():Promise<string>
    {
        let input = 'JBSWY3DPEBLW64TMMQQSCIJB' as base32;
        let output = this._app.baseUtil.fromBase32(input, CharSet.Base32);
        let expected = this._app.textUtil.toUint8Array('Hello World!!!!');

        this.assertEquals(output, expected, {id:"fromBase32"});

        expected = new Uint8Array([6, 154, 195, 217, 29]);
        input = 'A2NMHWI5' as base32;
        output = this._app.baseUtil.fromBase32(input, CharSet.Base32);
        this.assertEquals(output, expected, {id:"fromBase32_3"});

        //multiple of 5, no padding, performance test
        const bytes = this._app.byteUtil.generate(1000, {insecure:true});
        let timeA = performance.now();
        for (let i = 10000; i--;) 
        {
            const b = this._app.baseUtil.toBase32(bytes, CharSet.Base32);
            const b1 = this._app.baseUtil.fromBase32(b, CharSet.Base32);

            //validate that both methods produce the same output
            this.assertEquals(bytes, b1, {id:"toBasevsToBase32", details: `length: ${i}`, onFail: () => console.log(bytes)});
        }

        return `${Math.floor(performance.now() - timeA)} ms`;
    }

    async BaseUtil_toBase62():Promise<void>
    {
        const input = 'Hello World!!!!';
        const a = this._app.textUtil.toUint8Array(input);
        const output = this._app.baseUtil.toBase62(this._app.textUtil.toUint8Array(input));
        const b = this._app.textUtil.toUint8Array(output);
        let expected = 'hESIhQGby92Vg8GbsVGS';
        this.assertEquals(output, expected, {id:"toBase62"});

        const encoded = 'AnsKpf4LjmAqjG' as base62;
        let c = this._app.baseUtil.fromBase62(encoded, BaseOutputFormat.Uint8Array, CharSet.Base62);
        let expected1 = new Uint8Array([209, 212, 4, 209, 151, 199, 233, 42, 201, 192]);
        this.assertEquals(c, expected1, {id:"fromBase62"});

        for (let i = 10000; i > 1; i--) 
        {
            const bytes = this._app.byteUtil.generate(i, {insecure:true});
            
            const b = this._app.baseUtil.toBase62(bytes, CharSet.Base62);
            const b1 = this._app.baseUtil.fromBase62(b, BaseOutputFormat.Uint8Array, CharSet.Base62);

            //validate that both methods produce the same output
            this.assertEquals(bytes, b1, {id:"toBasevsToBase62", details: `length: ${i}`, onFail: () => console.log(bytes)});
        }
    }

    async BaseUtil_fromBase62():Promise<string>
    {
        const input = 'hESIhQGby92Vg8GbsVGS' as base62;
        const output = this._app.baseUtil.fromBase62(input);
        const expected = this._app.textUtil.toUint8Array('Hello World!!!!');
        this.assertEquals(output, expected, {id:"fromBase62"});

        //performance test
        const bytes = this._app.byteUtil.generate(1000, {insecure:true});
        let timeA = performance.now();
        for (let i = 10000; i--;) 
        {   
            const b = this._app.baseUtil.toBase62(bytes, CharSet.Base62);
            const b1 = this._app.baseUtil.fromBase62(b, BaseOutputFormat.Uint8Array, CharSet.Base62);

            //validate that both methods produce the same output
            this.assertEquals(bytes, b1, {id:"toBasevsToBase62", details: `length: ${i}`, onFail: () => console.log(bytes)});
        }

        return `${Math.floor(performance.now() - timeA)} ms`;
    }

    async BaseUtil_toBase64():Promise<string>
    {
        let base64 = this._app.baseUtil.toBase64("Hello World!");
        this.assertEquals(base64, "SGVsbG8gV29ybGQh", {id:"helloWorld"});

        //test string that will have 2 padding characters
        base64 = this._app.baseUtil.toBase64("A");
        this.assertEquals(base64, "QQ==", {id:"twoPaddingCharacters"});
        
        //test string that will have 1 padding character
        base64 = this._app.baseUtil.toBase64("AA");
        this.assertEquals(base64, "QUE=", {id:"onePaddingCharacter"});

        //generating a string from a byte array that covers 0 to 63 (Base64 character set)
        let chars = Array.from({length: 64}, (_, i) => String.fromCharCode(i)).join("");
        base64 = this._app.baseUtil.toBase64(chars);
        this.assertEquals(base64, 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+Pw==', {id:"allBase64Chars"});

        //test against btoa
        let timeA = 0;
        let timeB = 0;
        const app = this._app;
        for (let i = 10000; i > 1; i--)
        {
            const string = i.toString();
            
            const a1 = performance.now();
            const a = btoa(string);
            timeA += performance.now() - a1;

            const b1 = performance.now();
            const b = app.baseUtil.toBase64(string);
            timeB += performance.now() - b1;

            this.assertEquals(a, b, {id:"base64"});    
        }

        return `btoa: ${Math.floor(timeA)}, toBase64: ${Math.floor(timeB)}`;
    }

    async BaseUtil_fromBase64():Promise<string>
    {
        //test fromBase64 converting back to a Uint8Array
        let input = "SGVsbG8gV29ybGQh" as base64;  //"Hello World!" in base64
        let output = this._app.baseUtil.fromBase64(input, BaseOutputFormat.Uint8Array);
        let expected = new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]);  //byte values of "Hello World!"
        this.assertEquals(output, expected, {id:"fromBase64Uint8Array"});
        
        //test fromBase64 converting back to a string
        input = "SGVsbG8gV29ybGQh" as base64;  //"Hello World!" in base64
        let output2 = this._app.baseUtil.fromBase64(input, BaseOutputFormat.string);
        let expected2 = "Hello World!";
        this.assertEquals(output2, expected2, {id:"fromBase64String"});
        
        //test fromBase64 with default format (assumed to be Uint8Array)
        input = "SGVsbG8gV29ybGQh" as base64;  //"Hello World!" in base64
        output = this._app.baseUtil.fromBase64(input);
        expected = new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]);  //byte values of "Hello World!"
        this.assertEquals(output, expected, { id: "fromBase64Default" });
        
        //test 2 padding characters
        input = "QQ==" as base64; //"A" in base64
        output = this._app.baseUtil.fromBase64(input, BaseOutputFormat.Uint8Array);
        expected = new Uint8Array([65]);  //byte value of "A"
        this.assertEquals(output, expected, {id:"twoPaddingCharactersUint8Array"});
        
        //test 1 padding character
        input = "QUE=" as base64; //"AA" in base64
        output = this._app.baseUtil.fromBase64(input, BaseOutputFormat.Uint8Array);
        expected = new Uint8Array([65, 65]);  //byte value of "AA"
        this.assertEquals(output, expected, {id:"onePaddingCharacterUint8Array"});
        
        //test invalid characters
        //await this.assertThrows(() => this._app.baseUtil.fromBase64("Inv@lid" as base64), {id:"invalidCharacters"});
        
        let timeA = 0;
        let timeB = 0;
        const app = this._app;
        
        for (let i = 10000; i > 1; i--) 
        {
            //generate a random base64 string
            const base64Encoded = this._app.baseUtil.toBase64(this._app.textUtil.toUint8Array(i.toString()));

            //measure performance of atob
            const a1 = performance.now();
            const a = atob(base64Encoded);
            timeA += performance.now() - a1;

            //measure performance of BaseUtil.fromBase64
            const b1 = performance.now();
            const b = app.baseUtil.fromBase64(base64Encoded, BaseOutputFormat.string);
            timeB += performance.now() - b1;

            //validate that both methods produce the same output
            this.assertEquals(a, b, {id:"fromBase64Equals"});
        }

        const uint8Array = this._app.byteUtil.generate(10000, {insecure:true});
        const base64Data = this._app.baseUtil.toBase64(uint8Array) as base64;
        const uint8Array2 = this._app.baseUtil.fromBase64(base64Data, BaseOutputFormat.Uint8Array);

        this.assertEquals(uint8Array, uint8Array2, {id:"fromBase64Uint8ArrayEquals"});

        //ensure that fromBase64 can handle random bytes of various lengths
        for (let i = 1000; i--;) 
        {
            const bytes = i === 0 ? new Uint8Array() : this._app.byteUtil.generate(i, {insecure:true});
            
            const a = this._app.baseUtil.toBase64(bytes);
            const b = this._app.baseUtil.fromBase64(a);

            this.assertEquals(bytes, b, {id:"randombytes", details: `length: ${i}`, onFail: () => console.log(bytes)});
        }

        return `atob: ${Math.floor(timeA)}, fromBase64: ${Math.floor(timeB)}`;
    }
}