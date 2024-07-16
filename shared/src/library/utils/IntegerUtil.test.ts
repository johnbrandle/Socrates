/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "../IBaseApp";
import { TestSuite } from "../test/TestSuite.test";
import { uint } from "./IntegerUtil";

export class IntegerUtilTestSuite<A extends IBaseApp<A>> extends TestSuite<A> 
{
    public override async init():Promise<TestSuite<A>>
    {
        await super.init();
     
        this.addTest(this.IntegerUtil_to_from_uint8Array);
        this.addTest(this.IntegerUtil_getRandomInteger);

        return this;
    }

    public async IntegerUtil_to_from_uint8Array():Promise<string>
    {

        const ff = Number.MAX_SAFE_INTEGER as uint;
        const bigEndianResult = this._app.integerUtil.toUint8Array(ff, false);
        const littleEndianResult = this._app.integerUtil.toUint8Array(ff, true);

//        console.log(littleEndianResult, bigEndianResult);


        const bigEndianResult2 = this._app.integerUtil.fromUint8Array(bigEndianResult, false);
        const littleEndianResult2 = this._app.integerUtil.fromUint8Array(littleEndianResult, true);

  //      console.log(littleEndianResult2, bigEndianResult2);

        return '';
    }

    public async IntegerUtil_getRandomInteger():Promise<string>
    {
        const numbers:Map<number, number> = new Map();
        const length = 300000;
        const array = this._app.integerUtil.generate(length, 300 as uint, 302 as uint);   
        for (let i = 0; i < length; i++) 
        {
            const number = array[i];

            if (numbers.has(number) === false) numbers.set(number, 0);
            numbers.set(number, numbers.get(number)! + 1);
        }

        const expected = length / 3;
        const tolerance = expected * .015; //1.5% tolerance
        for (const [number, count] of numbers) this.assertTrue(count >= expected - tolerance && count <= expected + tolerance, {id:`${number} count ${count} is not within tolerance of ${expected}`});
        
        let string = `max: ${Math.floor(expected + tolerance)}, min: ${Math.floor(expected - tolerance)} : `;
        for (const [number, count] of numbers) string += `${number}: ${count}, `;

        return string;
    }
}