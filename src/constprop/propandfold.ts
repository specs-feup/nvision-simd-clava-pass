import { ConstantFolder } from "@specs-feup/clava-code-transforms/ConstantFolder";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { propagateConstants } from "./constprop.js";
import { BinaryOp, Literal } from "@specs-feup/clava/api/Joinpoints.js";

class ConstantFolderAll extends ConstantFolder {
    protected getBinaryOps(): BinaryOp[] {
        return Query.search(BinaryOp, binOp => {
            return binOp.left instanceof Literal && binOp.right instanceof Literal;
        }).get();
    }
}

export function propagateAndFoldConstants(): number {
    let iterationChanges = 0, iteration = 0, totalChanges = 0;

    do {
        totalChanges += iterationChanges;
        iterationChanges = 0;
        const constantFolder = new ConstantFolderAll(true);
        iterationChanges += propagateConstants();
        iterationChanges += constantFolder.doPass();

        iteration++;
    } while (iterationChanges > 0 && iteration < 100);

    return totalChanges;
}
