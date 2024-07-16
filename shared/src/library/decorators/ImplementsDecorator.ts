/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export const interfaceMap = new WeakMap<Function, Set<symbol> | Error>();

export function ImplementsDecorator(...interfaceSymbols:symbol[]) 
{
    return function (constructor:Function) 
    {
        setInterfaceSymbols(constructor, new Set(interfaceSymbols));
    };
}

export function setInterfaceSymbols(constructor:Function, interfaceSymbols:Set<symbol> | Error)
{
    if (interfaceMap.has(constructor) !== false) throw new Error(`Interface types already defined: ${constructor.name}`); //cannot use Framework Error here without causing circular dependency
        
    if (interfaceSymbols.constructor === Set && interfaceSymbols.size === 0) interfaceSymbols = new Error(`No interface symbols provided for: ${constructor.name}`); //cannot use Framework Error here without causing circular dependency

    interfaceMap.set(constructor, interfaceSymbols);
}

export function addInterfaceSymbol(constructor:Function, interfaceSymbol:symbol)
{
    let interfaceSymbols = interfaceMap.get(constructor);
    if (interfaceSymbols?.constructor !== Set) 
    {
        interfaceSymbols = new Set();
        interfaceMap.set(constructor, interfaceSymbols);
    }

    interfaceSymbols.add(interfaceSymbol);
}