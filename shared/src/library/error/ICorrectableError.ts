/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IError } from "./IError";

export const ICorrectableErrorType = Symbol("ICorrectableError");

/**
 * Represents errors attributable to developer oversight. The designation "correctable" suggests 
 * these errors are fundamentally avoidable, and their occurrence signals a lapse in development rigor.
 * 
 * @note Error Handling Strategy:
 * 
 * This strategy delineates the handling of correctable versus normal errors to promote
 * consistency and clarity across the application. Correctable errors, typically resulting from 
 * developer oversight or validation failures, undergo a distinct handling path compared to 
 * normal errors, which arise from unpredictable runtime conditions.
 * 
 * 1. **Throwing Errors**: When a correctable error occurs, it should be thrown as usual. These errors
 *    are expected to be minimized through careful coding and validation practices.
 * 
 * 2. **Error Propagation**: Correctable errors bubble up the call stack until intercepted by a 
 *    method designed to catch framework errors.
 * 
 * 3. **Error Wrapping**: Upon catching a correctable error, instead of processing it directly, the 
 *    handling method wraps it in a new, framework error wrapper. This step unifies the 
 *    treatment of all errors, allowing them to be managed through a standardized process while 
 *    still acknowledging their preventable nature.
 * 
 * 4. **Handling and Resolution**: The wrapped error is then passed up to its caller, which handles 
 *    it by error—logging, displaying user-friendly messages, or executing recovery actions as appropriate.
 * 
 * @note This is why correctable errors do not have a static warn method, as they are supposed to be
 * thrown and potentially caught by the caller.
 */
export interface ICorrectableError extends IError
{
    get correctable():true;
}