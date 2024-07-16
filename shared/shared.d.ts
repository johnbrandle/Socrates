/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

//@ts-ignore because of deno requiring assert
import type config from './config.json' assert {type:"json"};

declare global
{
    interface CompressionStream 
    {
        readonly readable:ReadableStream<Uint8Array>;
        readonly writable:WritableStream<Uint8Array>;
    }
    
    interface CompressionStreamConstructor 
    {
        new(algorithm:string):CompressionStream;
    }
    
    interface JsonObject 
    {
        [key:string]:string | number | boolean | undefined | JsonObject | JsonArray | undefined;
    }

    interface JsonArray extends Array<string | number | boolean | undefined | JsonObject | JsonArray> {}

    type BasicType = string | number | boolean | undefined | JsonObject | JsonArray;

    type ConfigGlobal = typeof config.global;
    type ConfigLocal = typeof config.local;
    type ConfigRemote = typeof config.remote;

    interface Config
    {
        global:ConfigGlobal;
        local:ConfigLocal;
        remote:ConfigRemote;
    }

    interface RequestContext<T extends CommonEnv>
    {
        request:Request;
        env:T;
    }

    interface CommonEnv 
    {
        environment:import('./src/library/IEnvironment.ts').DevEnvironment;
    }

    interface CommonServiceEnv extends CommonEnv 
    {
        proxyEnabled:boolean;

        proxyKeyHeaderName:string;
        proxyPassedHeaderName:string;
        serviceKeyHeaderName:string;
        adminKeyHeaderName:string;
        
        proxyKey:string; //private key shared by this and proxy, so we can verify proxy request came from proxy
        serviceKey:string; //private key for worker to worker communication (proxy uses proxy_key instead)
        adminKey:string; //private key for admin access (request must have both the serviceKey and adminKey to gain access)
    }

    //type ErrorJSONObject = import('./src/json/ErrorJSON').ErrorJSONObject;

    interface ErrorConstructor
    {
        captureStackTrace:any;
    }

    var environment:import ('./src/library/IEnvironment').IEnvironment;
}

export {};