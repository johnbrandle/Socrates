/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IEnvironment as ISharedEnvironment, IFrozenEnvironment as ISharedFrozenEnvironment } from "../../../../../shared/src/library/IEnvironment";
import type { IProgress } from "../pre/progress/IProgress";

export interface IFrozenEnvironment extends ISharedFrozenEnvironment
{
    freeze:Function,
    seal:Function,
    redirect:Function;
    log_original:Function;

    config:Config;
    isLocalhost:boolean;
    isMobile:boolean;
    isApp:boolean;
    isPWA:boolean;
    isDebug:boolean;
    isTouch:boolean;
    isSingleWindowMode:boolean;
    isOfflineSimulationMode:boolean;
    isSafeMode:boolean;
    isExperimentalMode:boolean;
    isSessionEnabled:boolean;
}

export interface IEnvironment extends ISharedEnvironment
{
    frozen:IFrozenEnvironment;

    isDevToolsOpen:boolean;
    inlineStageCompletePromise:Promise<void> | undefined;
    progress:IProgress;
    logs:Array<Array<any>>;
}