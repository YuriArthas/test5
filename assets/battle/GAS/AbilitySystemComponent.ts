import { _decorator, Component, Node } from 'cc';
import { GAS_Effect } from './Effect';
import { Attr } from './属性';
import { Unit } from './Unit';
const { ccclass, property } = _decorator;

export interface ITagName {
    readonly name: string;
    readonly parents: Set<ITagName>;

    // equals(other: ITagname): boolean;

    contains(other: ITagName): boolean;
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

export interface ITagContainer {
    owned_tags: Map<ITagName, number>;
    blocked_ability_tags: Map<ITagName, number>;
    blocked_effect_tags: Map<ITagName, number>;
}

export class GAS_BaseComponent extends Component {
    
}

@ccclass('GAS')
export class GAS extends GAS_BaseComponent implements ITagContainer {
    unit: Unit;
    owned_tags: Map<ITagName, number> = new Map();
    blocked_ability_tags: Map<ITagName, number> = new Map();
    blocked_effect_tags: Map<ITagName, number> = new Map();
    
    effects: GAS_Effect[] = [];
    
    属性Map: Map<string, Attr> = new Map();

}
