import { create_unit, Unit } from "./Unit";
import { Node } from "cc";

export class Team extends Unit {
    team_id: number = 0;

}

export function create_team<T extends Team>(TeamClassType: new ()=>T, team_id: number, node?: Node): T {
    const team = create_unit(TeamClassType, node);
    team.team_id = team_id;
    return team;
}
