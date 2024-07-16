/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import config from '../../../../shared/src/../config.json' assert {type:'json'};
import { IService } from '../../shared/src/core/IService.ts';
import { DevEnvironment } from '../../../../shared/src/library/IEnvironment.ts';
import { media_types } from './deps.ts';
import { path } from './deps.ts';
import { brotli } from './deps.ts';
import { IBaseApp } from '../../../shared/src/library/IBaseApp.ts';

enum CompressionEncoding
{
    Brotli = 'br', //slower to compress and there is no async version currently available, but since we are caching, not a big deal..., see also: https://cran.r-project.org/web/packages/brotli/vignettes/benchmarks.html
    Gzip = 'gzip',
    None = 'none'
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

const UNCOMPRESSED_FILE_CACHE_LIMIT = 10 * 1048576; //10 MB
const COMPRESS_WHITELIST:Record<string, true> = {'.html':true,'.js':true, '.map':true, '.css':true};
const NO_COMPRESS_WHITELIST:Record<string, true> = {'.woff2':true, '.jpg':true, '.ico':true}
const CACHE_PURGE_OFFSET = 5 * 60 * 1000;  //5 minutes in milliseconds
const MAX_ETAG_CACHE_SIZE = 4; //how many entries allowed in the cache at once (checked at an interval and purged as needed)
const DEV_ETAG_VALUE = 1234567890; //the etag value we use for dev

export class WebService<A extends IBaseApp<A>> implements IService
{
    private _app:A;

    _env:CommonEnv;
    _config:WebConfigLocal;
    _cache:Record<number, Record<CompressionEncoding, Record<string, Uint8Array>>> = {};
    _cspCache:Record<string, Record<string, string>> = {};
    _cachePurgeTimeout = Date.now() + CACHE_PURGE_OFFSET;
    _etag = -1;
    _upgraded = false; //true when we upgrade to the latest etag
    _validEtags:Set<number> = new Set();

    constructor(app:A, environment:DevEnvironment, config:WebConfigLocal) 
    {
        this._app = app;

        this._config = config;
        this._env = {environment};

        //check the directory for all valid etag values, and keep this list in memory so we can later use it to validate user supplied etags
        const entries = Deno.readDirSync(this._config.rootPath);
        const validEtagValues = this._validEtags;
        for (const dirEntry of entries) 
        {
            if (!dirEntry.isDirectory) continue;

            const etagString = dirEntry.name;
            const etagNumber = Number(etagString);
            if (isNaN(etagNumber)) continue;
            
            validEtagValues.add(etagNumber);
        }

        if (!validEtagValues.has(config.currentEtag)) throw new Error(`Path for current etag specified in config does not exist: ${config.currentEtag}`);
        this._etag = config.currentEtag;

        if (!validEtagValues.has(config.upgradeEtag)) throw new Error(`Path for upgrade etag specified in config does not exist: ${config.upgradeEtag}`);

        if (config.currentEtag > config.upgradeEtag) throw new Error('Etag values invalid. Upgrade etag must be equal to or greater than the current etag value specified in the config');
        if (config.currentEtag === config.upgradeEtag) this._upgraded = true;
    }

