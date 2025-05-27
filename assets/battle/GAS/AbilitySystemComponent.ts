import { _decorator, Component, Node } from 'cc';
import { GAS_Effect } from './Effect';
import { 属性 } from './属性';
import { 属性静态注册器 } from './属性';
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
 
export class TarContainer {
    tags: ITagName[] = [];
}

@ccclass('GAS_AbilitySystem')
export class GAS_AbilitySystem extends Component {
    tagContainer: TarContainer = new TarContainer();

    effects: GAS_Effect[] = [];
    
    属性Map: Map<string, 属性> = new Map();

    get_attr(name: string, create_if_not_exist: boolean = false): 属性 {
        let attr = this.属性Map.get(name);
        if(attr == undefined) {
            if(create_if_not_exist){
                attr = 属性静态注册器.创建(name, this);
                this.属性Map.set(name, attr);
            }
        }
        
        return attr;
    }
}