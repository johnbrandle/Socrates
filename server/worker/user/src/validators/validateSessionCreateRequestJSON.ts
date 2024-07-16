/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SessionCreateRequestJSON } from "../../../../../shared/src/app/json/UserJSON.ts";
import { IApp } from "../../../shared/src/app/IApp.ts";

const EXPECTED_PROPERTY_COUNT = 2;

export function validateSessionCreateRequestJSON<A extends IApp<A>>(app:IApp<A>, json:SessionCreateRequestJSON):Response | SessionCreateRequestJSON
{
    return app.validatorUtil.notNull(json)
    ?? app.validatorUtil.hasPropertyCount(json, EXPECTED_PROPERTY_COUNT)
    ?? app.validatorUtil.isID(json.userID)
    ?? app.validatorUtil.isHash(json.loginToken, 256)
    ?? json;
}