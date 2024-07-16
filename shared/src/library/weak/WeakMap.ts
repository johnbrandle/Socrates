/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { __isBoolean, __isObject } from "../utils/__internal/__is";

@ImplementsDecorator()
export class WeakMap<K extends WeakKey, V extends WeakKey> implements Iterable<[K, V]> 
{
    #_map:Map<WeakRef<K>, WeakRef<V>> = new Map();
    #_finalizationRegistry:FinalizationRegistry<{type:'key' | 'value', value:string}>;

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
            
            console.warn(this.constructor, 'Weak reference collected in WeakMap', heldValue);
        });

        if (iterable) 
        {
            for (const [key, value] of iterable) this.set(key, value);
        }
    }

    public set(key:K, value:V) 
    {
        if (__isObject(key) !== true) throw new Error('Invalid key used in weak map');
        if (__isObject(value) !== true) throw new Error('Invalid value used in weak map');

        this.delete(key);
        this.#_map.set(new WeakRef(key), new WeakRef(value));

        //register the WeakRef objects with the FinalizationRegistry
        this.#_finalizationRegistry.register(key, {type:'key', value:key.toString()}, key);
        this.#_finalizationRegistry.register(value, {type:'value', value:key.toString()}, value);
    }

    public delete(key:K):boolean 
    {
        const map = this.#_map;

        for (const [weakKeyRef, weakValueRef] of map) 
        {
            const derefKey = weakKeyRef.deref();
            if (derefKey === key) 
            {
                const derefValue = weakValueRef.deref();
                if (derefValue !== undefined)
                {
                    //unregister the WeakRef objects with the FinalizationRegistry
                    this.#_finalizationRegistry.unregister(key);
                    this.#_finalizationRegistry.unregister(derefValue);

                    map.delete(weakKeyRef);
                    return true;
                }
                else map.delete(weakKeyRef);
            }
            else if (derefKey === undefined) map.delete(weakKeyRef);
        }
        
        return false;
    }

    public has(key:K):boolean 
    {
        const map = this.#_map;
        for (const [weakKeyRef, weakKeyValue] of map) 
        {
            const derefKey = weakKeyRef.deref();
            if (derefKey === key) 
            {
                const derefValue = weakKeyValue.deref();
                if (derefValue !== undefined) return true;

                map.delete(weakKeyRef);
                return false;
            }
            if (derefKey === undefined) map.delete(weakKeyRef);
        }

        return false;
    }

    public get(key:K):V | undefined 
    {
        const map = this.#_map;
        for (const [weakKeyRef, weakValueRef] of map) 
        {
            const derefKey = weakKeyRef.deref();
            const derefValue = weakValueRef.deref();
            if (derefKey === key && derefValue !== undefined) return derefValue;

            if (derefKey === undefined || derefValue === undefined) map.delete(weakKeyRef);
        }
        
        return undefined;
    }

    *[Symbol.iterator]():IterableIterator<[K, V]> 
    {
        const map = this.#_map;
        for (const [weakKeyRef, weakValueRef] of map) 
        {
            const derefKey = weakKeyRef.deref();
            const derefValue = weakValueRef.deref();

            if (derefKey !== undefined && derefValue !== undefined) yield [derefKey, derefValue];
            else map.delete(weakKeyRef);
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