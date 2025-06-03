import { Component, _decorator } from "cc";
import { World } from "./GAS/World";
import { 可拖动Component } from "./可拖动Component";

const { ccclass, property } = _decorator;

@ccclass('可被拖到Component')
export class 可被拖到Component extends Component {
    world: World;

    @property
    layer: number = 0;  // bitset, 与可拖动Component的layer有重合时才算命中
    
    // 拖拽事件回调
    public onDragEnter: (draggable: 可拖动Component) => void = null;  // 有东西拖入
    public onDragExit: (draggable: 可拖动Component) => void = null;   // 有东西拖出
    public onDragOver: (draggable: 可拖动Component) => void = null;   // 有东西在上面悬停
    public onDragDrop: (draggable: 可拖动Component) => void = null;   // 有东西被放置（松手）

    protected onEnable(): void {
        this.registerToWorld();
    }

    protected onDisable(): void {
        this.unregisterFromWorld();
    }

    protected onDestroy(): void {
        this.unregisterFromWorld();
    }

    private registerToWorld(): void {
        if (!this.world || !this.world.dragable_layer_map) return;
        
        // 遍历所有bit位，将组件注册到对应的layer
        for (let bit = 0; bit < 32; bit++) {
            const layerBit = 1 << bit;
            if ((this.layer & layerBit) !== 0) {
                let components = this.world.dragable_layer_map.get(layerBit);
                if (!components) {
                    components = [];
                    this.world.dragable_layer_map.set(layerBit, components);
                }
                
                // 避免重复注册
                if (components.indexOf(this) === -1) {
                    components.push(this);
                }
            }
        }
    }

    private unregisterFromWorld(): void {
        if (!this.world || !this.world.dragable_layer_map) return;
        
        // 从所有layer中移除
        for (const [layer, components] of this.world.dragable_layer_map) {
            const index = components.indexOf(this);
            if (index !== -1) {
                components.splice(index, 1);
                
                // 如果数组为空，删除该layer
                if (components.length === 0) {
                    this.world.dragable_layer_map.delete(layer);
                }
            }
        }
    }

    // 设置layer时自动更新注册
    setLayer(newLayer: number): void {
        if (this.layer === newLayer) return;
        
        // 先取消注册
        this.unregisterFromWorld();
        
        // 更新layer
        this.layer = newLayer;
        
        // 重新注册
        if (this.node.activeInHierarchy) {
            this.registerToWorld();
        }
    }
}