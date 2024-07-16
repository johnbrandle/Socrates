/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IWeakSignal } from "../../../../../../shared/src/library/signal/IWeakSIgnal";

export const IPerformanceManagerType = Symbol("IPerformanceManager");

export enum Performance
{
    High = 2,
    Medium = 1,
    Low = 0,
}

export interface IPerformanceManager<A extends IBaseApp<A>>
{
    get fps():number;
    getMemoryInfo():Promise<{heap?:{totalSize:number, usedSize:number, sizeLimit:number}, bytes?:number, breakdown?:Record<string, any>}>;

    get recommended():Performance;

    get onRecommendedSignal():IWeakSignal<[Performance]>;
}