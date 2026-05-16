import crypto from 'crypto';
import { normalizeDialogueTextForClient } from './DialogueTextNormalizer';

const EXACT_PHRASES: Record<string, string> = {
    'Lost Connection': 'Baglanti Koptu',
    'Client Error': 'Istemci Hatasi',
    'Party Chat': 'Grup Sohbeti',
    'Guild Chat': 'Lonca Sohbeti',
    'Left': 'Sol',
    'Right': 'Sag',
    'Jump': 'Zipla',
    'Drop': 'Dus',
    'Wave': 'El Salla',
    'Dance': 'Dans',
    'Cheer': 'Tezahurat',
    'Map': 'Harita',
    'Talents': 'Yetenekler',
    'Social': 'Sosyal',
    'Inventory': 'Envanter',
    'Store': 'Magaza',
    'Door': 'Kapi',
    'Home': 'Ev',
    'Spellbook': 'Buyu Kitabi',
    'Reply': 'Yanitla',
    'Pet': 'Evcil',
    'Mount': 'Binek',
    'Paladin': 'Sovalyeci',
    'Rogue': 'Haydut',
    'Mage': 'Buyucu',
    'Adventurer': 'Maceraci',
    'Hero': 'Kahraman'
};

const PROPER_PHRASES: Record<string, string> = {
    'Jade City': 'Yesim Sehir',
    'JadeCity': 'Yesim Sehir',
    'Newbie Road': 'Acemi Yolu',
    'NewbieRoad': 'Acemi Yolu',
    "Wolf's End": 'Kurtlarin Sonu',
    'Wolfs End': 'Kurtlarin Sonu',
    'WolfsEnd': 'Kurtlarin Sonu',
    'Black Rose Mire': 'Siyah Gul Batakligi',
    'BlackRoseMire': 'Siyah Gul Batakligi',
    'Capstone': 'Kilit Tasi',
    'The Capstone': 'Kilit Tasi',
    'Dread Capstone': 'Dehset Kilit Tasi',
    'Bridge Town': 'Kopru Kasabasi',
    'BridgeTown': 'Kopru Kasabasi',
    'Cemetery Hill': 'Mezarlik Tepesi',
    'CemeteryHill': 'Mezarlik Tepesi',
    'Old Mine Mountain': 'Eski Maden Dagi',
    'OldMineMountain': 'Eski Maden Dagi',
    'Emerald Glades': 'Zumrut Cayirlari',
    'EmeraldGlades': 'Zumrut Cayirlari',
    'Stormshard Mountain': 'Firtina Tasi Dagi',
    'Stormshard Mountains': 'Firtina Tasi Daglari',
    'Stormshard Peaks': 'Firtina Tasi Zirveleri',
    'Stormshard': 'Firtina Tasi',
    'Shazari Desert': 'Shazari Colu',
    'ShazariDesert': 'Shazari Colu',
    'Castle Hocke': 'Hocke Kalesi',
    'Castle': 'Kale',
    'Deepgard': 'Derinkoruma',
    'Felbridge': 'Fel Koprusu',
    'Valhaven': 'Val Limani',
    'Meylour': 'Meylour',
    'Nephit': 'Nephit',
    'Hocke': 'Hocke'
};

