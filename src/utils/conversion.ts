import { Joinpoint } from "@specs-feup/clava/api/Joinpoints.js";

/**
 * Returns the input joinpoint cast to type T if it is an instance of T and conditions returns
 * true with it as an input, otherwise returns undefined
 */
export function tryAs<T extends typeof Joinpoint>(
    jp: Joinpoint,
    type: T,
    conditions?: (arg: InstanceType<T>) => boolean,
): InstanceType<T> | undefined {
    if (!(jp instanceof type)) return undefined;
    const castJp: InstanceType<T> = jp as InstanceType<T>;

    if (conditions !== undefined && conditions(castJp)) return castJp

    return undefined
}
