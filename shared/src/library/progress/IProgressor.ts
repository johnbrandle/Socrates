/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IAbortable } from "../abort/IAbortable";
import { IAborted } from "../abort/IAborted";
import { IError } from "../error/IError";
import { IWeakSignal } from "../signal/IWeakSIgnal";
import { IProgressable } from "./IProgressable";

export const IProgressorType = Symbol("IProgressorType");

export interface IProgressor<A, D> extends IAbortable, IProgressable
{
    slice(percent:number):IProgressor<A, D>;
    slice<F=D>(percent:number, onProgress:(progress:number, data:F, localProgress:number) => true | IAborted | IError):IProgressor<A, F>;
    
    split(count:number, percent?:number):IProgressor<A, D>[];
    split<F=D>(count:number, percent:number, onProgress:(progress:number, data:F, localProgress:number) => true | IAborted | IError):IProgressor<A, F>[];
    
    //true will take whatever remaining progress is left and set it to: progress = remainingProgress / 2;
    //false will not change the progress, but will still trigger the onProgress callback
    setProgress(progress:number | boolean, data:D):true | IAborted | IError;

    get progress():number;

    get onProgressSignal():IWeakSignal<[IProgressor<A, D>, number, D]>;
}