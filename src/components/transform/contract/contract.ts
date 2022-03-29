// @ts-nocheck

import {
    ClassPrototype,
    Program,
} from "assemblyscript";

import { ElementUtil } from "../utils/utils";

import {
    ContractInterpreter,
    SerializerInterpreter,
    ClassInterpreter,
    TableInterpreter
} from "./classdef";

import { NamedTypeNodeDef } from "./typedef";
import { RangeUtil } from "../utils/utils";
import {
    ABI,
    ABIAction,
    ABIStruct,
    ABIStructField,
    ABITable,
    VariantDef,
} from "../abi/abi";

import { ActionFunctionDef } from "./elementdef";
import { TypeKindEnum } from "../enums/customtype";
import { TypeHelper } from "../utils/typeutil";

export class ContractProgram {
    program: Program;
    contract!: ContractInterpreter;
    tables: TableInterpreter[] = [];
    serializers: ClassInterpreter[] = [];
    optionals: SerializerInterpreter[] = [];
    binaryExtensions: SerializerInterpreter[] = [];
    variants: SerializerInterpreter[] = [];
    customAbiTypes: SerializerInterpreter[] = [];
    allClasses: ClassInterpreter[] = [];

    public definedTypeMap: Map<string, NamedTypeNodeDef> = new Map<string, NamedTypeNodeDef>();

    constructor(program: Program) {
        this.program = program;
        this.resolveContract();
    }
    
    private resolveContract(): void {
        let countContract = 0;

        this.program.elementsByName.forEach((element, _) => {
            if (ElementUtil.isClass(element)) {
                this.allClasses.push(new ClassInterpreter(<ClassPrototype>element));
            }

            if (ElementUtil.isTopContractClass(element)) {
                countContract ++;
                this.contract = new ContractInterpreter(<ClassPrototype>element);
                if (countContract > 1) {
                    throw Error(`Only one Contract class allowed! Trace ${RangeUtil.location(this.contract.declaration.range)}`);
                }
            }

            if (ElementUtil.isTableClassPrototype(element)) {
                const intercepter = new TableInterpreter(<ClassPrototype>element);
                this.tables.push(intercepter);
                this.CheckClassFields(intercepter);
            }

            if (ElementUtil.isSerializerClassPrototype(element)) {
                const intercepter = new SerializerInterpreter(<ClassPrototype>element);
                this.AddSerializer(intercepter);
                this.CheckClassFields(intercepter);
            }

            if (ElementUtil.isOptionalClassPrototype(element)) {
                const intercepter = new SerializerInterpreter(<ClassPrototype>element);
                if (intercepter.fields.length > 1) {
                    throw Error(`optional class can only contain 1 member. Trace: ${RangeUtil.location(intercepter.range)}`);
                }
                const field = intercepter.fields[0];
                if (!field.declaration.type?.isNullable) {
                    throw Error(`optional member must be nullable! Trace: ${RangeUtil.location(intercepter.range)}`);
                }
                this.optionals.push(intercepter);
            }

            if (ElementUtil.isBinaryExtensionClassPrototype(element)) {
                const intercepter = new SerializerInterpreter(<ClassPrototype>element);
                if (intercepter.fields.length > 1) {
                    throw Error(`optional class can only contain 1 member. Trace: ${RangeUtil.location(intercepter.range)}`);
                }
                const field = intercepter.fields[0];
                if (!field.declaration.type?.isNullable) {
                    throw Error(`optional member must be nullable! Trace: ${RangeUtil.location(intercepter.range)}`);
                }
                this.binaryExtensions.push(intercepter);
            }

            if (ElementUtil.isVariantClassPrototype(element)) {
                const intercepter = new SerializerInterpreter(<ClassPrototype>element);
                const fieldMap = new Map<string, boolean>();
                intercepter.fields.forEach(x => {
                    const tp = x.type.plainTypeNode
                    if (fieldMap.has(tp)) {
                        throw new Error(`Duplicated type in variant ${intercepter.className}! Trace ${RangeUtil.location(x.declaration.range)}`)
                    }
                    fieldMap.set(tp, true);
                })
                this.variants.push(intercepter);
                this.CheckClassFields(intercepter);
            }
        });

        if (countContract != 1) {
            throw new Error(`The entry file should contain only one '@contract', in fact it has ${countContract}`);
        }

        this.contract!.actionFuncDefs.forEach(func => {
            func.parameters.forEach(para => {
                let cls = this.allClasses.find(cls => {
                     return cls.className == para.type.plainTypeNode;
                });
                if (cls) {
                    cls = new SerializerInterpreter(cls.classPrototype)
                    this.AddSerializer(cls);
                    this.CheckClassFields(cls);
                }
            });
        });

        this.setTypeSequence();
    }

