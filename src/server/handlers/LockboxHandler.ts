import { Client } from '../core/Client';
import { GameData } from '../core/GameData';
import { PetConfig } from '../core/PetConfig';
import { JsonAdapter } from '../database/JsonAdapter';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';
import { upsertInventoryGear } from '../utils/GearInventory';
import { PetHandler } from './PetHandler';
import { RewardHandler } from './RewardHandler';

const db = new JsonAdapter();

type LockboxRewardType = 'mount' | 'pet' | 'egg' | 'consumable' | 'gear' | 'charm' | 'gold' | 'dye';

interface LockboxRewardDefinition {
    index: number;
    name: string | null;
    type: LockboxRewardType;
    goldAmount?: number;
}

interface ResolvedLockboxReward {
    index: number;
    type: LockboxRewardType;
    grantName: string;
    packetName: string;
    gearId?: number;
    goldAmount?: number;
}

export class LockboxHandler {
    private static readonly TROVE_LOCKBOX_ID = 1;
    private static readonly TROVE_OPTIONS: Record<number, { quantity: number; cost: number }> = {
        0: { quantity: 1, cost: 50000 },
        1: { quantity: 10, cost: 375000 },
        2: { quantity: 25, cost: 625000 }
    };
    private static readonly KEY_OPTIONS: Record<number, { quantity: number; cost: number }> = {
        0: { quantity: 1, cost: 22 },
        1: { quantity: 10, cost: 210 },
        2: { quantity: 25, cost: 470 }
    };
    private static readonly LOCKBOX_REWARD_POOL: LockboxRewardDefinition[] = [
        { index: 0, name: 'MountLockbox01L01', type: 'mount' },
        { index: 1, name: 'Lockbox01L01', type: 'pet' },
        { index: 2, name: 'GenericBrown', type: 'egg' },
        { index: 3, name: 'CommonBrown', type: 'egg' },
        { index: 4, name: 'OrdinaryBrown', type: 'egg' },
        { index: 5, name: 'PlainBrown', type: 'egg' },
        { index: 6, name: 'RarePetFood', type: 'consumable' },
        { index: 7, name: 'PetFood', type: 'consumable' },
        { index: 8, name: null, type: 'gear' },
        { index: 9, name: 'TripleFind', type: 'charm' },
        { index: 10, name: 'DoubleFind1', type: 'charm' },
        { index: 11, name: 'DoubleFind2', type: 'charm' },
        { index: 12, name: 'DoubleFind3', type: 'charm' },
        { index: 13, name: 'MajorLegendaryCatalyst', type: 'consumable' },
        { index: 14, name: 'MajorRareCatalyst', type: 'consumable' },
        { index: 15, name: 'MinorRareCatalyst', type: 'consumable' },
        { index: 16, name: '3,000,000 Gold', type: 'gold', goldAmount: 3000000 },
        { index: 17, name: '1,500,000 Gold', type: 'gold', goldAmount: 1500000 },
        { index: 18, name: '750,000 Gold', type: 'gold', goldAmount: 750000 },
        { index: 19, name: null, type: 'dye' }
    ];
    private static readonly CLASS_GEAR_IDS: Record<string, number[]> = {
        mage: [1165, 1166, 1167, 1168, 1169, 1170],
        rogue: [1171, 1172, 1173, 1174, 1175, 1176],
        paladin: [1177, 1178, 1179, 1180, 1181, 1182]
    };
    private static readonly CLASS_GEAR_NAMES: Record<number, string> = {
        1165: 'UniqueMageLockbox01GearSword30',
        1166: 'UniqueMageLockbox01GearShield30',
        1167: 'UniqueMageLockbox01GearHat30',
        1168: 'UniqueMageLockbox01GearArmor30',
        1169: 'UniqueMageLockbox01GearGloves30',
        1170: 'UniqueMageLockbox01GearBoots30',
        1171: 'UniqueRogueLockbox01GearSword30',
        1172: 'UniqueRogueLockbox01GearShield30',
        1173: 'UniqueRogueLockbox01GearHat30',
        1174: 'UniqueRogueLockbox01GearArmor30',
        1175: 'UniqueRogueLockbox01GearGloves30',
        1176: 'UniqueRogueLockbox01GearBoots30',
        1177: 'UniquePaladinLockbox01GearSword30',
        1178: 'UniquePaladinLockbox01GearShield30',
        1179: 'UniquePaladinLockbox01GearHat30',
        1180: 'UniquePaladinLockbox01GearArmor30',
        1181: 'UniquePaladinLockbox01GearGloves30',
        1182: 'UniquePaladinLockbox01GearBoots30'
    };
    private static readonly LEGENDARY_DYES = [
        'BroodMotherBlack',
        'ClearcastPearl',
        'WizardWoolWhite',
        'AstralObsidian',
        'GleamingGold',
        'ShiningSilver',
        'MightyMammothIvory',
        'FieryPhoenixFeather',
        'VelvetValkyries',
        'YearOfTheMammoth',
        'CheerocracyPackPink',
        'ElegantEmerald',
        'LeviathanLapisLazuli',
        'AlluringAmethyst',
        'SparklingTourmaline',
        'DragonCoatRed',
        'IridescentOpal',
        'HailToTheForest',
        'BrokenHeartBlack',
        'FrostlordSatin'
    ];

