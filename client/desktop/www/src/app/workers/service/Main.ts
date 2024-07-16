
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

//@ts-check
/// <reference lib="ES2015" />
/// <reference lib="webworker" />

declare const self:ServiceWorkerGlobalScope;

//const originalLog = console.log;
//const log = (...args:any) => originalLog.apply(console, args);

export default class Main
{    
    constructor()
    {
        self.addEventListener('install', this.#onInstall);  
        self.addEventListener('activate', this.#onActivate);
        self.addEventListener('fetch', this.#onFetch);
        self.addEventListener('message', this.#onMessage);
    }

    #onInstall = (event:ExtendableEvent) =>
    {
        self.skipWaiting(); //skip waiting for other service workers to finish (need to investigate the purpose of this further...)
    }

    #onActivate = (event:ExtendableEvent) =>
    {
        event.waitUntil(self.clients.claim()); //(need to investigate the purpose of this further...)

        console.log = (...args:any) => this.#log.apply(this, args);

        //ConsoleUtil.log('Service Worker Activated!');
    }
    
    #onFetch = (event:FetchEvent) =>
    {
        //ConsoleUtil.log('fetching: ' + event.request.url);

        //if (!event.request.url.endsWith('/empty.txt'))
        //{
        //    return;
        //}
        
        //event.respondWith(this.handleFetch(event.request));
    }

    /*
    async handleFetch(request:Request) 
    {
          return new Response('foobar', {
            status: 200, //HTTP OK status code
            statusText: 'OK', //HTTP OK status text
            headers: { 'Content-Type': 'text/plain' }
          });
        
    }
    */
   
    #onMessage = (event:ExtendableMessageEvent) =>
    {
    }

    #log(...args:any) 
    {
        //log(...args); //chrome already logs these messages in the main console, so we don't need to log them here

        //send to all clients
        self.clients.matchAll({includeUncontrolled:true, type:'window'}).then(clients => 
        {
            if (!clients || clients.length < 1) return; 
            
            clients.forEach(client => { client.postMessage('SERVICE WORKER ' + args.join(' ')); });
        });
    }
}

new Main();