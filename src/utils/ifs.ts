import { If, Joinpoint } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";

export function isInIfCondition(jp: Joinpoint) {
    return Query.search(If, ifJp => ifJp.cond.astId === jp.astId || ifJp.cond.contains(jp)).get().length !== 0;
}