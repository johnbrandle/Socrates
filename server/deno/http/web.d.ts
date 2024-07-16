/// <reference path="../shared/shared.d.ts" />

//@ts-ignore deno bug requires assert
import type _WebConfig from './config.json' assert {type:'json'};

declare global 
{
    type WebConfig = typeof _WebConfig;
    type WebConfigLocal = typeof _WebConfig.local;
    type WebConfigRemote = typeof _WebConfig.remote;
}

export {}