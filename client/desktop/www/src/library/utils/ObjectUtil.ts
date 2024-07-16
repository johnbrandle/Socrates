/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ObjectUtil as Shared } from '../../../../../../shared/src/library/utils/ObjectUtil.ts';
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from '../IBaseApp.ts';

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
@SealedDecorator()
export class ObjectUtil<A extends IBaseApp<A>> extends Shared<A>
{
    public freeze<T>(object:T):Readonly<T>
    {
        return self.environment.frozen.freeze(object);
    }

    public seal<T>(object:T):T
    {
        return self.environment.frozen.seal(object);
    }
}