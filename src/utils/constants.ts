import { Joinpoint, UnaryOp, Vardecl, Varref } from "@specs-feup/clava/api/Joinpoints.js";
import { getAllDirectAssignments, getAllDirectAssignmentsIn, getAllIndirectAssignments, getAllIndirectAssignmentsIn } from "./assignments.js";
import { isVarrefOf } from "./varReferences.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";

/**
 * Checks whether a variable is constant, i.e. its value is not changed, in any descendant
 * node of baseJp after referenceJp.
 * baseJp is inclusive, referenceJp is exclusive.
 * 
 * All limitations associated with the other isConstant functions also apply.
 * 
 * Consider the following C code: "int a, b;  while(true) { a = 1; b = a; }"
 * When propagating the a constant, we can safely substitute "b = a" for "b = 1", but only
 * if 'a' does not change its value after the assignment of the variable 'b', i.e if 
 * isConstantAfter(a, whileLoop, b = a) (in pseudocode)
 */
export function isConstantInAfter(varDecl: Vardecl, baseJp: Joinpoint, referenceJp: Joinpoint) {
    const consideredJoinpoints: Joinpoint[] = Query.searchFromInclusive(baseJp, Joinpoint).get();
    const referenceJpIndex = consideredJoinpoints.findIndex((jp) => jp.astId === referenceJp.astId);

    if (referenceJpIndex === -1) {
        throw new Error(`isConstantInAfter: referenceJp:\n${referenceJp.code}'\n\nis not a child of (or the very same) baseJp:\n${baseJp.code}\n`);
    }

    for (let i = referenceJpIndex; i < consideredJoinpoints.length; i++) {
        const currentJp: Joinpoint = consideredJoinpoints[i];
        if (currentJp instanceof Varref) {
            if (!isVarrefOf(currentJp, varDecl)) {
                continue;
            }

            if (currentJp.parent instanceof UnaryOp && currentJp.parent.kind === "addr_of") {

            }
        }

    }
}

/**
 * Checks whether a variable is modified in any of the descendants of baseJp.
 * It checks for assignments directly to the variable, and also
 * assignments to a dereferenced pointer to the variable, supporting
 * only one level of indirection within function calls (e.g. we pass
 * a pointer to the var 'a' to a function and then we assign a value
 * to the dereferenced pointer)
 * 
 * This function does not account for unreachable code.
 * A pointer to a pointer to a variable, and further indirection
 * levels, are not be checked.
 */
export function isConstantIn(varDecl: Vardecl, baseJp: Joinpoint): boolean {
    return [...getAllDirectAssignmentsIn(varDecl, baseJp), ...getAllIndirectAssignmentsIn(varDecl, baseJp)].length === 0;
}

/**
 * Same as isContantIn but uses the root as the base joinpoint, effectively
 * checking if the constant is variable in the entirety of the program.
 */
export function isConstant(varDecl: Vardecl): boolean {
    return [...getAllDirectAssignments(varDecl), ...getAllIndirectAssignments(varDecl)].length === 0;
}