    static async handleBuyTreasureTrove(client: Client, data: Buffer): Promise<void> {
        if (!client.character) {
            return;
        }

        let optionIndex = 0;
        try {
            const br = new BitReader(data);
            br.readMethod6(2);
            optionIndex = br.readMethod4();
        } catch (error) {
            console.log(`[LockboxHandler] Failed to parse treasure trove purchase payload: ${String(error)}`);
            return;
        }

        const option = LockboxHandler.TROVE_OPTIONS[optionIndex];
        if (!option) {
            return;
        }

        const currentGold = Number(client.character.gold ?? 0);
        if (currentGold < option.cost) {
            return;
        }

        client.character.gold = currentGold - option.cost;
        LockboxHandler.addLockboxes(client.character, LockboxHandler.TROVE_LOCKBOX_ID, option.quantity);

        LockboxHandler.sendGoldLoss(client, option.cost);
        LockboxHandler.sendLockboxInventoryDelta(client, LockboxHandler.TROVE_LOCKBOX_ID, option.quantity);
        await LockboxHandler.saveCharacter(client);
    }

    static async handleBuyLockboxKeys(client: Client, data: Buffer): Promise<void> {
        if (!client.character) {
            return;
        }

        let optionIndex = 0;
        try {
            const br = new BitReader(data);
            optionIndex = br.readMethod9();
        } catch (error) {
            console.log(`[LockboxHandler] Failed to parse Dragon Key purchase payload: ${String(error)}`);
            return;
        }

        const option = LockboxHandler.KEY_OPTIONS[optionIndex];
        if (!option) {
            return;
        }

        const currentIdols = Number(client.character.mammothIdols ?? 0);
        if (currentIdols < option.cost) {
            return;
        }

        client.character.mammothIdols = currentIdols - option.cost;
        client.character.DragonKeys = Number(client.character.DragonKeys ?? 0) + option.quantity;

        LockboxHandler.sendIdolLoss(client, `DragonKeys_x${option.quantity}`, option.cost);
        await LockboxHandler.saveCharacter(client);
    }

    static async handleLockboxReward(client: Client, _data: Buffer): Promise<void> {
        if (!client.character) {
            return;
        }

        const currentTroveCount = LockboxHandler.getLockboxCount(client.character, LockboxHandler.TROVE_LOCKBOX_ID);
        const currentKeys = Number(client.character.DragonKeys ?? 0);
        if (currentTroveCount <= 0 || currentKeys <= 0) {
            return;
        }

        LockboxHandler.addLockboxes(client.character, LockboxHandler.TROVE_LOCKBOX_ID, -1);
        client.character.DragonKeys = currentKeys - 1;

        const reward = LockboxHandler.selectReward(client.character);
        LockboxHandler.sendLockboxReveal(client, reward);

        const sigilReward = 50 + Math.floor(Math.random() * 101);
        client.character.SilverSigils = Number(client.character.SilverSigils ?? 0) + sigilReward;
        LockboxHandler.sendRoyalSigilReward(client, sigilReward);

        await LockboxHandler.applyReward(client, reward);
        await LockboxHandler.saveCharacter(client);
    }

