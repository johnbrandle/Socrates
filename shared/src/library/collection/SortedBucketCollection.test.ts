/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SortedBucketCollection } from "./SortedBucketCollection";
import { TestSuite } from "../test/TestSuite.test";
import { IBaseApp } from "../IBaseApp";
import { CharSet } from "../utils/BaseUtil";

export class SortedBucketCollectionTestSuite<A extends IBaseApp<A>> extends TestSuite<A> 
{
    public override async init():Promise<TestSuite<A>>
    {
        await super.init();

        this.addTest(this.SortedBucketCollection_iterate);
        this.addTest(this.SortedBucketCollection_remove);
        this.addTest(this.SortedBucketCollection_add);
        this.addTest(this.SortedBucketCollection_nested);
        this.addTest(this.SortedBucketCollection_insertionOrder);

        return this;
    }

    async SortedBucketCollection_iterate():Promise<void>
    {
        type Item = {id:string};

        const correctlySortedItems:Item[] = [{id:"aa"}, {id:"ab"}, {id:"ac"}, {id:"ba"}, {id:"bb"}, {id:"bc"}, {id:"ca"}, {id:"cb"}, {id:"cc"}, {id:"fdsdf"}, {id:"fdsdx"}]
        
        const incorrectlySortedItems:Item[] = correctlySortedItems.slice();
        this._app.arrayUtil.randomize(incorrectlySortedItems);

        const sortedSortedBucketSet = new SortedBucketCollection<A, Item>(this._app, ["a", "b", "c", "other"], (item:Item) => 
        {
            if (item.id[0] === "a") return "a";
            if (item.id[0] === "b") return "b";
            if (item.id[0] === "c") return "c";

            return "other";
        }, (a, b) => a.id.localeCompare(b.id), incorrectlySortedItems);

        let i = 0;
        for (const item of sortedSortedBucketSet)
        {
            this.assertTrue(item === correctlySortedItems[i], {id:"SortedBucketSet_iterate"});
            i++;
        }

        this.assertTrue(i === correctlySortedItems.length, {id:"SortedBucketSet_iterate_2"});
    }

    async SortedBucketCollection_remove():Promise<void>
    {
        type Item = {id:string};

        const correctlySortedItems:Item[] = [{id:"aa"}, {id:"ab"}, {id:"ac"}, {id:"ba"}, {id:"bb"}, {id:"bc"}, {id:"ca"}, {id:"cb"}, {id:"cc"}, {id:"fdsdf"}, {id:"fdsdx"}]
        
        const incorrectlySortedItems:Item[] = correctlySortedItems.slice();
        this._app.arrayUtil.randomize(incorrectlySortedItems);

        const sortedSortedBucketSet = new SortedBucketCollection<A, Item>(this._app, ["a", "b", "c", "other"], (item:Item) => 
        {
            if (item.id[0] === "a") return "a";
            if (item.id[0] === "b") return "b";
            if (item.id[0] === "c") return "c";

            return "other";
        }, (a, b) => a.id.localeCompare(b.id), incorrectlySortedItems);

        const removeRandomItem = (array:any[]) => 
        {
            if (array.length === 0) throw new Error("Cannot remove from an empty array.");
        
            const randomIndex = Math.floor(Math.random() * array.length);
            const deleted = array.splice(randomIndex, 1);
            
            return deleted[0];
        }

        while (sortedSortedBucketSet.size > 0)
        {
            const deleted = removeRandomItem(correctlySortedItems);
            sortedSortedBucketSet.delete(deleted);
            
            //check that the arrays still match
            let i = 0;
            for (const item of sortedSortedBucketSet)
            {
                this.assertTrue(item === correctlySortedItems[i], {id:"SortedBucketSet_remove"});
                i++;
            }
            this.assertTrue(i === correctlySortedItems.length, {id:"SortedBucketSet_remove_2"});
        }
    }

