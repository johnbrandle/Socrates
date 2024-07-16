/// <reference path="../../shared/shared.d.ts" />

declare global 
{
    interface ExecutionContext 
    {
        waitUntil(promise: Promise<unknown>):void;
        passThroughOnException():void;
        remoteAddress:string;
    }
}

export {}