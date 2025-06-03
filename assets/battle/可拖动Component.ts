import { Component, EventTouch, Button, Node, v3, UITransform, Rect, Vec3, Color, Sprite, _decorator, director, Enum, v2 } from "cc";
import { World } from "./GAS/World";
import { 可被拖到Component } from "./可被拖到Component";

const { ccclass, property } = _decorator;

// 拖拽结束行为枚举
export enum DragEndBehavior {
    STAY_AT_DROP_POSITION = 0,  // 留在拖拽结束的位置（无占位机制）
    RETURN_TO_PLACEHOLDER = 1,  // 返回到占位节点位置（启用占位机制，推荐用于UI元素排列）
    RETURN_TO_ORIGINAL = 2      // 返回到拖拽开始的位置（无占位机制，适用于卡牌/道具等）
}

Enum(DragEndBehavior);

/**
 * 可拖动组件
 * 
 * 拖拽行为说明：
 * - STAY_AT_DROP_POSITION: 拖拽结束后留在当前位置，不创建占位节点，适用于自由拖拽
 * - RETURN_TO_PLACEHOLDER: 创建占位节点并在拖拽结束后回到占位位置，适用于有序排列的UI元素
 * - RETURN_TO_ORIGINAL: 拖拽结束后回到拖拽开始的位置，不创建占位节点，适用于拖拽失败时的回退
 */
@ccclass('可拖动Component')
export class 可拖动Component extends Component {
    world: World;

    @property
    layer: number = 0;  // bitset
    
    @property
    enableDragOpacity: boolean = true;  // 拖拽时是否改变透明度
    
    @property
    dragOpacity: number = 180;  // 拖拽时的透明度
    
    @property({ type: DragEndBehavior })
    dragEndBehavior: DragEndBehavior = DragEndBehavior.RETURN_TO_PLACEHOLDER;  // 拖拽结束后的行为

    private isDragging: boolean = false;
    private dragStartPos: Vec3;
    private nodeStartPos: Vec3;
    private originalOpacity: number = 255;
    private sprite: Sprite = null;
    private currentHoverTarget: 可被拖到Component = null;  // 当前悬停的目标
    
    // 占位相关
    private placeholderNode: Node = null;  // 占位节点
    private originalParent: Node = null;    // 原始父节点
    private originalSiblingIndex: number = -1;  // 原始在父节点中的索引
    private originalWorldPos: Vec3 = null;  // 原始世界坐标
    
    // 拖拽事件回调
    public onDragStart: (event: EventTouch) => void = null;
    public onDragMove: (event: EventTouch) => void = null;
    public onDragEnd: (event: EventTouch, target: 可被拖到Component | null) => void = null;
    public onDropSuccess: (target: 可被拖到Component) => void = null;
    public onDropFailed: () => void = null;
    
    // 新增：拖入拖出事件
    public onDragEnter: (target: 可被拖到Component) => void = null;  // 拖入目标
    public onDragExit: (target: 可被拖到Component) => void = null;   // 拖出目标
    public onDragOver: (target: 可被拖到Component) => void = null;   // 在目标上悬停

    protected onLoad(): void {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        
        // 获取Sprite组件用于透明度控制
        this.sprite = this.node.getComponent(Sprite);
    }

