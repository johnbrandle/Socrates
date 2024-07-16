/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export const ResultJSONType = Symbol.for('ResultJSON');

export interface ResultJSON
{
    success?:boolean;
}