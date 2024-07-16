/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { DevEnvironment } from '../../../../../shared/src/library/IEnvironment.ts';
import { IService } from './IService.ts';

export class HTTP2Server
{
    private _service:IService;

    constructor(service:IService)
    {
        this._service = service;
    }

    public init(options:Deno.ServeOptions, tlsOptions:Deno.ServeTlsOptions | undefined)
    {
        Deno.serve({...options, ...tlsOptions}, (request:Request, info:Deno.ServeHandlerInfo) => 
        { 
            const waitUntil = (_promise:Promise<unknown>) => {}
            const passThroughOnException = () => {};
            const context = {waitUntil:waitUntil, passThroughOnException:passThroughOnException, remoteAddress:info.remoteAddr.hostname};

            return this._service.fetch(request, this._service.env, context);
        });

        if (options.port !== 443) return;

        Deno.serve({port:80}, (request:Request, _info:Deno.ServeHandlerInfo) => 
        {
            const url = new URL(request.url);
            if (this._service.env.environment !== DevEnvironment.Dev) url.protocol = 'https:';
            url.port = (options.port || 443).toString();
            
            return Response.redirect(url, 301);
        });
    }
}