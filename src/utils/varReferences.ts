import { BinaryOp, Expression, Joinpoint, UnaryOp, Vardecl, Varref } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";

export function getAllReferencesTo(variable: Vardecl): Varref[] {
    return Query.search(Varref, (varref) => isVarrefOf(varref, variable)).get();
}

/**
 * Checks whether a given JoinPoint contains (can be either itself or any of its descendants) a Varref of the provided varDecl
 *  
 * @param jp JoinPoint from which the search starts
 * @param varDecl Variable that is being search
 */
export function containsVarrefOf(jp: Joinpoint, varDecl: Vardecl): boolean {
    return Query.searchFromInclusive(jp, Varref, varref => varref.decl.equals(varDecl)).get().length !== 0;
}

/**
 * Checks whether the provided Joinpoint is a Varref of the provided varDecl
 */
export function isVarrefOf(jp: Joinpoint, varDecl: Vardecl): boolean {
    return jp instanceof Varref && jp.decl !== undefined && jp.decl !== null && jp.decl.equals(varDecl);
}

export function getAssignedExpression(varref: Varref): Expression {
    if (varref.use === "read") throw new Error(`Tried to get assigned value of a varref with use 'read'`);

    if (varref.use === "readwrite" && !(varref.parent instanceof UnaryOp)) {
        throw new Error(`readwrite varref «${varref.code}» of line ${varref.line} is not the child of a unary operator: «${varref.parent.code}»`);
    }
    if (varref.use === "readwrite") {
        return varref.parent as UnaryOp;
    }
    if (varref.use === "write" && varref.parent instanceof BinaryOp && varref.parent.left.equals(varref)) {
        return varref.parent.right;
    }

    throw new Error(`Unknown assigned value: «${varref.parent}» for variable «${varref.code}»`);
}