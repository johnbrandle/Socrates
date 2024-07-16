/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { __isBoolean, __isObject } from "../utils/__internal/__is";

@ImplementsDecorator()
export class WeakSet<T extends WeakKey> implements Iterable<T> 
{
    #_set:Set<WeakRef<T>> = new Set();
    #_finalizationRegistry:FinalizationRegistry<string>;

    constructor(permitNonDeterministicGarbageCollection?:boolean); 
    constructor(iterable?:Iterable<T>, permitNonDeterministicGarbageCollection?:boolean); 
    constructor(...args:any[]) 
    {
        let permitNonDeterministicGarbageCollection:boolean = false;
        let iterable:Iterable<T> | undefined;
        if (args.length !== 0)
        {
            if (__isBoolean(args[0]) === true) permitNonDeterministicGarbageCollection = args[0];
            else iterable = args[0];

            if (__isBoolean(args[1]) === true) permitNonDeterministicGarbageCollection = args[1];
        }

        this.#_finalizationRegistry = new FinalizationRegistry((heldValue) => 
        {
            if (permitNonDeterministicGarbageCollection) return;

            console.warn(this.constructor, 'Weak reference collected in WeakSet', heldValue);
        });

        if (iterable)
        {
            for (const item of iterable) this.add(item);
        }
    }
  
    public add(value:T) 
    {
        if (__isObject(value) !== true) throw new Error('Invalid value used in weak set');
        
        this.#_set.add(new WeakRef(value));

        //register the WeakRef object with the FinalizationRegistry
        this.#_finalizationRegistry.register(value, value.toString(), value);
    }
  
    public delete(value:T) 
    {
        const set = this.#_set;

        for (const ref of set) 
        {
            const deref = ref.deref();
            if (deref === value) 
            {
                //unregister the WeakRef objects with the FinalizationRegistry
                this.#_finalizationRegistry.unregister(deref);

                set.delete(ref);
                return true;
            }
            else if (deref === undefined) set.delete(ref);
        }

        return false;
    }
  
    public has(value:T) 
    {
        const set = this.#_set;
        for (const ref of set) 
        {
            const deref = ref.deref();
            if (deref === value) return true;
            if (deref === undefined) set.delete(ref);
        }
        
        return false;
    }
  
    *[Symbol.iterator]():IterableIterator<T> 
    {
        const set = this.#_set;
        for (const ref of set) 
        {
            const deref = ref.deref();
            if (deref !== undefined) yield deref;
            else set.delete(ref);
        }
    }

    public entries():IterableIterator<T> 
    {
        return this[Symbol.iterator]();
    }

    public forEach(callback:(value:T) => void) 
    {
        for (const value of this) callback(value);
    }

    public get size():number
    {
        let count = 0;
        for (const _ of this) count++;

        return count;
    }
}