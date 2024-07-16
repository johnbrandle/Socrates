/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IError } from "../error/IError";
import { IBaseApp } from "../IBaseApp";

export interface IStorageTree 
{
    [key:string]:
    {
        storages:Set<string>, 
        keys:string[]
    }
};

export const IStorageType = Symbol("IStorage");

export interface IStorage<A extends IBaseApp<A>> extends IBaseStorageAPI<A>
{
    transaction(func:(batchAPI:ITransactionAPI<A>) => Promise<true | IError | void>, batchAPI?:ITransactionAPI<A>):Promise<true | IError>; //true if the transaction operations were successful, false otherwise

    getStructure():Promise<IStorageTree | IError>; //warning: very expensive operation (depending on the specific underyling db implementation), but should be fine as it is only likely to be used for clear (which shouldn't be called too often, if ever. _keys, but deep should almost always be false. and for debugging purposes)

    get id():string;

    get app():A;
}

export const ITransactionAPIType = Symbol("ITransactionAPI");

export interface ITransactionAPI<A extends IBaseApp<A>> extends IBaseStorageAPI<A>
{
    belongsTo(storage:IStorage<A>):boolean; //true if the transaction belongs to the specified storage, false otherwise
}

export const IBaseStorageAPIType = Symbol("IBaseStorageAPI");

interface IBaseStorageAPI<A extends IBaseApp<A>>
{
    set<T extends BasicType>(key:string, value:T):Promise<true | IError>;
    set<T extends BasicType>(keys:Array<string>, values:Array<T>):Promise<true | IError>;

    get<T extends BasicType>(key:string, isOkayIfNotExists?:false):Promise<T | IError>;
    get<T extends BasicType>(key:string, isOkayIfNotExists:true):Promise<T | undefined | IError>;
    get<T extends [BasicType[]]>(keys:Array<string>, isOkayIfNotExists?:false):Promise<{[K in keyof T]: T[K]} | IError>;
    get<T extends [BasicType[]]>(keys:Array<string>, isOkayIfNotExists:true):Promise<{[K in keyof T]: T[K] | undefined} | IError>;
    
    find<T extends BasicType>(...query:any):Promise<Array<T> | IError>; //expensive operation
    keys():Promise<Array<string> | IError>; //expensive operation
    
    has(key:string):Promise<boolean | IError>;

    remove(key:string):Promise<true | IError>;
    remove(keys:Array<string>):Promise<true | IError>;

    clear():Promise<true | IError>;
}