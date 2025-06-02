import { create_unit, Unit } from "./Unit";
import { Team } from "./Team";
import { _decorator, Node } from "cc";
const { ccclass, property } = _decorator;

@ccclass('Player')
export class Player extends Unit {
    team: Team;
}

export function create_player<T extends Player>(PlayerClassType: new ()=>T, team: Team, node?: Node): T {
    const player = create_unit(PlayerClassType, node);
    player.team = team;
    return player;
}
