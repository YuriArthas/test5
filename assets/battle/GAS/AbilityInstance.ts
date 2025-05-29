import { _decorator, Component } from "cc";
import { ASC } from "./AbilitySystemComponent";

const { ccclass, property } = _decorator;

@ccclass('AbilityInstance')
export class AbilityInstance extends Component {
    asc: ASC;
    
    onLoad() {
        this.asc = this.getComponent(ASC);
    }


}