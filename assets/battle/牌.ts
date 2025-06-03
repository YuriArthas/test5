import { _decorator, Component, Node, Button } from 'cc';
import { 牌数据 } from './牌数据';
import { Pawn } from './GAS/Pawn';
import { Player } from './GAS/Player';
import { World } from './GAS/World';
import { 可拖动Component } from './可拖动Component';
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
    牌class?: new () => 牌;

    aim: 牌目标;

    num?: {
        min: number;
        max: number;
    }

    create_card(world: World, player: Player): 牌;
}

@ccclass('牌')
export class 牌 extends Pawn {
    public 牌状态: 牌状态 = 牌状态.None;

    public 牌数据: I牌数据 = undefined;

    protected onLoad(): void {
        const 可拖动 = this.node.addComponent(可拖动Component);
        可拖动.world = this.world;
        可拖动.layer = 1;
    }

    
    /**
     * 销毁时清理
     */
    protected onDestroy(): void {
        this.node.off(Button.EventType.CLICK);
    }


} 