/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { IProgressableType } from "./IProgressable";
import { IAborted } from "../abort/IAborted";
import { IProgressor, IProgressorType } from "./IProgressor";
import { IWeakSignal } from "../signal/IWeakSIgnal";
import { WeakSignal } from "../signal/WeakSignal";
import { IBaseApp } from "../IBaseApp";
import { AbortController } from "../abort/AbortController";
import { IAbortable } from "../abort/IAbortable";
import { IError } from "../error/IError";

@ImplementsDecorator(IProgressableType, IProgressorType)
export class Progressor<A extends IBaseApp<A>, P, R=unknown> extends AbortController<A, R> implements IProgressor<A, P>
{
    private _onProgress:(progress:number, data:P, localProgress:number) => true | IAborted | IError;
    
    private _progress = 0;
    private _remainingPercentThatCanBeAllocated = 1;
    public get progress():number { return this._progress; }

    private _toComplete = 0;
    private _setProgressCalled = false;

    /**
     * The signal that is triggered on progress.
     */
    private _onProgressSignal:IWeakSignal<[IProgressor<A, P>, number, P]> | undefined;
    public get onProgressSignal():IWeakSignal<[IProgressor<A, P>, number, P]> { return this._onProgressSignal ?? (this._onProgressSignal = new WeakSignal(this._app)); }
    
    constructor(app:A, onProgress:(progress:number, data:P, localProgress:number) => true | IAborted | IError, abortables:IAbortable[] | IAbortable, shouldAbortFunction?:(value?:any) => (false | string | [string, R]));
    constructor(app:A, onProgress:(progress:number, data:P, localProgress:number) => true | IAborted | IError, shouldAbortFunction?:(value?:any) => (false | string | [string, R]));
    constructor(app:A, onProgress:(progress:number, data:P, localProgress:number) => true | IAborted | IError, ...args:any[])
    {
        super(app, ...args);

        this._onProgress = onProgress;
    }

    /**
     * Creates a sub-progressor representing a slice of the current progressor's remaining progress.
     * This method allows for the partitioning of progress tracking into smaller segments, each with its
     * own callback for progress updates. Once a slice has been extracted, the remaining allocatable
     * progress is adjusted to reflect the allocated portion. Attempting to create a slice after
     * `setProgress` has been called will result in an error.
     *
     * @template F The data type associated with the progress update of the returned sub-progressor. If not provided,
     * it defaults to the parent progressor's data type `D`.
     * @param {number} percent The percentage of the remaining allocatable progress to be represented by the new slice.
     * Must be a positive value, not exceeding the total remaining progress.
     * @param {(progress: number, data: F) => IAborted | true} [onProgress] Optional. The callback to be invoked on progress
     * updates for the returned sub-progressor. If not provided, the parent progressor's callback is used.
     * @returns {IProgressor<P> | IProgressor<F>} A new `Progressor` instance representing the allocated slice of progress.
     */
    public slice(percent:number):IProgressor<A, P>;
    public slice<F=P>(percent:number, onProgress:(progress:number, data:F, localProgress:number) => true | IAborted | IError):IProgressor<A, F>;
    public slice<F=P>(percent:number, onProgress?:(progress:number, data:F, localProgress:number) => true | IAborted | IError):IProgressor<A, P> | IProgressor<A, F>
    {
        if (this._setProgressCalled === true) this._app.throw('cannot extract after setProgress has been called', [], {correctable:true});
        if (percent === 0) this._app.throw('percent cannot be 0', [], {correctable:true});
        if (this._remainingPercentThatCanBeAllocated === 0) this._app.throw('no progress remaining', [], {correctable:true});

        const maxPercent = percent * this._remainingPercentThatCanBeAllocated;
        this._remainingPercentThatCanBeAllocated -= maxPercent;

        let lastResult = 0;
        
        this._toComplete++;
        let completed = false;

        const progresser = new Progressor(this._app, ((progress:number, data:P | F) =>
        {
            if (progress < 0) this._app.throw('progress cannot be less than 0', [], {correctable:true});
            if (progress > 1) this._app.throw('progress cannot exceed 1', [], {correctable:true});

            const result = progress * maxPercent;
            if (result < lastResult) this._app.throw('progress cannot decrease', [], {correctable:true});
            
            this._progress += result - lastResult;
            lastResult = result;

            //clamp
            this._progress = Math.min(1, Math.max(0, this._progress));

            if (progresser.aborted === true) return progresser as IAborted;

            if (progress === 1 && completed === false) 
            {
                this._toComplete--;
                completed = true;
            }

            return onProgress !== undefined ? onProgress(this._progress, data as F, progress) : this._onProgress(this._progress, data as P, progress);
        }), [this]) as IProgressor<A, P> | IProgressor<A, F>; //aborts the child if the parent is aborted

        return progresser;
    }
    
