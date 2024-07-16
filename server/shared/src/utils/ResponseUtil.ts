/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ResponseUtil as Shared } from '../../../../shared/src/library/utils/ResponseUtil.ts';
import { DevEnvironment } from "../../../../shared/src/library/IEnvironment.ts";
import { IBaseApp } from '../library/IBaseApp.ts';

export class ResponseUtil<A extends IBaseApp<A>> extends Shared<A>
{
    public setHeaders = (request:Request, env:CommonEnv, config:Config, response:Response):Response =>
    {
        const origin = request.headers.get('origin');
        const origins = env.environment === DevEnvironment.Dev ? config.local.origins : config.remote.origins;
    
        if (env.environment === DevEnvironment.Dev && request.body && !request.bodyUsed) request.blob(); //fix for bug in miniflare, see: https://github.com/cloudflare/miniflare/issues/577

        try
        {
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Json');
        }
        catch(_error)
        {
            response = new Response(response.body, response);
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Json');    
        }

        if (origin && origins.includes(origin)) response.headers.set('Access-Control-Allow-Origin', origin);

        response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        response.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Content-Encoding, X-Json');
        response.headers.set('Access-Control-Max-Age', '86400'); //24 hours

        return response;
    }

    public setProxyHeaders = (request:Request, env:CommonServiceEnv, config:Config, response:Response):Response =>
    {    
        if (!env.proxyEnabled) return this.setHeaders(request, env, config, response);

        if (env.environment === DevEnvironment.Dev && request.body && !request.bodyUsed) request.blob(); //fix for bug in miniflare, see: https://github.com/cloudflare/miniflare/issues/577

        try
        {
            response.headers.set(env.proxyPassedHeaderName, '1');
        }
        catch(_error)
        {
            response = new Response(response.body, response);
            response.headers.set(env.proxyPassedHeaderName, '1');  
        }

        response.headers.delete(env.proxyKeyHeaderName);
 
        return response;
    }  
}