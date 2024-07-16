/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IComponent } from "../components/IComponent";

export const componentsByConstructorMap = new Map<new (...args: any[]) => IComponent, string>(); //values set in Main.ts
export const componentsByPathMap = new Map<string, new (...args: any[]) => IComponent>(); //values set in Main.ts

export function ComponentDecorator() 
{
    return function (constructor:Function) 
    {
        //Main.ts will look for this to know if the class is a component
        componentsByConstructorMap.set(constructor as new (...args: any[]) => IComponent, '');
    };
}
