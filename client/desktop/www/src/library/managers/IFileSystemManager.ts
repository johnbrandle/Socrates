/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IDrive } from "../../../../../../shared/src/library/file/drive/IDrive";

export const IFileSystemManagerType = Symbol("IFileSystemManager");

export interface IFileSystemManager<A extends IBaseApp<A>>
{
    mount(drive:IDrive<A>):Promise<boolean>;
    unmount(drive:IDrive<A>):Promise<boolean>;
}