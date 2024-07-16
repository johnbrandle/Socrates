/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "../IBaseApp";
import { TestSuite } from "../test/TestSuite.test";

export class ArrayUtilTestSuite<A extends IBaseApp<A>> extends TestSuite<A> 
{
    public override async init():Promise<TestSuite<A>>
    {
        await super.init();

        this.addTest(this.ArrayUtil_toArray);
        this.addTest(this.ArrayUtil_distribute);
        this.addTest(this.ArrayUtil_shuffle);

        return this;
    }

    async ArrayUtil_toArray():Promise<void>
    {
        const set = new Set(["foo", "bar", "baz", "foo"]);
        const array = this._app.arrayUtil.to(set);

        this.assertTrue(array.length === 3, {id:"length"}); //3 because set has 3 unique values
        this.assertTrue(array[0] === "foo", {id:"foo"});
        this.assertTrue(array[1] === "bar", {id:"bar"});
        this.assertTrue(array[2] === "baz", {id:"baz"});
        this.assertFalse(array[3] === "foo", {id:"foo_2"});
    }

    async ArrayUtil_distribute():Promise<void>
    {
        const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const maxLength = 3;
        const result = this._app.arrayUtil.distribute(array, maxLength);

        this.assertTrue(result.length === 3, {id:"length"}); //3 because because maxLength is 3
        this.assertTrue(result[0].length === 4, {id:"group_1_length"});
        this.assertTrue(result[1].length === 3, {id:"group_2_length"});
        this.assertTrue(result[2].length === 3, {id:"group_3_length"});
        this.assertTrue(result[0][0] === 1, {id:"group_1_element_1"});
        this.assertTrue(result[0][1] === 2, {id:"group_1_element_2"});
        this.assertTrue(result[0][2] === 3, {id:"group_1_element_3"});
        this.assertTrue(result[0][3] === 4, {id:"group_1_element_4"});
        this.assertTrue(result[1][0] === 5, {id:"group_2_element_1"});
        this.assertTrue(result[1][1] === 6, {id:"group_2_element_2"});
        this.assertTrue(result[1][2] === 7, {id:"group_2_element_3"});
        this.assertTrue(result[2][0] === 8, {id:"group_3_element_1"});
        this.assertTrue(result[2][1] === 9, {id:"group_3_element_2"});
        this.assertTrue(result[2][2] === 10, {id:"group_3_element_3"});
    }

    async ArrayUtil_shuffle():Promise<void>
    {
        const array = [1, 2, 3, 4, 5];
        this._app.arrayUtil.randomize(array);

        this.assertTrue(array.length === 5, {id:"length"});
        this.assertTrue(array.includes(1), {id:"includes_1"});
        this.assertTrue(array.includes(2), {id:"includes_2"});
        this.assertTrue(array.includes(3), {id:"includes_3"});
        this.assertTrue(array.includes(4), {id:"includes_4"});
        this.assertTrue(array.includes(5), {id:"includes_5"});

        //call shuffle many times and check for random distribution
        const results = new Map<number, number>();
        const iterations = 300000;
        const array2 = [1, 2, 3, 4];
        for (let i = 0; i < iterations; i++)
        {
            this._app.arrayUtil.randomize(array2);

            const index = array2.indexOf(1);
            if (results.has(index) === false) results.set(index, 0);
            results.set(index, results.get(index)! + 1);
        }

        const expected = iterations / array2.length;
        const tolerance = expected * .015; //1.5% tolerance
        
        this.assertTrue(results.get(0)! >= expected - tolerance && results.get(0)! <= expected + tolerance, {id:"distribution_1"});
        this.assertTrue(results.get(1)! >= expected - tolerance && results.get(1)! <= expected + tolerance, {id:"distribution_2"});
        this.assertTrue(results.get(2)! >= expected - tolerance && results.get(2)! <= expected + tolerance, {id:"distribution_3"});
        this.assertTrue(results.get(3)! >= expected - tolerance && results.get(3)! <= expected + tolerance, {id:"distribution_4"});
    }
}