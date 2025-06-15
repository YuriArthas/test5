import { ASC } from "./AbilitySystemComponent";
import { _decorator, assert, Component } from "cc";
import { Node } from "cc";
import { World, WorldRole } from "./World";
import { 可被拖到Component } from "../可被拖到Component";
import { IAttributeHost, IAttributeManager, 属性预定义器 } from "./属性";
import { GAS_State, GAS_Object, GAS_Property, GAS_Array, GAS_Set, GAS_Map, IGAS_Object } from "./State";
import { ExtractInitDataType } from "./World";
const { ccclass, property} = _decorator;


export interface UnitInitData {
    asc?: ASC;
}

export interface PlayerInitData extends UnitInitData {
    team: Team;
}

export interface TeamInitData extends UnitInitData {
    team_id: number;
}

export interface PawnInitData extends UnitInitData {
    player: Player;
}


export class GAS_BaseComponent extends Component {
    asc: ASC = undefined;
}

@GAS_State
export class GAS_Node extends GAS_Object {

    @GAS_Property({type: GAS_Array, own: true})
    components: GAS_Component[] = [];

    @GAS_Property({type: GAS_Node, own: false})
    parent: GAS_Node = undefined;

    @GAS_Property({type: GAS_Array, own: true})
    children: GAS_Node[] = [];


    @GAS_Property({type: Boolean})
    active: boolean = true;
    private _activeInHierarchy: boolean = false;
    private _hasLoaded: boolean = false;
    private _hasStarted: boolean = false;

    init(init_data: any) {
        this._updateActiveInHierarchy();
    }

    add_component<T extends GAS_Component & { init(data: any): void }>(ComponentType: new () => T, init_data: ExtractInitDataType<typeof ComponentType>): T {
        const component = new ComponentType();
        this.components.push(component);
        component.init(init_data);
        
        if (this._hasLoaded) {
            component.onLoad();
        }
        
        if (this._hasStarted) {
            component.start();
        }

        if (this.isActiveInHierarchy()) {
            component.onEnable(); 
        }

        return component;
    }

    get_component<T extends GAS_Component>(ComponentType: new () => T): T | undefined {
        for (const component of this.components) {
            if (component instanceof ComponentType) {
                return component as T;
            }
        }
        return undefined;
    }

    get_components<T extends GAS_Component>(ComponentType: new () => T): T[] {
        return this.components.filter(c => c instanceof ComponentType) as T[];
    }

    get_component_in_children<T extends GAS_Component>(ComponentType: new () => T): T | undefined {
        for (const child of this.children) {
            const component = child.get_component(ComponentType);
            if (component) {
                return component;
            }
            const componentInChildren = child.get_component_in_children(ComponentType);
            if (componentInChildren) {
                return componentInChildren;
            }
        }
        return undefined;
    }

    remove_component(component: GAS_Component) {
        const index = this.components.indexOf(component);
        if (index !== -1) {
            this.components.splice(index, 1);
            component.onDestroy();
        }
    }

    add_child(child: GAS_Node) {
        if (child.parent) {
            child.parent.remove_child(child);
        }
        this.children.push(child);
        child.parent = this;
        child.onAddedToParent();
        child._updateActiveInHierarchy();
    }

    remove_child(child: GAS_Node) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parent = undefined;
            child._updateActiveInHierarchy();
            child.onRemovedFromParent();
        }
    }

    set_parent(parent: GAS_Node) {
        if (parent) {
            parent.add_child(this);
        } else if (this.parent) {
            this.parent.remove_child(this);
        }
    }

    onLoad() {
        if (this._hasLoaded) return;
        this._hasLoaded = true;

        if(this.role == WorldRole.Server){
            this.rpc_notify("onLoad");
        }
        
        for (const component of this.components) {
            component.onLoad();
        }
        for (const child of this.children) {
            child.onLoad();
        }
    }

    start() {
        if (this._hasStarted) return;
        this._hasStarted = true;

        if(this.role == WorldRole.Server){
            this.rpc_notify("start");
        }
        
        for (const component of this.components) {
            component.start();
        }
        for (const child of this.children) {
            child.start();
        }
    }

    update(deltaTime: number) {
        if (!this._activeInHierarchy) return;
        
        for (const component of this.components) {
            component.update(deltaTime);
        }
        for (const child of this.children) {
            child.update(deltaTime);
        }
    }

    setActive(active: boolean) {
        if (this.active === active) return;
        
        this.active = active;
        this._updateActiveInHierarchy();
    }

    private _updateActiveInHierarchy() {
        const newActiveInHierarchy = this.active && (this.parent?._activeInHierarchy || this as any == this.world);
        
        if (this._activeInHierarchy === newActiveInHierarchy) return;
        
        this._activeInHierarchy = newActiveInHierarchy;
        
        if (newActiveInHierarchy) {
            this.onEnable();
        } else {
            this.onDisable();
        }
        
        for (const child of this.children) {
            child._updateActiveInHierarchy();
        }
    }

    isActiveInHierarchy(): boolean {
        return this._activeInHierarchy;
    }

    onEnable() {
        if(this.role == WorldRole.Server){
            this.rpc_notify("onEnable");
        }

        if (!this._hasStarted) {
            this.start();
        }

        for (const component of this.components) {
            component.onEnable();
        }
    }

    onDisable() {
        if(this.role == WorldRole.Server){
            this.rpc_notify("onDisable");
        }

        for (const component of this.components) {
            component.onDisable();
        }
    }

    onAddedToParent() {
        this.onLoad();
    }

    onRemovedFromParent() {
        
    }

    onDestroy() {
        // Detach from parent first.
        if (this.parent) {
            this.parent.remove_child(this);
        }

        // Destroy children recursively.
        // A copy is needed because child.onDestroy() will modify this.children.
        const childrenToDestroy = [...this.children];
        for (const child of childrenToDestroy) {
            child.onDestroy();
        }

        // Destroy components.
        for (const component of this.components) {
            component.onDestroy();
        }

        if(this.role == WorldRole.Server){
            this.rpc_notify("onDestroy");
        }

        // Unregister from world.
        this.world.remove_id_state(this);
    }

    destroy_all_components() {
        const componentsToDestroy = [...this.components];
        for (const component of componentsToDestroy) {
            this.remove_component(component);
        }
    }

    
}

