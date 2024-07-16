/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ErrorCode } from '../../../../shared/src/app/json/ErrorJSON.ts';
import config from '../../../../shared/config.json' assert {type:'json'};
import { IService } from '../../shared/src/core/IService.ts';
import { DevEnvironment } from '../../../../shared/src/library/IEnvironment.ts';
import type { IBaseApp } from '../../../../shared/src/library/IBaseApp.ts';

const allowedForwardingRequestHeaders = {'accept':true, 'accept-encoding':true, 'accept-language':true, 'content-length':true, 'content-type':true, 'x-json':true}; //white list

//deno-lint-ignore no-empty-interface
export interface Env extends CommonServiceEnv
{
}

globalThis.environment =
{
    frozen:
    {
        isPlainTextMode:false,
        isLocalhost:false,
        config:config,
        devEnvironment:DevEnvironment.Prod,
        isDebug:false
    },
    isDevToolsOpen:false
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class ProxyService<A extends IBaseApp<A>> implements IService
{
    private _app:A;

    private _env:Env;

    constructor(app:A, environment:DevEnvironment, _localConfig:ProxyConfigLocal)
    {
        this._app = app;

        this._env = {environment:environment,
                     proxyEnabled:true,

                     proxyKeyHeaderName:'xy-proxy-key',
                     proxyPassedHeaderName:'xy-proxy-passed',
                     serviceKeyHeaderName:'xy-service-key',
                     adminKeyHeaderName:'xy-admin-key',
                    
                     proxyKey:'UUID',
                     serviceKey:'',
                     adminKey:'',
        };
    }

    async fetch(request:Request, env:Env, context:ExecutionContext):Promise<Response> 
    {
        try
        {
            const valid = await this._app.requestUtil.validate(request, context.remoteAddress, env, config);
            if (valid instanceof Response) return this._app.responseUtil.setHeaders(request, env, config, valid);

            const url = new URL(request.url); //parse the URL of the request
            
            const searchParams = url.searchParams;
            const keys = Array.from(searchParams.keys());

            if (keys.length === 0)
            {
                const response = this._app.responseUtil.error({error:ErrorCode.GLOBAL_UNSUPPORTED_COMMAND, details:'proxy, unsupported command 1, ' + request.url});
                return this._app.responseUtil.setHeaders(request, env, config, response);
            }
    
            type workerType = typeof config.local.workers;
            const workerName = keys[0] as keyof workerType;
    
            const value:string = decodeURIComponent(searchParams.get(workerName) || '');
            
            const workerURL = env.environment === 'dev' ? config.local.workers[workerName] : config.remote.workers[workerName]; //find the worker URL in the config file
    
            if (!workerURL || !value) 
            {
                const response = this._app.responseUtil.error({error:ErrorCode.GLOBAL_UNSUPPORTED_COMMAND, details:'proxy, unsupported command 2, ' + request.url});
                return this._app.responseUtil.setHeaders(request, env, config, response);
            }
            
            const proxiedRequest = new Request(`${workerURL}${value}`, {method:request.method, headers:request.headers, body:request.body}); //create a new request to the worker with the provided path value
    
            const headers = Array.from(proxiedRequest.headers);  //remove headers that could be used to identify the user
            for (let i = headers.length; i--;)
            {
                const header = headers[i];
    
                if (header[0].toLowerCase() in allowedForwardingRequestHeaders) continue;
                
                proxiedRequest.headers.delete(header[0]);
            }
    
            proxiedRequest.headers.set(env.proxyKeyHeaderName, env.proxyKey);
    
            let response:Response = await fetch(proxiedRequest); //fetch the response from the worker
            if (!response || !response.ok || !response.headers.has(env.proxyPassedHeaderName)) 
            {
                if (response && response.ok) this._app.consoleUtil.warn({name:'fetch'}, await response.text());
                response = this._app.responseUtil.error({error:ErrorCode.PROXY_FETCH_FAILED, 'details':'unknown failure 1'}); //very important. if this header is not present, a 500 error probably occured (we don't want to return this, as it will have info such as the secret proxy key in it)
            }
    
            return this._app.responseUtil.setHeaders(request, env, config, response);
        }
        catch(error)
        {
            return this._app.responseUtil.setHeaders(request, env, config, this._app.responseUtil.error({error:ErrorCode.PROXY_FETCH_FAILED, details:'unknown failure 2'}, error));
        }
	}

    get env():CommonServiceEnv
    {
        return this._env;
    }
}