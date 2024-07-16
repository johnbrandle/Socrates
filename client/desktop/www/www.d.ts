/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

/// <reference path="../desktop.d.ts" />

declare module '*.yaml' 
{
    const content:any;
    export default content;
}

declare module '*.html' 
{
    const content:any;
    export default content;
}

declare module '*.css' 
{
    const content:any;
    export default content;
}

declare module 'buffer'
{
    const content:any;
    export default content;
}

declare module 'mp4box'
{
    const content:any;
    export default content;
}

declare module 'FFmpegWASM'
{
    export class FFmpeg
    {
        constructor();

        load(any:any):Promise<void>;
        writeFile(string:string, uint8Array:Uint8Array):Promise<void>;
        exec(array:Array<any>):Promise<void>;
        readFile(string:string):Promise<Uint8Array>;
        on(event:string, callback:Function):void;
        off(event:string, callback:Function):void;
        terminate():void;
    }
}

declare module 'hash-wasm'
{
    type IDataType = string | Buffer | Uint8Array | Uint16Array | Uint32Array;
    type OutputType = 'hex' | 'binary';
    interface IHasher 
    {
        init:() => IHasher;
        update:(data: IDataType) => IHasher;
        digest: <T extends OutputType>(outputType: T) => T extends 'hex' ? string : Uint8Array;
        save:() => Uint8Array; //returns the internal state for later resumption
        load:(state: Uint8Array) => IHasher; //loads a previously saved internal state
        blockSize:number; //in bytes
        digestSize:number; //in bytes
    }

    export function sha256(data:IDataType):Promise<string>;
    export function createSHA256():Promise<IHasher>;
}

interface Element 
{
    component:import("./src/library/components/IComponent").IComponent<any>;
    html:string;
}

type IProgress = import('./src/pre/progress/IProgress').IProgress;

interface Navigator
{
    userAgentData:any;
}

declare module 'node:perf_hooks' 
{
    export class FinalizationRegistry<T> 
    {
        constructor(callback:(heldValue:T) => void);

        register(target:object, heldValue:T, unregisterToken?:object): void;
        unregister(unregisterToken: object): void;
    }
}

interface Window 
{        
    environment:import('./src/app/IEnvironment').IEnvironment;

    addEventListener(type:"transferWindow", listener:(ev:TransferWindowCustomEvent) => any, options?:boolean | AddEventListenerOptions):void;
    removeEventListener(type:"transferWindow", listener:(ev:TransferWindowCustomEvent) => any, options?:boolean | AddEventListenerOptions):void;
}

type WebpackModule = any;

interface WebpackContext
{
    (key:string):WebpackModule; //function to get module by key
    keys:() => string[]; //array of all possible keys
    id:number; //the context module id, helpful for hot module replacement
    resolve:(key: string) => string; //function to get the full path of the module by key
}

interface NodeRequire
{
    context:(directory:string, useSubdirectories?:boolean, regExp?:RegExp, mode?:string) => WebpackContext;
}
 
interface TransferWindowCustomEventDetail 
{
    type:'load' | 'close';
    window:Window;
    transferID:string;
}
  
interface TransferWindowCustomEvent extends CustomEvent 
{
    detail:TransferWindowCustomEventDetail;
}

interface WindowEventMap
{
    consolelog:string;
}

//https://transform.tools/json-to-typescript (could be useful)