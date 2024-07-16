/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { ITileData } from "../ITileData";
import type { IBoard } from "../IBoard";
import type { ITile } from "../ITile";
import type { IBaseApp } from "../../../IBaseApp";

export const IFitBoardType = Symbol("IFitBoard");

export interface IFitBoard<A extends IBaseApp, D extends ITileData, T extends ITile<A, D>> extends IBoard<A, D, T>
{
    //set selected(tiles:Array<D>);
    //get selected():Array<D>;

    set spacing([x, y]:[number, number]);
    set padding([top, right, bottom, left]:[number, number, number, number]);

    set tileSize([width, height]:[number, number]);
}