import { _decorator, Component, Node, Button } from 'cc';
import { 牌数据 } from './牌数据';
const { ccclass, property } = _decorator;

export enum 牌状态 {
    None = 'None',
    在合成区域 = '在合成区域',
    在牌物品栏 = '在牌物品栏',
    在合成结果显示面板 = '在合成结果显示面板',
}

@ccclass('牌')
export class 牌 extends Component {
    @property
    public 牌状态: 牌状态 = 牌状态.None;

    @property
    public 牌数据: 牌数据 = null;

    start() {
        // 设置点击事件
        this.setupClickEvent();
        
        // 初始化牌显示
        this.更新牌显示();
    }

    /**
     * 设置点击事件
     */
    private setupClickEvent(): void {
        // 确保节点有Button组件，如果没有则添加
        let buttonComponent = this.getComponent(Button);
        if (!buttonComponent) {
            buttonComponent = this.addComponent(Button);
        }

        // 监听点击事件
        this.node.on(Button.EventType.CLICK, this.on_牌Button_click, this);
    }

    /**
     * 牌被点击时的处理
     */
    private on_牌Button_click(): void {
        console.log("牌被点击了", this.牌数据);
        
        // 发送自定义事件给父节点
        this.node.emit('牌被点击', this);
    }

    /**
     * 更新牌的显示
     */
    private 更新牌显示(): void {
        // 这里可以根据牌数据更新牌的外观
        // 比如更换贴图、文字等
        if (this.牌数据) {
            console.log("更新牌显示:", this.牌数据);
        }
    }

    /**
     * 销毁时清理
     */
    protected onDestroy(): void {
        // 清理Button点击事件
        this.node.off(Button.EventType.CLICK, this.on_牌Button_click, this);
        
        // 清理所有"牌被点击"事件监听器（一次性清理所有外部监听）
        this.node.off('牌被点击');
    }
} 