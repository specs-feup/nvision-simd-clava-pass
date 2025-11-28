import process from "node:process";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import Clava from "@specs-feup/clava/api/clava/Clava.js";
import { applyPass } from "./pass.js";

// import WeaverLauncher from "@specs-feup/lara/code/WeaverLauncher.js";
// import { weaverConfig, printstuff } from "./myWeaverConfig.js";

// printstuff();

// const weaverLauncher = new WeaverLauncher(weaverConfig);
// await weaverLauncher.execute();

// console.log(`argv: ««${process.argv.toString()}»», arguments: ${Clava.getProgram()}`);

// const argv = yargs(hideBin(process.argv))
//     .options({
//         verbose: {
//             type: 'boolean',
//             describe: "hi",
//             alias: 'v',
//             default: false
//         },
//         'use-sw-sim': {
//             type: 'boolean',
//             describe: "something",
//             default: false
//         },
//         'input': {
//             type: 'string',
//             alias: 'i',
//             required: true,
//             describe: "A Clava input string. "
//         },
//         'output-path': {
//             type: 'string',
//             alias: 'o',
//             required: true,
//             normalize: true,
//             default: "woven_code",
//             describe: "Directory where the output should be written"
//         }
//     })
//     .parseSync();

// // Clava.runClava(['-p', argv.input]);
// console.log(`verbose: ${argv.verbose}`);
// console.log(`use-sw-sim: ${argv.useSwSim}`);
// console.log(`: ${argv.outputPath}`);
// console.log(`input file(s): ${argv.input}`);

applyPass(true, false);
// Clava.writeCode(argv.outputPath);