    private CheckClassFields(cls: ClassInterpreter) {
        cls.fields.forEach(field => {
            let cls2 = this.allClasses.find(cls2 => {
                return cls2.className == field.type.plainTypeNode
            });

            if (cls2) {
                cls2 = new SerializerInterpreter(cls2.classPrototype)
                this.AddSerializer(cls2);
                this.CheckClassFields(cls2);
            }
        });
    }

    private AddSerializer(cls: ClassInterpreter) {
        if (TypeHelper.primitiveToAbiMap.get(cls.className)) {
            return
        }

        if (this.tables.find(x2 => x2.className == cls.className)) {
            return
        }

        if (this.variants.find(x2 => x2.className == cls.className)) {
            return
        }

        if (this.optionals.find(x2 => x2.className == cls.className)) {
            return
        }

        if (this.binaryExtensions.find(x2 => x2.className == cls.className)) {
            return
        }

        if (this.serializers.find(x => x.className == cls.className)) {
            return
        }
        this.serializers.push(cls);
    }

    private setTypeSequence(): void {
        if (this.contract) {
            this.contract.genTypeSequence(this.definedTypeMap);
        }
    }

    findType(plainType: string) {
        const tp = TypeHelper.primitiveToAbiMap.get(plainType)!;
        if (tp) {
            return tp;
        }

        let cls = <ClassInterpreter>this.optionals.find(x => {
            return x.className == plainType;
        });

        if (cls) {
            plainType = cls.fields[0].type.plainTypeNode.replace("chain.", "");
            const type = this.findType(plainType)!;
            if (type) {
                return type + "?";
            }
        }

        cls = <ClassInterpreter>this.binaryExtensions.find(x => {
            return x.className == plainType;
        });

        if (cls) {
            plainType = cls.fields[0].type.plainTypeNode.replace("chain.", "");
            const type = this.findType(plainType)!;
            if (type) {
                return type + "$";
            }
        }

        cls = <ClassInterpreter>this.allClasses.find(x => {
            return x.className == plainType;
        });

        if (cls) {
            return cls.className;
        }
        return "";
    }

    addAbiClass(cls: SerializerInterpreter) {
        if (this.customAbiTypes.find(x => x.className == cls.className)) {
            return;
        }

        if (ElementUtil.isVariantClassPrototype(cls.classPrototype)) {
            return;
        }

        this.customAbiTypes.push(cls);

        cls.fields.forEach(x => {
            const cls = this.findClass(x.type.plainTypeNode);
            if (cls) {
                this.addAbiClass(cls);
            }
        });
    }

    parseField(name: string, type: NamedTypeNodeDef) {
        const abiField = new ABIStructField();
        abiField.name = name;
        let plainType = type.plainTypeNode;
        if (type.typeNode.isNullable) {
            plainType = plainType.split('|')[0].trim();
        }

        if (type.typeKind == TypeKindEnum.ARRAY) {
            plainType = plainType.replace('[]', '');
            plainType = plainType.replace('Array<', '').replace('>', '');
        }

        if (plainType.indexOf('chain.') == 0) {
            plainType = plainType.replace('chain.', '');
        }

        abiField.type = this.findType(plainType);
        if (!abiField.type) {
            throw Error(`type of ${name} not found: ${plainType}`)
        }
    
        if (type.typeKind == TypeKindEnum.ARRAY) {
            if (abiField.type == "uint8") {
                abiField.type = "bytes";
            } else {
                abiField.type += "[]";
            }
        }
        return abiField;
    }
    
