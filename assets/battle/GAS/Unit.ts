import { ASC } from "./AbilitySystemComponent";
import { WorldRole } from "./World";
import { AttributeManager} from "./属性";
import { GAS_State, GAS_Object, GAS_Property, GAS_Array, GAS_Ref } from "./State";
import { ExtractInitDataType } from "./World";


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

@GAS_State
export class GAS_Node extends GAS_Object {

    @GAS_Property({type: GAS_Array})
    private _components: GAS_Component[] = [];

    @GAS_Ref({type: GAS_Node})
    parent: GAS_Node = undefined;

    @GAS_Property({type: GAS_Array})
    private _children: GAS_Node[] = [];


    @GAS_Property({type: Boolean})
    _active: boolean = true;
    
    private _activeInHierarchy: boolean = false;
    private _hasLoaded: boolean = false;
    private _hasStarted: boolean = false;

    init(init_data: any) {
        this._updateActiveInHierarchy();
    }

    add_component<T extends GAS_Component & { init(data: any): void }>(ComponentType: new (...any: any[]) => T, init_data: ExtractInitDataType<typeof ComponentType>): T {
        const component = this.create_object(ComponentType, init_data);
        this._components.push(component);
        
        if (this.world.role & WorldRole.Server) {
            if (this._hasLoaded && this._isInWorldTree()) {
                component._internal_onLoad();
            }
            
            if (this._hasStarted && this._isInWorldTree()) {
                component._internal_start();
            }
    
            if (this.isActiveInHierarchy()) {
                component._internal_onEnable(); 
            }
        }

        return component;
    }

    get_component<T extends GAS_Component>(ComponentType: new (owner: GAS_Object, gas_id: number) => T): T | undefined {
        for (const component of this._components) {
            if (component instanceof ComponentType) {
                return component as T;
            }
        }
        return undefined;
    }

    get_components<T extends GAS_Component>(ComponentType: new (owner: GAS_Object, gas_id: number) => T): T[] {
        return this._components.filter(c => c instanceof ComponentType) as T[];
    }

