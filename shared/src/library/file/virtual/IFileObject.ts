/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export const IFileObjectType = Symbol.for('IFileObject');

export interface IFileObject
{
    get name():string;
    get size():number;
    get type():string;
    arrayBuffer():Promise<ArrayBuffer>;
    stream():ReadableStream<Uint8Array>;
    text():Promise<string>;
}