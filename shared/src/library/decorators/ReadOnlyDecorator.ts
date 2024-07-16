/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

const defineProperty = Object.defineProperty.bind(Object);

export function ReadOnlyDecorator(target:any, propertyKey:string) 
{
    defineProperty(target, propertyKey, {writable:false, configurable:false});
}