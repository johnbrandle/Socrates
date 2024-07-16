/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { PromiseUtil as Shared } from '../../../../../../shared/src/library/utils/PromiseUtil.ts';
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from '../IBaseApp.ts';

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
@SealedDecorator()
export class PromiseUtil<A extends IBaseApp<A>> extends Shared<A>
{
    /**
     * Returns a Promise that resolves on the next animation frame.
     *
     * @returns {Promise<void>} - Promise that resolves on the next animation frame.
     */
    public nextAnimationFrame = ():Promise<void> => new Promise((resolve:() => void) => window.requestAnimationFrame(resolve));
}