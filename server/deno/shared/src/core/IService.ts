/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export interface IService
{
    fetch(request:Request, env:CommonEnv, context:ExecutionContext):Promise<Response>;
    get env():CommonEnv;
}