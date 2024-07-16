/// <reference path="../shared/shared.d.ts" />

//@ts-ignore deno bug requires assert
import type _ProxyConfig from './config.json' assert {type:'json'};

declare global 
{
    type ProxyConfig = typeof _ProxyConfig;
    type ProxyConfigLocal = typeof _ProxyConfig.local;
    type ProxyConfigRemote = typeof _ProxyConfig.remote;
}

export {}