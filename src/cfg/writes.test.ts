import { registerSourceCodeOnce, getFirstAndExpectExists, expectExists } from "../utils/jestHelpers.js";
import { Vardecl, BinaryOp, Joinpoint, UnaryOp, Program, Loop, FunctionJp, Scope, Param, Varref, Expression, IntLiteral } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";

import fs from "node:fs";

import { getLastWrites } from "./writes.js"
import ClavaFlowGraph from "@specs-feup/clava-flow/ClavaFlowGraph";
import ClavaCfgGenerator from "@specs-feup/clava-flow/transformation/ClavaCfgGenerator";
import Graph from "@specs-feup/flow/graph/Graph";
import { isVarrefOf } from "../utils/varReferences.js";

const baseCaseCode = fs.readFileSync("./src/input/cfg/writes/base_case.c", "utf-8");
const simpleLinearCode = fs.readFileSync("./src/input/cfg/writes/simple_linear.c", "utf-8");
const ifBranchCode = fs.readFileSync("./src/input/cfg/writes/if_branch.c", "utf-8");
const loopCode = fs.readFileSync("./src/input/cfg/writes/loop.c", "utf-8");
const nestingCode = fs.readFileSync("./src/input/cfg/writes/nesting.c", "utf-8");

describe("base case test", () => {
    let cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    beforeAll(() => {
        registerSourceCodeOnce(baseCaseCode);
        cfg = Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));

        console.log((Query.root() as Joinpoint).code);
    });

    test("finds a literal in from the declaration", () => {
        const aVarref: Varref = getFirstAndExpectExists(Varref, { "name": "a" });
        const declarationLiteral: IntLiteral = expectExists(Query.search(Vardecl, { name: "a" }).search(IntLiteral).getFirst());

        const lastWrites: Expression[] = getLastWrites(cfg, aVarref);
        expect(lastWrites).toHaveLength(1);
        expect(lastWrites[0].equals(declarationLiteral)).toBe(true);
    });
});

describe("simple linear test case", () => {
    let cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    beforeAll(() => {
        registerSourceCodeOnce(simpleLinearCode);
        cfg = Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));

        console.log((Query.root() as Joinpoint).code);
    });

    test("finds a literal in an assignment after declaration", () => {
        const aVarref: Varref = expectExists(Query.search(BinaryOp, { kind: "add" }).search(Varref, { "name": "a" }).getFirst());
        const assignmentLiteral: IntLiteral = expectExists(Query.search(BinaryOp, binop => {
            return binop.kind === "assign" && binop.left instanceof Varref && binop.left.name === "a"
        }).search(IntLiteral).getFirst());

        const lastWrites: Expression[] = getLastWrites(cfg, aVarref);
        expect(lastWrites).toHaveLength(1);
        expect(lastWrites[0].equals(assignmentLiteral)).toBe(true);
    });

    test("finds a varref in an assignment after declaration", () => {
        const bVarref: Varref = expectExists(Query.search(BinaryOp, { kind: "sub" }).search(Varref, { "name": "b" }).getFirst());
        const assignmentVarref: Varref = expectExists(Query.search(BinaryOp, binop => {
            return binop.kind === "assign" && binop.left instanceof Varref && binop.left.name === "b"
        }).search(Varref, { name: "a" }).getFirst());

        const lastWrites: Expression[] = getLastWrites(cfg, bVarref);
        expect(lastWrites).toHaveLength(1);
        expect(lastWrites[0].equals(assignmentVarref)).toBe(true);
    });
});

describe("if branch test case", () => {
    let cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    beforeAll(() => {
        registerSourceCodeOnce(ifBranchCode);
        cfg = Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));

        console.log((Query.root() as Joinpoint).code);
    });

    test("finds a literal in from the declaration", () => {
        const aVarref: Varref = expectExists(Query.search(BinaryOp, { kind: "add" }).search(Varref, { name: "a" }).getFirst());
        const declarationLiteral: IntLiteral = expectExists(Query.search(Vardecl, { name: "a" }).search(IntLiteral).getFirst());
        const unaryOperation: UnaryOp = getFirstAndExpectExists(UnaryOp, { kind: "post_inc" });

        const lastWrites: Expression[] = getLastWrites(cfg, aVarref);
        expect(lastWrites).toHaveLength(2);
        expect(
            (lastWrites[0].equals(declarationLiteral) && lastWrites[1].equals(unaryOperation))
            !== // xor
            (lastWrites[0].equals(unaryOperation) && lastWrites[1].equals(declarationLiteral))
        ).toBe(true);
    });
});

