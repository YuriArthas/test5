import { Player } from "./Player";
import { create_unit, Unit } from "./Unit";
import { World } from "./World";
import { Node } from "cc";

export class Pawn extends Unit {
    world: World = undefined;
    player: Player = undefined;


}

// 创建一个Unit, 并返回它, 脚本总是这样创建Unit
export function create_pawn<T extends Pawn>(PawnClassType: new ()=>T, world: World, player: Player, node?: Node): T {
    const pawn = create_unit(PawnClassType, node);
    pawn.world = world;
    pawn.player = player;
    return pawn;
}
