import { registerSourceCodeOnce, getFirstAndExpectExists } from "../utils/jestHelpers.js";
import { Vardecl, BinaryOp, Joinpoint, UnaryOp, Program } from "@specs-feup/clava/api/Joinpoints.js";
import Query from "@specs-feup/lara/api/weaver/Query.js";

import fs from "node:fs";

import { findInCfg } from "./search.js"
import ClavaFlowGraph from "@specs-feup/clava-flow/ClavaFlowGraph";
import ClavaCfgGenerator from "@specs-feup/clava-flow/transformation/ClavaCfgGenerator";
import Graph from "@specs-feup/flow/graph/Graph";
import ForNode from "@specs-feup/clava-flow/cfg/node/condition/ForNode";
import IfNode from "@specs-feup/clava-flow/cfg/node/condition/IfNode";

const expressionsCode = fs.readFileSync("./src/input/cfg/search/expressions.c", "utf-8");

describe("expressions test case", () => {
    let cfg: ClavaFlowGraph.Class<ClavaFlowGraph.Data, ClavaFlowGraph.ScratchData>;

    beforeAll(() => {
        registerSourceCodeOnce(expressionsCode);
        cfg = Graph.create()
            .apply(new ClavaCfgGenerator(Query.root() as Program));

        console.log((Query.root() as Joinpoint).code);
    });

    test("finds normal binop statement", () => {
        const sum: BinaryOp = getFirstAndExpectExists(BinaryOp, { "kind": "add" });
        const found = findInCfg(cfg, sum);
        expect(found).toBeDefined();
        expect(found?.jp?.code).toBe("1 + 1");
    });

    test("finds binop inside if header", () => {
        const gt: BinaryOp = getFirstAndExpectExists(BinaryOp, { "kind": "gt" });
        const found = findInCfg(cfg, gt);
        expect(found).toBeDefined();
        expect(found?.is(IfNode)).toBe(true);
    });

    test("finds initialization in forloop header", () => {
        const vardecl: Vardecl = getFirstAndExpectExists(Vardecl, { "name": "i" });
        const found = findInCfg(cfg, vardecl);
        expect(found).toBeDefined();
        expect(found?.jp?.code).toBe("int i = 0");
    });


    test("finds comparison in forloop header", () => {
        const lt: BinaryOp = getFirstAndExpectExists(BinaryOp, { "kind": "lt" });
        const found = findInCfg(cfg, lt);
        expect(found).toBeDefined();
        expect(found?.is(ForNode)).toBe(true);
    });

    test("finds increment in forloop header", () => {
        const post_inc: UnaryOp = getFirstAndExpectExists(UnaryOp, { "kind": "post_inc" });
        const found = findInCfg(cfg, post_inc);
        expect(found).toBeDefined();
        expect(found?.jp?.code).toBe("i++");
    });

    test("finds expressions inside forloop body", () => {
        const pre_inc: UnaryOp = getFirstAndExpectExists(UnaryOp, { "kind": "pre_inc" });
        expect(findInCfg(cfg, pre_inc)).toBeDefined();
        const found = findInCfg(cfg, pre_inc);
        expect(found).toBeDefined();
        expect(found?.jp?.code).toBe("++i");
    });
});