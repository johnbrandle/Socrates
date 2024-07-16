/**
 * `IResolveOnlyPromise` is a native JavaScript `Promise` that is supposed to never reject.
 */
export type IResolveOnlyPromise<T> = Promise<T>;

export const IResolveOnlyPromiseType = Symbol("IResolveOnlyPromise");