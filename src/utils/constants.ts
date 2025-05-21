import { Vardecl } from "@specs-feup/clava/api/Joinpoints.js";
import { getAllDirectAssignments, getAllIndirectAssignments } from "./assignments.js";

export function isConstant(varDecl: Vardecl): boolean {
    return [...getAllDirectAssignments(varDecl), ...getAllIndirectAssignments(varDecl)].length === 0;
}