    async SortedBucketCollection_add():Promise<void>
    {
        type Item = {id:string};

        const correctlySortedItems:Item[] = [{id:"aa"}, {id:"ab"}, {id:"ac"}, {id:"ba"}, {id:"bb"}, {id:"bc"}, {id:"ca"}, {id:"cb"}, {id:"cc"}]
        
        const incorrectlySortedItems:Item[] = correctlySortedItems.slice();
        this._app.arrayUtil.randomize(incorrectlySortedItems);

        const sortedSortedBucketSet = new SortedBucketCollection<A, Item>(this._app, ["a", "b", "c"], (item:Item) => 
        {
            if (item.id[0] === "a") return "a";
            if (item.id[0] === "b") return "b";
            if (item.id[0] === "c") return "c";

            throw new Error("Invalid item.");
        }, (a, b) => a.id.localeCompare(b.id), incorrectlySortedItems);

        const addRandomItem = (array:any[]) => 
        {
            const randomIndex = Math.floor(Math.random() * array.length);
            const newItem = {id:this._app.textUtil.generate(9, {charset:'abc'})};
            array.splice(randomIndex, 0, newItem);
            
            return newItem;
        }

        while (correctlySortedItems.length < 100)
        {
            let newItem = addRandomItem(correctlySortedItems);
            sortedSortedBucketSet.add(newItem);

            newItem = addRandomItem(correctlySortedItems);
            sortedSortedBucketSet.add(newItem);

            newItem = addRandomItem(correctlySortedItems);
            sortedSortedBucketSet.add(newItem);

            correctlySortedItems.sort((a, b) => a.id.localeCompare(b.id)); //resort the array

            //check that the arrays still match
            let i = 0;
            for (const item of sortedSortedBucketSet)
            {
                this.assertTrue(item.id === correctlySortedItems[i].id, {id:"SortedBucketSet_add"});  //important to compare by name in case of duplicates
                i++;
            }
            this.assertTrue(i === correctlySortedItems.length, {id:"SortedBucketSet_add_2"});
        }
    }

