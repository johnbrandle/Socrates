/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IModel } from './IModel.ts';
import { IModelType } from './IModel.ts';
import { DestructableEntity } from '../entity/DestructableEntity.ts';
import { ImplementsDecorator } from '../decorators/ImplementsDecorator.ts';
import { IBaseApp } from '../IBaseApp.ts';

@ImplementsDecorator(IModelType)
export abstract class Model<A extends IBaseApp<A>> extends DestructableEntity<A> implements IModel {}