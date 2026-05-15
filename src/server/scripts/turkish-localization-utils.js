const crypto = require('crypto');

const ASCII_REPLACEMENTS = new Map([
    ['ç', 'c'], ['Ç', 'C'],
    ['ğ', 'g'], ['Ğ', 'G'],
    ['ı', 'i'], ['İ', 'I'],
    ['ö', 'o'], ['Ö', 'O'],
    ['ş', 's'], ['Ş', 'S'],
    ['ü', 'u'], ['Ü', 'U'],
    ['’', "'"], ['‘', "'"],
    ['“', '"'], ['”', '"'],
    ['…', '...']
]);

const EXACT_PHRASES = new Map(Object.entries({
    'Lost Connection': 'Baglanti Koptu',
    'Client Error': 'Istemci Hatasi',
    'Must be level': 'Seviye gerekli',
    'Busy upgrading': 'Yukseltme suruyor',
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
    'Hero': 'Kahraman',
    'GuildMaster': 'Lonca Ustasi',
    'Officer': 'Subay',
    'Member': 'Uye',
    'Initiate': 'Aday',
    'Silenced': 'Susturulmus',
    'Unknown': 'Bilinmeyen',
    'Player': 'Oyuncu',
    'Dungeon': 'Zindan',
    'Gear': 'Ekipman',
    'Loot': 'Ganimet',
    'Display': 'Gorunum',
    'Login': 'Giris',
    'Transfer': 'Aktarim',
    'Play': 'Oyna',
    'None': 'Yok',
    'Infernal': 'Cehennem',
    'Draconic': 'Ejderha',
    'Mythic': 'Efsanevi',
    'Sylvan': 'Orman',
    'Trog': 'Trog',
    'Undead': 'Olumsuz',
    'Divulgent Dragonnette': 'Acik Sozlu Kucuk Ejder',
    'Ingenious Seraph': 'Zeki Seraf',
    'Sagacious Sprite': 'Bilge Peri'
}));

const PROPER_PHRASES = new Map(Object.entries({
    'Jade City': 'Yesim Sehir',
    'JadeCity': 'Yesim Sehir',
    'Newbie Road': 'Acemi Yolu',
    'NewbieRoad': 'Acemi Yolu',
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
    'Shazari Desert': 'Sazari Colu',
    'ShazariDesert': 'Sazari Colu',
    'Castle': 'Kale',
    'Deepgard': 'Derinkoruma',
    'Felbridge': 'Felkopru',
    'Wolfs End': 'Kurt Sonu',
    'Wolf': 'Kurt',
    'Meylour': 'Meylour',
    'Nephit': 'Nephit',
    'Hocke': 'Hocke',
    'Titus': 'Titus',
    'Yagaga': 'Yagaga',
    'Pappy': 'Pappy',
    'Arachnae': 'Arachnae',
    'Svars': 'Svar',
    'Svagg': 'Svagg',
    'Kamak': 'Kamak'
}));

