import Query from "@specs-feup/lara/api/weaver/Query.js";
import { registerSourceCodeOnce } from "./utils/jestHelpers.js";
import fs from "node:fs";
import { Joinpoint } from "@specs-feup/clava/api/Joinpoints.js";
import Clava from "@specs-feup/clava/api/clava/Clava.js";

import { applyPass } from "./pass.js"
const forloop = fs.readFileSync("./src/input/forloop.c", "utf-8");

describe("debug", () => {
    beforeAll(() => {
        registerSourceCodeOnce(forloop);
        console.log((Query.root() as Joinpoint).code);
    });

    afterAll(() => {
        Clava.getProgram().pop();
    });

    test("debug", () => {
        console.log("before pass");
        applyPass();
        console.log("after pass");
    });
});