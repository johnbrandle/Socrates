/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IDestructable } from "../../../../../../shared/src/library/IDestructable";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";

export const IInstanceManagerType = Symbol("IInstanceManager");

export interface IInstanceManager<A extends IBaseApp<A>>
{
    parse<T extends IDestructable<A>>(destructor:IDestructor<A>, string:string, options?:{type?:any, defaultArgs?:any[]}):T | undefined;
    parse<T extends IDestructable<A> | WeakKey>(arg1:T extends IDestructor<A> ? IDestructor<A> : string, arg2?:T extends IDestructor<A> ? string: {type?:any, defaultArgs?:any[]}, options?:{type?:any, defaultArgs?:any[]}):T | undefined;
    
    create<T extends IDestructable<A>>(destructor:IDestructor<A>, uid:string, options:{args?:any[], id?:undefined, strong?:false}):T;  
    create<T extends IDestructable<A>>(destructor:IDestructor<A>, uid:string, options:{args?:any[], id:string, strong?:boolean}):T;  
    create<T extends IDestructable<A> | WeakKey>(arg1:T extends IDestructor<A> ? IDestructor<A> : string, arg2?:T extends IDestructor<A> ? string : {args?:any[], id?:string, strong?:false | undefined}, options?:{args?:any[], id:string, strong:boolean} | {args?:any[], id?:undefined, strong?:false}):T | undefined;
    
    get<T extends WeakKey>(id:string):T | undefined;
    has(id:string):boolean;
    set<T extends WeakKey>(id:string, instance:T, options?:{strong?:boolean}):void;
    set<T extends IDestructable<A>>(id:string, instance:T, options?:{strong?:true}):void;
    remove(id:string):void;
}