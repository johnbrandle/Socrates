/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @description loads styles and scripts in order. does not block.
 */

import loader from '../../../data/loader.json' assert {type:'json'}; 

type Item = {src:string, cache:boolean, integrity?:string, type?:'module' | 'script'};

export class Loader
{
    readonly #_cache = !(self.environment.frozen.isLocalhost || self.environment.frozen.isApp); //don't cache if testing locally or in an app
    readonly #_cacheBustString = document.documentElement.getAttribute('data-etag'); //modify this value in the index.html file to cache bust (prod script does this automatically)
    readonly #_nextAnimationFrame = () => new Promise(resolve => window.requestAnimationFrame(resolve));
    readonly #_apply:(() => Promise<unknown>)[] = []; //apply the textContent in order when everything is loaded
    
    readonly #_appURI:string = loader.app;

    readonly #_styleURIs:Item[] = loader.styles;
    readonly #_scriptURIs:Item[] = loader.scripts; //because i don't want these scripts blocking rendering, but i want all of these loaded before app loads
    
    #_cacheObj:Cache | undefined;

    constructor() 
    {
        this.#init();
    }
    
    async #init() 
    {
        await self.environment.inlineStageCompletePromise; //wait for inline stage to complete before proceeding

        this.#_cacheObj = await caches.open('LOADER_' + this.#_cacheBustString);
            
        const documentFragment = new DocumentFragment();
        
        //callback for when scripts/styles loaded
        let count = this.#_styleURIs.length + this.#_scriptURIs.length + 1;
        const onLoaded = async () =>
        {
            if (--count) return;
        
            for (let i = 0, length = this.#_apply.length; i < length; i++) await this.#_apply[i](); //see getNCache
            this.#_apply.length = 0;

            //load app script last
            const appScript = document.createElement('script');
            const element = await this.#get({src:this.#_appURI, cache:true}, appScript, 0, () => 
            { 
                const listener = () => 
                {
                    window.removeEventListener('DOMContentLoaded', listener);
                
                    this.#_apply[0](); 
                    this.#_apply.length = 0;
                }    

                if (document.readyState === 'complete' || document.readyState === 'interactive') listener();
                else window.addEventListener('DOMContentLoaded', listener);
            });
            document.head.appendChild(element);
        }
    
        const promises = [];
        
        //load each style
        let index = 0;
        for (let i = 0, length = this.#_styleURIs.length; i < length; i++)
        {
            const obj = this.#_styleURIs[i];
    
            const style = document.createElement('style');
            
            if (obj.integrity) 
            {
                style.setAttribute('integrity', obj.integrity);
                style.setAttribute('crossorigin', 'anonymous');
            }

            promises.push(this.#get(obj, style, index++, onLoaded));
        }

        //load each script
        for (let i = 0, length = this.#_scriptURIs.length; i < length; i++)
        {
            const obj = this.#_scriptURIs[i];
    
            const script = document.createElement('script');
            if (obj.type === 'module') script.setAttribute('type', 'module');
            else obj.type = 'script';

            promises.push(this.#get(obj, script, index++, onLoaded));
        }
    
        let elements = await Promise.all(promises);
        elements.forEach((element) => documentFragment.appendChild(element));

        document.head.appendChild(documentFragment);

        onLoaded();
    }

    async #get(obj:Item, element:HTMLStyleElement | HTMLScriptElement, index:number, callback:Function)
    {
        const getNCache = async(obj:Item, tries=3):Promise<any> =>
        {
            const abort = async(reason:string) => 
            {
                if (self.environment.frozen.isLocalhost === true) throw new Error(reason);
                
                if (tries) return await getNCache(obj, --tries);
                
                self.environment.frozen.redirect();   
            }
        
            try
            {
                if (obj.src.indexOf('://') !== -1) throw new Error('cannot load externaly hosted files'); //don't load externally hosted files
                
                let response;
                if (this.#_cache && obj.cache && this.#_cacheObj) 
                {
                    response = await this.#_cacheObj.match(obj.src);
                    if (response) return response.text();
                }
                

                const url = new URL(obj.src, window.location.origin);
                url.searchParams.append('etag', self.environment.frozen.config.global.etag);
                response = await fetch(url);
                if (!response.ok) return await abort('Network response was not ok');
            
                if (this.#_cache && obj.cache && this.#_cacheObj) await this.#_cacheObj.put(obj.src, response.clone());
                
                return response.text();
            }
            catch (error)
            {
                console.log(error);
        
                return await abort('There was a problem with the fetch operation');
            }
        }
    
        const object = document.createElement('object');
    
        getNCache(obj).then(text => 
        {
            this.#_apply[index] = (async () => 
            {
                if (obj.type === 'module' || obj.type === 'script') 
                {
                    let promiseResolver:(...args:any) => void;
                    const promise = new Promise((resolve) => promiseResolver = resolve);
                    
                    element.setAttribute('src', obj.src);
                    element.onload = () => 
                    {
                        element.onload = null;
                        promiseResolver();
                    };

                    object.replaceWith(element);

                    return promise;
                }
                
                await this.#_nextAnimationFrame(); //prevent the framerate from being hammered
                element.textContent = text;
                object.replaceWith(element);
            });
            
            callback();
        });
    
        return object;
    }
}

new Loader();