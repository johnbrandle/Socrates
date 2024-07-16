/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { RequestUtil as Shared } from '../../../../shared/src/library/utils/RequestUtil.ts';
import { ErrorCode } from "../../../../shared/src/app/json/ErrorJSON.ts";
import { DevEnvironment } from "../../../../shared/src/library/IEnvironment.ts";
import { HashOutputFormat, HashType, hex_256 } from "../../../../shared/src/library/utils/HashUtil.ts";
import { IBaseApp } from '../library/IBaseApp.ts';

//rate limiting configuration
const RATE_LIMIT_THRESHOLD = 10; //requests allowed within the specified time window
const RATE_LIMIT_TIME_WINDOW = 500; //time window in milliseconds (.5 seconds, or no more than 1 request every 50 milliseconds)

//rate limiting data structure
const rateLimitMap = new Map<string, { count:number, timestamp:number }>();

export class RequestUtil<A extends IBaseApp<A>> extends Shared<A>
{
    public constructor(app:A)
    {
        super(app);
    }

    async validate(request:Request, ip:string, env:CommonEnv, config:Config):Promise<true | Response>
    {
        const origin = request.headers.get('origin');
        const origins:Array<string> = (env.environment === DevEnvironment.Dev) ? config.local.origins : config.remote.origins;
    
        //check there is a timestamp in the header and see if it is within the last 5 minutes
        let timestamp = request.headers.get('timestamp');
        if (!timestamp || isNaN(parseInt(timestamp)) || (Date.now() - parseInt(timestamp)) > 300000) 
        {
            const response = this._app.responseUtil.error({error:ErrorCode.GLOBAL_UNSUPPORTED_COMMAND, details:'proxy, missing or invalid timestamp'});
            return this._app.responseUtil.setHeaders(request, env, config, response);
        }

        if (!origin || !origins.includes(origin)) 
        {
            this._app.consoleUtil.warn(this.validate, 'Attempted access from unknown origin: ' + origin);
            
            if (env.environment !== DevEnvironment.Dev)
            {
                const response = new Response(null, {status:400, statusText:'Unknown Origin'})
                return this._app.responseUtil.setHeaders(request, env, config, response);
            }
        }

        if (request.method === 'OPTIONS')
        {
            const response = new Response(null, {status:204});
            return this._app.responseUtil.setHeaders(request, env, config, response);
        }

        if (request.method !== 'POST' && request.method !== 'GET')
        {
            const response = new Response(null, {status:400, statusText:'Bad Request Method'});
            return this._app.responseUtil.setHeaders(request, env, config, response);
        }

        const length = parseInt(request.headers.get('content-length') || '-1');
        if (request.method === 'POST' && (length < 0 || isNaN(length)))
        {
            const response = new Response(null, {status:400, statusText:'Content Length Missing or Invalid'});
            return this._app.responseUtil.setHeaders(request, env, config, response);
        }

        if (env.environment !== DevEnvironment.Dev && !ip)
        {
            const response = this._app.responseUtil.error({error:ErrorCode.GLOBAL_UNSUPPORTED_COMMAND, details:'expected ip header'});
            return this._app.responseUtil.setHeaders(request, env, config, response);
        }

        if (await isRateLimited(ip)) //apply rate limiting
        {
            const response = this._app.responseUtil.error({error:ErrorCode.GLOBAL_UNSUPPORTED_COMMAND, details:'proxy, rate limit exceeded, ' + request.url});
            return this._app.responseUtil.setHeaders(request, env, config, response);
        }

        if (await isAnomalousRequest(request)) //check for anomalous requests
        {
            const response = this._app.responseUtil.error({error:ErrorCode.GLOBAL_UNSUPPORTED_COMMAND, details:'proxy, anomalous request, ' + request.url});
            return this._app.responseUtil.setHeaders(request, env, config, response);
        }

        return true;

        const ref = this;

        async function hashIpAddress(ipAddress:string):Promise<hex_256>
        {
            return ref._app.hashUtil.derive(ref._app.hashUtil.encodeData(ref._app.textUtil.toUint8Array(ipAddress)), HashType.SHA_256, HashOutputFormat.hex);
        }

        async function isAnomalousRequest(request:Request):Promise<boolean>
        {
            //add your anomaly detection logic here, e.g., unusual request patterns, unexpected headers or payloads
            //return true if the request is considered anomalous, false otherwise
            return false;
        }
    
        async function isRateLimited(ipAddress:string):Promise<boolean>
        {
            return false; //TODO
            /*
            ipAddress = await hashIpAddress(ipAddress);

            const now = Date.now();
            const rateLimitData = rateLimitMap.get(ipAddress);

            if (rateLimitData && (now - rateLimitData.timestamp) < RATE_LIMIT_TIME_WINDOW)
            {
                if (rateLimitData.count >= RATE_LIMIT_THRESHOLD) return true;
                else rateLimitData.count++;
            }
            else rateLimitMap.set(ipAddress, {count:1, timestamp:now});
            
            return false;
            */
        }
    }

