import { Client } from '../core/Client';
import { BitReader } from '../network/protocol/bitReader';

export class RewardHandler {
    static handleGrantReward(client: Client, data: Buffer): void {
        const br = new BitReader(data);

        br.readMethod9(); // receiver id
        br.readMethod9(); // source id
        br.readMethod15(); // drop item
        br.readMethod309(); // item multiplier
        br.readMethod15(); // drop gear
        br.readMethod309(); // gear multiplier
        br.readMethod15(); // drop material
        br.readMethod15(); // drop trove
        br.readMethod9(); // exp
        br.readMethod9(); // pet exp
        br.readMethod9(); // hp gain
        br.readMethod9(); // gold
        br.readMethod24(); // world x
        br.readMethod24(); // world y

        if (br.readMethod15()) {
            br.readMethod9(); // combo
        }

        // The Python server turns this into loot/xp handling.
        // TS currently only needs to accept the packet so tutorial flow keeps moving.
        void client;
    }
}
