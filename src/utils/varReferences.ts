import { Joinpoint, Vardecl, Varref } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";

export function containsVarrefOf(jp: Joinpoint, varDecl: Vardecl): boolean {
    return Query.searchFromInclusive(jp, Varref, varref => varref.decl.equals(varDecl)).get().length !== 0;
}

export function isVarrefOf(jp: Joinpoint, varDecl: Vardecl) {
    return jp instanceof Varref && jp.decl.equals(varDecl);
}