import WeaverConfiguration from "@specs-feup/lara/code/WeaverConfiguration.js";
import path from "path";
import { fileURLToPath } from "url";

export const weaverConfig: WeaverConfiguration = {
    weaverName: "clava",
    weaverPrettyName: "Clava",
    weaverFileName: "@specs-feup/lara/code/Weaver.js",
    jarPath: path.join(
        path.dirname(path.dirname(import.meta.resolve("@specs-feup/clava/code/index.js"))),
        "./java-binaries/"
    ),
    javaWeaverQualifiedName: "pt.up.fe.specs.clava.weaver.CxxWeaver",
    importForSideEffects: ["@specs-feup/clava/api/Joinpoints.js", "@specs-feup/clava/code/sideEffects.js"],
};

export function printstuff(): void {
    console.log("...");
    console.log(`path: ${path.join(
        path.dirname(path.dirname(import.meta.resolve("@specs-feup/clava/code/index.js"))),
        "./java-binaries/"
    )}`);
}