import { BinaryOp, Call, Joinpoint, Literal, Loop, Op, UnaryOp, Vardecl, Varref } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { isDeclaredWithLiteral } from "../utils/declarations.js"
import { getAllReferencesTo } from "../utils/varReferences.js"
import { PositionRelToLoop, getNearestAncestorLoop, getPositionRelativeToOuterLoop } from "../utils/loops.js"
import { isAddressof } from "../utils/unaryOperations.js";
import { isConstantIn } from "../utils/constants.js";
import { getAllIndirectAssignmentsIn } from "../utils/assignments.js";

function constructValuesTable(variables: Vardecl[]): Map<Vardecl, Literal | null> {
    const table = new Map<Vardecl, Literal | null>();
    for (const variable of variables) {
        if (!isDeclaredWithLiteral(variable)) {
            table.set(variable, null);
        }
        else if (variable.children?.length === 1 && variable.getChild(0) instanceof Literal) {
            table.set(variable, variable.getChild(0) as Literal);
        } else {
            throw new Error("Variable is declared with Literal but no Literal child found: " + variable.code);
        }
    }

    return table;
}

function canReplaceReadVarref(varref: Varref, valueInTable: Literal | null, positionInLoop: PositionRelToLoop): boolean {
    if (valueInTable === null) return false;

    if (varref.parent instanceof Op && isAddressof(varref.parent)) {
        return false;
    }

    if (positionInLoop === PositionRelToLoop.OUTSIDE || positionInLoop === PositionRelToLoop.INITIALIZATION) {
        return true;
    }

    const ancestorLoop: Loop = getNearestAncestorLoop(varref)!;

    if ((positionInLoop === PositionRelToLoop.CONDITION || positionInLoop === PositionRelToLoop.STEP)) {
        return isConstantIn(varref.decl as Vardecl, ancestorLoop);
    } else if (positionInLoop === PositionRelToLoop.BODY) {
        return true; // TODO
    }
    return false;
}

export function propagateConstants(): void {
    let changes: number = 0;
    let cycle: number = 0;
    do {
        changes = 0;
        const variables: Vardecl[] = Query.search(Vardecl).get();
        const values: Map<Vardecl, Literal | null> = constructValuesTable(variables);

        for (const variable of variables) {
            const varrefs: Varref[] = getAllReferencesTo(variable);

            for (const varref of varrefs) {
                const relativeLoopPos: PositionRelToLoop = getPositionRelativeToOuterLoop(varref);

                if (varref.use === "write") {
                    const parent: Joinpoint = varref.parent;
                    if (relativeLoopPos !== PositionRelToLoop.CONDITION && parent instanceof BinaryOp && parent.kind === "assign" && parent.right instanceof Literal) {
                        values.set(variable, parent.right);
                        continue;
                    }
                    values.set(variable, null);
                    continue;
                }

                const currentVariableValue: Literal | null | undefined = values.get(variable);
                if (currentVariableValue === undefined) {
                    throw new Error("Variable not found in values table: " + variable.code);
                }

                if (varref.use === "read") {
                    const parent = varref.parent;
                    if (varref.parent instanceof UnaryOp && varref.parent.kind === "addr_of" && varref.parent.parent instanceof Call && getAllIndirectAssignmentsIn(variable, varref.parent.parent).length !== 0) {
                        values.set(variable, null);
                        continue;
                    }

                    if (!canReplaceReadVarref(varref, currentVariableValue, relativeLoopPos)) {
                        continue;
                    }

                    varref.replaceWith((currentVariableValue as Literal).copy());
                    changes++;
                } else if (varref.use === "readwrite") {
                    values.set(variable, null);
                } else {
                    throw new Error("Unknown varref use");
                }
            }
        }

        cycle++;
    } while (changes > 0 && cycle < 100)

}