// @ts-nocheck

import { DecoratorKind, DecoratorNode, Expression, IdentifierExpression, NodeKind } from "assemblyscript/dist/assemblyscript";
import { ContractDecoratorKind } from "../enums/decorator";
import { RangeUtil } from "../utils/utils";

const toCharCode = (char: string) => char.charCodeAt(0);

function fromNode(nameNode: Expression): ContractDecoratorKind {
    if (nameNode.kind == NodeKind.IDENTIFIER) {
        const nameStr = (<IdentifierExpression>nameNode).text;
        switch (toCharCode(nameStr)) {
            case toCharCode("a"): {
                if (nameStr == "action") return ContractDecoratorKind.ACTION;
                break;
            }
            case toCharCode("b"): {
                if (nameStr == "binaryextension") return ContractDecoratorKind.BINARYEXTENSION;
                break;
            }
            case toCharCode("c"): {
                if (nameStr == "contract") return ContractDecoratorKind.CONTRACT;
                break;
            }
            case toCharCode("i"): {
                if (nameStr == "ignore") return ContractDecoratorKind.IGNORE;
                break;
            }
            case toCharCode("o"): {
                if (nameStr == "optional") return ContractDecoratorKind.OPTIONAL;
                break;
            }
            case toCharCode("p"): {
                if (nameStr == "packer") return ContractDecoratorKind.SERIALIZER;
                if (nameStr == "primary") return ContractDecoratorKind.PRIMARY;
                break;
            }
            case toCharCode("s"): {
                if (nameStr == "secondary") return ContractDecoratorKind.SECONDARY;
                if (nameStr == "serializer") return ContractDecoratorKind.SERIALIZER;
                break;
            }
            case toCharCode("t"): {
                if (nameStr == "table") return ContractDecoratorKind.TABLE;
                break;
            }
            case toCharCode("v"): {
                if (nameStr == "variant") return ContractDecoratorKind.VARIANT;
                break;
            }
        }
    }
    return ContractDecoratorKind.OTHER;
}

export function getCustomDecoratorKind(decorator: DecoratorNode): ContractDecoratorKind {
    if (decorator.decoratorKind != DecoratorKind.CUSTOM) {
        return ContractDecoratorKind.INTERNAL;
    }
    const kind = fromNode(decorator.name);
    if (kind == ContractDecoratorKind.OTHER) {
        throw new Error(`The contract don't support the decorator ${decorator.name.range.toString()}, please check ${RangeUtil.location(decorator.range)}`);
    }
    return kind;
}
