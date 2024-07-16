/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../../IBaseApp";
import type { ITile } from "./ITile";
import type { IStorageTileData } from "./IStorageTileData";
import type { IContextMenuData } from "../../managers/IContextMenuManager";
import type { emptystring } from "../../../../../../../shared/src/library/utils/StringUtil";
import type { path } from "../../../../../../../shared/src/library/file/Path";

export const IStorageTileType = Symbol("IStorageTile");

export interface IStorageTile<A extends IBaseApp<A>, D extends IStorageTileData> extends ITile<A, D>
{
    set id(val:path | emptystring);
    set name(val:path | emptystring);
    get id():path | emptystring;
    get name():path | emptystring;

    onContextMenu(event:MouseEvent):IContextMenuData | undefined
    showOutline():void;
}