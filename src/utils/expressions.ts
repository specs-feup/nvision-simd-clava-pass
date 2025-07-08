import { BinaryOp, Expression, UnaryOp } from "@specs-feup/clava/api/Joinpoints.js";

function commutativeBinOpsAreEquivalent(first: BinaryOp, second: BinaryOp): boolean {
    // TODO
    return false;
}

function nonCommutativeBinOpsAreEquivalent(first: BinaryOp, second: BinaryOp): boolean {
    // TODO
    return false;
}

function binaryOpsAreEquiavalent(first: BinaryOp, second: BinaryOp): boolean {
    if (first.kind !== second.kind) return false;

    //if (first.kind === "add" || first.kind === "mul" || first.kind === "eq" || first.kind === "and" || first.kind === "or" || first.kind === "ne")

    // TODO
    return false;
}

function unaryOpsAreEquivalent(first: UnaryOp, second: UnaryOp): boolean {
    // TODO
    if (first.kind !== second.kind) return false;

    if (first.firstChild === undefined && second.firstChild === undefined) return true;
    else if (first.firstChild instanceof Expression && second.firstChild instanceof Expression) {
        return isEquivalent(first.firstChild, second.firstChild);
    }

    return false;
}

export function isEquivalent(first: Expression, second: Expression): boolean {
    // TODO
    if (first.constructor !== second.constructor) return false;

    if (first instanceof UnaryOp && second instanceof UnaryOp) {
        return unaryOpsAreEquivalent(first, second);
    }
    else if (first instanceof BinaryOp && second instanceof BinaryOp) {
        return binaryOpsAreEquiavalent(first, second);
    }

    return false;
}