/**
 * @license		UNLICENSED
 * @date		04.01.2023
 * @copyright   Untitled.io
 * @author      John Brandle
 */

import { Main } from './Main';
import { DevEnvironment } from './core/DevEnvironment';

export default new Main(DevEnvironment.Prod).init();