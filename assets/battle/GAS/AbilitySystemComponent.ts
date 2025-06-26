import { _decorator } from 'cc';
import { Effect } from './Effect';
import { Attribute, AttrFormula, BaseAttribute, IAttributeManager, IAttributeHost } from './属性';
import { GAS_Component, GAS_Node} from './Unit';
import type { World } from './World';
import { AbilitySpec } from './AbilitySpec';
import { AbilityInstance } from './AbilityInstance';
import { GAS_Array, GAS_Map, GAS_Object, GAS_Property, GAS_State } from './State';
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




@GAS_State
export class ASC extends GAS_Component implements IAttributeManager{
    world: World = undefined;

    @GAS_Property({type: GAS_Node, ref: true})
    node: GAS_Node = undefined; // 每个ASC都必然有一个Unit

    // ITagManager
    @GAS_Property({type: GAS_Map})
    owned_tags: GAS_Map<ITagName, number> = undefined;

    @GAS_Property({type: GAS_Map})
    blocked_other_tags: GAS_Map<ITagName, number> = undefined;

    @GAS_Property({type: GAS_Map})
    tag_ability_map: GAS_Map<ITagName, AbilityInstance[]> = undefined;

    @GAS_Property({type: GAS_Map})
    tag_effect_map: GAS_Map<ITagName, Effect[]> = undefined;


    running_ability_instance_list: AbilityInstance[];

    @GAS_Property({type: GAS_Array})
    ability_spec_list: AbilitySpec[] = [];
    
    // IAttributeManager
    属性Map: GAS_Map<string, BaseAttribute> = undefined;

    constructor(world: World, gas_id: number) {
        super(world, gas_id);
        this.owned_tags = world.create_map();
        this.blocked_other_tags = world.create_map();
        this.tag_ability_map = world.create_map();
        this.tag_effect_map = world.create_map();
        this.ability_spec_list = world.create_array();
        this.属性Map = world.create_map();
    }

    init(init_data: any) {
        super.init(init_data);
    }

    get attached_host(): IAttributeHost {
        return this.node;
    }

    get_attribute<T extends BaseAttribute>(name: string, create_if_not_exist: boolean = true): T {
        let attr = this.属性Map.get(name);
        if(!attr && create_if_not_exist) {
            attr = this.world.属性预定义器.创建(name, this);
            this.属性Map.set(name, attr);
        }

        return attr as T;
    }

    cast_ability(){

    }


}
