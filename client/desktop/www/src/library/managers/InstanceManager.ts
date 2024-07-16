/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp.ts";
import { IDestructableType, type IDestructable } from "../../../../../../shared/src/library/IDestructable.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { PromiseTransition } from "../components/view/transition/PromiseTransition.ts";
import { Transition } from "../components/view/transition/Transition.ts";
import { None } from "../components/view/transition/effects/None.ts";
import { Opacity } from "../components/view/transition/effects/Opacity.ts";
import { Slide } from "../components/view/transition/effects/Slide.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import { WeakValueMap } from "../../../../../../shared/src/library/weak/WeakValueMap.ts";
import { IInstanceManagerType, type IInstanceManager } from "./IInstanceManager.ts";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator.ts";

/**
 * Manages instances of objects and provides methods for creating, getting, setting, and removing instances.
 */
@ImplementsDecorator(IInstanceManagerType)
export class InstanceManager<A extends IBaseApp<A>> extends DestructableEntity<A> implements IInstanceManager<A>
{
    private _weakValueMap:WeakValueMap<string, WeakKey> = new WeakValueMap();
    private _map:Map<string, WeakKey> = new Map();

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }

    /**
     * Parses a string representation of an object and returns the corresponding object instance.
     * @param string - The string representation of the object.
     * @returns The parsed object instance, or undefined if the string cannot be parsed.
     * 
     * if the string has the format '${id}', the instance with the specified id will be returned.
     * if the string has the format 'new uid(foo, bar)', an instance of the class with the specified uid will be created.
     */
    
    parse<T extends IDestructable<A>>(destructor:IDestructor<A>, string:string, options?:{type?:any, defaultArgs?:any[]}):T | undefined;
    parse<T extends IDestructable<A> | WeakKey>(arg1:T extends IDestructor<A> ? IDestructor<A> : string, arg2?:T extends IDestructor<A> ? string:{type?:any, defaultArgs?:any[]}, options?:{type?:any, defaultArgs?:any[]}): T | undefined;
    public parse<T extends IDestructable<A> | WeakKey>(...args:unknown[]):T | undefined
    {
        let destructor:IDestructor<A> | undefined;
        let string:string;
        let options:{type?:any, defaultArgs?:any[]} | undefined;
        if (this._app.typeUtil.isString(args[0]) !== true) [destructor, string, options] = args as [IDestructor<A>, string, {type?:any, defaultArgs?:any[]}];
        else [string, options] = args as [string, {type?:any, defaultArgs?:any[]}];

        const Type = options?.type;
        const defaultArgs = options?.defaultArgs || [];

        if (string.startsWith('${') === true && string.endsWith('}') === true) 
        {
            const result = this.get(string.substring(2, string.length - 1)) as T | undefined;
            if (result === undefined || Type === undefined) return result;

            if (this._app.typeUtil.is(result, Type) !== true) this._app.throw('instance with id is not of type', [string, Type]);

            return result;
        }
        if (string.startsWith('new ') !== true) return undefined;

        const getValue = (string:string):any =>
        {
            switch (string)
            {
                case 'true':
                    return true;
                case 'false':
                    return false;
                case 'undefined':
                    return undefined;
            }

            if (string.startsWith('"') === true && string.endsWith('"') === true) return string.substring(1, string.length - 1);
            if (string.startsWith("'") === true && string.endsWith("'") === true) return string.substring(1, string.length - 1);

            if (string.startsWith('{') === true && string.endsWith('}') === true)
            {
                const obj = JSON.parse(string);
                for (const [key, value] of obj) obj[key] = getValue(value);
                return obj;
            }

            if (string.startsWith('[') === true && string.endsWith(']') === true)
            {
                const array = JSON.parse(string);
                for (let j = array.length; j--;) array[j] = getValue(array[j]);
                return array;
            }

            const number = Number(string);
            if (isNaN(number) === false) return number;

            const object = this.parse(string);
            if (object !== undefined) return object;
            
            return string;
        }

        string = string.substring(4, string.length);
        const uid = string.split('(')[0];
        const args1:any[] = string.split('(')[1].split(')')[0].split(',');
        if (args1.length === 1 && args1[0] === '') args1.length = 0;

        for (let i = args1.length; i--;) args1[i] = getValue(args1[i]);
        
        const result = destructor !== undefined ? this.create<IDestructable<A>>(destructor, uid, {args:args1.length > 0 ? args1 : defaultArgs}) as T | undefined : this.create<WeakKey>(uid, {args:args1.length > 0 ? args1 : defaultArgs}) as T | undefined;
        if (result === undefined || Type === undefined) return result;

        if (this._app.typeUtil.is(result, Type) !== true) this._app.throw('instance with id is not of type', [string, Type]);

        return result;
    }

    /**
     * Creates an instance of a class based on the provided UID.
     * @param uid The unique identifier for looking up the class to create the instance from.
     * @param options The options for creating the instance.
     * @param options.args The arguments to pass to the constructor.
     * @param options.id The ID to assign to the instance.
     * @param options.strong Whether to hold a strong reference to the instance.
     * @returns The created instance.
     * @throws Error if the UID is invalid.
     * 
     * Note: if an id is provided, the instance will be stored in a map and can be retrieved using the get method.
     * Note: if strong is true, the instance must be an observable.
     * 
     * Note: if an arg starts with '${' and ends with '}', it will be replaced with the instance with the specified id (if it exists)
     */
    public create<T extends IDestructable<A>>(destructor:IDestructor<A>, uid:string, options:{args?:any[], id?:undefined, strong?:false}):T;  
    public create<T extends IDestructable<A>>(destructor:IDestructor<A>, uid:string, options:{args?:any[], id:string, strong?:boolean}):T;  
    public create<T extends IDestructable<A> | WeakKey>(arg1:T extends IDestructor<A> ? IDestructor<A> : string, arg2?:T extends IDestructor<A> ? string : {args?:any[], id?:string, strong?:false | undefined}, options?:{args?:any[], id:string, strong:boolean} | {args?:any[], id?:undefined, strong?:false}):T | undefined;
    public create<T extends IDestructable<A> | WeakKey>(...args:unknown[]):T | undefined
    {
        if (this._app.typeUtil.isString(args[0]) !== true)
        {
            const [destructor, uid, options] = args as [IDestructor<A>, string, {args?:any[], id?:string, strong:true}];

            switch (uid)
            {
                case 'transition:Transition':
                    return this._create(destructor, Transition, options) as T;
                case 'transition:Promise':
                    return this._create(destructor, PromiseTransition, options) as T;
                case 'effect:Slide':
                    return this._create(destructor, Slide, options) as T;
                case 'effect:None':
                    return this._create(destructor, None, options) as T;
                case 'effect:Opacity':
                    return this._create(destructor, Opacity, options) as T;
                default:
                    this._app.throw('invalid uid', [uid]);
            }
        }
        else
        {
            const [uid, options] = args as [string, {args?:any[], id?:string, strong?:false | undefined}];

            switch (uid)
            {
                default:
                    this._app.throw('invalid uid', [uid]);
            }
        }
    }

    /**
     * Creates and returns an instance of type T.
     * 
     * @template T - The type of the instance to create.
     * @param Constructor - The constructor function of the instance.
     * @param options - Optional parameters for creating the instance.
     * @param options.args - An array of arguments to pass to the constructor.
     * @param options.id - The unique identifier for the instance.
     * @param options.strong - A boolean indicating whether the instance should be stored strongly.
     * @returns The created instance of type T.
     * @throws Error if an instance with the same id already exists, or if the instance is not registered with the observable manager when it is an IObservable, or if the instance is not an observable when options.strong is true.
     * 
     * Note: if an arg starts with '${' and ends with '}', it will be replaced with the instance with the specified id (if it exists)
     */
    protected _create<T extends IDestructable<A>>(destructor:IDestructor<A>, Constructor:new (...args:any[]) => T, options?:{args?:any[], id?:string, strong?:boolean}):T;
    protected _create<T extends IDestructable<A> | WeakKey>(arg1:T extends IDestructor<A> ? IDestructor<A> : (new (...args:any[]) => T), arg2?:T extends IDestructor<A> ? string : {args?:any[], id?:string, strong?:boolean}, options?:{args?:any[], id?:string, strong?:boolean}):T | undefined;
    protected _create<T extends IDestructable<A> | WeakKey>(...args:any[]):T
    {
        let destructor:IDestructor<A> | undefined;
        let Constructor:new (...args:any[]) => T;
        let options:{args?:any[], id?:string, strong?:boolean} | undefined;
        if (this._app.typeUtil.isString(args[0]) !== true) [destructor, Constructor, options] = args as [IDestructor<A>, new (...args:any[]) => T, {args?:any[], id?:string, strong:true}];
        else [Constructor, options] = args as [new (...args:any[]) => T, {args?:any[], id?:string, strong:true}];

        if (options?.id !== undefined && this.has(options.id) !== false) this._app.throw('instance with id already exists', [options.id]);

        if (options?.args !== undefined)
        {
            for (let i = options.args.length; i--;)
            {
                const arg = options.args[i];

                if (this._app.typeUtil.isString(arg) !== true) continue;
                if (arg.startsWith('${') === false || arg.endsWith('}') === false) continue;
                
                const id = arg.substring(2, arg.length - 1);
                const instance = this.get(id);
                
                if (instance === undefined) 
                {
                    this.warn(`instance with id ${id} not found`);
                    continue;
                }

                options.args[i] = instance;
            }
        }

        const cargs = options?.args ?? [];
        if (destructor !== undefined) cargs.unshift(this._app, destructor);
        const instance = new Constructor(...cargs);

        if (options?.id !== undefined) 
        {
            if (this._app.typeUtil.is<IDestructable<A>>(instance, IDestructableType) === true) 
            {
                if (this._app.observableManager.isRegistered(instance) === false) this._app.throw('instance with id is not registered with the observable manager', [options.id]);
            }
            else if (options.strong === true) this._app.throw('instance with id is not destructable', [options.id]);
            
            //@ts-ignore
            this.set(options.id, instance, {strong:options.strong});
        }

        return instance;
    }

    /**
     * Retrieves the value associated with the specified id from the InstanceManager.
     * @param id The id of the value to retrieve.
     * @returns The value associated with the specified id, or undefined if the id is not found.
     */
    public get<T extends WeakKey>(id:string):T | undefined
    {
        return this._weakValueMap.get(id) as T | undefined;
    }

    /**
     * Checks if an instance with the specified ID exists.
     * 
     * @param id - The ID of the instance to check.
     * @returns True if an instance with the specified ID exists, false otherwise.
     */
    public has(id:string):boolean
    {
        return this._weakValueMap.has(id);
    }

    /**
     * Sets an instance with the specified ID.
     * 
     * @template T - The type of the instance.
     * @param id - The ID of the instance.
     * @param instance - The instance to set.
     * @param options - The options for setting the instance.
     * @param options.strong - If true, holds a strong reference to the instance to prevent it from being garbage collected.
     */
    public set<T extends IDestructable<A>>(id:string, instance:T, options:{strong:true}):void;
    public set<T extends WeakKey>(id:string, instance:T, options:{strong:false | undefined}):void;
    public set<T extends IDestructable<A> | WeakKey>(id:string, instance:T, options:{strong?:boolean}):void
    {
        this._weakValueMap.set(id, instance);

        if (options.strong === true) this._map.set(id, instance); //hold a strong reference, so it doesn't get garbage collected
    }
    
    /**
     * Removes an instance with the specified ID from the manager.
     * @param id - The ID of the instance to remove.
     */
    public remove(id:string):void
    {
        this._weakValueMap.delete(id);
        this._map.delete(id);
    }
}