    private static normalizeLockboxes(character: any): Array<{ lockboxID: number; count: number }> {
        const counts = new Map<number, number>();
        for (const entry of Array.isArray(character?.lockboxes) ? character.lockboxes : []) {
            const lockboxId = Number(entry?.lockboxID ?? 0);
            const count = Number(entry?.count ?? 0);
            if (!Number.isFinite(lockboxId) || lockboxId <= 0 || !Number.isFinite(count) || count === 0) {
                continue;
            }
            counts.set(lockboxId, (counts.get(lockboxId) ?? 0) + Math.round(count));
        }

        const normalized = Array.from(counts.entries())
            .filter(([, count]) => count > 0)
            .map(([lockboxID, count]) => ({ lockboxID, count }))
            .sort((left, right) => left.lockboxID - right.lockboxID);

        if (character) {
            character.lockboxes = normalized;
        }

        return normalized;
    }

    private static getLockboxCount(character: any, lockboxId: number): number {
        const entry = LockboxHandler.normalizeLockboxes(character).find((lockbox) => lockbox.lockboxID === lockboxId);
        return Number(entry?.count ?? 0);
    }

    private static addLockboxes(character: any, lockboxId: number, delta: number): number {
        const lockboxes = LockboxHandler.normalizeLockboxes(character);
        const entry = lockboxes.find((lockbox) => lockbox.lockboxID === lockboxId);
        if (entry) {
            entry.count = Math.max(0, Number(entry.count ?? 0) + delta);
        } else if (delta > 0) {
            lockboxes.push({ lockboxID: lockboxId, count: delta });
        }

        const normalized = lockboxes
            .filter((lockbox) => Number(lockbox.count ?? 0) > 0)
            .sort((left, right) => left.lockboxID - right.lockboxID);
        character.lockboxes = normalized;
        return Number(normalized.find((lockbox) => lockbox.lockboxID === lockboxId)?.count ?? 0);
    }

