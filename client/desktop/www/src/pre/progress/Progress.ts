/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

const _currentScript = document.currentScript;

import { DevEnvironment } from '../../../../../../shared/src/library/IEnvironment.ts';
import type { IProgress } from './IProgress.ts';

export class Progress implements IProgress
{
    #_element!:HTMLElement;

    constructor()
    {
        if (self.environment.frozen.isSingleWindowMode === true || self.environment.frozen.devEnvironment === DevEnvironment.Test) return;

        document.body.style.backgroundColor = '#000000';  
        
        this.#_element = document.getElementById(_currentScript!.getAttribute('data-progress-id-ref')!)!;
    }
}

self.environment.progress = new Progress();