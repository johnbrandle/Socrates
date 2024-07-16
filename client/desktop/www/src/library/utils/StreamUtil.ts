/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { StreamUtil as Shared } from '../../../../../../shared/src/library/utils/StreamUtil.ts';
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from '../IBaseApp.ts';

export type { 
    ITransformer, IVariableTransformer 
} from '../../../../../../shared/src/library/utils/StreamUtil.ts';

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
@SealedDecorator()
export class StreamUtil<A extends IBaseApp<A>> extends Shared<A> 
{
}