const WORDS = new Map(Object.entries({
    a: 'bir',
    an: 'bir',
    the: '',
    and: 've',
    or: 'veya',
    of: '',
    to: '',
    in: 'icinde',
    on: 'uzerinde',
    for: 'icin',
    from: 'kaynakli',
    with: 'ile',
    without: 'olmadan',
    your: 'senin',
    you: 'sen',
    me: 'beni',
    my: 'benim',
    our: 'bizim',
    all: 'tum',
    every: 'her',
    no: 'yok',
    not: 'degil',
    more: 'daha',
    less: 'daha az',
    new: 'yeni',
    old: 'eski',
    great: 'buyuk',
    greater: 'daha buyuk',
    small: 'kucuk',
    hard: 'zor',
    normal: 'normal',
    dread: 'dehset',
    ancient: 'kadim',
    magic: 'buyu',
    magical: 'buyulu',
    power: 'guc',
    powers: 'gucler',
    ability: 'yetenek',
    abilities: 'yetenekler',
    skill: 'beceri',
    skills: 'beceriler',
    talent: 'yetenek',
    talents: 'yetenekler',
    tree: 'agac',
    level: 'seviye',
    levels: 'seviyeler',
    upgrade: 'yukselt',
    upgrades: 'yukseltmeler',
    damage: 'hasar',
    attack: 'saldiri',
    attacks: 'saldirilar',
    armor: 'zirh',
    health: 'can',
    mana: 'mana',
    recovery: 'toparlanma',
    haste: 'hiz',
    chance: 'sans',
    critical: 'kritik',
    crit: 'kritik',
    resist: 'direnc',
    resilience: 'dayaniklilik',
    melee: 'yakin dovus',
    ranged: 'menzilli',
    range: 'menzil',
    magicdmg: 'buyu hasari',
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
    spider: 'orumcek',
    spiders: 'orumcekler',
    lizard: 'kertenkele',
    undead: 'olumsuz',
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
    idol: 'idol',
    item: 'esya',
    items: 'esyalar',
    gear: 'ekipman',
    weapon: 'silah',
    weapons: 'silahlar',
    sword: 'kilic',
    bow: 'yay',
    staff: 'asa',
    robe: 'cubbe',
    boots: 'cizmeler',
    gloves: 'eldivenler',
    helm: 'migfer',
    helmet: 'migfer',
    ring: 'yuzuk',
    charm: 'tilsim',
    charms: 'tilsimlar',
    material: 'malzeme',
    materials: 'malzemeler',
    pet: 'evcil',
    pets: 'evciller',
    mount: 'binek',
    mounts: 'binekler',
    store: 'magaza',
    royal: 'kraliyet',
    lockbox: 'kilitli sandik',
    consumable: 'tuketilebilir',
    statue: 'heykel',
    egg: 'yumurta',
    dye: 'boya',
    color: 'renk',
    black: 'siyah',
    white: 'beyaz',
    red: 'kirmizi',
    blue: 'mavi',
    green: 'yesil',
    yellow: 'sari',
    purple: 'mor',
    orange: 'turuncu',
    silver: 'gumus',
    golden: 'altin',
    dark: 'koyu',
    bright: 'parlak',
    deep: 'derin',
    stone: 'tas',
    crystal: 'kristal',
    crystals: 'kristaller',
    dream: 'ruya',
    dreams: 'ruyalar',
    sleeping: 'uyuyan',
    lands: 'topraklar',
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
    castle: 'kale',
    cemetery: 'mezarlik',
    glade: 'cayir',
    glades: 'cayirlar',
    temple: 'tapinak',
    tower: 'kule',
    keep: 'hisar',
    king: 'kral',
    queen: 'kralice',
    emperor: 'imparator',
    baron: 'baron',
    captain: 'kaptan',
    mayor: 'baskan',
    master: 'usta',
    apprentice: 'cirak',
    slayer: 'avci',
    killer: 'olduren',
    kill: 'oldur',
    kills: 'oldurmeler',
    slay: 'avla',
    defeat: 'yen',
    defeated: 'yenildi',
    complete: 'tamamla',
    completed: 'tamamlandi',
    collect: 'topla',
    find: 'bul',
    open: 'ac',
    close: 'kapat',
    enter: 'gir',
    leave: 'ayril',
    return: 'don',
    talk: 'konus',
    protect: 'koru',
    save: 'kurtar',
    help: 'yardim',
    destroy: 'yok et',
    stop: 'durdur',
    use: 'kullan',
    summon: 'cagir',
    summons: 'cagirir',
    strike: 'vurus',
    blade: 'bicak',
    blades: 'bicaklar',
    shot: 'atis',
    shots: 'atislar',
    arrow: 'ok',
    arrows: 'oklar',
    bolt: 'ok',
    blast: 'patlama',
    wave: 'dalga',
    storm: 'firtina',
    shield: 'kalkan',
    barrier: 'bariyer',
    aura: 'aura',
    form: 'form',
    trap: 'tuzak',
    bomb: 'bomba',
    rage: 'ofke',
    focus: 'odak',
    wisdom: 'bilgelik',
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
    busy: 'mesgul',
    requires: 'gerektirir',
    required: 'gerekli',
    enough: 'yeterli',
    locked: 'kilitli',
    unlocked: 'acildi',
    available: 'mevcut',
    learn: 'ogren',
    learned: 'ogrenildi',
    cost: 'bedel',
    free: 'serbest',
    buy: 'satın al',
    sell: 'sat',
    equip: 'kusat',
    equipped: 'kusatilmis',
    unequip: 'cikar',
    craft: 'uret',
    crafting: 'uretim',
    rare: 'nadir',
    epic: 'destansi',
    common: 'yaygin',
    uncommon: 'sira disi',
    legendary: 'efsanevi'
}));