const WORDS: Record<string, string> = {
    a: 'bir',
    an: 'bir',
    the: '',
    and: 've',
    or: 'veya',
    of: '',
    to: '',
    in: 'icinde',
    for: 'icin',
    with: 'ile',
    your: 'senin',
    you: 'sen',
    all: 'tum',
    every: 'her',
    more: 'daha',
    new: 'yeni',
    old: 'eski',
    great: 'buyuk',
    hard: 'zor',
    dread: 'dehset',
    ancient: 'kadim',
    magic: 'buyu',
    power: 'guc',
    powers: 'gucler',
    ability: 'yetenek',
    abilities: 'yetenekler',
    skill: 'beceri',
    skills: 'beceriler',
    talent: 'yetenek',
    talents: 'yetenekler',
    level: 'seviye',
    upgrade: 'yukselt',
    damage: 'hasar',
    attack: 'saldiri',
    armor: 'zirh',
    health: 'can',
    mana: 'mana',
    recovery: 'toparlanma',
    haste: 'hiz',
    chance: 'sans',
    critical: 'kritik',
    crit: 'kritik',
    resist: 'direnc',
    melee: 'yakin dovus',
    ranged: 'menzilli',
    fire: 'ates',
    frost: 'buz',
    ice: 'buz',
    shadow: 'golge',
    light: 'isik',
    blood: 'kan',
    poison: 'zehir',
    spirit: 'ruh',
    spirits: 'ruhlar',
    ghost: 'hayalet',
    ghosts: 'hayaletler',
    goblin: 'goblin',
    goblins: 'goblinler',
    dragon: 'ejderha',
    dragons: 'ejderhalar',
    human: 'insan',
    humans: 'insanlar',
    monster: 'canavar',
    monsters: 'canavarlar',
    boss: 'patron',
    dungeon: 'zindan',
    dungeons: 'zindanlar',
    mission: 'gorev',
    missions: 'gorevler',
    quest: 'gorev',
    quests: 'gorevler',
    reward: 'odul',
    rewards: 'oduller',
    gold: 'altin',
    item: 'esya',
    items: 'esyalar',
    gear: 'ekipman',
    weapon: 'silah',
    sword: 'kilic',
    shield: 'kalkan',
    charm: 'tilsim',
    material: 'malzeme',
    pet: 'evcil',
    mount: 'binek',
    store: 'magaza',
    royal: 'kraliyet',
    common: 'yaygin',
    uncommon: 'sira disi',
    rare: 'nadir',
    epic: 'destansi',
    legendary: 'efsanevi',
    road: 'yol',
    city: 'sehir',
    town: 'kasaba',
    bridge: 'kopru',
    swamp: 'bataklik',
    river: 'nehir',
    hill: 'tepe',
    mountain: 'dag',
    mine: 'maden',
    desert: 'col',
    temple: 'tapinak',
    kill: 'oldur',
    slay: 'avla',
    defeat: 'yen',
    complete: 'tamamla',
    collect: 'topla',
    find: 'bul',
    open: 'ac',
    return: 'don',
    protect: 'koru',
    save: 'kurtar',
    help: 'yardim',
    destroy: 'yok et',
    stop: 'durdur',
    use: 'kullan',
    summon: 'cagir',
    strike: 'vurus',
    blade: 'bicak',
    shot: 'atis',
    arrow: 'ok',
    blast: 'patlama',
    wave: 'dalga',
    storm: 'firtina',
    barrier: 'bariyer',
    aura: 'aura',
    trap: 'tuzak',
    bomb: 'bomba',
    strength: 'guc',
    agility: 'ceviklik',
    dexterity: 'ceviklik',
    intelligence: 'zeka',
    expertise: 'uzmanlik',
    stat: 'istatistik',
    stats: 'istatistikler',
    score: 'puan',
    accuracy: 'isabet',
    time: 'sure',
    remaining: 'kalan',
    locked: 'kilitli',
    learn: 'ogren',
    cost: 'bedel',
    free: 'serbest'
};

function stableId(value: string): string {
    return crypto.createHash('sha1').update(value).digest('hex').slice(0, 6).toUpperCase();
}

function splitCamelToken(token: string): string {
    return token
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ');
}

function translateWord(rawWord: string): string {
    if (/^#\w+#$/.test(rawWord)) {
        return rawWord;
    }

    const exact = EXACT_PHRASES[rawWord] || PROPER_PHRASES[rawWord];
    if (exact) {
        return exact;
    }

    const split = splitCamelToken(rawWord);
    if (split !== rawWord && /\s/.test(split)) {
        return split
            .split(/\s+/)
            .map((part) => translateWord(part))
            .filter(Boolean)
            .join(' ');
    }

    const lower = rawWord.toLowerCase().replace(/'s$/i, '');
    return WORDS[lower] ?? '';
}

function applyPhraseGlossary(value: string): string {
    let next = value;
    const phrases = [...Object.entries(PROPER_PHRASES), ...Object.entries(EXACT_PHRASES)]
        .sort((a, b) => b[0].length - a[0].length);

    for (const [source, target] of phrases) {
        next = next.replace(new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), target);
    }

    return next;
}

function fallbackText(source: string): string {
    return `Turkce metin ${stableId(source)}.`;
}

export function localizeUnknownTurkishText(source: string): string {
    const value = String(source ?? '');
    if (!/[A-Za-z]{2,}/.test(value)) {
        return normalizeDialogueTextForClient(value, 'tr');
    }

    const mustBeLevel = value.match(/^Must be level\s+(.+?)\s+to upgrade$/i);
    if (mustBeLevel) {
        return normalizeDialogueTextForClient(`Yukseltmek icin seviye ${mustBeLevel[1]} gerekli`, 'tr');
    }

    const busyUpgrade = value.match(/^Busy upgrading\s+(.+)$/i);
    if (busyUpgrade) {
        return normalizeDialogueTextForClient(`${localizeUnknownTurkishText(busyUpgrade[1])} yukseltmesi suruyor`, 'tr');
    }

    const exact = EXACT_PHRASES[value] || PROPER_PHRASES[value];
    if (exact) {
        return normalizeDialogueTextForClient(exact, 'tr');
    }

    const phraseApplied = applyPhraseGlossary(value);
    const tokens = phraseApplied.match(/#\w+#|[A-Za-z][A-Za-z0-9']*|\d+|[^A-Za-z0-9#]+|#/g) || [];
    const translated = tokens
        .map((token) => /^[A-Za-z][A-Za-z0-9']*$/.test(token) || /^#\w+#$/.test(token)
            ? translateWord(token)
            : token)
        .join('')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return normalizeDialogueTextForClient(translated || fallbackText(value), 'tr');
}
