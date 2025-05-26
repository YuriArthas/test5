import { _decorator, Component, Node, Button } from 'cc';
import { 牌数据 } from './牌数据';
const { ccclass, property } = _decorator;

export enum 牌状态 {
    None = 'None',
    在合成区域 = '在合成区域',
    在牌物品栏 = '在牌物品栏',
    在合成结果显示面板 = '在合成结果显示面板',
}

export enum 牌目标 {
    自己 = '自己',
    己方1 = '己方1',
    敌方1 = '敌方1',
    己方N = '己方N',
    敌方N = '敌方N',
}

export interface I牌数据 {
    name: string;
    合成材料: I牌数据[];
    prefab?: string;
    component?: new () => 牌;

    aim: 牌目标;

    num?: {
        min: number;
        max: number;
    }

    create_card(): Node;
}

@ccclass('牌')
export class 牌 extends Component {
    public 牌状态: 牌状态 = 牌状态.None;

    public 牌数据: I牌数据 = null;

    start() {
        
    }



    /**
     * 销毁时清理
     */
    protected onDestroy(): void {
        this.node.off(Button.EventType.CLICK);
    }
} 