describe("loop test case", () => {
    let cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    beforeAll(() => {
        registerSourceCodeOnce(loopCode);
        cfg = Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));

        console.log((Query.root() as Joinpoint).code);
    });

    test("finds writes from before the for and after in the for", () => {
        const aVarref: Varref = expectExists(Query.search(BinaryOp, { kind: "add" }).search(Varref, { name: "a" }).getFirst());
        const aAssignLiteral: IntLiteral = expectExists(Query.search(BinaryOp, binop => isVarrefOf(binop.left, aVarref.vardecl)).search(IntLiteral).getFirst());
        const aPreInc: UnaryOp = getFirstAndExpectExists(UnaryOp, { kind: "pre_inc" });

        const lastWrites: Expression[] = getLastWrites(cfg, aVarref);
        expect(lastWrites).toHaveLength(2);
        expect(
            (lastWrites[0].equals(aAssignLiteral) && lastWrites[1].equals(aPreInc))
            !== // xor
            (lastWrites[0].equals(aPreInc) && lastWrites[1].equals(aAssignLiteral))
        ).toBe(true);
    });

    test("finds writes from loop init and the loop step", () => {
        const iVarref: Varref = expectExists(Query.search(BinaryOp, { kind: "add" }).search(Varref, { name: "i" }).getFirst());
        const iDeclLiteral: IntLiteral = expectExists(Query.search(Vardecl, { name: "i" }).search(IntLiteral).getFirst());
        const iPostInc: UnaryOp = getFirstAndExpectExists(UnaryOp, { kind: "post_inc" });

        const lastWrites: Expression[] = getLastWrites(cfg, iVarref);
        expect(lastWrites).toHaveLength(2);
        expect(
            (lastWrites[0].equals(iDeclLiteral) && lastWrites[1].equals(iPostInc))
            !== // xor
            (lastWrites[0].equals(iPostInc) && lastWrites[1].equals(iDeclLiteral))
        ).toBe(true);
    });

    test("finds writes from before inside and outside the for", () => {
        const aVarref: Varref = expectExists(Query.search(BinaryOp, { kind: "sub" }).search(Varref, { name: "a" }).getFirst());
        const aAssignLiteral: IntLiteral = expectExists(Query.search(BinaryOp, binop => isVarrefOf(binop.left, aVarref.vardecl)).search(IntLiteral).getFirst());
        const aPreInc: UnaryOp = getFirstAndExpectExists(UnaryOp, { kind: "pre_inc" });

        const lastWrites: Expression[] = getLastWrites(cfg, aVarref);
        expect(lastWrites).toHaveLength(2);
        expect(
            (lastWrites[0].equals(aAssignLiteral) && lastWrites[1].equals(aPreInc))
            !== // xor
            (lastWrites[0].equals(aPreInc) && lastWrites[1].equals(aAssignLiteral))
        ).toBe(true);
    });
});

describe("nesting test case", () => {
    let cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    beforeAll(() => {
        registerSourceCodeOnce(nestingCode);
        cfg = Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));

        console.log((Query.root() as Joinpoint).code);
    });

    test("the outer loop a++ cuts the branch off, therefore only the outer loop step and init are found", () => {
        const aVarref: Varref = expectExists(Query.search(BinaryOp, { kind: "add" }).search(Varref, { name: "a" }).getFirst());
        const aLoopInitLiteral: IntLiteral = expectExists(Query.search(Loop).search(BinaryOp, binOp => {
            return binOp.kind === "assign" && isVarrefOf(binOp.left, aVarref.vardecl)
        }).search(IntLiteral, intliteral => intliteral.code === "1").getFirst());
        const aPostDec: UnaryOp = getFirstAndExpectExists(UnaryOp, { kind: "post_dec" });

        const lastWrites: Expression[] = getLastWrites(cfg, aVarref);
        expect(lastWrites).toHaveLength(2);
        expect(
            (lastWrites[0].equals(aLoopInitLiteral) && lastWrites[1].equals(aPostDec))
            !== // xor
            (lastWrites[0].equals(aPostDec) && lastWrites[1].equals(aLoopInitLiteral))
        ).toBe(true);
    });

    test("the outer loop doesn't cut any branch off, therefore we find the inner loop step --b and the outer loop init", () => {
        const bVarref: Varref = expectExists(Query.search(BinaryOp, { kind: "sub" }).search(Varref, { name: "b" }).getFirst());
        const bLoopInitLiteral: IntLiteral = expectExists(Query.search(Loop).search(BinaryOp, binOp => {
            return binOp.kind === "assign" && isVarrefOf(binOp.left, bVarref.vardecl)
        }).search(IntLiteral, intliteral => intliteral.code === "1").getFirst());
        const bPostDec: UnaryOp = getFirstAndExpectExists(UnaryOp, { kind: "pre_dec" });

        const lastWrites: Expression[] = getLastWrites(cfg, bVarref);
        expect(lastWrites).toHaveLength(2);
        expect(
            (lastWrites[0].equals(bLoopInitLiteral) && lastWrites[1].equals(bPostDec))
            !== // xor
            (lastWrites[0].equals(bPostDec) && lastWrites[1].equals(bLoopInitLiteral))
        ).toBe(true);
    });

});
