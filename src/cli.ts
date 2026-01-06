import yargs from "yargs";
import { applyPass } from "./pass.js";
import Clava from "@specs-feup/clava/api/clava/Clava.js";
import Weaver from "@specs-feup/lara/api/weaver/Weaver.js";

// console.log(Weaver.laraArgs);
const args: string = Weaver.laraArgs["cli-args"] as string;

const argv = yargs(args)
    .options({
        silent: {
            type: 'boolean',
            describe: "Disables debugging information.",
            alias: 's',
            default: false
        },
        'use-sw-sim': {
            type: 'boolean',
            describe: "Uses software to emulate/approximate the hardware's behaviour.",
            default: false
        },
        'input': {
            type: 'string',
            alias: 'i',
            required: true,
            describe: "A Clava input string, specifying a directory or file(s) that should be included."
        },
        'output-path': {
            type: 'string',
            alias: 'o',
            required: true,
            normalize: true,
            default: "woven_code",
            describe: "Directory where the output should be written."
        }
    })
    .parseSync();

// console.log(`silent: ${argv.silent}`);
// console.log(`use-sw-sim: ${argv.useSwSim}`);
// console.log(`output file: ${argv.outputPath}`);
// console.log(`input file(s): ${argv.input}`);

Clava.addExistingFile(argv.input);
Clava.rebuild();

applyPass(argv.useSwSim, argv.silent);
Clava.writeCode(argv.outputPath);