    protected onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        
        // 清理占位节点
        if (this.placeholderNode) {
            this.placeholderNode.destroy();
            this.placeholderNode = null;
        }
    }

    private onTouchStart(event: EventTouch): void {
        this.isDragging = true;
        
        // 记录开始拖拽时的位置
        const touchPos = event.getUILocation();
        this.dragStartPos = v3(touchPos.x, touchPos.y, 0);
        this.nodeStartPos = v3(this.node.position);
        
        // 记录原始父节点和位置信息
        this.originalParent = this.node.parent;
        this.originalSiblingIndex = this.node.getSiblingIndex();
        this.originalWorldPos = this.node.worldPosition.clone();
        const originalLayer = this.node.layer;  // 记录原始layer
        const originalWorldScale = this.node.worldScale.clone();  // 记录世界缩放
        const originalWorldRotation = this.node.worldRotation.clone();  // 记录世界旋转
        
        // 只有在RETURN_TO_PLACEHOLDER模式下才创建占位节点
        if (this.dragEndBehavior === DragEndBehavior.RETURN_TO_PLACEHOLDER) {
            // 创建占位节点
            this.placeholderNode = new Node('Placeholder_' + this.node.name);
            // 复制UITransform组件的大小，保持占位
            const uiTransform = this.node.getComponent(UITransform);
            if (uiTransform) {
                const placeholderUI = this.placeholderNode.addComponent(UITransform);
                placeholderUI.setContentSize(uiTransform.contentSize);
                placeholderUI.anchorPoint = uiTransform.anchorPoint;
            }
            
            // 将占位节点放在原位置
            this.placeholderNode.setPosition(this.node.position);
            this.originalParent.insertChild(this.placeholderNode, this.originalSiblingIndex);
        }
        
        // 寻找合适的拖动时父节点
        let rootNode: Node = null;
        
        // 方案1：向上查找Canvas
        let current = this.originalParent;
        while (current && current.parent) {
            if (current.name === 'Canvas') {
                rootNode = current;
                break;
            }
            current = current.parent;
        }
        
        // 方案2：如果没找到Canvas，使用场景根节点下的第一个子节点（通常是Canvas）
        if (!rootNode) {
            const scene = director.getScene();
            if (scene.children.length > 0) {
                rootNode = scene.children[0];
            } else {
                rootNode = scene;
            }
        }
        
        this.node.removeFromParent();
        rootNode.addChild(this.node);
        
        // 恢复原始layer
        this.node.layer = originalLayer;
        
        // 设置节点的世界变换，保持位置、缩放和旋转不变
        this.node.worldPosition = this.originalWorldPos;
        this.node.worldScale = originalWorldScale;
        this.node.worldRotation = originalWorldRotation;
        this.nodeStartPos = v3(this.node.position);  // 更新起始位置为在新父节点下的本地坐标
        
        // 提升节点层级，使其显示在最上层
        this.node.setSiblingIndex(rootNode.children.length - 1);
        
        // 改变透明度
        if (this.enableDragOpacity && this.sprite) {
            this.originalOpacity = this.sprite.color.a;
            const color = this.sprite.color.clone();
            color.a = this.dragOpacity;
            this.sprite.color = color;
        }
        
        // 触发拖拽开始回调
        if (this.onDragStart) {
            this.onDragStart(event);
        }
        
        event.propagationStopped = true;
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.isDragging) return;
        
        // 计算拖拽偏移
        const touchPos = event.getUILocation();
        const currentPos = v3(touchPos.x, touchPos.y, 0);
        const delta = currentPos.subtract(this.dragStartPos);
        
        // 更新节点位置
        const newPos = this.nodeStartPos.clone().add(delta);
        this.node.setPosition(newPos);
        
        // 持续检测悬停目标
        this.updateHoverTarget();
        
        // 触发拖拽移动回调
        if (this.onDragMove) {
            this.onDragMove(event);
        }
        
        event.propagationStopped = true;
    }

    private onTouchEnd(event: EventTouch): void {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // 恢复透明度
        if (this.enableDragOpacity && this.sprite) {
            const color = this.sprite.color.clone();
            color.a = this.originalOpacity;
            this.sprite.color = color;
        }
        
        // 检测是否与可被拖到的目标重叠
        const hitTarget = this.checkHitTarget();
        
        // 如果有悬停目标，触发其onDragDrop事件
        if (this.currentHoverTarget && hitTarget === this.currentHoverTarget) {
            this.currentHoverTarget.onDragDrop?.(this);
        }
        
        // 清理悬停状态
        if (this.currentHoverTarget) {
            this.handleDragExit(this.currentHoverTarget);
            this.currentHoverTarget = null;
        }
        
        // 触发拖拽结束回调
        if (this.onDragEnd) {
            this.onDragEnd(event, hitTarget);
        }
        
        // 根据dragEndBehavior统一处理位置恢复
        switch (this.dragEndBehavior) {
            case DragEndBehavior.RETURN_TO_PLACEHOLDER:
                if (this.placeholderNode && this.originalParent && this.originalParent.isValid) {
                    // 获取占位节点的当前索引和位置
                    const currentIndex = this.placeholderNode.getSiblingIndex();
                    const placeholderPos = this.placeholderNode.position.clone();
                    
                    // 删除占位节点
                    this.placeholderNode.destroy();
                    this.placeholderNode = null;
                    
                    // 将节点重新添加回原父节点
                    this.node.removeFromParent();
                    this.originalParent.insertChild(this.node, currentIndex);
                    this.node.setPosition(placeholderPos);
                }
                break;
                
            case DragEndBehavior.RETURN_TO_ORIGINAL:
                // 返回到拖拽开始的位置（仅在回退信息未被清除时）
                if (this.nodeStartPos) {
                    this.node.setPosition(this.nodeStartPos);
                }
                break;
                
            case DragEndBehavior.STAY_AT_DROP_POSITION:
            default:
                // 留在当前位置，不做任何处理
                break;
        }
        
        // 清理残留的占位节点
        if (this.placeholderNode) {
            this.placeholderNode.destroy();
            this.placeholderNode = null;
        }
        
        // 处理拖拽结果回调
        if (hitTarget) {
            this.onDroppedOn(hitTarget);
            
            // 触发成功回调
            if (this.onDropSuccess) {
                this.onDropSuccess(hitTarget);
            }
        } else {
            // 触发失败回调
            if (this.onDropFailed) {
                this.onDropFailed();
            }
        }
        
        event.propagationStopped = true;
    }

    private updateHoverTarget(): void {
        const newTarget = this.checkHitTarget();
        
        // 如果目标发生变化
        if (newTarget !== this.currentHoverTarget) {
            // 处理离开旧目标
            if (this.currentHoverTarget) {
                this.handleDragExit(this.currentHoverTarget);
            }
            
            // 处理进入新目标
            if (newTarget) {
                this.handleDragEnter(newTarget);
            }
            
            this.currentHoverTarget = newTarget;
        } else if (this.currentHoverTarget) {
            // 如果仍在同一个目标上，触发悬停事件
            this.handleDragOver(this.currentHoverTarget);
        }
    }

    private handleDragEnter(target: 可被拖到Component): void {
        // 触发自己的拖入事件
        if (this.onDragEnter) {
            this.onDragEnter(target);
        }
        
        // 触发目标的被拖入事件
        if (target.onDragEnter) {
            target.onDragEnter(this);
        }
    }

    private handleDragExit(target: 可被拖到Component): void {
        // 触发自己的拖出事件
        if (this.onDragExit) {
            this.onDragExit(target);
        }
        
        // 触发目标的被拖出事件
        if (target.onDragExit) {
            target.onDragExit(this);
        }
    }

    private handleDragOver(target: 可被拖到Component): void {
        // 触发自己的悬停事件
        if (this.onDragOver) {
            this.onDragOver(target);
        }
        
        // 触发目标的被悬停事件
        if (target.onDragOver) {
            target.onDragOver(this);
        }
    }

    private checkHitTarget(): 可被拖到Component | null {
        if (!this.world || !this.world.dragable_layer_map) return null;
        
        // 获取拖动节点的世界坐标点（中心点）
        const dragWorldPos = this.node.worldPosition;
        const dragPoint = v2(dragWorldPos.x, dragWorldPos.y);
        
        // 遍历所有layer
        for (const [layer, components] of this.world.dragable_layer_map) {
            // 检查layer是否匹配（bitset操作）
            if ((this.layer & layer) === 0) continue;
            
            // 遍历该layer的所有可被拖到组件
            for (const target of components) {
                if (!target.node || !target.node.active) continue;
                
                const targetUI = target.node.getComponent(UITransform);
                if (!targetUI) continue;
                
                const targetRect = targetUI.getBoundingBoxToWorld();
                
                // 检测拖动点是否在目标矩形内
                if (targetRect.contains(dragPoint)) {
                    return target;
                }
            }
        }
        
        return null;
    }

    private onDroppedOn(target: 可被拖到Component): void {
        // 可以在这里触发拖拽完成的事件或执行相关逻辑
        // 例如：
        // - 触发技能
        // - 交换位置
        // - 合并物品等
    }
    
    // 公共方法：强制停止拖拽
    public cancelDrag(): void {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // 恢复透明度
        if (this.enableDragOpacity && this.sprite) {
            const color = this.sprite.color.clone();
            color.a = this.originalOpacity;
            this.sprite.color = color;
        }
        
        // 清理悬停状态
        if (this.currentHoverTarget) {
            this.handleDragExit(this.currentHoverTarget);
            this.currentHoverTarget = null;
        }
        
        // 根据dragEndBehavior统一处理位置恢复
        switch (this.dragEndBehavior) {
            case DragEndBehavior.RETURN_TO_PLACEHOLDER:
                if (this.placeholderNode && this.originalParent && this.originalParent.isValid) {
                    // 获取占位节点的当前索引和位置
                    const currentIndex = this.placeholderNode.getSiblingIndex();
                    const placeholderPos = this.placeholderNode.position.clone();
                    
                    // 删除占位节点
                    this.placeholderNode.destroy();
                    this.placeholderNode = null;
                    
                    // 将节点重新添加回原父节点
                    this.node.removeFromParent();
                    this.originalParent.insertChild(this.node, currentIndex);
                    this.node.setPosition(placeholderPos);
                }
                break;
                
            case DragEndBehavior.RETURN_TO_ORIGINAL:
                // 返回到拖拽开始的位置（仅在回退信息未被清除时）
                if (this.nodeStartPos) {
                    this.node.setPosition(this.nodeStartPos);
                }
                break;
                
            case DragEndBehavior.STAY_AT_DROP_POSITION:
            default:
                // 留在当前位置，不做任何处理
                break;
        }
        
        // 清理残留的占位节点
        if (this.placeholderNode) {
            this.placeholderNode.destroy();
            this.placeholderNode = null;
        }
    }

    // 公共方法：清除回退信息，调用后无论什么模式都不会返回原位置
    public clearRollbackInfo(): void {
        // 删除占位节点
        if (this.placeholderNode) {
            this.placeholderNode.destroy();
            this.placeholderNode = null;
        }
        
        // 清除回退信息
        this.originalParent = null;
        this.originalSiblingIndex = -1;
        this.originalWorldPos = null;
        this.nodeStartPos = null;
    }
}