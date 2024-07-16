/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { BrowserWindow } from "electron";
import type { IBaseApp } from "../library/IBaseApp";
import type { Server } from "../library/Server";
import type { IAPIManager } from "./managers/IAPIManager";
import type { FolderPath } from "../../../../shared/src/library/file/Path";

export const IAppType = Symbol("IApp");

export interface IApp<A extends IApp<A>=IApp<any>> extends IBaseApp<A>
{   
    get browserWindow():BrowserWindow;

    get server():Server;
    get session():Electron.Session;

    get apiManager():IAPIManager<A>;

    get contentPath():FolderPath;
    get dataPath():FolderPath;

}