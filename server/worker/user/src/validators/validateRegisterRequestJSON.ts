/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { RegisterRequestJSON } from "../../../../../shared/src/app/json/UserJSON.ts";
import { validateLoginRequestJSON } from './validateLoginRequestJSON.ts';
import { IApp } from "../../../shared/src/app/IApp.ts";

const EXPECTED_PROPERTY_COUNT = 5;

export function validateRegisterRequestJSON<A extends IApp<A>>(app:IApp<A>, json:RegisterRequestJSON):Response | RegisterRequestJSON
{
    return app.validatorUtil.notNull(json) 
    ?? app.validatorUtil.isBase24(json.totpSecret, 21, 21)
    ?? app.validatorUtil.isString(json.encrypted, 1, 10000)
    ?? validateLoginRequestJSON(app, json, EXPECTED_PROPERTY_COUNT) as Response | RegisterRequestJSON;
}