// @ts-nocheck
import { APIOptions } from "assemblyscript/cli/asc";
import { SourceModifier, ModifyPoint, ModifyType } from "./preprocess";
import * as path from "path";
import * as fs from "fs";
export class APIOptionImpl implements APIOptions {
    modifySourceText(sourceText: string, point: ModifyPoint): string {
        console.log("++++++++++ascoption.ts:modifySourceText:", point.code);
        if (point.mode == ModifyType.REPLACE) {
            const prefix = sourceText.substring(0, point.range.start);
            const suffix = sourceText.substring(point.range.end, sourceText.length);
            return prefix + point.code + suffix;
        } else if (point.mode == ModifyType.APPEND) {
            return sourceText + point.code;
        }
        return sourceText;
    }

    readFile(filename: string, baseDir: string) : string | null {
        console.log("++++++++++ascoption.ts:readFile:", filename, baseDir);
        const name = path.resolve(baseDir, filename);
        try {
            let text = fs.readFileSync(name, "utf8");
            const sourceModifier = process.sourceModifier ? process.sourceModifier : new SourceModifier();
            if (sourceModifier.fileExtMap.has(filename)) {
                const extCodes = sourceModifier.fileExtMap.get(filename);
                extCodes!.sort((a: ModifyPoint, b: ModifyPoint) => (b.range.end - a.range.end)).forEach(item => {
                    console.log("++++++point.code:", item.code);
                    text = this.modifySourceText(text, item);
                });
            }
            return text;
        } catch (e) {
            console.log(`Process file: ${filename} failed. Details: ${e}`);
            return null;
        }
    }
}