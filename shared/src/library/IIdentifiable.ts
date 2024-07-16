/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export const IIdentifiableType = Symbol("IIdentifiable");

export interface IIdentifiable 
{
    /**
     * @return	Unique id, used for identification within a specific domain. (e.g. a component id, only guarenteed to be unique within the component's domain)
     */
    get id():string;
}