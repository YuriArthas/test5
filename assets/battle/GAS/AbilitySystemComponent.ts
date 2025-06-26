import { _decorator } from 'cc';
import { Effect } from './Effect';
import { Attribute, AttrFormula, BaseAttribute, AttributeManager} from './属性';
import { GAS_Component, GAS_Node} from './Unit';
import type { World } from './World';
import { AbilitySpec } from './AbilitySpec';
import { AbilityInstance } from './AbilityInstance';
import { GAS_Array, GAS_Map, GAS_Object, GAS_Property, GAS_Property_Array, GAS_Property_Ref, GAS_State } from './State';
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
export class ASC extends GAS_Component{
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

    @GAS_Property_Array({item_type: AbilitySpec})
    ability_spec_list: AbilitySpec[] = [];
    
    @GAS_Property_Ref({type: AttributeManager})
    attribute_manager: AttributeManager = undefined;

    constructor(world: World, gas_id: number) {
        super(world, gas_id);
        this.owned_tags = world.create_map();
        this.blocked_other_tags = world.create_map();
        this.tag_ability_map = world.create_map();
        this.tag_effect_map = world.create_map();
        this.ability_spec_list = world.create_array();
        
    }

    onLoad() {
        super.onLoad();
        this.attribute_manager = this.node.get_component(AttributeManager);
    }

    cast_ability(){

    }


}
