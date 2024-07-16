/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Main } from './Main';
import { DevEnvironment } from './core/DevEnvironment';

export default new Main(DevEnvironment.Dev).init();