import { _decorator } from 'cc';
import { Effect } from './Effect';
import { Attribute, AttrFormula, BaseAttribute, IAttributeManager, IAttributeHost } from './属性';
import type { Unit, World} from './Unit';
import { AbilitySpec } from './AbilitySpec';
import { AbilityInstance } from './AbilityInstance';
const { ccclass, property } = _decorator;

export interface ITagName {
    readonly name: string;
    readonly parents: Set<ITagName>;

    // equals(other: ITagname): boolean;

    contains(other: ITagName): boolean;

    toString(): string;
}

export function ToTagName(name: string): ITagName {
    return TagManager.instance.apply(name);
}

class TagName implements ITagName {
    readonly name: string;
    readonly parents: Set<ITagName> = new Set();

    constructor(name: string) {
        this.name = name;
    }

    // equals(other: ITagname): boolean {
    //     return this.name === other.name;
    // }

    contains(other: ITagName): boolean {
        if((this as ITagName) === other) {
            return true;
        }
        if(this.parents.has(other)) {
            return true;
        }
        return false;
    }

    toString(): string {
        return this.name;
    }
}



export class TagManager {
    static _instance: TagManager;
    static get instance() {
        if(!this._instance) {
            this._instance = new TagManager();
        }
        return this._instance;
    }

    tags: Map<string, ITagName> = new Map();

    apply(name: string): TagName {
        let tag = this.tags.get(name);
        if(!tag) {
            tag = new TagName(name);
            let pos = 0;
            while(pos < name.length) {
                const next = name.indexOf('.', pos);
                if(next != -1){
                    const parent = name.slice(0, next);
                    tag.parents.add(this.apply(parent));
                    pos = next + 1;
                } else {
                    break;
                }
            }
            
            this.tags.set(name, tag);
        }

        return tag;
    }

    get(name: string): ITagName {
        return this.tags.get(name);
    }

    applyAll(names: string[]): ITagName[] {
        return names.map(name => this.apply(name));
    }
}

export interface ITagManager {
    world: World;

    owned_tags: Map<ITagName, number>;
    blocked_other_tags: Map<ITagName, number>;

    tag_ability_map: Map<ITagName, AbilityInstance[]>;
    tag_effect_map: Map<ITagName, Effect[]>;
}
 
export class ASC implements IAttributeManager, ITagManager {
    world: World = undefined;
    unit: Unit = undefined; // 每个ASC都必然有一个Unit

    // ITagManager
    owned_tags: Map<ITagName, number> = new Map();
    blocked_other_tags: Map<ITagName, number> = new Map();

    tag_ability_map: Map<ITagName, AbilityInstance[]> = new Map();
    tag_effect_map: Map<ITagName, Effect[]> = new Map();


    
    running_ability_instance_list: AbilityInstance[];
    ability_spec_list: AbilitySpec[];
    
    // IAttributeManager
    属性Map: Map<string, BaseAttribute> = new Map();
    default_attr_formula: AttrFormula;
    get attached_host(): IAttributeHost {
        return this.unit;
    }

    get_attribute<T extends BaseAttribute>(name: string, create_if_not_exist: boolean = true): T {
        let attr = this.属性Map.get(name);
        if(!attr && create_if_not_exist) {
            attr = this.world.属性预定义器.创建(name, this);
            if(this.default_attr_formula && attr instanceof Attribute){
                attr.set_formula(this.default_attr_formula);
            }
            this.属性Map.set(name, attr);
        }

        return attr as T;
    }

    cast_ability(){

    }
}