    async fetch(request:Request, env:CommonEnv, context:ExecutionContext):Promise<Response> 
    {
        const response = (async ():Promise<Response> => 
        {
            try
            {
                if (this._config.auth.enabled === true) //require authorization if it is enabled in config
                {
                    const header = request.headers.get('authorization') || '';
                    const token = header.split(/\s+/).pop() || '';
                    const auth = token ? atob(token) : '';
                    const [username, password] = auth ? auth.split(':') : ['', ''];
                    if (username !== this._config.auth.username || password !== this._config.auth.password) 
                    {
                        const response = new Response(`<html><body>UNAUTHORIZED</body></html>`, {status:401});
                        response.headers.set('www-authenticate', 'Basic realm="Private Area", charset="UTF-8"');
                        return response;
                    }
                }

                if (this._upgraded === false)
                {
                    const millisecondOffset = this._config.upgradeMinuteOffset * 60 * 1000;
                    if (Date.now() >= this._etag + millisecondOffset)
                    {
                        this._etag = this._config.upgradeEtag;
                        this._upgraded = true;
                    }
                }

                const noneMatch = request.headers.get("If-None-Match") || ''; //client is checking if resource is still valid (.html files will use this as they expire often)
                if (parseInt(noneMatch) === this._etag) return new Response(null, {status: 304}); //etag provided matches latest etag, let the client know their cached version is still valid

                const valid = await this._app.requestUtil.validate(request, context.remoteAddress, env, config);
                if (valid instanceof Response) return valid;

                const url = new URL(request.url);
                let pathname = url.pathname.toLowerCase();
                if (pathname.indexOf('.') === -1) pathname = '/index.html';

                const fileExtension = path.extname(pathname).toLowerCase();
                const fileExtensionIsHTML = fileExtension === '.html'; //!important, if this is screwed up, cache expiration could be a big issue
                let queryEtagValue:string | null = null;
                if (!fileExtensionIsHTML) 
                {
                    const params = url.searchParams;
                    queryEtagValue = params.get('etag');
                    if (queryEtagValue === 'L' || fileExtension === '.map') queryEtagValue = this._etag.toString(); //a query value of L will always use the latest (asset is not expected to change between revisions)
                    if (!queryEtagValue) return new Response("Missing etag query param on non-html request", {status:400});
                }

                const etag = queryEtagValue ? parseInt(queryEtagValue) : this._etag; //!important to set this here, as this value could change in the middle of this function call (while waiting for promise)                
                if (!this._validEtags.has(etag) || (env.environment !== DevEnvironment.Dev && etag === DEV_ETAG_VALUE)) return new Response("invalid etag value", {status:400});  //!important, check if there is anything wrong with their etag Number
                
                const filePath = path.resolve(this._config.rootPath, `./${etag}/`, '.' + pathname);  
                if (filePath.startsWith(this._config.rootPath) !== true) 
                {
                    this._app.consoleUtil.log(filePath);
                    return new Response("404 Not Found", {status:404}); //!important ensure the file path is within the project root
                }

                const contentType = media_types.contentType(fileExtension);
                if (!contentType)
                {
                    this._app.consoleUtil.log('media type unknown for: ' + filePath);
                    return new Response(null, {status:415});
                }

                if (this._cache[etag] === undefined) this._cache[etag] = {[CompressionEncoding.Brotli]:{}, [CompressionEncoding.Gzip]:{}, [CompressionEncoding.None]:{}};
                const cache = this._cache[etag]; //!important to set this here, as this cache object could be removed from the array in the middle of this function call (while waiting for promise)
                if (env.environment === DevEnvironment.Dev) delete this._cache[etag]; //!important, delete the cache if we are in debug mode

                const contentEncodings = request.headers.get('accept-encoding')?.toLowerCase() || '';
                
                let contentEncoding:CompressionEncoding = CompressionEncoding.None;
                let body:ReadableStream<Uint8Array> | Uint8Array | undefined;
                if (contentEncodings.indexOf('br') !== -1 && COMPRESS_WHITELIST[fileExtension])
                {
                    if (cache.br[filePath] !== undefined) body = cache.br[filePath];

                    contentEncoding = CompressionEncoding.Brotli;
                }
                if (contentEncoding === CompressionEncoding.None && contentEncodings.indexOf('gzip') !== -1 && COMPRESS_WHITELIST[fileExtension])
                {
                    if (cache.gzip[filePath] !== undefined) body = cache.gzip[filePath];

                    contentEncoding = CompressionEncoding.Gzip;
                }                   
                if (contentEncoding === CompressionEncoding.None && cache.none[filePath] !== undefined) body = cache.none[filePath];

                let csp = this._app.cspUtil.base;
                let file:Deno.FsFile | undefined; 
                if (body === undefined)
                {
                    try
                    {
                        file = await Deno.open(filePath, {read:true});
                    }
                    catch 
                    { 
                        this._app.consoleUtil.log(filePath);
                        return new Response("404 Not Found", {status:404}); 
                    }

                    if (contentEncoding === CompressionEncoding.Brotli)
                    {
                        const size = (await file.stat()).size;
                        let uint8Array = new Uint8Array(size);
                        await file.read(uint8Array);
                        file.close();

                        [csp, uint8Array] = this._app.cspUtil.merge(fileExtension, csp, uint8Array);
                        this._cspCache[filePath] = csp;

                        body = brotli.compress(uint8Array);
                        
                        cache.br[filePath] = body;
                    }
                    else if (contentEncoding === CompressionEncoding.Gzip)
                    {
                        const size = (await file.stat()).size;
                        let uint8Array = new Uint8Array(size);
                        await file.read(uint8Array);
                        file.close();

                        [csp, uint8Array]= this._app.cspUtil.merge(fileExtension, csp, uint8Array);
                        this._cspCache[filePath] = csp;

                        body = await this._app.streamUtil.toUint8Array(this._app.streamUtil.fromUint8Array(uint8Array).pipeThrough(new CompressionStream('gzip')));
                        
                        cache.gzip[filePath] = body;
                    }
                    else 
                    {
                        const size = (await file.stat()).size;
                        body = this.#encodeStream(file);

                        if (size < UNCOMPRESSED_FILE_CACHE_LIMIT)
                        {
                            const uint8Array = await this._app.streamUtil.toUint8Array(body);

                            [csp, body] = this._app.cspUtil.merge(fileExtension, csp, uint8Array);
                            this._cspCache[filePath] = csp;

                            cache.none[filePath] = body;
                        }
                    }
                }
                else if (this._cspCache[filePath] !== undefined) csp = this._cspCache[filePath];
                
                if (contentEncoding == CompressionEncoding.None && !NO_COMPRESS_WHITELIST[fileExtension]) this._app.consoleUtil.log('did not compress file: ' + filePath);

                const cacheControl = fileExtensionIsHTML ? "public, no-transform, max-age=300" : "public, immutable, no-transform, max-age=7776000"; //5 minutes if html, otherwise 90 days
                
                //TODO, https://infosec.mozilla.org/guidelines/web_security#http-public-key-pinning
                const responseInit:ResponseInit = {headers:
                                                    {
                                                        'etag':etag.toString(),
                                                        'last-modified':new Date(etag * 1000).toUTCString(),
                                                        'content-type':contentType, 
                                                        'strict-transport-security':'max-age=63072000; includeSubDomains; preload',
                                                        'referrer-policy':'no-referrer',
                                                        'x-content-type-options':'nosniff',
                                                        'x-frame-options':'deny',
                                                        'x-xss-protection':'1; mode=block',
                                                        'content-security-policy':this._app.cspUtil.toString(csp, env.environment),
                                                        'cache-control':cacheControl,
                                                        'content-encoding':contentEncoding === CompressionEncoding.None ? '' : contentEncoding.toString()
                                                    }};

                const response = new Response(body, responseInit);
                if (body instanceof Uint8Array) response.headers.set('content-length', body.length.toString());

                if (Date.now() > this._cachePurgeTimeout) this.#purgeOldEntriesFromCache();

                return response;
            }
            catch(error)
            {
                this._app.consoleUtil.log(error);
                return new Response(null, {status:500});
            }
        })();

        return this._app.responseUtil.setHeaders(request, env, config, await response);
	}

