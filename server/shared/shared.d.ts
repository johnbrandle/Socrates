/// <reference path="../../shared/shared.d.ts" />

declare type EventContext<Env, P extends string, Data> = 
{
    request:Request;
    waitUntil:(promise: Promise<unknown>) => void;
    passThroughOnException:() => void;
    env:Env;
};

export {};