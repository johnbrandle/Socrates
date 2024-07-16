/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { __isBoolean, __isObject } from "../utils/__internal/__is";

@ImplementsDecorator()
export class WeakValueMap<K, V extends WeakKey> implements Iterable<[K, V]> 
{
    #_map:Map<K, WeakRef<V>> = new Map();
    #_finalizationRegistry:FinalizationRegistry<string>;

    constructor(permitNonDeterministicGarbageCollection?:boolean); 
    constructor(iterable?:Iterable<[K, V]>, permitNonDeterministicGarbageCollection?:boolean); 
    constructor(...args:any[]) 
    {
        let permitNonDeterministicGarbageCollection:boolean = false;
        let iterable:Iterable<[K, V]> | undefined;
        if (args.length !== 0)
        {
            if (__isBoolean(args[0]) === true) permitNonDeterministicGarbageCollection = args[0];
            else iterable = args[0];

            if (__isBoolean(args[1]) === true) permitNonDeterministicGarbageCollection = args[1];
        }

        this.#_finalizationRegistry = new FinalizationRegistry((heldValue) => 
        {
            if (permitNonDeterministicGarbageCollection) return;

            console.warn(this.constructor, 'Weak reference collected in WeakValueMap', heldValue);
        });

        if (iterable) 
        {
            for (const [key, value] of iterable) this.set(key, value);
        }
    }

    public set(key:K, value:V) 
    {
        if (__isObject(value) !== true) throw new Error('Invalid value used in weak value map');
     
        this.#_map.set(key, new WeakRef(value));

        //register the WeakRef object with the FinalizationRegistry
        this.#_finalizationRegistry.register(value, value.toString(), value);
    }

    public delete(key:K):boolean 
    {
        const map = this.#_map;

        const weakValueRef = map.get(key);
        if (weakValueRef === undefined) return false;
        
        const derefValue = weakValueRef.deref();
        if (derefValue !== undefined)
        {
            //unregister the WeakRef object with the FinalizationRegistry
            this.#_finalizationRegistry.unregister(derefValue);

            this.#_map.delete(key);
            return true;
        }

        this.#_map.delete(key);  
        return false;
    }

    public has(key:K):boolean 
    {
        const map = this.#_map;

        let value = map.get(key);
        if (value === undefined) return false;

        const derefValue = value.deref();
        if (derefValue === undefined) map.delete(key);

        return derefValue !== undefined;
    }

    public get(key:K):V | undefined 
    {
        const map = this.#_map;

        const weakValueRef = map.get(key);
        if (weakValueRef !== undefined) 
        {
            const derefValue = weakValueRef.deref();
            if (derefValue === undefined) map.delete(key);

            return derefValue;
        }
        
        return undefined;
    }

    *[Symbol.iterator]():IterableIterator<[K, V]> 
    {
        const map = this.#_map;
        for (const [key, weakValueRef] of map.entries()) 
        {
            const derefValue = weakValueRef.deref();

            if (derefValue !== undefined) yield [key, derefValue];
            else map.delete(key);
        }
    }

    public entries():IterableIterator<[K, V]> 
    {
        return this[Symbol.iterator]();
    }    

    public forEach(callback:(key:K, value:V) => void):void 
    {
        for (const [key, value] of this) callback(key, value);
    }

    public get size():number
    {
        let count = 0;
        for (const _ of this) count++;

        return count;
    }
}
