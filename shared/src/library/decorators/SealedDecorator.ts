/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

const seal = Object.seal.bind(Object);

export function SealedDecorator() 
{
    return function (constructor:new (...args:any) => any) 
    {
        //seal the constructor function to prevent modifying static properties
        seal(constructor);

        //seal the prototype to prevent modifying properties on the instance
        seal(constructor.prototype);
    };
}