const POWER_DISPLAY_PHRASES = new Map(Object.entries({
    'Sword Melee': 'Kilic Yakin Dovus',
    'Mace Melee': 'Gurz Yakin Dovus',
    'Axe Melee': 'Balta Yakin Dovus',
    'Dagger Melee': 'Hancer Yakin Dovus',
    'Staff Melee': 'Asa Yakin Dovus',
    Lightningball: 'Simsek Kuresi',
    Energyball: 'Enerji Kuresi',
    Fireball: 'Ates Topu',
    Iceball: 'Buz Kuresi',
    Poisonball: 'Zehir Kuresi',
    Smash: 'Ezici Darbe',
    Skewer: 'Saplama',
    Cleave: 'Yarici Darbe',
    'Healing Touch': 'Sifa Dokunusu',
    Warcry: 'Savas Cigligi',
    'Shield Stun': 'Kalkan Sersemletmesi',
    'Aura of Blessing': 'Kutsama Aurasi',
    'Guardian Shield': 'Muhafiz Kalkani',
    'Jump Slam': 'Sicrama Darbesi',
    'Divine Bolt': 'Ilahi Ok',
    'Divine Word': 'Ilahi Soz',
    Subjugate: 'Boyun Egdir',
    'Hallowed Reckoning': 'Kutsal Hesaplasma',
    Penance: 'Kefaret',
    Verdict: 'Hukum',
    'Empyrean Aura': 'Goksel Aura',
    Sanctum: 'Siginak',
    'Celestial Lance': 'Goksel Mizrak',
    'Sacred Light': 'Kutsal Isik',
    'Axe Flurry': 'Balta Firtinasi',
    'Pain Eater': 'Aci Yiyen',
    'End Pain Eater': 'Aci Yiyeni Bitir',
    Sacrifice: 'Fedakarlik',
    'End Sacrifice': 'Fedakarligi Bitir',
    'Furious Assault': 'Ofkeli Saldiri',
    'Justice Fist': 'Adalet Yumrugu',
    'Cleaving Blows': 'Yarici Darbeler',
    Fury: 'Hiddet',
    'Flame Axe': 'Alev Baltasi',
    'Lightning Storm': 'Simsek Firtinasi',
    'Lightning Bomb': 'Simsek Bombasi',
    Harm: 'Zarar',
    Berserker: 'Cengaver',
    'Meteor Smash': 'Meteor Darbesi',
    'Fire Shield': 'Ates Kalkani',
    Heroism: 'Kahramanlik',
    Blaze: 'Alev',
    'Concussion Bolt': 'Sarsma Oku',
    'Holy Smash': 'Kutsal Darbe',
    'Shield Flurry': 'Kalkan Firtinasi',
    Retribution: 'Intikam',
    Shockwave: 'Sok Dalgasi',
    'Unstable Barrier': 'Dengesiz Bariyer',
    Juggernaut: 'Ezici Guc',
    'Second Wind': 'Ikinci Nefes',
    Defiance: 'Meydan Okuma',
    'Sentinel Form': 'Nobetci Formu',
    'End Sentinel Form': 'Nobetci Formunu Bitir',
    'Fire Blast': 'Ates Patlamasi',
    'Ice Lance': 'Buz Mizragi',
    'Vine Strike': 'Sarmasik Darbesi',
    'Vine Lance': 'Sarmasik Mizragi',
    'Flame Wave': 'Alev Dalgasi',
    'Ice Nova': 'Buz Novasi',
    'Poison Cloud': 'Zehir Bulutu',
    'Meteor Channel': 'Meteor Odaklamasi',
    Meteor: 'Goktasi',
    'Hail Storm': 'Dolu Firtinasi',
    'Call Guard': 'Muhafiz Cagir',
    'Frost Bolt': 'Don Oku',
    'Frigid Comet': 'Dondurucu Kuyruklu Yildiz',
    'Frozen Ward': 'Donmus Muhafaza',
    'Arctic Blast': 'Kutup Patlamasi',
    'Hailstone Embrace': 'Dolu Sarmali',
    'End Hailstone Embrace': 'Dolu Sarmalini Bitir',
    'Frost Spire': 'Buz Kulesi',
    'Glacial Spear': 'Buzul Mizragi',
    'Permafrost Clone': 'Don Klonu',
    'Tundra Wyrm': 'Tundra Ejderi',
    'Bitter Blade': 'Aci Bicak',
    Inferno: 'Cehennem Alevi',
    Conflagration: 'Buyuk Yangin',
    'Molten Rain': 'Erimis Yagmur',
    'Draconic Soul': 'Ejderha Ruhu',
    'Fire Ball': 'Ates Topu',
    'Searing Grasp': 'Yakici Kavrayis',
    Pyromania: 'Piromani',
    Wildfire: 'Kontrolsuz Ates',
    WildFire: 'Kontrolsuz Ates',
    Firebrand: 'Alev Damgasi',
    'Iridescent Burst': 'Yanardoner Patlama',
    'Molten Fist': 'Erimis Yumruk',
    'Lich Shot': 'Lich Atisi',
    'Call the Horde': 'Suruyu Cagir',
    'Bolster the Horde': 'Suruyu Guclendir',
    Desecrate: 'Kirlet',
    Infestation: 'Istila',
    'Death Mark': 'Olum Isareti',
    'Spectral Grasp': 'Ruhani Kavrayis',
    Lifethirst: 'Yasam Susuzlugu',
    'Wail of the Banshee': 'Banshee Cigligi',
    'Plague Battalion': 'Veba Taburu',
    'Stun Strike': 'Sersemletme Darbesi',
    'Poison Strike': 'Zehir Darbesi',
    'Triple Strike': 'Uclu Darbe',
    Weaken: 'Zayiflat',
    Entanglement: 'Dolanma',
    'Steel Whirlwind': 'Celik Kasirga',
    'Hawk Strike': 'Sahin Darbesi',
    'Armor Breaker': 'Zirh Kiran',
    'Reduce Armor': 'Zirhi Azalt',
    'Slapdash Decoy': 'Derme Catma Sahte Hedef',
    Decoy: 'Sahte Hedef',
    'Bone Daggers': 'Kemik Hancerler',
    'Flurry of Daggers': 'Hancer Firtinasi',
    'Severing Strike': 'Koparan Darbe',
    "Scorpion's Sting": 'Akrep Ignesi',
    'Crimson Butterfly': 'Kizil Kelebek',
    'Withering Impact': 'Solduran Darbe',
    Assassinate: 'Suikast',
    'Mist Walk': 'Sis Yuruyusu',
    'Vicious Assault': 'Acimasiz Saldiri',
    'Shadow Rend': 'Golge Yirtisi',
    "Charon's Blades": 'Charon Bicaklari',
    'Heavy Daggers': 'Agir Hancerler',
    Devour: 'Yut',
    'Hex Blade': 'Lanet Bicagi',
    'Chaos Wave': 'Kaos Dalgasi',
    "Butcher's Boon": 'Kasabin Lutufu',
    'Shadow Scythe': 'Golge Tirpani',
    'Necrotic Surge': 'Nekrotik Dalga',
    'Ghost Blade': 'Hayalet Bicak',
    'Soul Reaver': 'Ruh Bicici',
    Carnifex: 'Cellat',
    'Rolling Vines': 'Yuvarlanan Sarmasiklar',
    'AoE Melee': 'Alan Yakin Dovus',
    'Shadow Step': 'Golge Adimi',
    'Daggers Of Affliction': 'Eziyet Hancerleri',
    'Corrosive Dagger': 'Asindirici Hancer',
    'Heart Seeker': 'Kalp Avcisi',
    'Dark Chi': 'Kara Chi',
    'False Chi': 'Sahte Chi',
    'Shadow Legion': 'Golge Lejyonu',
    'Midnight Shroud': 'Gece Yarisi Ortusu',
    'Withering Mist': 'Solduran Sis',
    'Black Miasma': 'Kara Miasma',
    'Black Storm': 'Kara Firtina',
    Arcanum: 'Arkanum',
    Swiftfoot: 'Cevik Ayak',
    'Mending Blow': 'Onarici Darbe',
    Mythbane: 'Mit Avcisi',
    Trogbane: 'Trog Avcisi',
    Demonbane: 'Iblis Avcisi',
    Forestbane: 'Orman Avcisi',
    Dragonbane: 'Ejderha Avcisi',
    Ghostbane: 'Hayalet Avcisi',
    Blizzard: 'Tipi',
    Incinerate: 'Yakip Kul Et',
    Lifebane: 'Yasam Dusmani',
    Deathdealer: 'Olum Dagitan',
    Typhoon: 'Tayfun',
    Earthshaker: 'Yer Sarsan',
    Renew: 'Yenile',
    'Heavy Blow': 'Agir Darbe',
    Hemorrhage: 'Kanama',
    'Attack Speed': 'Saldiri Hizi',
    Tenacity: 'Metanet',
    'Air Slayer': 'Hava Avcisi',
    'Earth Slayer': 'Toprak Avcisi',
    'Fire Slayer': 'Ates Avcisi',
    'Life Slayer': 'Yasam Avcisi',
    'Ice Slayer': 'Buz Avcisi',
    'Death Slayer': 'Olum Avcisi',
    'Critical Chance': 'Kritik Sans',
    'Critical Power': 'Kritik Guc',
    'Health Bonus': 'Can Bonusu',
    'Recovery Bonus': 'Toparlanma Bonusu',
    'Resist Air': 'Hava Direnci',
    'Resist Earth': 'Toprak Direnci',
    'Resist Fire': 'Ates Direnci',
    'Resist Life': 'Yasam Direnci',
    'Resist Ice': 'Buz Direnci',
    'Resist Death': 'Olum Direnci',
    Mythward: 'Mit Muhafazasi',
    Trogward: 'Trog Muhafazasi',
    Demonward: 'Iblis Muhafazasi',
    Forestward: 'Orman Muhafazasi',
    Dragonward: 'Ejderha Muhafazasi',
    Ghostward: 'Hayalet Muhafazasi',
    Dismount: 'Binekten In',
    'Summon Wolf Bear': 'Kurt Ayi Cagir',
    'Summon Pet': 'Evcil Cagir',
    'Dismiss Pet': 'Evcili Gonder',
    'Proc Life Rob': 'Can Calma Tetikle',
    'Summon Pet Jack-O': 'Jack-O Evcili Cagir',
    'Summon Pet Gargoyle': 'Gargoyle Evcili Cagir',
    'Summon Dragonette': 'Kucuk Ejder Cagir',
    'Summon Spirit': 'Ruh Cagir',
    'Summon Skull': 'Kafatasi Cagir',
    '***Monster***': '***Canavar***',
    '***MonsterProc***': '***CanavarTetik***'
}));