    ///purges older cache entries
    #purgeOldEntriesFromCache():void
    {
        this._cachePurgeTimeout = Date.now() + CACHE_PURGE_OFFSET; //!important, set this immediatly to prevent subsequent calls

        const etags:Array<number> = [];
        const cache = this._cache;
        for (const prop in cache) etags.push(parseInt(prop));

        if (etags.length > MAX_ETAG_CACHE_SIZE) //purge old caches
        {
            etags.sort((a, b) => a - b);
            for (let i = 0; i < etags.length - MAX_ETAG_CACHE_SIZE; i++) delete cache[etags[i]];
        }
    }

    ///pipe a file's contents through a new stream so we can close the file after.
    ///https://github.com/denoland/deno/issues/3515#issuecomment-1629071790
    #encodeStream = (file:Deno.FsFile, chunkSize = 524288):ReadableStream<Uint8Array> => 
    {
        const ref = this;

        let cancelled = false;
        return new ReadableStream(
        {
            async pull(controller) 
            {
                const reader = file.readable.getReader();
                let buffer = new Uint8Array();
    
                try 
                {
                    const read = await reader.read();
    
                    if (cancelled === true) 
                    {
                        reader.releaseLock();
                        return;
                    }

                    if (read.done) 
                    {
                        //if we've finished reading the file, enqueue any remaining data and close the stream.
                        if (buffer.byteLength > 0) controller.enqueue(buffer);
                        
                        controller.close();
                        await file.close(); //ensure the file is closed when done.
                        return;
                    }
    
                    //combine the new data with the existing buffer.
                    const tempBuffer = new Uint8Array(buffer.byteLength + read.value.byteLength);
                    tempBuffer.set(buffer);
                    tempBuffer.set(read.value, buffer.byteLength);
                    buffer = tempBuffer;
    
                    //enqueue chunks of the specified size.
                    while (buffer.byteLength >= chunkSize) 
                    {
                        const chunk = buffer.subarray(0, chunkSize);
                        buffer = buffer.subarray(chunkSize);
                        controller.enqueue(chunk);
                    }
                } 
                catch (error) 
                {
                    //handle any errors that occur during read.
                    ref._app.consoleUtil.warn('Error reading file:', error);
                    controller.error(error);
                    await file.close();
                }
            },
            cancel(_reason) 
            {
                //if the consumer cancels the stream, set the abort flag and close the file.
                cancelled = true;
                file.close();
            }
        });
    };
    
    get env():CommonEnv
    {
        return this._env;
    }
}