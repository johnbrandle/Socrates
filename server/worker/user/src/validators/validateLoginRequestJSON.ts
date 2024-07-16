/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { LoginRequestJSON } from "../../../../../shared/src/app/json/UserJSON.ts";
import { IApp } from "../../../shared/src/app/IApp.ts";

const EXPECTED_PROPERTY_COUNT = 3;

export function validateLoginRequestJSON<A extends IApp<A>>(app:IApp<A>, json:LoginRequestJSON, expectedPropertyCount:number=EXPECTED_PROPERTY_COUNT):Response | LoginRequestJSON
{
    return app.validatorUtil.notNull(json)
    ?? app.validatorUtil.hasPropertyCount(json, expectedPropertyCount)
    ?? app.validatorUtil.isHash(json.key, 512)
    ?? app.validatorUtil.isString(json.totp, 8, 8)
    ?? app.validatorUtil.isInteger(json.epoch, 1, Number.MAX_SAFE_INTEGER)
    ?? json;
}