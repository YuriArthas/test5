import { _decorator, Component } from "cc";
import { ITagName } from "./AbilitySystemComponent";

const { ccclass, property } = _decorator;



@ccclass('GAS_Effect')
export class GAS_Effect extends Component {
    effectTag: ITagName;
}