    findClass(className: string) {
        className = className.replace('[]', '');
        className = className.replace('Array<', '').replace('>', '');    

        if (TypeHelper.primitiveToAbiMap.get(className)) {
            return
        }

        const cls = this.allClasses.find(cls => {
            return cls.className == className;
        });
        if (cls) {
            return new SerializerInterpreter(cls.classPrototype);
        }
    }

    findAllAbiTypes() {
        [
            this.variants,
            this.tables,
            this.optionals,
            this.binaryExtensions
        ].forEach(classes => {
            classes.forEach(cls => {
                cls.fields.forEach(field => {
                    const plainType = field.type.plainTypeNode;
                    const fieldClassType = this.findClass(plainType)
                    if (fieldClassType) {
                        this.addAbiClass(fieldClassType);
                    }
                });
            });
        })

        this.contract.actionFuncDefs.forEach(func => {
            func.parameters.forEach(parameter => {
                const cls = this.findClass(parameter.type.plainTypeNode)
                if (cls) {
                    this.addAbiClass(cls);
                }
            });
        });
    }

    getAbiInfo() {
        const abi = new ABI();
        this.findAllAbiTypes();

        this.variants.forEach((variant, i) => {
            const def = new VariantDef();
            def.name = variant.className;
            variant.fields.forEach((field, i) => {
                const ret = this.parseField(field.name, field.type);
                def.types.push(ret.type);
            });
            abi.variants.push(def);
        });

        this.tables.forEach((table, i) => {
            if (table.no_abigen) {
                return;
            }

            const abiTable = new ABITable();
            abiTable.name = table.tableName;
            abiTable.type = table.className;
            abiTable.index_type = 'i64';
            abi.tables.push(abiTable);
    
            const abiStruct = new ABIStruct();
            abiStruct.name = table.className;
            abiStruct.base = "";
            table.fields.forEach((field, i) => {
                const ret = this.parseField(field.name, field.type);
                if (ret.type.endsWith("$")) {
                    if (i+1 != table.fields.length) {
                        throw Error(`binaryextension can only appear as the last member! Trace ${RangeUtil.location(field.declaration.range)}`);
                    }
                }
                abiStruct.fields.push(ret);
            });
            abi.structs.push(abiStruct);
        });

        this.contract.actionFuncDefs.forEach((func, i) => {
            // Ignore notify actions in ABI
            if ((<ActionFunctionDef>func).messageDecorator.notify) {
                return;
            }

            const actionName = (<ActionFunctionDef>func).messageDecorator.actionName;
            const action = new ABIAction(actionName, actionName);
            abi.actions.push(action);
    
            const abiStruct = new ABIStruct();
            abiStruct.name = actionName;
            abiStruct.base = "";
            func.parameters.forEach(parameter => {
                const ret = this.parseField(parameter.name, parameter.type);
                abiStruct.fields.push(ret);
            });
            abi.structs.push(abiStruct);
        });

        this.customAbiTypes.forEach(cls => {
            const found = abi.structs.find(x => {
                return x.name == cls.className
            });

            if (found) {
                return;
            }

            const abiStruct = new ABIStruct();
            abiStruct.name = cls.className;
            abiStruct.base = "";
            cls.fields.forEach(field => {
                const ret = this.parseField(field.name, field.type);
                abiStruct.fields.push(ret);
            });
            abi.structs.push(abiStruct);
        });
        return JSON.stringify(abi, null, 2);
    }
}

export function getContractInfo(program: Program): ContractProgram {
    const contract = new ContractProgram(program);
    return contract;
}
