/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { NetworkManager as SharedNetworkManager } from "../../library/managers/NetworkManager.ts";
import type { IApp } from "../IApp.ts";
import { APIClient } from "./_networkmanager/APIClient.ts";
import { WebClient } from "./_networkmanager/WebClient.ts";

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
export class NetworkManager<A extends IApp<A>> extends SharedNetworkManager<A>
{
    #_webClient:WebClient<A> = new WebClient(this.app, this);
    public get webClient():WebClient<A> { return this.#_webClient; }

    #_apiClient:APIClient<A> = new APIClient(this.app, this);
    public get apiClient():APIClient<A> { return this.#_apiClient; }

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }
}