/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ErrorCode } from '../../../../shared/src/app/json/ErrorJSON.ts';
import { App } from '../../shared/src/app/App.ts';
import config from '../../../../shared/config.json' assert {type:"json"};
import { DevEnvironment } from '../../../../shared/src/library/IEnvironment.ts';

export interface Env extends CommonServiceEnv
{
}

const environment = globalThis.environment =
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

const _app = new App(environment);
type A = typeof _app;

const allowedForwardingRequestHeaders = {'accept':true, 'accept-encoding':true, 'accept-language':true, 'content-length':true, 'content-type':true, 'x-json':true}; //white list

////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export default 
{
	async fetch(request:Request, env:Env, context:ExecutionContext):Promise<Response> 
    {
        try
        {
            const valid = await _app.requestUtil.validate(request, request.headers.get('cf-connecting-ip') || '', env, config);
            if (valid instanceof Response) return _app.responseUtil.setHeaders(request, env, config, valid);
    
            const url = new URL(request.url); //parse the URL of the request
            
            const searchParams = url.searchParams;
            const keys = Array.from(searchParams.keys());
    
            if (keys.length < 1)
            {
                const response = _app.responseUtil.error({error:ErrorCode.GLOBAL_UNSUPPORTED_COMMAND, details:'proxy, unsupported command, ' + request.url});
                return _app.responseUtil.setHeaders(request, env, config, response);
            }
    
            type workerType = typeof config.local.workers;
            const workerName = keys[0] as keyof workerType;
    
            const value = decodeURIComponent(searchParams.get(workerName) || '');
            
            const workerURL = env.environment === 'dev' ? config.local.workers[workerName] : config.remote.workers[workerName]; //find the worker URL in the config file
    
            if (!workerURL || !value) 
            {
                const response = _app.responseUtil.error({error:ErrorCode.GLOBAL_UNSUPPORTED_COMMAND, details:'proxy, unsupported command, ' + request.url});
                return _app.responseUtil.setHeaders(request, env, config, response);
            }
            
            const proxiedRequest = new Request(`${workerURL}${value}`, {method:request.method, headers:request.headers, body:request.body}); //create a new request to the worker with the provided path value
    
            const headers = Array.from(proxiedRequest.headers);  //remove headers that could be used to identify the user
            for (let i = headers.length; i--;)
            {
                let header = headers[i];
    
                if (header[0].toLowerCase() in allowedForwardingRequestHeaders) continue;
                
                proxiedRequest.headers.delete(header[0]);
            }
    
            proxiedRequest.headers.set(env.proxyKeyHeaderName, env.proxyKey);
    
            let response = await fetch(proxiedRequest); //fetch the response from the worker
            if (!response || !response.ok || !response.headers.has(env.proxyPassedHeaderName)) 
            {
                if (response && response.ok) _app.consoleUtil.warn(this.constructor, await response.text());
                response = _app.responseUtil.error({error:ErrorCode.PROXY_FETCH_FAILED, 'details':'unknown failure 1'}); //very important. if this header is not present, a 500 error probably occured (we don't want to return this, as it will have info such as the secret proxy key in it)
            }
    
            return _app.responseUtil.setHeaders(request, env, config, response);
        }
        catch(error)
        {
            return _app.responseUtil.setHeaders(request, env, config, _app.responseUtil.error({error:ErrorCode.PROXY_FETCH_FAILED, details:'unknown failure 2'}, error));
        }
	}
}