const POWER_WORDS = new Map(Object.entries({
    acid: 'asit',
    accelerant: 'hizlandirici',
    affliction: 'eziyet',
    air: 'hava',
    arctic: 'kutup',
    artery: 'atardamar',
    assault: 'saldiri',
    bane: 'kirici',
    banshee: 'banshee',
    basic: 'temel',
    bash: 'darbe',
    battalion: 'tabur',
    bind: 'baglama',
    binding: 'baglama',
    bite: 'isirik',
    bitter: 'aci',
    bladed: 'bicakli',
    blains: 'yaralar',
    blessed: 'kutsanmis',
    blessing: 'kutsama',
    bleed: 'kanama',
    bleeding: 'kanayan',
    blinding: 'kor eden',
    blinded: 'kor',
    blizzard: 'tipi',
    blow: 'darbe',
    blows: 'darbeler',
    bolster: 'guclendir',
    bomb: 'bomba',
    bone: 'kemik',
    boon: 'lutfu',
    boost: 'artis',
    breaker: 'kiran',
    breaking: 'kirilma',
    briefly: 'kisa sure',
    burn: 'yanma',
    burning: 'yanan',
    burst: 'patlama',
    butcher: 'kasap',
    call: 'cagir',
    carnifex: 'cellat',
    casket: 'tabut',
    cast: 'kullanim',
    casting: 'kullanmak',
    celestial: 'goksel',
    channel: 'kanal',
    charon: 'charon',
    chill: 'sogutma',
    chilled: 'sogutulmus',
    chilblains: 'soguk yaralari',
    chi: 'chi',
    cleanse: 'arindir',
    cleansing: 'arindirici',
    cleaving: 'yarici',
    cloak: 'pelerin',
    clone: 'klon',
    clutch: 'son anda',
    cold: 'soguk',
    comet: 'kuyruklu yildiz',
    combo: 'kombo',
    concentrated: 'yogun',
    concussion: 'sarsma',
    conflagration: 'buyuk yangin',
    conserve: 'koru',
    contact: 'temas',
    cooldown: 'bekleme',
    corrosive: 'asindirici',
    crippling: 'sakatlayan',
    cripple: 'sakatla',
    cripples: 'sakatlar',
    criticals: 'kritikler',
    curse: 'lanet',
    cursed: 'lanetli',
    cuts: 'kesikler',
    daggers: 'hancerler',
    damage: 'hasar',
    damages: 'hasar verir',
    damaging: 'hasar veren',
    daybreak: 'safak',
    deal: 'ver',
    dealer: 'dagitan',
    deals: 'verir',
    death: 'olum',
    debuff: 'zayiflatma',
    debuffs: 'zayiflatmalar',
    decoy: 'sahte hedef',
    decrease: 'azalt',
    decreases: 'azaltir',
    defense: 'savunma',
    defiance: 'meydan okuma',
    demoralizing: 'moral bozan',
    desecrate: 'kirlet',
    devour: 'yut',
    divine: 'ilahi',
    doom: 'kiyamet',
    dot: 'zamanla hasar',
    draconic: 'ejderha',
    drain: 'tuketim',
    dry: 'kuru',
    duration: 'sure',
    earth: 'toprak',
    eater: 'yiyen',
    edge: 'kenar',
    effectiveness: 'etki',
    effect: 'etki',
    elemental: 'element',
    embrace: 'sarmal',
    enemies: 'dusmanlar',
    enemy: 'dusman',
    enfeeble: 'gucsuzlestirme',
    entering: 'giris',
    ethereal: 'ruhani',
    extra: 'ek',
    fall: 'dus',
    false: 'sahte',
    fervor: 'cosku',
    firebrand: 'alev damgasi',
    fist: 'yumruk',
    flurry: 'firtina',
    foe: 'dusman',
    foes: 'dusmanlar',
    form: 'form',
    fortify: 'guclendir',
    freeze: 'dondurma',
    frigid: 'dondurucu',
    frostbite: 'don isirigi',
    gain: 'kazan',
    gains: 'kazanir',
    generation: 'uretimi',
    ghoul: 'ghoul',
    glacial: 'buzul',
    grants: 'verir',
    grasp: 'kavrayis',
    greater: 'buyuk',
    guard: 'muhafiz',
    guardian: 'muhafiz',
    hallowed: 'kutsal',
    hail: 'dolu',
    hailstone: 'dolu',
    hamstring: 'topallatma',
    harmony: 'uyum',
    hate: 'nefret',
    heal: 'iyilestir',
    healing: 'iyilestirme',
    heavy: 'agir',
    hemorrhage: 'kanama',
    heroism: 'kahramanlik',
    hex: 'lanet',
    hit: 'vurus',
    hits: 'vuruslar',
    horde: 'suru',
    hp: 'can',
    ice: 'buz',
    ignite: 'tutustur',
    ignited: 'tutusmus',
    ignites: 'tutusturur',
    igniting: 'tutusturur',
    immobilized: 'hareketsiz',
    impact: 'etki',
    incinerate: 'yakip kul et',
    increase: 'artir',
    increased: 'artan',
    increases: 'artirir',
    inferno: 'cehennem alevi',
    infestation: 'istila',
    insidious: 'sinsi',
    intensity: 'yogunluk',
    iridescent: 'yanardoner',
    jab: 'saplama',
    jabs: 'saplamalar',
    justice: 'adalet',
    lance: 'mizrak',
    last: 'son',
    lesser: 'kucuk',
    lich: 'lich',
    life: 'yasam',
    lifethirst: 'yasam susuzlugu',
    lingering: 'kalici',
    mana: 'mana',
    mark: 'isaret',
    mastery: 'ustalik',
    maximum: 'azami',
    mending: 'onarici',
    meteor: 'meteor',
    miasma: 'miasma',
    midnight: 'gece yarisi',
    minion: 'hizmetkar',
    minions: 'hizmetkarlar',
    mist: 'sis',
    molten: 'erimis',
    multi: 'coklu',
    mythbane: 'mit avcisi',
    napalm: 'napalm',
    nearby: 'yakindaki',
    necrotic: 'nekrotik',
    nerve: 'sinir',
    nova: 'nova',
    number: 'sayi',
    opponent: 'rakip',
    opportunist: 'firsatci',
    overtime: 'zamanla',
    pain: 'aci',
    party: 'grup',
    pause: 'duraklama',
    pauses: 'duraklatir',
    penalty: 'ceza',
    percent: 'yuzde',
    penance: 'kefaret',
    permafrost: 'kalici don',
    pierce: 'del',
    piercing: 'delici',
    plague: 'veba',
    pounce: 'sicrayis',
    proc: 'tetik',
    projectile: 'mermi',
    projectiles: 'mermiler',
    pyromania: 'piromani',
    quick: 'hizli',
    raised: 'yukseldi',
    rapid: 'hizli',
    reckoning: 'hesaplasma',
    reduce: 'azalt',
    reduces: 'azaltir',
    reducing: 'azaltir',
    refuge: 'siginak',
    regeneration: 'yenilenme',
    rend: 'yirtis',
    reaver: 'bicici',
    rob: 'calma',
    root: 'kok',
    sacred: 'kutsal',
    sanctify: 'kutsalla',
    scorpion: 'akrep',
    scorch: 'kavurma',
    scythe: 'tirpan',
    searing: 'yakici',
    second: 'saniye',
    seconds: 'saniye',
    sentinel: 'nobetci',
    shatter: 'parcala',
    shield: 'kalkan',
    shots: 'atislar',
    shroud: 'ortu',
    siphon: 'emme',
    slam: 'sert darbe',
    slapdash: 'derme catma',
    slowed: 'yavaslamis',
    soul: 'ruh',
    spear: 'mizrak',
    spectral: 'ruhani',
    spire: 'kule',
    stack: 'yuk',
    stacks: 'yukler',
    stagger: 'sars',
    staggered: 'sarsilmis',
    staggering: 'sarsan',
    steadiness: 'denge',
    steel: 'celik',
    sting: 'igne',
    strike: 'darbe',
    strikes: 'darbeler',
    stunned: 'sersemlemis',
    stun: 'sersemlet',
    subjugate: 'boyun egdir',
    surge: 'dalga',
    swiftfoot: 'cevik ayak',
    taunt: 'kiskirt',
    taunting: 'kiskirtan',
    tenacious: 'inatci',
    target: 'hedef',
    targets: 'hedefler',
    thirst: 'susuzluk',
    thrust: 'hamle',
    touch: 'dokunus',
    transferred: 'aktarilan',
    triple: 'uclu',
    tundra: 'tundra',
    twisted: 'carpik',
    unleash: 'serbest birak',
    unstable: 'dengesiz',
    venom: 'zehir',
    verdict: 'hukum',
    vicious: 'acimasiz',
    vigor: 'dinclik',
    volatile: 'ucucu',
    vulnerable: 'savunmasiz',
    wail: 'ciglik',
    walk: 'yuruyus',
    ward: 'muhafaza',
    weakened: 'zayiflatilmis',
    whirlwind: 'kasirga',
    wildfire: 'kontrolsuz ates',
    wind: 'ruzgar',
    within: 'icindeki',
    wounded: 'yarali',
    wyrm: 'ejder',
    zeal: 'cosku'
}));

