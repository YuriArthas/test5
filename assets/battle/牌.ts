import { _decorator, Component, Node, Button } from 'cc';
import { 牌数据 } from './牌数据';
import { Pawn, Player, World } from './GAS/Unit';
import { 可拖动Component } from './可拖动Component';
import { BattleWorld } from './battle';
const { ccclass, property } = _decorator;

export enum 牌状态 {
    None = 'None',
    在合成区域 = '在合成区域',
    在牌物品栏 = '在牌物品栏',
    在合成结果显示面板 = '在合成结果显示面板',
}

export enum 牌可拖到Layer {
    None = 0,
    合成区域 = 1,
    牌物品栏 = 2,
    在合成结果显示面板 = 4,
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

export class 牌 extends Pawn {
    protected _牌状态: 牌状态 = 牌状态.None;
    可拖动: 可拖动Component = undefined;
    world: BattleWorld = undefined;

    get 牌状态(): 牌状态 {
        return this._牌状态;
    }

    set 牌状态(value: 牌状态) {
        this._牌状态 = value;
        switch(this._牌状态){
            case 牌状态.在合成区域:
                this.可拖动.layer = 牌可拖到Layer.牌物品栏;
                this.可拖动.isDragEnabled = true;
                break;
            case 牌状态.在牌物品栏:
                this.可拖动.layer = 牌可拖到Layer.合成区域;
                this.可拖动.isDragEnabled = true;
                break;
            case 牌状态.在合成结果显示面板:
                this.可拖动.layer = 牌可拖到Layer.在合成结果显示面板;
                this.可拖动.isDragEnabled = false;
                break;
        }
    }

    public 牌数据: I牌数据 = undefined;

    protected onLoad(): void {
        this.可拖动 = this.node.addComponent(可拖动Component);
        this.可拖动.world = this.world;
        
    }

    
    /**
     * 销毁时清理
     */
    onDestroy(): void {
        this.node.off(Button.EventType.CLICK);
    }


} 