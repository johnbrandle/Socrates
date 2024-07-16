/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @description code that must run before anything else
 */

import { DevEnvironment } from '../../../../../../shared/src/library/IEnvironment';
import config from '../../../data/config.json';
import type { IFrozenEnvironment } from '../../app/IEnvironment';

const freeze = <T extends object>(object:T):T => 
{
    if (object === window) throw new Error('cannot freeze window object');
    if (object === document) throw new Error('cannot freeze document object');

    const properties = Reflect.ownKeys(object);
  
    for (const name of properties) 
    {
        const value = object[name as keyof T];
  
        if (value === null || value === undefined) continue;
        if (typeof value !== 'function' && typeof value !== 'object') continue;
        
        if (value === object) throw new Error('cannot freeze object that references itself');

        freeze(value);
    }
  
    return Object.freeze(object);
}

const seal = <T extends object>(object:T):T => 
{
    if (object === window) throw new Error('cannot seal window object');
    if (object === document) throw new Error('cannot seal document object');

    const properties = Reflect.ownKeys(object);
  
    for (const name of properties) 
    {
        const value = object[name as keyof T];
  
        if (value === null || value === undefined) continue;
        if (typeof value !== 'function' && typeof value !== 'object') continue;
        
        if (value === object) throw new Error('cannot seal object that references itself');

        seal(value);
    }
  
    return Object.seal(object);
}

export class Inline
{
    constructor()
    {
        this.#init();
    }