    /**
     * Divides a specified portion (or all) of the current progressor's remaining allocatable progress into a 
     * specified number of equally-sized slices, each represented as a new `Progressor` instance. This method 
     * is useful for scenarios where progress needs to be tracked across multiple parallel or sequential operations 
     * that each contribute equally to the defined portion of the overall progress.
     * 
     * The division can either encompass the entire remaining progress (default behavior when `percent` is not provided)
     * or a specific percentage of it, allowing for more granular control over the progress allocation.
     * 
     * @template F The data type associated with the progress update of the returned sub-progressors. If not provided,
     * it defaults to the parent progressor's data type `D`.
     * @param {number} count The number of slices to divide the progress into. Must be a positive integer.
     * @param {number} [percent] Optional. The percentage of the remaining allocatable progress to be divided 
     * among the slices. If not specified, the method divides all remaining allocatable progress.
     * @param {(progress: number, data: F) => IAborted | true} [onProgress] Optional. The callback to be invoked on progress
     * updates for each of the returned sub-progressors. If not provided, the parent progressor's callback is used.
     * @returns {Array<IProgressor<P> | IProgressor<F>>} An array of new `Progressor` instances, each representing an
     * equally-sized slice of the specified portion of the remaining allocatable progress.
     */
    public split(count:number, percent?:number):IProgressor<A, P>[];
    public split<F=P>(count:number, percent:number, onProgress:(progress:number, data:F, localProgress:number) => true | IAborted | IError):IProgressor<A, F>[];
    public split<F=P>(count:number, percent:number | undefined, onProgress?:(progress:number, data:F, localProgress:number) => true | IAborted | IError):IProgressor<A, F>[] | IProgressor<A, P>[]
    {
        if (count <= 0) this._app.throw('count cannot be less than or equal to 0', [], {correctable:true});

        const parts = [];
        const incrementPercent = (1 / count) * (percent ?? 1);
        let cumulativePercent = 0;
        for (let i = 0; i < count; i++)
        {
            cumulativePercent += incrementPercent;

            const part = this.slice(cumulativePercent, onProgress as any);
            parts.push(part);
        }

        return parts as IProgressor<A, P>[] | IProgressor<A, F>[];
    }

    public setProgress(progress:number | boolean, data:P):true | IAborted | IError
    {
        this._setProgressCalled = true;

        //if they pass in true, we increment the progress by the remaining progress / 2
        if (progress === true) progress = this._progress + (1 - this._progress) / 2;

        //if they pass in false, we don't change the progress, but still trigger the onProgress callback
        if (progress === false) progress = this._progress;

        if (this._aborted === true) return this as IAborted;
        if (progress < this._progress) this._app.throw('progress cannot decrease', [], {correctable:true});
        if (progress > 1) this._app.throw('progress cannot exceed 1', [], {correctable:true});
        if (progress < 0) this._app.throw('progress cannot be less than 0', [], {correctable:true}); 

        //we do this because of rounding errors. if there are parts, and all parts are complete, we want to make sure the progress is 1
        if (this._remainingPercentThatCanBeAllocated !== 1 && this._toComplete === 0) progress = 1;

        this._progress = progress;
    
        const result = this._onProgress(progress, data, progress);

        if (result !== undefined) return result;

        this._onProgressSignal?.dispatch(this, progress, data);

        return true;
    }
}