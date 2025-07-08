import ClavaFlowGraph from "@specs-feup/clava-flow/ClavaFlowGraph";
import { Expression, Joinpoint, Varref } from "@specs-feup/clava/api/Joinpoints.js";
import { getLastWrites } from "./writes.js";

export function valueIs<T extends typeof Joinpoint>(
    jp: Joinpoint,
    type: T,
    cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>
): InstanceType<T> | undefined {
    if (jp instanceof type) {
        return (jp as InstanceType<T>);
    }
    if (!((jp as Joinpoint) instanceof Varref)) return undefined;

    const lastWrites: Expression[] = getLastWrites(cfg, jp);
    if (lastWrites.length !== 1 || !(lastWrites[0] instanceof type)) return undefined;

    return lastWrites[0] as InstanceType<T>;
}