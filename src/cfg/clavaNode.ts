import ClavaNode from "@specs-feup/clava-flow/ClavaNode";

export function getIncomingClavaNodes(clavaNode: ClavaNode.Class): ClavaNode.Class[] {
    return clavaNode.incomers.toArray()
        .map(edge => edge.source)
        .filter(node => node.is(ClavaNode))
        .map(clavaNode => clavaNode.as(ClavaNode));
} 