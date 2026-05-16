#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { localizeText, normalizeAscii } = require('./turkish-localization-utils');

const DEFAULT_SWZ = path.join('src', 'client', 'content', 'localhost', 'p', 'cbq', 'Game.swz');
const DEFAULT_EN_SWZ = path.join('src', 'client', 'content', 'localhost', 'p', 'cbq', 'Game.en.swz');
const DEFAULT_TR_SWZ = path.join('src', 'client', 'content', 'localhost', 'p', 'cbq', 'Game.tr.swz');
const XML_ROOT = path.join('src', 'client', 'content', 'xml');

const TRANSLATABLE_TAGS = new Set([
    'ActiveText',
    'BonusInfo',
    'Description',
    'DisplayName',
    'FlavorText',
    'LockedMessage',
    'OfferText',
    'PraiseText',
    'PreReqText',
    'ProgressText',
    'ReturnText',
    'TrackerReturn',
    'TrackerText',
    'UpgradeDescription'
]);

const TRANSLATABLE_TAGS_BY_ROOT = new Map([
    ['MissionTypes', new Set([
        'ActiveText',
        'Description',
        'DisplayName',
        'OfferText',
        'PraiseText',
        'PreReqText',
        'ProgressText',
        'ReturnText',
        'TrackerReturn',
        'TrackerText'
    ])],
    ['PlayerPowerTypes', new Set(['Description', 'DisplayName', 'UpgradeDescription'])],
    ['MonsterPowerTypes', new Set(['DisplayName'])],
    ['PowerModTypes', new Set(['Description', 'DisplayName'])],
    ['AbilityTypes', new Set([])],
    ['LevelTypes', new Set(['DisplayName'])],
    ['DoorTypes', new Set(['LockedMessage'])],
    ['MissionGroups', new Set(['DisplayName'])],
    ['BuildingTypes', new Set(['DisplayName', 'UpgradeDescription'])],
    ['ConsumableTypes', new Set(['Description', 'DisplayName'])],
    ['CharmTypes', new Set(['Description', 'DisplayName'])],
    ['DyeTypes', new Set(['DisplayName'])],
    ['EggTypes', new Set(['Description', 'DisplayName'])],
    ['GearTypes', new Set(['Description', 'DisplayName'])],
    ['LockboxTypes', new Set(['Description', 'DisplayName'])],
    ['MagicTypes', new Set(['Description', 'DisplayName'])],
    ['MaterialTypes', new Set(['DisplayName'])],
    ['MountTypes', new Set(['Description', 'DisplayName'])],
    ['PetTypes', new Set(['BonusInfo', 'Description', 'DisplayName'])],
    ['RoyalStoreTypes', new Set(['Description', 'DisplayName'])],
    ['StatueTypes', new Set(['DisplayName', 'FlavorText'])]
]);

const MISSION_DIALOGUE_TAGS = new Set(['OfferText', 'ActiveText', 'ReturnText', 'PraiseText']);
const TRANSLATABLE_TAG_PATTERN = [...TRANSLATABLE_TAGS].join('|');
const TRANSLATABLE_TAG_REGEX = new RegExp(`<(${TRANSLATABLE_TAG_PATTERN})>([\\s\\S]*?)<\\/\\1>`, 'g');

function repoRoot() {
    return path.resolve(__dirname, '..', '..', '..');
}

function resolvePath(root, value) {
    if (value) {
        return path.isAbsolute(value) ? value : path.join(root, value);
    }

    const trSwzPath = path.join(root, DEFAULT_TR_SWZ);
    return fs.existsSync(trSwzPath) ? trSwzPath : path.join(root, DEFAULT_SWZ);
}

function resolveSourceSwzPath(root, value) {
    if (value) {
        return resolvePath(root, value);
    }

    const enSwzPath = path.join(root, DEFAULT_EN_SWZ);
    return fs.existsSync(enSwzPath) ? enSwzPath : path.join(root, DEFAULT_SWZ);
}

function resolveTargetSwzPath(root, value) {
    if (value) {
        return resolvePath(root, value);
    }

    return path.join(root, DEFAULT_TR_SWZ);
}

function rotateKey(key, shift) {
    return (((key << (32 - shift)) >>> 0) | (key >>> shift)) >>> 0;
}

function decodeSwz(buffer) {
    let offset = 0;
    const initialKey = buffer.readUInt32BE(offset);
    let key = initialKey >>> 0;
    offset += 4;
    const count = buffer.readUInt32BE(offset);
    offset += 4;

    const entries = [];
    for (let entryIndex = 0; entryIndex < count; entryIndex++) {
        const encodedLength = buffer.readUInt32BE(offset);
        offset += 4;
        const encoded = Buffer.alloc(encodedLength);

        for (let byteIndex = 0; byteIndex < encodedLength; byteIndex++) {
            const shift = byteIndex & 7;
            encoded[byteIndex] = buffer[offset++] ^ (key & 0xff);
            key = rotateKey(key, shift);
        }

        const xml = zlib.inflateSync(encoded).toString('utf8');
        entries.push({
            rootName: xml.match(/<([A-Za-z0-9_:-]+)/)?.[1] || '',
            xml
        });
    }

    return { initialKey, entries };
}

