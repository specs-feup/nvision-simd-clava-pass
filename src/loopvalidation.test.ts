import { loopIsSuitable } from "./pass.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { getFirstAndExpectExists, registerSourceCodeOnce } from "./utils/jestHelpers.js";
import fs from "node:fs";
import { BinaryOp, Body, Joinpoint, Loop, Program } from "@specs-feup/clava/api/Joinpoints.js";
import Clava from "@specs-feup/clava/api/clava/Clava.js";
import ClavaFlowGraph from "@specs-feup/clava-flow/ClavaFlowGraph";
import Graph from "@specs-feup/flow/graph/Graph";
import ClavaCfgGenerator from "@specs-feup/clava-flow/transformation/ClavaCfgGenerator";
import SimplifyAssignment from "@specs-feup/clava/api/clava/code/SimplifyAssignment.js";

const nestedForloopCode = fs.readFileSync("./src/input/pass/nested_loop.c", "utf-8");

describe("Matrix-vector multiplication with nested loop test case", () => {
    let cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    beforeAll(() => {
        registerSourceCodeOnce(nestedForloopCode);
        
        cfg = Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));

        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("outer loop is not suitable", () => {
        const outerLoop: Loop = getFirstAndExpectExists(Loop, { nestedLevel: 0 });
        expect(loopIsSuitable(outerLoop, 4, cfg)).toBe(false);
    });

    test("inner loop is suitable", () => {
        const innerLoop: Loop = getFirstAndExpectExists(Loop, { nestedLevel: 1 });
        expect(loopIsSuitable(innerLoop, 4, cfg)).toBe(true);
    });
});