    private static selectReward(character: any): ResolvedLockboxReward {
        const className = String(character?.class ?? 'paladin').trim().toLowerCase();
        const ownedMounts = new Set<number>(PetHandler.normalizeMountState(character));
        const ownedPetTypes = new Set<number>(
            (Array.isArray(character?.pets) ? character.pets : [])
                .map((pet: any) => Number(pet?.typeID ?? 0))
                .filter((typeId: number) => typeId > 0)
        );
        const ownedDyes = new Set<number>(
            (Array.isArray(character?.OwnedDyes) ? character.OwnedDyes : [])
                .map((dyeId: unknown) => Number(dyeId))
                .filter((dyeId: number) => dyeId > 0)
        );
        const ownedGearIds = new Set<number>();
        for (const rawGear of Array.isArray(character?.inventoryGears) ? character.inventoryGears : []) {
            const gearId = Number(rawGear?.gearID ?? 0);
            if (gearId > 0) {
                ownedGearIds.add(gearId);
            }
        }
        for (const rawGear of Array.isArray(character?.equippedGears) ? character.equippedGears : []) {
            const gearId = Number(rawGear?.gearID ?? 0);
            if (gearId > 0) {
                ownedGearIds.add(gearId);
            }
        }

        const availableRewards = LockboxHandler.LOCKBOX_REWARD_POOL.filter((reward) => {
            if (reward.type === 'mount' && reward.name) {
                const mountId = GameData.getMountId(reward.name);
                return mountId <= 0 || !ownedMounts.has(mountId);
            }

            if (reward.type === 'pet' && reward.name) {
                const petDef = PetConfig.PET_TYPES.find((pet) => String(pet.PetName) === reward.name);
                return !petDef || !ownedPetTypes.has(Number(petDef.PetID ?? 0));
            }

            if (reward.type === 'dye') {
                return LockboxHandler.LEGENDARY_DYES.some((dyeName) => !ownedDyes.has(GameData.getDyeId(dyeName)));
            }

            if (reward.type === 'gear') {
                return LockboxHandler.getAvailableClassGearIds(className, ownedGearIds).length > 0;
            }

            return true;
        });

        const rewardPool = availableRewards.length > 0
            ? availableRewards
            : LockboxHandler.LOCKBOX_REWARD_POOL.filter((reward) =>
                reward.type === 'gold' ||
                reward.type === 'consumable' ||
                reward.type === 'charm' ||
                reward.type === 'egg'
            );
        const selectedReward = rewardPool[Math.floor(Math.random() * rewardPool.length)] ?? LockboxHandler.LOCKBOX_REWARD_POOL[18];

        if (selectedReward.type === 'dye') {
            const availableDyeNames = LockboxHandler.LEGENDARY_DYES.filter(
                (dyeName) => !ownedDyes.has(GameData.getDyeId(dyeName))
            );
            const dyeName = availableDyeNames[Math.floor(Math.random() * availableDyeNames.length)] ?? 'BroodMotherBlack';
            return {
                index: selectedReward.index,
                type: 'dye',
                grantName: dyeName,
                packetName: dyeName
            };
        }

        if (selectedReward.type === 'gear') {
            const availableGearIds = LockboxHandler.getAvailableClassGearIds(className, ownedGearIds);
            const gearId = availableGearIds[Math.floor(Math.random() * availableGearIds.length)] ?? 0;
            return {
                index: selectedReward.index,
                type: 'gear',
                grantName: LockboxHandler.CLASS_GEAR_NAMES[gearId] ?? `LockboxGear${gearId}`,
                packetName: LockboxHandler.CLASS_GEAR_NAMES[gearId] ?? `LockboxGear${gearId}`,
                gearId
            };
        }

        const rewardName = selectedReward.name ?? '';
        if (selectedReward.type === 'egg') {
            const petDisplayName = LockboxHandler.getEggDisplayPetName(rewardName);
            return {
                index: selectedReward.index,
                type: 'egg',
                grantName: rewardName,
                packetName: petDisplayName || rewardName
            };
        }

        return {
            index: selectedReward.index,
            type: selectedReward.type,
            grantName: rewardName,
            packetName: rewardName,
            goldAmount: selectedReward.goldAmount
        };
    }

    private static getAvailableClassGearIds(className: string, ownedGearIds: Set<number>): number[] {
        const classGearIds = LockboxHandler.CLASS_GEAR_IDS[className] ?? LockboxHandler.CLASS_GEAR_IDS.paladin;
        return classGearIds.filter((gearId) => !ownedGearIds.has(gearId));
    }

    private static getEggDisplayPetName(eggName: string): string {
        const eggDef = PetConfig.EGG_TYPES.find((egg) => String(egg.EggName) === eggName);
        if (!eggDef) {
            return eggName;
        }

        const petDef = PetConfig.PET_TYPES.find((pet) => Number(pet.PetID ?? 0) === Number(eggDef.EggID ?? 0));
        return String(petDef?.PetName ?? eggName);
    }

