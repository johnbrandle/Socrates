/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { interfaceMap } from "../../decorators/ImplementsDecorator";

/**
 * A cache map that keeps track of interfaces implemented by objects.
 * - `interfaces`: A set containing symbols representing interfaces that the object constructor implements.
 * - `lastCurrentPrototypeChecked`: The last prototype in the object's prototype chain that was checked.
 *   Helps in reducing redundant checks by continuing from where it left off in subsequent checks.
 */
const interfacesCacheMap = new WeakMap<new (...args: any[]) => any, {interfaces:Set<symbol>, lastCurrentPrototypeChecked:any}>();

export function __is<T>(object:any, Type:any):object is T;
export function __is<T>(object:any, Type:symbol, ...additionalTypes:symbol[]):object is T;
export function __is<T>(object:any, Type:any, ...additionalTypes:symbol[]):object is T
{
    if (typeof Type === 'symbol')
    {
        if (object === null || object === undefined) return false;
        
        //retrieve the existing object mapping or initialize if it doesn't exist
        const constructor = object.constructor;
        if (constructor === undefined) throw new Error('Object has no constructor: ' + object);

        let obj = interfacesCacheMap.get(constructor);
        if (obj === undefined) 
        {
            obj = {interfaces:new Set<symbol>(), lastCurrentPrototypeChecked:object};
            interfacesCacheMap.set(constructor, obj);
        }
        else if (obj.interfaces.has(Type) || (additionalTypes.length > 0 && additionalTypes.some(Type => obj?.interfaces.has(Type)))) return true; //return true if the object has the interface cached
        else if (obj.lastCurrentPrototypeChecked === null) return false; //return false if we previously finished checking the entire prototype chain
        
        //iterate through the object's prototype chain to search for interfaces
        const interfaces = obj.interfaces;
        let currentPrototype = obj.lastCurrentPrototypeChecked !== null ? Object.getPrototypeOf(object) : null;
        while (currentPrototype !== null) 
        {
            const interfaceSet:Set<symbol> | Error | undefined = interfaceMap.get(currentPrototype.constructor);
            if (interfaceSet instanceof Error) throw interfaceSet;
            if (interfaceSet !== undefined) 
            {
                //cache all found interfaces to the object's set of interfaces
                for (const interfaceSymbol of interfaceSet) interfaces.add(interfaceSymbol);   

                //update the last current prototype checked
                obj.lastCurrentPrototypeChecked = currentPrototype;

                //return true if the searched interface is found
                if (interfaces.has(Type) || (additionalTypes.length > 0 && additionalTypes.some(Type => obj?.interfaces.has(Type)))) return true;
            }

            //move to the next prototype in the chain
            currentPrototype = Object.getPrototypeOf(currentPrototype);
        }         
        
        //set currentPrototype to null indicating the end of the prototype chain
        obj.lastCurrentPrototypeChecked = null;

        return false;
    }

    const objectType = typeof object;

    switch (objectType) 
    {
        case 'boolean':
            return Type === Boolean;
        case 'number':
            if (isNaN(object) === true) return false; //we do not accept NaN as a valid Type, so we return false
            return Type === Number;
        case 'bigint':
            return Type === BigInt;
        case 'string':
            return Type === String;
        case 'symbol':
            return Type === Symbol;
        case 'undefined':
            return Type === undefined;
        case 'object':
            if (object === null) return Type === null;
            if (Array.isArray(object) === true) return Type === Array;
            break;       
    }

    return object instanceof Type;
}

export const __isBoolean = (any:any):any is boolean => typeof any === 'boolean';
export const __isString = (any:any):any is string => typeof any === 'string'; //will not catch boxed strings, but we shouldn't be using them anyway. typeof is fast, so we will not bother with doing slower instanceof call to check for boxed strings.
export const __isObject = (any:any):any is object => any !== null && typeof any === 'object'; //we are not counting null as being an object