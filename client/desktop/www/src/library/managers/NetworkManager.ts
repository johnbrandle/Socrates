/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import type { IWeakSignal } from "../../../../../../shared/src/library/signal/IWeakSIgnal.ts";
import { WeakSignal } from "../../../../../../shared/src/library/signal/WeakSignal.ts";
import { GlobalEvent } from "./GlobalListenerManager.ts";
import type { INetworkManager } from "./INetworkManager.ts";
import { INetworkManagerType } from "./INetworkManager.ts";
import { Status } from "./INetworkManager.ts";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator.ts";

@ImplementsDecorator(INetworkManagerType)
export class NetworkManager<A extends IBaseApp<A>> extends DestructableEntity<A> implements INetworkManager<A>
{
    private _status:Status;

    private _onStatusChangedSignal:IWeakSignal<[Status]> = new WeakSignal(this._app, this);

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);

        this._status = window.navigator.onLine ? Status.Unknown : Status.Disconnected; //offline is probably always correct, but online may not be, so set to unknown till we verify the user is truly online
    
        this.#monitor();
    }

    #monitor()
    {
        this._app.globalListenerManager.subscribe(this, GlobalEvent.Online, () => //listen for browser online event
        {
            if (this._status === Status.Connected || this._status === Status.Unknown) return;
            
            this._status = Status.Unknown; //online could still be offline, so set to unknown instead. see: https://www.electronjs.org/docs/latest/tutorial/online-offline-events
            this._onStatusChangedSignal.dispatch(this._status); //let the world know
        });

        this._app.globalListenerManager.subscribe(this, GlobalEvent.Offline, () => //listen for browser offline event
        {
            if (this._status === Status.Disconnected) return;

            this._status = Status.Disconnected; //i  believe offline always means offline, so no need to set unknown status
            this._onStatusChangedSignal.dispatch(this._status); //let the world know
        });
    }

    public notifyConnectionErrorOccured() //we can let the network manager know we may be disconnected (for instance, if an api call fails)
    {
        if (this._status === Status.Disconnected) return;
        
        this._status = Status.Disconnected;
        this._onStatusChangedSignal.dispatch(this._status); //let the world know
    }

    public notifyConnectionSucceded() //we can let the network manager know we are connected
    {
        if (this._status === Status.Connected) return;
        
        this._status = Status.Connected;
        this._onStatusChangedSignal.dispatch(this._status); //let the world know
    }

    public get status():Status
    {
        return this._status;
    }

    public get onStatusChangedSignal():IWeakSignal<[Status]>
    {
        return this._onStatusChangedSignal;
    }
}