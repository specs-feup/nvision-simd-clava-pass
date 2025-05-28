import { Call, FunctionJp, Joinpoint } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";

import { type Filter_WrapperVariant } from "@specs-feup/lara/api/weaver/Selector.js"
import { getAllCalledFunctions } from "./calls.js";

function isAfterReferenceIndex(consideredJoinpoints: Joinpoint[], referenceIndex: number, jp: Joinpoint): boolean {
    return consideredJoinpoints.findIndex(findIndexJp => findIndexJp.equals(jp)) >= referenceIndex;
}

/**
 * 
 * @param baseJp serves as the base from which all other joinpoints will be searched from (only its descendants)
 * @param type what type of Joinpoint is to be searched
 * @param referenceJp only joinpoints after this one will be searched. NOTE: search is
 * preorder, therefore its children always come after
 * @param filter normal Query filter. Read @specs-feup/lara's Query.search documentation do learn more
 * @param referenceInclusive DEFAULT FALSE. Whether the first searched joinpoint should be referenceJp or the one after that
 * @param searchCalls DEFAULT FALSE. Whether the code inside functions called after referenceJp should be checked too. If enabled,
 * the search is recursive across all calls within calls
 * @returns a list of all joinpoints that adhere to the criteria
 */
export function getFromAfter<T extends typeof Joinpoint>(
    baseJp: Joinpoint,
    type: T,
    referenceJp: Joinpoint,
    filter?: Filter_WrapperVariant<T>,
    referenceInclusive: boolean = false,
    searchCalls: boolean = false
): InstanceType<T>[] {
    const jpsInsideBaseJp: Joinpoint[] = Query.searchFromInclusive(baseJp, Joinpoint).get();
    const referenceIndex: number = jpsInsideBaseJp.findIndex((jp) => jp.equals(referenceJp)) + (referenceInclusive ? 0 : 1);

    if (referenceIndex === -1) {
        throw new Error(`getFromAfter: referenceJp:\n${referenceJp.code}'\n\nis not a child of (or the very same) baseJp:\n${baseJp.code}\n`);
    }

    const topLevelJps: InstanceType<T>[] = Query.searchFromInclusive(baseJp, type, filter).get()
        .filter(filteringJp => isAfterReferenceIndex(jpsInsideBaseJp, referenceIndex, filteringJp));

    if (!searchCalls) return topLevelJps;

    const calledFunctions: Set<FunctionJp> = new Set(jpsInsideBaseJp.slice(referenceIndex).filter(jp => jp instanceof Call).flatMap(getAllCalledFunctions));
    const jpsInCalledFunctions: InstanceType<T>[] = [...calledFunctions].flatMap(fun => Query.searchFromInclusive(fun, type, filter).get());

    return [...topLevelJps, ...jpsInCalledFunctions];
}