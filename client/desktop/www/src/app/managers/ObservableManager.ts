/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../../library/IBaseApp";
import { OnDestruct } from "../../../../../../shared/src/library/IDestructable";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import type { IObservable } from "../../../../../../shared/src/library/IObservable";
import { ObservableManager as SharedObservableManager } from "../../../../../../shared/src/library/managers/ObservableManager";

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
export class ObservableManager<A extends IBaseApp<A>> extends SharedObservableManager<A>
{
    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }

    protected override onObservableChanged(observable:IObservable, type:Symbol, changed:JsonObject | undefined):void
    {
        if (type === OnDestruct) this._app.gcUtil.mark(observable);
    }
}