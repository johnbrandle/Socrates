/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IRouter } from "./router/IRouter.ts";
import type { IViewer } from "./components/view/IViewer.ts";
import type { IView } from "./components/view/IView.ts";
import type { INetworkManager } from "./managers/INetworkManager.ts";
import type { IComponentFactory } from "./factories/IComponentFactory.ts";
import type { IGlobalObserverManager } from "./managers/IGlobalObserverManager.ts";
import type { IGlobalObserverMap } from "./managers/GlobalObserverManager.ts";
import type { IGlobalListenerManager } from "./managers/IGlobalListenerManager.ts";
import type { IDragAndDropManager } from "./managers/IDragAndDropManager.ts";
import type { IContextMenuManager } from "./managers/IContextMenuManager.ts";
import type { IWorkerManager } from "./managers/IWorkerManager.ts";
import type { IInstanceManager } from "./managers/IInstanceManager.ts";
import type { IPerformanceManager } from "./managers/IPerformanceManager.ts";
import type { ITranscodeManager } from "./managers/ITranscodeManager.ts";
import type { IGlobalListenerMap } from "./managers/GlobalListenerManager.ts";
import type { IFileSystemManager } from "./managers/IFileSystemManager.ts";
import type { IBaseApp as ISharedBaseApp } from "../../../../../shared/src/library/IBaseApp.ts";
import type { IEnvironment } from "./IEnvironment.ts";
import type { IAbortable } from "../../../../../shared/src/library/abort/IAbortable.ts";
import type { IComponent } from "./components/IComponent.ts";
import type { BrowserUtil } from "./utils/BrowserUtil.ts";
import type { ComponentUtil } from "./utils/ComponentUtil.ts";
import type { DOMUtil } from "./utils/DOMUtil.ts";
import type { FileUtil } from "./utils/FileUtil.ts";
import type { BaseUtil } from "./utils/BaseUtil.ts";
import type { ConsoleUtil } from "./utils/ConsoleUtil.ts";
import type { DebugUtil } from "./utils/DebugUtil.ts";
import type { HashUtil } from "./utils/HashUtil.ts";
import type { HMACUtil } from "./utils/HMACUtil.ts";
import type { KeyUtil } from "./utils/KeyUtil.ts";
import type { ObjectUtil } from "./utils/ObjectUtil.ts";
import type { PromiseUtil } from "./utils/PromiseUtil.ts";
import type { StreamUtil } from "./utils/StreamUtil.ts";
import type { UIDUtil } from "./utils/UIDUtil.ts";
import type { UUIDUtil } from "./utils/UUIDUtil.ts";
import type { ImageUtil } from "./utils/ImageUtil.ts";
import type { TileUtil } from "./utils/TileUtil.ts";
import type { ValidationUtil } from "./utils/ValidationUtil.ts";
import type { VideoUtil } from "./utils/VideoUtil.ts";

export const IBaseAppType = Symbol("IBaseApp");

export interface IBaseApp<A extends IBaseApp<A>, R=any> extends ISharedBaseApp<A>, IAbortable<R>
{
    get environment():IEnvironment;

    get baseUtil():BaseUtil<A>;
    get browserUtil():BrowserUtil<A>;
    get componentUtil():ComponentUtil<A>;
    get consoleUtil():ConsoleUtil<A>;
    get debugUtil():DebugUtil<A>;
    get domUtil():DOMUtil<A>;
    get fileUtil():FileUtil<A>;
    get hashUtil():HashUtil<A>;
    get hmacUtil():HMACUtil<A>;
    get imageUtil():ImageUtil<A>;
    get keyUtil():KeyUtil<A>;
    get objectUtil():ObjectUtil<A>;
    get promiseUtil():PromiseUtil<A>;
    get streamUtil():StreamUtil<A>;
    get tileUtil():TileUtil<A>;
    get uidUtil():UIDUtil<A>;
    get uuidUtil():UUIDUtil<A>;
    get validationUtil():ValidationUtil<A>;
    get videoUtil():VideoUtil<A>;

    get globalListenerManager():IGlobalListenerManager<A, IGlobalListenerMap>;
    get globalObserverManager():IGlobalObserverManager<A, IGlobalObserverMap>;
    get networkManager():INetworkManager<A>;
    get dragAndDropManager():IDragAndDropManager<A>;
    get contextMenuManager():IContextMenuManager<A>;
    get workerManager():IWorkerManager<A>;
    get instanceManager():IInstanceManager<A>;
    get performanceManager():IPerformanceManager<A>;
    get transcodeManager():ITranscodeManager<A>;
    get fileSystemManager():IFileSystemManager<A>;
    get rootView():IView<A>;
    get rootViewer():IViewer<A>;
    get router():IRouter<A>;
    
    get componentFactory():IComponentFactory<A>;

    get info():
    {
        show:(component:IComponent<A>) => void;
        hide:(component:IComponent<A>) => void;
        update:(component:IComponent<A>, id:string, value:string) => void;
    };
}