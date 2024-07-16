/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { __isBoolean, __isObject } from "../utils/__internal/__is";

@ImplementsDecorator()
export class WeakKeyMap<K extends WeakKey, V> implements Iterable<[K, V]> 
{
    #_map:Map<WeakRef<K>, V> = new Map();
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
            
            console.warn(this.constructor, 'Weak reference collected in WeakKeyMap', heldValue);
        });

        if (iterable) 
        {
            for (const [key, value] of iterable) this.set(key, value);
        }
    }

    public set(key:K, value:V) 
    {
        if (__isObject(key) !== true) throw new Error('Invalid key used in weak key map');

        this.delete(key);
        this.#_map.set(new WeakRef(key), value);

        //register the WeakRef object with the FinalizationRegistry
        this.#_finalizationRegistry.register(key, key.toString(), key);
    }

    public delete(key:K):boolean 
    {
        const map = this.#_map;

        for (const [weakRef, _] of map) 
        {
            const derefKey = weakRef.deref();
            if (derefKey === key) 
            {
                //unregister the WeakRef object with the FinalizationRegistry
                this.#_finalizationRegistry.unregister(key);

                map.delete(weakRef);
                return true;
            }
            else if (derefKey === undefined) map.delete(weakRef);
        }
    
        return false;
    }

    public has(key:K):boolean
    {
        const map = this.#_map;
        for (const [weakRef, _] of map) 
        {
            const derefKey = weakRef.deref();
            if (derefKey === key) return true;
            if (derefKey === undefined) map.delete(weakRef);
        }
        
        return false;
    }

    public get(key:K):V | undefined 
    {
        const map = this.#_map;
        for (const [weakRef, value] of map) 
        {
            const derefKey = weakRef.deref();
            if (derefKey === key) return value;
            if (derefKey === undefined) map.delete(weakRef);
        }
    
        return undefined;
    }

    *[Symbol.iterator]():IterableIterator<[K, V]>
    {
        const map = this.#_map;
        for (const [weakRef, value] of map) 
        {
            const derefKey = weakRef.deref() as K;
            if (derefKey !== undefined) yield [derefKey, value];
            else map.delete(weakRef);
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

    public clear():void
    {
        for (const [key, _] of this) this.delete(key);
    }
}
