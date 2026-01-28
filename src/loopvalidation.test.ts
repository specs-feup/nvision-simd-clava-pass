import { VecMulAccumulationReplacer } from "./pass.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";
import { getFirstAndExpectExists, registerSourceCodeOnce } from "./utils/jestHelpers.js";
import fs from "node:fs";
import { Joinpoint, Loop } from "@specs-feup/clava/api/Joinpoints.js";
import Clava from "@specs-feup/clava/api/clava/Clava.js";

const nestedForloopCode = fs.readFileSync("./src/input/pass/nested_loop.c", "utf-8");

describe("Matrix-vector multiplication with nested loop test case", () => {
    let vmar: VecMulAccumulationReplacer;

    beforeAll(() => {
        registerSourceCodeOnce(nestedForloopCode);
        
        vmar = new VecMulAccumulationReplacer(false);

        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("outer loop is not suitable", () => {
        const outerLoop: Loop = getFirstAndExpectExists(Loop, { nestedLevel: 0 });
        expect(vmar.analyseLoopValidity(outerLoop)).toBe(false);
    });

    test("inner loop is suitable", () => {
        const innerLoop: Loop = getFirstAndExpectExists(Loop, { nestedLevel: 1 });
        expect(vmar.analyseLoopValidity(innerLoop)).toBe(true);
    });
});