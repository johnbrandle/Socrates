/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { __is } from "../utils/__internal/__is";

export class TwoWayMap<K, V>
{
    private _typeK:any;
    private _typeV:any;

    private _map:Map<K, V>;
    private _reverseMap:Map<V, K>;
    
    constructor(typeK:any, typeV:any, initialValues?:Iterable<readonly [K, V]>) 
    {
        if (typeK == typeV) throw new Error('types cannot be the same');
        this._typeK = typeK;
        this._typeV = typeV;

        let map = this._map = new Map(initialValues);
        let reverseMap = this._reverseMap = new Map();
        map.forEach((value, key) => reverseMap.set(value, key));
    }
    
    public clear():void 
    {
        this._map.clear();
        this._reverseMap.clear();
    }
    
    public delete(keyOrValue:K|V):boolean 
    {
        if (__is(keyOrValue, this._typeK))
        {
            let reverseMap = this._reverseMap;
            for (let [key, value] of reverseMap) 
            {
                if (value !== keyOrValue) continue; 
                
                reverseMap.delete(key);
                break;
            }
    
            return this._map.delete(keyOrValue as K);
        }
        
        if (__is(keyOrValue, this._typeV))
        {
            let map = this._map;
            for (let [key, value] of map) 
            {
                if (value !== keyOrValue) continue; 
                
                map.delete(key);
                break;
            }
    
            return this._reverseMap.delete(keyOrValue as V);
        }

        return false;
    }
    
    public forEach(callbackfn:(value:V, key:K, map:Map<K, V>) => void, thisArg?:any):void 
    {
        this._map.forEach(callbackfn, thisArg);
    }

    public forEachValues(callbackfn:(value:K, key:V, map:Map<V, K>) => void, thisArg?:any):void 
    {
        this._reverseMap.forEach(callbackfn, thisArg);
    }
    
    public get(keyOrValue:K|V):K|V | undefined 
    {
        if (__is(keyOrValue, this._typeK)) return this._map.get(keyOrValue as K);
        if (__is(keyOrValue, this._typeV)) return this._reverseMap.get(keyOrValue as V);

        return undefined;
    }
    
    public has(keyOrValue:K|V):boolean 
    {
        if (__is(keyOrValue, this._typeK)) return this._map.has(keyOrValue as K);
        if (__is(keyOrValue, this._typeV)) return this._reverseMap.has(keyOrValue as V);

        return false;
    }
    
    public set(keyOrValue:K|V, valueOrKey:V|K):this 
    {
        if (__is(keyOrValue, this._typeK) && __is(valueOrKey, this._typeV)) 
        {
            this._map.set(keyOrValue as K, valueOrKey as V);
            this._reverseMap.set(valueOrKey as V, keyOrValue as K);
        } 
        else if (__is(keyOrValue, this._typeV) && __is(valueOrKey, this._typeK)) 
        {
            this._map.set(valueOrKey as K, keyOrValue as V);
            this._reverseMap.set(keyOrValue as V, valueOrKey as K);
        }

        return this;
    }

    public get size():number 
    {
        return this._map.size;
    }
}