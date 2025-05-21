import { registerSourceCode } from "../utils/jestHelpers.js"
import { Vardecl } from "@specs-feup/clava/api/Joinpoints.js";
import { isDeclaredWithLiteral } from "../utils/declarations.js"
import Query from "@specs-feup/lara/api/weaver/Query.js";

import fs from "node:fs";

const code = fs.readFileSync("./src/input/constprop/simple.c", "utf-8");

describe("simple test", () => {
    registerSourceCode(code);

    test("correct number of varDecls", () => {
        const varDecls: Vardecl[] = Query.search(Vardecl).get();
        expect(varDecls).toHaveLength(5);
    })

    test("All variables are declared with literals", () => {
        const varDecls: Vardecl[] = Query.search(Vardecl).get();
        for (const vardecl of varDecls) {
            expect(isDeclaredWithLiteral(vardecl)).toBe(true);
        }
    })
});