    private static async applyReward(client: Client, reward: ResolvedLockboxReward): Promise<void> {
        const character = client.character;
        if (!character) {
            return;
        }

        if (reward.type === 'gold') {
            const goldAmount = Number(reward.goldAmount ?? 0);
            if (goldAmount > 0) {
                character.gold = Number(character.gold ?? 0) + goldAmount;
                RewardHandler.sendGoldReward(client, goldAmount, false);
            }
            return;
        }

        if (reward.type === 'consumable') {
            const consumableId = GameData.getConsumableId(reward.grantName);
            if (consumableId <= 0) {
                return;
            }

            const consumables = Array.isArray(character.consumables) ? character.consumables : [];
            const entry = consumables.find((consumable: any) => Number(consumable?.consumableID ?? 0) === consumableId);
            if (entry) {
                entry.count = Number(entry.count ?? 0) + 1;
            } else {
                consumables.push({ consumableID: consumableId, count: 1 });
            }
            character.consumables = consumables;
            LockboxHandler.sendConsumableReward(client, consumableId, 1, Number(entry?.count ?? 1));
            return;
        }

        if (reward.type === 'charm') {
            const charmId = GameData.getCharmId(reward.grantName);
            if (charmId <= 0) {
                return;
            }

            const charms = Array.isArray(character.charms) ? character.charms : [];
            const entry = charms.find((charm: any) => Number(charm?.charmID ?? 0) === charmId);
            if (entry) {
                entry.count = Number(entry.count ?? 0) + 1;
            } else {
                charms.push({ charmID: charmId, count: 1 });
            }
            character.charms = charms;
            LockboxHandler.sendCharmReward(client, charmId);
            return;
        }

        if (reward.type === 'mount') {
            const mountId = GameData.getMountId(reward.grantName);
            if (mountId <= 0) {
                return;
            }

            const mounts = PetHandler.normalizeMountState(character);
            if (!mounts.includes(mountId)) {
                mounts.push(mountId);
            }
            character.mounts = Array.from(new Set(mounts)).sort((left, right) => left - right);
            LockboxHandler.sendMountReward(client, mountId, false);
            return;
        }

        if (reward.type === 'pet' || reward.type === 'egg') {
            const petDef = reward.type === 'pet'
                ? PetConfig.PET_TYPES.find((pet) => String(pet.PetName) === reward.grantName)
                : PetConfig.PET_TYPES.find((pet) => Number(pet.PetID ?? 0) === Number(
                    PetConfig.EGG_TYPES.find((egg) => String(egg.EggName) === reward.grantName)?.EggID ?? 0
                ));
            if (!petDef) {
                return;
            }

            const pets = Array.isArray(character.pets) ? character.pets : [];
            const nextSpecialId = pets.reduce((max: number, pet: any) =>
                Math.max(max, Number(pet?.special_id ?? 0)), 0) + 1;
            const petLevel = reward.type === 'egg' ? 10 : 1;
            pets.push({
                typeID: Number(petDef.PetID ?? 0),
                special_id: nextSpecialId,
                level: petLevel,
                xp: 0
            });
            character.pets = pets;
            LockboxHandler.sendNewPetReward(client, Number(petDef.PetID ?? 0), nextSpecialId, petLevel, false);
            return;
        }

        if (reward.type === 'dye') {
            const dyeId = GameData.getDyeId(reward.grantName);
            if (dyeId <= 0) {
                return;
            }

            const ownedDyes = new Set<number>(
                (Array.isArray(character.OwnedDyes) ? character.OwnedDyes : [])
                    .map((dye: unknown) => Number(dye))
                    .filter((dyeIdValue: number) => dyeIdValue > 0)
            );
            ownedDyes.add(dyeId);
            character.OwnedDyes = Array.from(ownedDyes.values()).sort((left, right) => left - right);
            LockboxHandler.sendDyeReward(client, dyeId, false);
            return;
        }

        if (reward.type === 'gear') {
            const gearId = Number(reward.gearId ?? 0);
            if (gearId <= 0) {
                return;
            }

            upsertInventoryGear(character, gearId, 2, [0, 0, 0], [0, 0]);
            LockboxHandler.sendGearReward(client, gearId, 2);
        }
    }

    private static sendGoldLoss(client: Client, amount: number): void {
        const bb = new BitBuffer(false);
        bb.writeMethod4(amount);
        client.sendBitBuffer(0xB4, bb);
    }

    private static sendIdolLoss(client: Client, purchaseName: string, amount: number): void {
        const bb = new BitBuffer(false);
        bb.writeMethod13(purchaseName);
        bb.writeMethod4(amount);
        client.sendBitBuffer(0xB5, bb);
    }