    async SortedBucketCollection_nested():Promise<void>
    {
        type Item = {id:string};

        const nestedSortedSortedBucketSet1 = new SortedBucketCollection<A, Item>(this._app, ["all"], (item:Item) =>
        {   
            return "all";
        }, (a, b) => a.id.localeCompare(b.id), []);

        const nestedSortedSortedBucketSet2 = new SortedBucketCollection<A, Item>(this._app, ["all"], (item:Item) =>
        {   
            return "all";
        }, (a, b) => a.id.localeCompare(b.id), []);

        const nestedSortedSortedBucketSet3 = new SortedBucketCollection<A, Item>(this._app, ["all"], (item:Item) =>
        {   
            return "all";
        }, (a, b) => a.id.localeCompare(b.id), []);

        const correctlySortedItems:Item[] = [{id:"aa"}, {id:"ab"}, {id:"ac"}, {id:"ba"}, {id:"bb"}, {id:"bc"}, {id:"ca"}, {id:"cb"}, {id:"cc"}];
        
        const incorrectlySortedItems:Item[] = correctlySortedItems.slice();
        this._app.arrayUtil.randomize(incorrectlySortedItems);


        const sortedSortedBucketSet1 = new SortedBucketCollection<A, Item>(this._app, ["a", "b", "c", {id:"other", nested:nestedSortedSortedBucketSet1}, {id:"other2", nested:nestedSortedSortedBucketSet2}, {id:"other3", nested:nestedSortedSortedBucketSet3}], (item:Item) => 
        {
            if (item.id[0] === "a") return "a";
            if (item.id[0] === "b") return "b";
            if (item.id[0] === "c") return "c";

            if (item.id[0] === "d") return "other";
            
            return "other3";
        }, (a, b) => a.id.localeCompare(b.id), []);

    
        for (let i = 0; i < 25; i++)
        {
            const newItem = {id:this._app.textUtil.generate(5, {charset:CharSet.Base62})};
            sortedSortedBucketSet1.add(newItem);
        }

        let count = 0;
        for (const item of sortedSortedBucketSet1)
        {
            this.assertTrue(sortedSortedBucketSet1.at(count++) === item, {id:"SortedBucketSet_nested_3a"});
        }

        this.assertTrue(count === 25, {id:"SortedBucketSet_nested_3"});

        const nestedSortedSortedBucketSet4 = new SortedBucketCollection<A, Item>(this._app, ["all"], (item:Item) =>
        {   
            return "all";
        }, (a, b) => a.id.localeCompare(b.id), []);

        const sortedSortedBucketSet = new SortedBucketCollection<A, Item>(this._app, ["a", "b", "c", {id:"other", nested:nestedSortedSortedBucketSet4}], (item:Item) => 
        {
            if (item.id[0] === "a") return "a";
            if (item.id[0] === "b") return "b";
            if (item.id[0] === "c") return "c";

            return "other";
        }, (a, b) => a.id.localeCompare(b.id), incorrectlySortedItems);

        const addRandomItem = (array:any[]) => 
        {
            const randomIndex = Math.floor(Math.random() * array.length);
            const newItem = {id:this._app.textUtil.generate(1, {charset:CharSet.Base62}) + this._app.textUtil.generate(4, {charset:'abc'})};
            array.splice(randomIndex, 0, newItem);
            
            return newItem;
        }

        while (correctlySortedItems.length < 250)
        {
            let newItem = addRandomItem(correctlySortedItems);
            sortedSortedBucketSet.add(newItem);

            newItem = addRandomItem(correctlySortedItems);
            sortedSortedBucketSet.add(newItem);

            newItem = addRandomItem(correctlySortedItems);
            sortedSortedBucketSet.add(newItem);

            correctlySortedItems.sort((a, b) => {
                const firstCharA = a.id[0];
                const firstCharB = b.id[0];
                const specialChars = ['a', 'b', 'c'];
            
                const isSpecialA = specialChars.includes(firstCharA);
                const isSpecialB = specialChars.includes(firstCharB);
            
                if (isSpecialA && !isSpecialB) {
                    return -1; //names starting with 'a', 'b', or 'c' come first
                } else if (!isSpecialA && isSpecialB) {
                    return 1; //other names come after
                } else {
                    //sort alphabetically by the entire name
                    return a.id.localeCompare(b.id);
                }
            });
            
            //check that the arrays still match
            let i = 0;
            const collect:[string, string][] = [];
            for (const item of sortedSortedBucketSet)
            {
                collect.push([item.id, correctlySortedItems[i].id]);
                if (item.id !== correctlySortedItems[i].id) 
                {
                    this.log(collect);
                    debugger;
                }
                this.assertTrue(item.id === correctlySortedItems[i].id, {id:"SortedBucketSet_nested"}); //important to compare by name in case of duplicates
                i++;
            }
            this.assertTrue(i === correctlySortedItems.length, {id:"SortedBucketSet_nested_2"});
        }
    }

    async SortedBucketCollection_insertionOrder():Promise<void>
    {
        type Item = {id:string};

        const correctlySortedItems:Item[] = [{id:"aa"}, {id:"ab"}, {id:"ac"}, {id:"ba"}, {id:"bb"}, {id:"bc"}, {id:"ca"}, {id:"cb"}, {id:"cc"}]
        
        const sortedSortedBucketSet = new SortedBucketCollection<A, Item>(this._app, ["a", "b", "c"], (item:Item) => 
        {
            if (item.id[0] === "a") return "a";
            if (item.id[0] === "b") return "b";
            if (item.id[0] === "c") return "c";

            throw new Error("Invalid item.");
        }, (a, b) => a.id.localeCompare(b.id), correctlySortedItems);

        let offset = 0;
        while (sortedSortedBucketSet.size < 100)
        {
            const newItem = {id:"ab"};

            sortedSortedBucketSet.add(newItem);

            this.assertTrue(sortedSortedBucketSet.at(2 + offset) === newItem, {id:"SortedBucketSet_insertionOrder"});
            this.assertTrue(sortedSortedBucketSet[Symbol.iterator](2 + offset).next().value === newItem, {id:"SortedBucketSet_insertionOrder_2"});
            offset++;
        }
    }
}