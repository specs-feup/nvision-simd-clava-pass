import { BinaryOp, Joinpoint, Op, UnaryOp, Vardecl, Varref } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { getParentOp } from "./operations.js";
import { isAddressofToVar } from "./unaryOperations.js";
import { getAllReferencesToVariablePassedToFunctionsIn } from "./calls.js";

/**
 * Operations that directly modify the value of variable declared in varDecl. Includes
 * assignments and unary operations, but not operations involving the derreference
 * of pointers to the variable.
 * 
 * Searches descendants of baseJp, including itself.
 * 
 */
export function getAllDirectAssignmentsIn(baseJp: Joinpoint, varDecl: Vardecl): Op[] {
    return Query.searchFromInclusive(baseJp, Varref, (varref) => {
        if (varref.vardecl.equals(varDecl) && (varref.use === "write" || varref.use === "readwrite")) {
            return true;
        }
        return false;
    }).get().map(getParentOp);
}

/**
 * Same as getAllDirectAssignmentsIn but uses the root as the base joinpoint
 */
export function getAllDirectAssignments(varDecl: Vardecl): Op[] {
    return getAllDirectAssignmentsIn(Query.root() as Joinpoint, varDecl);
}

/**
 * Operations that dereference the variable declared in varDecl and change its underlying value.
 * 
 * Searches descendants of baseJp, including itself
 */
export function getAllDerefAssignmentsIn(baseJp: Joinpoint, varDecl: Vardecl): Op[] {
    return Query.searchFromInclusive(baseJp, UnaryOp, unaryOp => {
        return unaryOp.kind === "deref" && 
        (unaryOp.use === "write" || unaryOp.use === "readwrite") && 
        unaryOp.children.at(0) instanceof Varref && (unaryOp.children.at(0) as Varref)?.decl?.equals(varDecl);
    }).get();
}

/**
 * Same as getAllDerrefAssignmentsIn but uses the root as the base joinpoint
 */
export function getAllDerefAssignments(varDecl: Vardecl): Op[] {
    return getAllDerefAssignmentsIn(Query.root() as Joinpoint, varDecl);
}

/**
 * Returns all variables that are assigned a value of a pointer to the given variable in the
 * descendents of baseJp, including itself.
 * Only works on simple assignments or declarations, of the kind "type* foo = &bar"
 */
export function getAllPointersToVarIn(baseJp: Joinpoint, variable: Vardecl): Vardecl[] {
    const varAddressofs: UnaryOp[] = Query.searchFromInclusive(baseJp, UnaryOp, (uop) => isAddressofToVar(uop, variable)).get();

    const pointersToVar: Vardecl[] = [];

    for (const uop of varAddressofs) {
        const parent: Joinpoint = uop.parent;
        if (parent instanceof Vardecl) {
            pointersToVar.push(parent);
        } else if (parent instanceof BinaryOp && parent.kind === "assign" && parent.left instanceof Varref) {
            pointersToVar.push((parent.left as Varref).decl as Vardecl);
        }
    }

    return pointersToVar;
}

/**
 * WARNING: This function is **severely** limited.
 * Searches for operations that modify the contents of the variable declared in Vardecl, 
 * specifically those accomplish that by derreferencing a pointer to that variable.
 * Currently it only checks for function calls that receive a pointer to the variable via
 * the addressOf operator (&) and then use that pointer as described above. Any level 
 * of indirection (e.g. first creating a pointer, and then passing it to the function)
 * or other scenarios are not detected.
 * Reassigning the pointer variable to another address inside the function body, which may lead to
 * the original variable's value not actually being modified, is not checked for,
 * and so it might return operations that do not actually modify the variable.
 * 
 * Note: as the assignment of the parameters happen within the scope of their functions,
 * those joinpoints returned by this function are not guaranteed be descendants of baseJp,
 * though the call to that function is
 */
export function getAllIndirectAssignmentsIn(baseJp: Joinpoint, varDecl: Vardecl): Op[] {
    const pointersToVar = getAllPointersToVarIn(baseJp, varDecl);
    const assignmentsOfPointers = pointersToVar.flatMap((pointerVariable) => getAllDerefAssignmentsIn(baseJp, pointerVariable));

    const functionParametersThatArePointersToVar = getAllReferencesToVariablePassedToFunctionsIn(baseJp, varDecl).map(functionArgument => functionArgument.argumentDecl);
    const assignmentsOfParams = functionParametersThatArePointersToVar.flatMap(getAllDerefAssignments)

    return [...assignmentsOfPointers, ...assignmentsOfParams];
}

/**
 * Same as getAllIndirectAssignmentIn, but uses the root as the base joinpoint
 */
export function getAllIndirectAssignments(varDecl: Vardecl): Op[] {
    return getAllIndirectAssignmentsIn(Query.root() as Joinpoint, varDecl);
}