function encodeSwz(initialKey, entries) {
    const chunks = [];
    const header = Buffer.alloc(8);
    header.writeUInt32BE(initialKey >>> 0, 0);
    header.writeUInt32BE(entries.length >>> 0, 4);
    chunks.push(header);

    let key = initialKey >>> 0;
    for (const entry of entries) {
        const compressed = zlib.deflateSync(Buffer.from(entry.xml, 'utf8'));
        const length = Buffer.alloc(4);
        length.writeUInt32BE(compressed.length >>> 0, 0);
        chunks.push(length);

        const encoded = Buffer.alloc(compressed.length);
        for (let byteIndex = 0; byteIndex < compressed.length; byteIndex++) {
            const shift = byteIndex & 7;
            encoded[byteIndex] = compressed[byteIndex] ^ (key & 0xff);
            key = rotateKey(key, shift);
        }
        chunks.push(encoded);
    }

    return Buffer.concat(chunks);
}

function decodeEntities(value) {
    return String(value ?? '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

function escapeXmlText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function normalizeKey(value) {
    return decodeEntities(value).trim().replace(/\s+/g, ' ');
}

function isLikelyAlreadyLocalized(value) {
    return /^(Yerel|Turkce|Acemi|Yesim|Kopru|Mezarlik|Eski|Zumrut|Shazari|Siyah|Kurtlarin|Firtina|Fel|Val|Kilit|Dehset|Hocke|Gorev|Zindan|Binek|Evcil|Esya|Yetenek|Saldiri|Savunma|Guc|Can|Mana|Altin|Kral|Baron|General)\b/i.test(normalizeKey(value));
}

function normalizeUnsupportedTurkishGlyphs(value) {
    return normalizeAscii(value);
}

function loadTranslations(root) {
    const dialoguePath = path.join(root, 'src', 'server', 'data', 'DialogueTranslations.tr.json');
    const missionPath = path.join(root, 'src', 'server', 'data', 'MissionDialogues.tr.json');
    const dialogueRaw = JSON.parse(fs.readFileSync(dialoguePath, 'utf8')).translations || {};
    const missionRaw = JSON.parse(fs.readFileSync(missionPath, 'utf8')).missions || {};
    const translations = new Map();

    for (const [source, target] of Object.entries(dialogueRaw)) {
        const key = normalizeKey(source);
        const value = String(target ?? '').trim();
        if (key && value) {
            translations.set(key, value);
        }
    }

    return { translations, missions: missionRaw };
}

function shouldTranslateTag(rootName, tagName) {
    const scoped = TRANSLATABLE_TAGS_BY_ROOT.get(rootName);
    if (scoped) {
        return scoped.has(tagName);
    }

    return TRANSLATABLE_TAGS.has(tagName);
}

function translateValue(value, translations, context = {}) {
    const decoded = decodeEntities(value);
    if (context.allowAlreadyLocalizedSkip && isLikelyAlreadyLocalized(decoded)) {
        return decoded;
    }

    const exact = translations.get(normalizeKey(decoded));
    if (exact && normalizeKey(exact) !== normalizeKey(decoded)) {
        return exact;
    }

    if (!/[=]/.test(decoded)) {
        return localizeText(decoded, context);
    }

    let changed = false;
    const translated = decoded
        .split(/(=@|=)/)
        .map((part) => {
            if (part === '=' || part === '=@') {
                return part;
            }

            const replacement = translations.get(normalizeKey(part));
            if (!replacement) {
                return part;
            }

            changed = true;
            return replacement;
        })
        .join('');

    if (changed) {
        return translated;
    }

    return localizeText(decoded, context);
}

function patchMissionTypes(xml, translations, missions, stats) {
    return xml.replace(/<MissionType>[\s\S]*?<\/MissionType>/g, (entry) => {
        const missionId = entry.match(/<MissionID>(\d+)<\/MissionID>/)?.[1] || '';
        const missionDialogue = missions[missionId] || {};

        return entry.replace(TRANSLATABLE_TAG_REGEX, (match, tagName, value) => {
            if (!shouldTranslateTag('MissionTypes', tagName)) {
                return match;
            }

            const translated = MISSION_DIALOGUE_TAGS.has(tagName) && missionDialogue[tagName]
                ? missionDialogue[tagName]
                : translateValue(value, translations, { rootName: 'MissionTypes', tagName, missionId });
            const nextValue = normalizeUnsupportedTurkishGlyphs(translated || decodeEntities(value));
            if (normalizeKey(nextValue) === normalizeKey(value)) {
                return match;
            }

            stats.updated += 1;
            stats.byTag[tagName] = (stats.byTag[tagName] || 0) + 1;
            return `<${tagName}>${escapeXmlText(nextValue)}</${tagName}>`;
        });
    });
}

function patchGenericXml(xml, rootName, translations, stats, options = {}) {
    return xml.replace(TRANSLATABLE_TAG_REGEX, (match, tagName, value) => {
        if (!shouldTranslateTag(rootName, tagName)) {
            return match;
        }

        const translated = translateValue(value, translations, { rootName, tagName, ...options });
        const nextValue = normalizeUnsupportedTurkishGlyphs(translated || decodeEntities(value));
        if (normalizeKey(nextValue) === normalizeKey(value)) {
            return match;
        }

        stats.updated += 1;
        stats.byTag[tagName] = (stats.byTag[tagName] || 0) + 1;
        return `<${tagName}>${escapeXmlText(nextValue)}</${tagName}>`;
    });
}

function patchXmlResource(xml, rootName, translations, missions, stats) {
    if (rootName === 'MissionTypes') {
        return patchMissionTypes(xml, translations, missions, stats);
    }

    return patchGenericXml(xml, rootName, translations, stats);
}

function patchSwz(sourceSwzPath, targetSwzPath, translations, missions, verifyOnly) {
    const decoded = decodeSwz(fs.readFileSync(sourceSwzPath));
    const stats = { updated: 0, byTag: {} };
    const entries = decoded.entries.map((entry) => ({
        ...entry,
        xml: patchXmlResource(entry.xml, entry.rootName, translations, missions, stats)
    }));

    if (!verifyOnly) {
        fs.writeFileSync(targetSwzPath, encodeSwz(decoded.initialKey, entries));
    }

    return { stats, entries };
}

function patchStaticXml(xmlRoot, entries, translations, missions, verifyOnly, includeLooseXml) {
    const stats = { updated: 0, byTag: {} };
    if (!fs.existsSync(xmlRoot)) {
        return stats;
    }

    const entryByRoot = new Map(entries.map((entry) => [entry.rootName, entry.xml]));
    const syncedRoots = new Set();
    for (const [rootName, xml] of entryByRoot) {
        const filePath = path.join(xmlRoot, `${rootName}.xml`);
        if (!fs.existsSync(filePath)) {
            continue;
        }

        syncedRoots.add(rootName);
        const current = fs.readFileSync(filePath, 'utf8');
        if (current !== xml) {
            stats.updated += 1;
            stats.byTag[rootName] = (stats.byTag[rootName] || 0) + 1;
            if (!verifyOnly) {
                fs.writeFileSync(filePath, xml);
            }
        }
    }

    if (!includeLooseXml) {
        return stats;
    }

    for (const file of fs.readdirSync(xmlRoot)) {
        if (!file.endsWith('.xml')) {
            continue;
        }

        const rootName = path.basename(file, '.xml');
        if (syncedRoots.has(rootName)) {
            continue;
        }

        const filePath = path.join(xmlRoot, file);
        const current = fs.readFileSync(filePath, 'utf8');
        const before = stats.updated;
        const patched = patchGenericXml(current, rootName, translations, stats, { allowAlreadyLocalizedSkip: true });
        if (!verifyOnly && stats.updated !== before) {
            fs.writeFileSync(filePath, patched);
        }
    }

    return stats;
}

function parseArgs(argv) {
    const args = {
        sourceSwz: '',
        swz: '',
        xmlRoot: XML_ROOT,
        looseXml: false,
        verify: false
    };

    for (let index = 2; index < argv.length; index++) {
        const arg = argv[index];
        if (arg === '--swz') {
            args.swz = argv[++index] || '';
            continue;
        }
        if (arg === '--source-swz') {
            args.sourceSwz = argv[++index] || '';
            continue;
        }
        if (arg === '--xml-root') {
            args.xmlRoot = argv[++index] || '';
            continue;
        }
        if (arg === '--loose-xml') {
            args.looseXml = true;
            continue;
        }
        if (arg === '--verify') {
            args.verify = true;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    return args;
}

function main() {
    const args = parseArgs(process.argv);
    const root = repoRoot();
    const { translations, missions } = loadTranslations(root);
    const sourceSwzPath = resolveSourceSwzPath(root, args.sourceSwz);
    const targetSwzPath = resolveTargetSwzPath(root, args.swz);
    const xmlRoot = resolvePath(root, args.xmlRoot);

    const { stats: swzStats, entries } = patchSwz(sourceSwzPath, targetSwzPath, translations, missions, args.verify);
    const xmlStats = patchStaticXml(xmlRoot, entries, translations, missions, args.verify, args.looseXml);
    console.log(JSON.stringify({
        sourceSwz: path.relative(root, sourceSwzPath),
        targetSwz: path.relative(root, targetSwzPath),
        swz: swzStats,
        xml: xmlStats
    }, null, 2));
}

main();
