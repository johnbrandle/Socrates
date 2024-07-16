/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp as ISharedBaseApp } from "../../../../shared/src/library/IBaseApp";
import type { IEnvironment } from "./IEnvironment";
import type { IInstanceManager } from "./managers/IInstanceManager";
import type { AccessUtil } from "./utils/AccessUtil";

export const IBaseAppType = Symbol("IBaseApp");

export interface IBaseApp<A extends IBaseApp<A>> extends ISharedBaseApp<A>
{
    get environment():IEnvironment;

    get accessUtil():AccessUtil<A>;

    get instanceManager():IInstanceManager<A>;
}