    async #init()
    {
        //redirect to unsupported page or something went wrong page
        let alertOnce = false; //so we don't alert multiple times
        const redirect = (to:'wrong' | 'unsupported'='wrong') => 
        {
            if (alertOnce !== false) return;
            alertOnce = true;

            isDebug ? alert('Something went wrong!') : window.location.replace(`./redirects/${to}/index.html`);
        }

        let unsupported = undefined; 
        unsupported = unsupported ?? window.localStorage === undefined ?? window.caches === undefined;
        unsupported = unsupported ?? window.Worker === undefined;
        unsupported = unsupported ?? window.FontFace === undefined;
        unsupported = unsupported ?? window.CompressionStream === undefined;
        unsupported = unsupported ?? navigator.serviceWorker === undefined;
        
        if (unsupported === true) return redirect('unsupported');
        
        const uri = location.toString();
        const searchParams = new URL(uri).searchParams;

        const isTouch = window.ontouchstart !== undefined || navigator.maxTouchPoints > 0;
        const isMobile = navigator.userAgentData !== undefined ? navigator.userAgentData.mobile : navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|BB10|mobi|tablet|opera mini|nexus 7)/i) && isTouch;
        const isPWA = searchParams.has('pwa') === true;
        const isApp = (self as any).bridgeAPI !== undefined || isPWA === true;
        const isDebug = searchParams.has('d') === true;
        const isDevEnvironment = document.documentElement.getAttribute('data-env') === 'dev';
        const isLocalhost = uri.indexOf('//localhost') !== -1 || uri.indexOf('127.0.0.1') !== -1 || (isDebug === true && isApp === true);
        const isSingleWindowMode = searchParams.has('transferID') === true;
        const isPlainTextMode = searchParams.has('pt') === true;
        const isTestMode = searchParams.has('test') === true;
        const isOfflineSimulationMode = searchParams.has('o') === true;
        const isSafeMode = searchParams.has('s') === true;
        const isExperimentalMode = searchParams.has('e') === true;

        //loader uses this to know when the inline stage is complete
        let completeInlineStage:() => void;
        const inlineStageCompletePromise = new Promise<void>(resolve => completeInlineStage = () => 
        {
            resolve();

            self.environment.inlineStageCompletePromise = undefined;
        });
        
        const log_original = window.console.log; //capture logs, so we can access them in framework
        const logs:any[] = [];
        window.console.log = (...args) => 
        {
            logs.push(args);
            log_original.apply(window.console, args);
        }

        const log = (...datas:any):false =>
        {
            console.log.apply(this, ['%cINLINE', 'color: #388cc7', this.constructor.name, '—', ...datas]);
    
            return false;
        }

        //frozen object
        const frozen = freeze({
            freeze,
            seal,
            redirect:redirect,
            log_original,

            isTouch,
            isMobile,
            isPWA,
            isApp,
            isDebug,
            isLocalhost,
            isSingleWindowMode,
            isPlainTextMode,
            isOfflineSimulationMode,
            isSafeMode,
            isExperimentalMode,
            config,

            isSessionEnabled:false,
            devEnvironment:isTestMode ? DevEnvironment.Test : (isDevEnvironment ? DevEnvironment.Dev : DevEnvironment.Prod),
        } as IFrozenEnvironment);

        //create the environment object
        const environment = 
        {
            logs,
            isDevToolsOpen:undefined, 
            progress:undefined,
            inlineStageCompletePromise,

            bridgeAPI:(self as any).bridgeAPI
        };

        //set the frozen object as non-configurable, non-enumerable, and non-writable
        Object.defineProperty(environment, 'frozen', {value:frozen, writable:false, enumerable:false, configurable:false});

        //set the environment object as non-configurable, non-enumerable, and non-writable
        Object.defineProperty(window, 'environment', {value:environment, writable:false, enumerable:false, configurable:false});

        window.addEventListener('message', (event) => //listen for messages from Debug browser extension
        {
            if (event.source != window) return; //we only accept messages from ourselves

            if (event.data?.type !== 'FROM_EXTENSION') return;

            switch (event.data.message.code)
            {
                case 'ready': //received when Debug browser extension is ready
                    window.postMessage({type:'FROM_PAGE', code:'devtools_opened'}, '*'); //ask Debug browser extension if dev tools are open
                    break;
                case 'devtools_opened': //received when Debug browser extension responds to our request (or when dev tools is opened/closed)
                    environment.isDevToolsOpen = event.data.message.value;
                    break;
            }
        });

        //dispatch events to window that opened this window
        if (isSingleWindowMode === true) 
        {
            window.opener.dispatchEvent(new CustomEvent<TransferWindowCustomEventDetail>('transferWindow', {detail:{type:'load', window, transferID:searchParams.get('transferID')!}}));
            window.addEventListener('beforeunload', () => window.opener.dispatchEvent(new CustomEvent<TransferWindowCustomEventDetail>('transferWindow', {detail:{type:'close', window, transferID:searchParams.get('transferID')!}})));
        }
        
        document.addEventListener('touchmove', (event:TouchEvent) => event.preventDefault(), {passive:false, capture:true}); //prevent browser's default drag behavior

        navigator.serviceWorker.register(`./js/worker_service.bundle.js?etag=${config.global.etag}`, { scope: '/'}).then((registration:ServiceWorkerRegistration) => 
        {
            if (registration.installing) log('service worker installing');
            if (registration.waiting) log('service worker installed');
            if (registration.active) log('service worker active');

            return registration;
        }).catch((error) => console.error(`service worker registration failed with ${error}`));
        navigator.serviceWorker.addEventListener('message', event => 
        {
            log(`service worker message: ${event.data}`);
        });

        //clear local storage, indexedDB, and opfs if clear is in the url
        if (searchParams.has('clear') === true)
        {
            //clear local storage
            window.localStorage.clear();

            const promises = [];

            //clear opfs
            promises.push((async () =>
            {
                async function deleteAllFilesAndFolders(directoryHandle:FileSystemDirectoryHandle):Promise<void> 
                {
                    //@ts-ignore
                    for await (const entry of directoryHandle.values()) 
                    {
                        if (entry.kind === 'file') 
                        {
                            //if the entry is a file, delete it
                            await directoryHandle.removeEntry(entry.name);
                        } 
                        else if (entry.kind === 'directory') 
                        {
                            //if the entry is a directory, recursively call this function
                            await deleteAllFilesAndFolders(entry);
                            //after deleting all contents, delete the directory itself
                            await directoryHandle.removeEntry(entry.name);
                        }
                    }
                }

                return deleteAllFilesAndFolders(await navigator.storage.getDirectory());
            })().catch(error => console.error(error)));
            
            if (indexedDB.databases !== undefined) //not a function in firefox
            {
                //clear indexedDB
                promises.push((indexedDB.databases().then(databases => 
                {
                    for (const database of databases) if (database.name !== undefined) indexedDB.deleteDatabase(database.name);
                }).catch(error => console.error(error))));
            }
            await Promise.all(promises);

            log('clear finished, any errors will have been logged to the console');
        }

        completeInlineStage!();
    }
}

new Inline();