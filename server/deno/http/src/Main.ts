/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

// ban-unused-ignore deno-lint-ignore-file no-case-declarations

import { HTTP2Server } from "../../shared/src/core/HTTP2Server.ts";
import { IService } from "../../shared/src/core/IService.ts";
import { WebService } from "./WebService.ts";
import { DevEnvironment } from "../../../../shared/src/library/IEnvironment.ts";

//@ts-ignore deno require assert
import type Config from '../config.json' assert {type:'json'};

export default class Main
{
	constructor()
	{
        addEventListener('unhandledrejection', (event:PromiseRejectionEvent) => console.error(event));

        const environment = Deno.args[0] === 'true' ? DevEnvironment.Dev : DevEnvironment.Prod;
        const config = JSON.parse(Deno.readTextFileSync(Deno.args[1])) as typeof Config;
        const localConfig = environment === DevEnvironment.Dev ? config.local : config.remote;

        const service:IService = new WebService(environment, localConfig);

        let options = undefined;
        if (localConfig.key && localConfig.cert)
        {
            options = {key:Deno.readTextFileSync(localConfig.key as string), cert:Deno.readTextFileSync(localConfig.cert as string)};

            Deno.permissions.revokeSync({name:'read', path:localConfig.key});
            Deno.permissions.revokeSync({name:'read', path:localConfig.cert});
        }

        const server = new HTTP2Server(service);
        server.init({port:localConfig.port}, options);
    }
}

new Main();