export interface GAS_ComponentInitData {
    owner: GAS_Node;
}

@GAS_State
export class GAS_Component extends GAS_Object {
    owner: GAS_Node = undefined;
    gas_id: number = undefined;

    @GAS_Property({type: Boolean})
    private _enabled: boolean = true;
    @GAS_Property({type: Boolean})
    private _hasLoaded: boolean = false;
    @GAS_Property({type: Boolean})
    private _hasStarted: boolean = false;

    init(init_data: GAS_ComponentInitData) {
        this.owner = init_data.owner;
        this.onInit();
    }

    protected onInit() {
        
    }

    onLoad() {
        if (this._hasLoaded) return;
        this._hasLoaded = true;
        this.onLoadImpl();
    }

    protected onLoadImpl() {
        
    }

    start() {
        if (this._hasStarted) return;
        this._hasStarted = true;
        this.onStartImpl();
    }

    protected onStartImpl() {
        
    }

    update(deltaTime: number) {
        if (!this._enabled || !this.owner?.isActiveInHierarchy()) return;
        this.onUpdateImpl(deltaTime);
    }

    protected onUpdateImpl(deltaTime: number) {
        
    }

    onEnable() {
        if (!this._enabled) {
            this._enabled = true;
            this.onEnableImpl();
        }
    }

    protected onEnableImpl() {
        
    }

    onDisable() {
        if (this._enabled) {
            this._enabled = false;
            this.onDisableImpl();
        }
    }

    protected onDisableImpl() {
        
    }

    onDestroy() {
        this.onDestroyImpl();
        this.world.remove_id_state(this);
        this.owner = undefined;
    }

    protected onDestroyImpl() {

    }

    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(value: boolean) {
        if (this._enabled === value) return;
        
        if (value) {
            this.onEnable();
        } else {
            this.onDisable();
        }
    }

    get hasLoaded(): boolean {
        return this._hasLoaded;
    }

    get hasStarted(): boolean {
        return this._hasStarted;
    }
}

@GAS_State
export class Unit extends GAS_Node implements IAttributeHost {

    @GAS_Property({type: ASC, own: true})
    asc: ASC = undefined;  // 每个Unit都必然有ASC

    init(init_data: UnitInitData) {
        super.init(init_data);
        const asc = init_data.asc?? this.create_object(ASC, {});
        this.asc = asc;
        asc.unit = this;
    }

    get attribute_manager(): IAttributeManager {
        return this.asc;
    }
    get attribute_manager_inherit(): IAttributeHost {
        return undefined;
    }
}

@GAS_State
export class Team extends Unit {
    @GAS_Property(Number)
    team_id: number = 0;

    init(init_data: TeamInitData) {
        super.init(init_data);
        this.team_id = init_data.team_id;
    }

    get attribute_manager_inherit(): IAttributeHost {
        return this.asc.world;
    }
}

@GAS_State
export class Player extends Unit {

    @GAS_Property({type: Team, own: false})
    team: Team = undefined;

    @GAS_Property({type: Number})
    player_id: number = undefined;

    get owner_player(): Player {
        return this;
    }

    init(init_data: PlayerInitData) {
        super.init(init_data);
        this.team = init_data.team;
        this.player_id = this.world.apply_player_id();
    }

    get attribute_manager_inherit(): IAttributeHost {
        return this.team;
    }
}

@GAS_State
export class Pawn extends Unit {
    
    @GAS_Property({type: Player, own: false})
    player: Player = undefined;

    get attribute_manager_inherit(): IAttributeHost {
        return this.player;
    }

    init(init_data: PawnInitData) {
        super.init(init_data);
        this.player = init_data.player;
    }
}



// 创建一个Unit, 并返回它, 脚本总是这样创建Unit
export function create_and_init<P extends { new (): { init(data: any): void } }>(UnitClassType: P, init_data: ExtractInitDataType<P>): InstanceType<P> {
    const unitNode = (init_data as any).node?? new Node();
    const unit = unitNode.addComponent(UnitClassType);
    unit.init(init_data);
    return unit as InstanceType<P>;
}