    //this performs a basic auth check, an additional check should be done in the individual request handler methods
    async validateProxied<T extends CommonServiceEnv>(request:Request, ip:string, env:T, context:ExecutionContext, config:Config):Promise<[string | Response, RequestContext<T>]>
    {
        const checkProxyRequest = async (request:Request, env:CommonServiceEnv, config:any):Promise<true | Response> =>
        {
            if (!env.proxyEnabled) return this.validate(request, ip, env, config);
    
            if (env.environment === DevEnvironment.Dev) return true;
    
            let value = request.headers.get(env.proxyKeyHeaderName);
            if (!value || !env.proxyKey || env.proxyKey !== value) return this._app.responseUtil.error({error:ErrorCode.PROXY_INVALID_OR_MISSING_PROXY_KEY, details:'invalid or missing proxy key'});
    
            return true;
        }
    
        const isAuthorized = (request:Request, env:CommonServiceEnv, pathname:string):true | Response => //differs a little from the isAuthorized method in that it checks the api white list
        {
            let webAccessAllowed = pathname.indexOf('_') === -1; //and underscore in the path indicates an admin only endpoint
            
            if (!webAccessAllowed) 
            {
                let authorized = this.isAuthorized(request, env);
                if (authorized instanceof Response) return authorized;
            }

            return true;
        }

        let eventContext = {request:request, env:env};

        let pathname = this._app.urlUtil.getNormalizedPathname(request.url);
 
        let valid = await checkProxyRequest(request, env, config);
        if (valid instanceof Response) return [this._app.responseUtil.setProxyHeaders(request, env, config, valid), eventContext];

        let authorized = isAuthorized(request, env, pathname);
        if (authorized instanceof Response) return [this._app.responseUtil.setProxyHeaders(request, env, config, authorized), eventContext];

        return [pathname, eventContext];
    }

    public isAuthorized = (request:Request, env:CommonServiceEnv):true | Response =>
    {
        let response = this._app.responseUtil.error({error:ErrorCode.GLOBAL_UNAUTHORIZED_ACCESS, details:'unauthorized'});

        if (request.url.indexOf('_') === -1) return response; //admin requests uri must have an underscore in them
        if (!this.isService(request, env)) return response; //admin requests can only come from a service
        if (!this.isAdmin(request, env)) return response; //admin requests can only come from an admin

        return true;
    }

    private isService(request:Request, env:CommonServiceEnv):boolean //service to service communication is required for admin rights
    {
        return (request.headers.get(env.serviceKeyHeaderName) === env.serviceKey) && (env.serviceKey?.length > 0);
    }

    private isAdmin = (request:Request, env:CommonServiceEnv):boolean => 
    {
        return (request.headers.get(env.adminKeyHeaderName) === env.adminKey) && (env.adminKey?.length > 0); //checking the length in case someone forgot to set the env var
    }
}