    private static sendLockboxInventoryDelta(client: Client, lockboxId: number, delta: number): void {
        const bb = new BitBuffer(false);
        bb.writeMethod6(lockboxId, 2);
        bb.writeMethod4(delta);
        bb.writeMethod15(true);
        client.sendBitBuffer(0x104, bb);
    }

    private static sendLockboxReveal(client: Client, reward: ResolvedLockboxReward): void {
        const bb = new BitBuffer(false);
        if (reward.type === 'dye') {
            bb.writeMethod6(4, 3);
            bb.writeMethod6(0, 6);
        } else {
            bb.writeMethod6(1, 3);
            bb.writeMethod6(reward.index, 6);
        }
        bb.writeMethod6(1, 1);
        bb.writeMethod13(reward.packetName);
        client.sendBitBuffer(0x108, bb);
    }

    private static sendRoyalSigilReward(client: Client, amount: number): void {
        const bb = new BitBuffer(false);
        bb.writeMethod4(amount);
        client.sendBitBuffer(0x112, bb);
    }

    private static sendMountReward(client: Client, mountId: number, suppress: boolean): void {
        const bb = new BitBuffer(false);
        bb.writeMethod4(mountId);
        bb.writeMethod15(suppress);
        client.sendBitBuffer(0x36, bb);
    }

    private static sendNewPetReward(
        client: Client,
        petTypeId: number,
        specialId: number,
        level: number,
        suppress: boolean
    ): void {
        const bb = new BitBuffer(false);
        bb.writeMethod6(petTypeId, 7);
        bb.writeMethod4(specialId);
        bb.writeMethod6(level, 6);
        bb.writeMethod15(suppress);
        client.sendBitBuffer(0x37, bb);
    }

    private static sendConsumableReward(client: Client, consumableId: number, amount: number, newTotal: number): void {
        const update = new BitBuffer(false);
        update.writeMethod6(consumableId, 5);
        update.writeMethod4(newTotal);
        client.sendBitBuffer(0x10C, update);

        const consumableDef = GameData.CONSUMABLES.find((consumable) => Number(consumable?.ConsumableID ?? 0) === consumableId);
        const displayAmount = String(consumableDef?.Type ?? '') === 'Potion' ? amount * 5000 : amount;

        const reward = new BitBuffer(false);
        reward.writeMethod6(consumableId, 5);
        reward.writeMethod4(displayAmount);
        reward.writeMethod15(false);
        client.sendBitBuffer(0x10B, reward);
    }

    private static sendCharmReward(client: Client, charmId: number): void {
        const bb = new BitBuffer(false);
        bb.writeMethod6(charmId, 16);
        bb.writeMethod15(false);
        client.sendBitBuffer(0x109, bb);
    }

    private static sendDyeReward(client: Client, dyeId: number, suppress: boolean): void {
        const bb = new BitBuffer(false);
        bb.writeMethod6(dyeId, 8);
        bb.writeMethod15(suppress);
        client.sendBitBuffer(0x10A, bb);
    }

    private static sendGearReward(client: Client, gearId: number, tier: number): void {
        const bb = new BitBuffer(false);
        bb.writeMethod6(gearId, 11);
        bb.writeMethod6(tier, 2);
        client.sendBitBuffer(0x33, bb);
    }

    private static async saveCharacter(client: Client): Promise<void> {
        if (!client.character) {
            return;
        }

        if (!client.userId) {
            const normalizedName = String(client.character.name ?? '').trim().toLowerCase();
            const existingIndex = client.characters.findIndex((character) =>
                String(character?.name ?? '').trim().toLowerCase() === normalizedName
            );
            if (existingIndex >= 0) {
                client.characters[existingIndex] = client.character;
            } else {
                client.characters.push(client.character);
            }
            return;
        }

        client.characters = await db.saveCharacterSnapshot(client.userId, client.character);
    }
}
