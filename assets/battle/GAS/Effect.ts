import { _decorator, Component } from "cc";
import { ITagName } from "./AbilitySystemComponent";
import { GAS_BaseComponent } from "./AbilitySystemComponent";
const { ccclass, property } = _decorator;



@ccclass('GAS_Effect')
export class GAS_Effect extends GAS_BaseComponent {
    effectTag: ITagName;
}