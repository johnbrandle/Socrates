/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import type { IApp } from "../IApp.ts";

export class DownloadManager<A extends IApp<A>> extends DestructableEntity<A>
{
    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);

        this.#init();
    }

    #init()
    {
    }

    public download(url:string, filename:string)
    {
        //step 1: show dialog asking where to save

        //step 2: download to temp folder

        //step 3: move to final location

        //step 4: notify user

        //for now...just tell electron to download
    }
}