function normalizeAscii(value) {
    return String(value ?? '').replace(/[çÇğĞıİöÖşŞüÜ’‘“”…]/g, (char) => ASCII_REPLACEMENTS.get(char) || char);
}

function hasEnglishLetters(value) {
    return /[A-Za-z]{2,}/.test(String(value ?? ''));
}

function stableId(value) {
    return crypto.createHash('sha1').update(String(value ?? '')).digest('hex').slice(0, 6).toUpperCase();
}

function titleCaseAscii(value) {
    return normalizeAscii(value)
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function splitCamelToken(token) {
    return String(token ?? '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ');
}

function translateWord(rawWord) {
    const word = String(rawWord ?? '');
    if (!word) {
        return word;
    }

    if (/^#\w+#$/.test(word)) {
        return word;
    }

    const exact = EXACT_PHRASES.get(word) || PROPER_PHRASES.get(word);
    if (exact) {
        return exact;
    }

    const split = splitCamelToken(word);
    if (split !== word && /\s/.test(split)) {
        const translated = split
            .split(/\s+/)
            .map((part) => translateWord(part))
            .filter(Boolean)
            .join(' ');
        if (translated) {
            return translated;
        }
    }

    const lower = word.toLowerCase().replace(/'s$/i, '');
    let mapped;
    if (POWER_WORDS.has(lower)) {
        mapped = POWER_WORDS.get(lower);
    } else if (WORDS.has(lower)) {
        mapped = WORDS.get(lower);
    } else {
        mapped = EXACT_PHRASES.get(lower) || PROPER_PHRASES.get(lower);
    }
    if (mapped !== undefined) {
        return mapped;
    }

    if (/^\d+$/.test(word)) {
        return word;
    }

    return splitCamelToken(word);
}

function applyPhraseGlossary(value) {
    let next = String(value ?? '');
    const phrases = [...PROPER_PHRASES.entries(), ...EXACT_PHRASES.entries()]
        .sort((a, b) => b[0].length - a[0].length);

    for (const [source, target] of phrases) {
        next = next.replace(new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), target);
    }

    return next;
}

function translateTokenized(value, options = {}) {
    const source = String(value ?? '');
    const phraseApplied = applyPhraseGlossary(source);
    const tokens = phraseApplied.match(/#\w+#|[A-Za-z][A-Za-z0-9']*|\d+|[^A-Za-z0-9#]+|#/g) || [];
    const out = [];

    for (const token of tokens) {
        if (/^[A-Za-z][A-Za-z0-9']*$/.test(token) || /^#\w+#$/.test(token)) {
            const translated = translateWord(token);
            if (translated) {
                out.push(translated);
            }
            continue;
        }
        out.push(token);
    }

    let translated = out.join('')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/([([{])\s+/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();

    if (!translated || !hasEnglishLetters(translated)) {
        translated = translated || fallbackText(source, options);
    }

    return normalizeAscii(translated);
}

function isPowerTextContext(options = {}) {
    const root = String(options.rootName || '');
    return /Power|Ability/.test(root);
}

function cleanPowerText(value) {
    return normalizeAscii(value)
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/([([{])\s+/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+$/g, '')
        .trim();
}

function localizePowerDisplayName(source) {
    const value = String(source ?? '').trim();
    const compactValue = value.replace(/\s+/g, ' ');
    if (!value || /^[-*]+$/.test(value)) {
        return normalizeAscii(value);
    }

    const exact = POWER_DISPLAY_PHRASES.get(value) || POWER_DISPLAY_PHRASES.get(compactValue);
    if (exact) {
        return normalizeAscii(exact);
    }

    const translated = translateTokenized(value, { rootName: 'PlayerPowerTypes', tagName: 'DisplayName' });
    return titleCaseAscii(cleanPowerText(translated || value));
}

function localizePowerLabel(source) {
    const value = String(source ?? '').trim();
    if (!value) {
        return value;
    }

    const exact = POWER_DISPLAY_PHRASES.get(value) || EXACT_PHRASES.get(value) || PROPER_PHRASES.get(value);
    if (exact) {
        return normalizeAscii(exact);
    }

    return titleCaseAscii(cleanPowerText(translateTokenized(value, { rootName: 'PowerModTypes', tagName: 'DisplayName' })));
}

function localizePowerStatSegment(source) {
    const value = String(source ?? '');
    return value.replace(/^(\s*)([^:,@]+)([:,])/, (_match, leading, label, punctuation) => {
        return `${leading}${localizePowerLabel(label)}${punctuation}`;
    });
}

function localizePowerSentence(source) {
    let value = String(source ?? '')
        .replace(/\byouself\b/gi, 'yourself')
        .replace(/\bstrenghtens\b/gi, 'strengthens')
        .trim();

    if (!value || /^[-]+$/.test(value)) {
        return normalizeAscii(value);
    }

    const exact = new Map(Object.entries({
        'Deliver a multi-hit melee combo that damages nearby foes': 'Yakindaki dusmanlara hasar veren cok vuruslu yakin dovus kombosu yapar',
        'Deliver two bonecrushing blows that total #dmg# damage to every foe within reach of your swing.': 'Savurma menzilindeki tum dusmanlara toplam #dmg# hasar veren iki kemik kiran darbe indirir.',
        'Launch a quick 3 hit assault on a single opponent': 'Tek bir rakibe hizli, uclu saldiri yapar',
        'Launch a quick 3 hit assault on a single opponent and Ignite them': 'Tek bir rakibe hizli, uclu saldiri yapar ve hedefi tutusturur',
        'Launch a quick 3 hit assault on a single opponent, Igniting them and reducing their Defense': 'Tek bir rakibe hizli, uclu saldiri yapar; hedefi tutusturur ve savunmasini azaltir',
        'Deliver two quick jabs and a vicious thrust of your sword that total #dmg# damage to your target.': 'Hedefe toplam #dmg# hasar veren iki hizli saplama ve acimasiz bir kilic hamlesi yapar.',
        'Cleave an arc of destruction that deals #dmg# damage to every foe in its wake.': 'Onundeki tum dusmanlara #dmg# hasar veren yikici bir yay cizer.',
        'Unleash a single, heavy melee attack that damages nearby foes': 'Yakindaki dusmanlara hasar veren tek ve agir bir yakin dovus saldirisi yapar',
        'Unleash a single, heavy melee attack that damages and Cripples nearby foes': 'Yakindaki dusmanlara hasar veren ve onlari sakatlayan tek ve agir bir yakin dovus saldirisi yapar',
        'Channel holy energy that restores the health of the most wounded player': 'En yarali oyuncunun canini yenileyen kutsal enerji kanalize eder',
        'Channel energy that restores your life or that of a more wounded ally': 'Senin veya daha yarali bir muttefigin canini yenileyen enerji kanalize eder',
        'Channel holy energy that restores the health and strengthens the Defense of the most wounded player': 'En yarali oyuncunun canini yeniler ve savunmasini guclendiren kutsal enerji kanalize eder',
        'Deal damage to foes in the impact area, Demoralizing and Taunting them': 'Etki alanindaki dusmanlara hasar verir, morallerini bozar ve onlari kiskirtir',
        'Deal damage to foes in the impact area, Staggering, Demoralizing and Taunting them': 'Etki alanindaki dusmanlara hasar verir; onlari sarsar, morallerini bozar ve kiskirtir',
        'Stun and damage your foe with a quick shield bash': 'Hizli bir kalkan darbesiyle dusmani sersemletir ve hasar verir',
        'Stun, Ignite and damage your foe with a quick shield bash': 'Hizli bir kalkan darbesiyle dusmani sersemletir, tutusturur ve hasar verir',
        'Channel holy energy to heal yourself and your allies overtime': 'Seni ve muttefiklerini zamanla iyilestiren kutsal enerji kanalize eder',
        'Channel holy energy to heal yourself and your allies overtime. Grants increased Defense for the duration': 'Seni ve muttefiklerini zamanla iyilestiren kutsal enerji kanalize eder. Sure boyunca savunma artisi verir',
        'Summon holy armor, damaging and Taunting nearby foes in the process': 'Kutsal zirh cagirir; bu sirada yakindaki dusmanlara hasar verir ve onlari kiskirtir',
        'End Sacrifice stance.': 'Fedakarlik durusu biter.'
    }));

    if (exact.has(value)) {
        return normalizeAscii(exact.get(value));
    }

    let match = value.match(/^Increases?\s+(.+)$/i);
    if (match) {
        return cleanPowerText(`${localizePowerLabel(match[1])} artar`);
    }

    match = value.match(/^Increased\s+(.+)$/i);
    if (match) {
        return cleanPowerText(`${localizePowerLabel(match[1])} artar`);
    }

    match = value.match(/^Adds?\s+(.+?)\s+to\s+last\s+hit\.?$/i);
    if (match) {
        return cleanPowerText(`Son vurusa ${localizePowerLabel(match[1])} etkisi ekler.`);
    }

    match = value.match(/^Adds?\s+a\s+stack\s+of\s+(.+?)\.?$/i);
    if (match) {
        return cleanPowerText(`Bir ${localizePowerLabel(match[1])} yuku ekler.`);
    }

    match = value.match(/^Adds?\s+(.+?)\.?$/i);
    if (match) {
        return cleanPowerText(`${localizePowerLabel(match[1])} etkisi ekler.`);
    }

    match = value.match(/^([+-]?\d+(?:\.\d+)?%?)\s+(.+?)\s+damage$/i);
    if (match) {
        return cleanPowerText(`${localizePowerDisplayName(match[2])} hasari ${match[1]}`);
    }

    match = value.match(/^([+-]?\d+(?:\.\d+)?%?)\s+(.+?)\s+healing$/i);
    if (match) {
        return cleanPowerText(`${localizePowerDisplayName(match[2])} iyilestirmesi ${match[1]}`);
    }

    match = value.match(/^([+-]?\d+(?:\.\d+)?%?)\s+(.+?)\s+duration$/i);
    if (match) {
        return cleanPowerText(`${localizePowerDisplayName(match[2])} suresi ${match[1]}`);
    }

    match = value.match(/^([+-]?\d+(?:\.\d+)?)\s+second\s+(.+?)\s+duration$/i);
    if (match) {
        return cleanPowerText(`${localizePowerDisplayName(match[2])} suresi ${match[1]} saniye`);
    }

    match = value.match(/^([+-]?\d+(?:\.\d+)?%)\s+(.+?)\s+(.+)$/i);
    if (match && /damage|defense|duration|healing|regen|leech|siphon|attack|reduction|dot/i.test(match[3])) {
        return cleanPowerText(`${localizePowerDisplayName(match[2])} ${localizePowerLabel(match[3])} ${match[1]}`);
    }

    match = value.match(/^([+-]?\d+(?:\.\d+)?%)\s+([A-Za-z][A-Za-z\s']+)$/i);
    if (match) {
        return cleanPowerText(`${localizePowerLabel(match[2])} ${match[1]}`);
    }

    match = value.match(/^Tendril speed reduction is\s+(.+?)$/i);
    if (match) {
        return cleanPowerText(`Sarmasik kolu hiz azaltmasi ${match[1]} olur`);
    }

    match = value.match(/^(-?\d+)\s+Mana Cost\.?$/i);
    if (match) {
        return cleanPowerText(`Mana bedeli ${match[1]} degisir.`);
    }

    match = value.match(/^([+-]?\d+)\s+Second Stun duration(?:,?\s+(.+))?$/i);
    if (match) {
        const extra = match[2] ? ` ${localizePowerSentence(match[2])}` : '';
        return cleanPowerText(`Sersemletme suresi ${match[1]} saniye degisir.${extra}`);
    }

    match = value.match(/^Defense Buff (?:increased|raised) to\s+(.+?)\.?$/i);
    if (match) {
        return cleanPowerText(`Savunma guclendirmesi ${match[1]} olur.`);
    }

    match = value.match(/^Target gains\s+(.+?)\s+Defense Buff for a second\.?$/i);
    if (match) {
        return cleanPowerText(`Hedef 1 saniye ${match[1]} savunma guclendirmesi kazanir.`);
    }

    match = value.match(/^Grants party a\s+(.+?)\s+Defense Boost for\s+(.+?)\s+seconds?\.?$/i);
    if (match) {
        return cleanPowerText(`Gruba ${match[2]} saniye ${match[1]} savunma artisi verir.`);
    }

    match = value.match(/^Debuff increased to\s+(.+?)\.?$/i);
    if (match) {
        return cleanPowerText(`Zayiflatma ${localizePowerLabel(match[1])} olur.`);
    }

    return cleanPowerText(translateTokenized(value, { rootName: 'PlayerPowerTypes', tagName: 'Description' }));
}

function localizePowerDescription(source) {
    const value = String(source ?? '');
    if (!value.trim() || /^[-]+$/.test(value.trim())) {
        return normalizeAscii(value);
    }

    const parts = value.split('@');
    const localized = parts.map((part, index) => {
        return index === 0 ? localizePowerSentence(part) : localizePowerStatSegment(part);
    });

    return cleanPowerText(localized.join('@'));
}

function fallbackText(source, options = {}) {
    const tag = String(options.tagName || '');
    const root = String(options.rootName || '');
    const id = stableId(source);

    if (/Name$/.test(tag) || tag === 'DyeName' || tag === 'DisplayName') {
        if (/LevelTypes/i.test(root)) {
            return `Yerel Bolge ${id}`;
        }
        if (/MissionTypes/i.test(root)) {
            return `Yerel Gorev ${id}`;
        }
        if (/Power|Ability|Node/i.test(root)) {
            return `Yerel Yetenek ${id}`;
        }
        if (/Pet|Mount/i.test(root)) {
            return `Yerel Yoldas ${id}`;
        }
        if (/Gear|Charm|Magic|Material|Consumable|Lockbox|RoyalStore|Egg|Dye/i.test(root)) {
            return `Yerel Esya ${id}`;
        }
        return `Yerel Ad ${id}`;
    }

    if (/LockedMessage/i.test(tag)) {
        return `Bu gecis henuz acilmadi. Kod ${id}.`;
    }

    return `Turkce aciklama ${id}.`;
}

function localizeText(source, options = {}) {
    const value = String(source ?? '');
    if (!value.trim() || !hasEnglishLetters(value)) {
        return normalizeAscii(value);
    }
    const compactValue = value.trim().replace(/\s+/g, ' ');

    if (isPowerTextContext(options)) {
        if (options.tagName === 'DisplayName') {
            return localizePowerDisplayName(value);
        }
        if (options.tagName === 'Description' || options.tagName === 'UpgradeDescription') {
            return localizePowerDescription(value);
        }
    }

    const templateMatches = [
        [/^Must be level\s+(.+?)\s+to upgrade$/i, (_match, level) => `Yukseltmek icin seviye ${level} gerekli`],
        [/^Busy upgrading\s+(.+)$/i, (_match, thing) => `${localizeText(thing, options)} yukseltmesi suruyor`],
        [/^Summon\s+(.+)$/i, (_match, thing) => `${localizeText(thing, options)} cagir`]
    ];

    for (const [pattern, build] of templateMatches) {
        const match = value.match(pattern);
        if (match) {
            return normalizeAscii(build(...match));
        }
    }

    if (EXACT_PHRASES.has(value) || PROPER_PHRASES.has(value) || EXACT_PHRASES.has(compactValue) || PROPER_PHRASES.has(compactValue)) {
        return normalizeAscii(EXACT_PHRASES.get(value) || PROPER_PHRASES.get(value) || EXACT_PHRASES.get(compactValue) || PROPER_PHRASES.get(compactValue));
    }

    const translated = translateTokenized(value, options);
    if (!translated || normalizeAscii(translated).trim() === normalizeAscii(value).trim()) {
        return normalizeAscii(fallbackText(value, options));
    }

    return normalizeAscii(translated);
}

module.exports = {
    EXACT_PHRASES,
    PROPER_PHRASES,
    WORDS,
    fallbackText,
    hasEnglishLetters,
    localizeText,
    normalizeAscii,
    stableId,
    titleCaseAscii
};
