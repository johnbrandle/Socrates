/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SetExchangeRateRequestJSON } from "../../../../../shared/src/app/json/WalletJSON.ts";
import { IApp } from "../../../shared/src/app/IApp.ts";

const EXPECTED_PROPERTY_COUNT = 1;

export function validateSetExchangeRateRequestJSON<A extends IApp<A>>(app:IApp<A>, json:SetExchangeRateRequestJSON):Response | SetExchangeRateRequestJSON
{
    const ValidatorUtil = app.validatorUtil;

    return ValidatorUtil.notNull(json)
    ?? ValidatorUtil.hasPropertyCount(json, EXPECTED_PROPERTY_COUNT)
    ?? ValidatorUtil.isFloat(json.rate, Number.EPSILON, 1000) //tokens per dollar
    ?? json;
}