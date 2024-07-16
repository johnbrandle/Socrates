/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IWeakSignal } from "../../../../../../shared/src/library/signal/IWeakSIgnal";

export enum Status
{
    Connected = 'connected',
    Disconnected = 'disconnected',
    Unknown = 'unknown',
}

export const INetworkManagerType = Symbol("INetworkManager");

export interface INetworkManager<A extends IBaseApp<A>>
{
    notifyConnectionErrorOccured():void;
    notifyConnectionSucceded():void;

    get status():Status

    get onStatusChangedSignal():IWeakSignal<[Status]>;
}