    get_component_in_children<T extends GAS_Component>(ComponentType: new (owner: GAS_Object, gas_id: number) => T): T | undefined {
        for (const child of this._children) {
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
        const index = this._components.indexOf(component);
        if (index !== -1) {
            this._components.splice(index, 1);
            if (this.world.role & WorldRole.Server) {
                component._internal_onDestroy();
            }
        }
    }

    add_child(child: GAS_Node) {
        if (child.parent) {
            child.parent.remove_child(child);
        }
        this._children.push(child);
        child.parent = this;
        if (this.world.role & WorldRole.Server) {
            child.onAddedToParent();
        }
        child._updateActiveInHierarchy();
    }

    remove_child(child: GAS_Node) {
        const index = this._children.indexOf(child);
        if (index !== -1) {
            this._children.splice(index, 1);
            child.parent = undefined;
            child._updateActiveInHierarchy();
            if (this.role & WorldRole.Server) {
                child.onRemovedFromParent();
            }
        }
    }

    set_parent(parent: GAS_Node) {
        if (parent) {
            parent.add_child(this);
        } else if (this.parent) {
            this.parent.remove_child(this);
        }
    }

    _internal_onLoad() {
        if (this._hasLoaded) return;
        this._hasLoaded = true;

        this.onLoad();

        for (const component of this._components) {
            component._internal_onLoad();
        }
        for (const child of this._children) {
            child._internal_onLoad();
        }
        
        if(this.role & WorldRole.Server){
            this.rpc_notify("onLoad");
        }
    }

    protected onLoad() {
        
    }

    _internal_start() {
        if (this._hasStarted) return;
        this._hasStarted = true;

        this.start();
        this.rpc_notify("start");

        for (const component of this._components) {
            component._internal_start();
        }
        for (const child of this._children) {
            child._internal_start();
        }
    }

    protected start() {
        
    }

    _internal_update(deltaTime: number) {
        if (!this._activeInHierarchy) return;
        
        this.update(deltaTime);

        for (const component of this._components) {
            component._internal_update(deltaTime);
        }
        for (const child of this._children) {
            child._internal_update(deltaTime);
        }
    }

    protected update(deltaTime: number) {
        
    }

    setActive(active: boolean) {
        if (this._active === active) return;
        
        this._active = active;
        this._updateActiveInHierarchy();
    }

    private _updateActiveInHierarchy() {
        const newActiveInHierarchy = this._active && (this.parent?._activeInHierarchy || this as any == this.world);
        
        if (this._activeInHierarchy === newActiveInHierarchy) return;
        
        this._activeInHierarchy = newActiveInHierarchy;
        
        if (this.role & WorldRole.Server) {
            if (newActiveInHierarchy) {
                this._internal_onEnable();
            } else {
                this._internal_onDisable();
            }
        }
        
        for (const child of this._children) {
            child._updateActiveInHierarchy();
        }
    }

    isActiveInHierarchy(): boolean {
        return this._activeInHierarchy;
    }

    private _isInWorldTree(): boolean {
        let current: GAS_Node = this;
        while (current) {
            if (current === this.world) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    _internal_onEnable() {
        if(this.role & WorldRole.Server){
            this.rpc_notify("onEnable");
        }

        if (!this._hasStarted) {
            if (this.role & WorldRole.Server) {
                this._internal_start();
            }
        }

        this.onEnable();

        for (const component of this._components) {
            component._internal_onEnable();
        }
    }

    protected onEnable() {
        
    }

    _internal_onDisable() {
        if(this.role & WorldRole.Server){
            this.rpc_notify("onDisable");
        }

        this.onDisable();

        for (const component of this._components) {
            component._internal_onDisable();
        }
    }

    protected onDisable() {
        
    }

    onAddedToParent() {
        if (this._isInWorldTree()) {
            this._onAddedToWorldTree();
        }
    }

    private _onAddedToWorldTree() {
        this._internal_onLoad();
        for (const child of this._children) {
            if (child._isInWorldTree()) {
                child._onAddedToWorldTree();
            }
        }
    }

    onRemovedFromParent() {
        if (!this._isInWorldTree()) {
            this._onRemovedFromWorldTree();
        }
    }

    private _onRemovedFromWorldTree() {
        for (const child of this._children) {
            child._onRemovedFromWorldTree();
        }
    }

    _internal_onDestroy() {
        // Detach from parent first.
        if (this.parent) {
            this.parent.remove_child(this);
        }

        // Destroy children recursively.
        // A copy is needed because child.onDestroy() will modify this.children.
        const childrenToDestroy = [...this._children];
        for (const child of childrenToDestroy) {
            child._internal_onDestroy();
        }

        this.onDestroy();

        // Destroy components.
        for (const component of this._components) {
            component._internal_onDestroy();
        }

        if(this.role == WorldRole.Server){
            this.rpc_notify("onDestroy");
        }
    }

    protected onDestroy() {

    }

    destroy_all_components() {
        const componentsToDestroy = [...this._components];
        for (const component of componentsToDestroy) {
            this.remove_component(component);
        }
    }
}

export interface GAS_ComponentInitData {
    
}

@GAS_State
export class GAS_Component extends GAS_Object {
    @GAS_Property({type: Boolean})
    private _enabled: boolean = true;
    @GAS_Property({type: Boolean})
    private _hasLoaded: boolean = false;
    @GAS_Property({type: Boolean})
    private _hasStarted: boolean = false;

    @GAS_Property({type: GAS_Node, ref: true})
    owner: GAS_Node = undefined;

    constructor(owner: GAS_Node, gas_id: number) {
        super(owner, gas_id);
        this.owner = owner;
    }

    init(init_data: GAS_ComponentInitData) {

    }

    _internal_onLoad() {
        if (this._hasLoaded) return;
        this._hasLoaded = true;
        this.onLoad();
    }

    protected onLoad() {
        
    }

    _internal_start() {
        if (this._hasStarted) return;
        this._hasStarted = true;
        this.start();
        this.rpc_notify("start");
    }

    protected start() {
        
    }

    _internal_update(deltaTime: number) {
        if (!this._enabled || !this.owner_player?.isActiveInHierarchy()) return;
        this.update(deltaTime);
    }

    protected update(deltaTime: number) {
        
    }

    _internal_onEnable() {
        if (!this._enabled) {
            this._enabled = true;
            this.onEnable();
        }
    }

    protected onEnable() {
        
    }

    _internal_onDisable() {
        if (this._enabled) {
            this._enabled = false;
            this.onDisable();
        }
    }

    protected onDisable() {
        
    }

    _internal_onDestroy() {
        this.onDestroy();
        this.owner = undefined;
    }

    protected onDestroy() {

    }

    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(value: boolean) {
        if (this._enabled === value) return;
        
        if (value) {
            this._internal_onEnable();
        } else {
            this._internal_onDisable();
        }
    }

    get hasLoaded(): boolean {
        return this._hasLoaded;
    }

    get hasStarted(): boolean {
        return this._hasStarted;
    }
}

export class Unit extends GAS_Node {
    @GAS_Ref({type: ASC})
    asc: ASC = undefined;

    @GAS_Ref({type: AttributeManager})
    attribute_manager: AttributeManager = undefined;

    init_asc(): ASC {
        return this.add_component(ASC, {});
    }

    init_attribute_manager(): AttributeManager {
        return this.add_component(AttributeManager, {});
    }

    init(init_data: any) {
        super.init(init_data);
        this.attribute_manager = this.init_attribute_manager();
        this.asc = this.init_asc();
    }

    get attribute_manager_inherit(): Unit {
        return this.world;
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

    get attribute_manager_inherit(): Unit {
        return this.world;
    }
}

@GAS_State
export class Player extends Unit {

    @GAS_Property({type: Team, ref: true})
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

    get attribute_manager_inherit(): Unit {
        return this.team;
    }
}

@GAS_State
export class Pawn extends Unit {
    get attribute_manager_inherit(): Unit {
        return this.owner_player;
    }
}

// 创建一个Unit, 并返回它, 脚本总是这样创建Unit
export function create_and_init<P extends { new (): { init(data: any): void } }>(UnitClassType: P, init_data: ExtractInitDataType<P>): InstanceType<P> {
    const unitNode = (init_data as any).node?? new Node();
    const unit = unitNode.addComponent(UnitClassType);
    unit.init(init_data);
    return unit as InstanceType<P>;
}
