/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export const ITileDataType = Symbol("ITileData");

export interface ITileData
{
    id:string;
    invalidated:boolean;
    selected:boolean;
}