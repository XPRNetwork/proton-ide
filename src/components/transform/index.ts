// @ts-nocheck

import { Transform } from "assemblyscript/transform";
import * as preprocess from "./preprocess";
import { getContractInfo } from "./contract/contract";
import { Program } from "assemblyscript";
import * as path from "path";
import process from "process"

// TODO: refactor to ts code
export class ContractTransform extends Transform {
    afterInitialize(program: Program): void {
        // TODO: support cli args, see https://github.com/AssemblyScript/assemblyscript/issues/1691
        // TODO: add a config file
        let source = program.sources[0];
        // TODO: make sure the semantics
        for (const src of program.sources) {
            if (
                src.sourceKind === 1 &&
                src.simplePath !== "index-incremental"
            ) {
                source = src;
                break;
            }
        }
        const info = getContractInfo(program);
        const internalPath = info.contract.classPrototype.internalName.split('/')
        const internalFolder = internalPath.slice(0, internalPath.length - 2)
        const internalFile = internalPath[internalPath.length - 2]
        const abi = preprocess.getAbiInfo(info);
        const out = preprocess.getExtCodeInfo(info);
        const baseDir = path.join(...internalFolder, "target");
        out.entryDir = baseDir;
        process.sourceModifier = out;
        const abiPath = path.join(internalFolder.map(_ => '..').join(path.sep), '..', baseDir, `${internalFile}.abi`);
        console.log("++++++writeFile:", abiPath);
        console.log(abi)
        // this.writeFile(abiPath, abi, baseDir);
    }
}
