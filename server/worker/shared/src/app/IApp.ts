/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IEnvironment } from "../../../../../shared/src/library/IEnvironment";
import { IBaseApp } from "../../../../shared/src/library/IBaseApp";
import { SQLUtil } from "../library/utils/SQLUtil";
import { ValidatorUtil } from "../library/utils/ValidatorUtil";
import { DurableObjectUtil } from "../library/utils/cloudflare/DurableObjectUtil";

export const IAppType = Symbol("IApp");

export interface IApp<A extends IApp<A>> extends IBaseApp<A>
{    
    get environment():IEnvironment;

    get sqlUtil():SQLUtil<A>;
    get validatorUtil():ValidatorUtil<A>;
    get durableObjectUtil():DurableObjectUtil<A>;
}