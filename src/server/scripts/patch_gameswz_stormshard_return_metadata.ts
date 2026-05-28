import * as fs from "fs";
import * as path from "path";
import { ensureBackup, parseSwz, SwzContext, writeSwz } from "./swzPatchUtils";

type Locale = "en" | "tr";

type MissionPatch = {
  name: string;
  fields: Record<Locale, Record<string, string>>;
};

const MISSION_TYPES_ROOT = "MissionTypes";

const PATCHES: MissionPatch[] = [
  {
    name: "GardenOfTheLost",
    fields: {
      en: {
        ContactName: "OMM_Moai01",
        ReturnName: "OMM_Moai01",
        TrackerReturn: "Return to the Moai to claim your reward",
        ReturnText: "Meylour rose in fury from the depths five decades past.",
        PraiseText: "Meylour rose in fury from the depths five decades past.",
      },
      tr: {
        ContactName: "OMM_Moai01",
        ReturnName: "OMM_Moai01",
        TrackerReturn: "Odulunu almak icin Moai'ye don",
        ReturnText: "Meylour, elli yil onceki derinliklerden ofkeyle yukseldi.",
        PraiseText: "Meylour, elli yil onceki derinliklerden ofkeyle yukseldi.",
      },
    },
  },
  {
    name: "ForgottenForge",
    fields: {
      en: {
        ContactName: "OMM_Statue01",
        ReturnName: "OMM_Statue01",
        TrackerReturn: "Return to Uthor's statue to claim your reward",
        OfferText: "Uthor's Exquisite Creations",
        ActiveText: "The forge remains hidden in the Stormshard Peaks.",
        ReturnText: "Uthor's Exquisite Creations=The forge is found.",
        PraiseText: "Uthor's Exquisite Creations=The forge is found.",
      },
      tr: {
        ContactName: "OMM_Statue01",
        ReturnName: "OMM_Statue01",
        TrackerReturn: "Odulunu almak icin Uthor'un heykeline don",
        OfferText: "Uthor'un Enfes Kreasyonlari",
        ActiveText: "Demirhane Firtina Tasi Zirveleri'nde gizli kalmaya devam ediyor.",
        ReturnText: "Uthor'un Enfes Kreasyonlari=Demirhane bulundu.",
        PraiseText: "Uthor'un Enfes Kreasyonlari=Demirhane bulundu.",
      },
    },
  },
  {
    name: "GardenOfTheLostHard",
    fields: {
      en: {
        ContactName: "OMM_Moai01Hard",
        ReturnName: "OMM_Moai01Hard",
        TrackerReturn: "Return to the Moai to claim your reward",
        ReturnText: "Meylour rose in fury from the depths five decades past.",
        PraiseText: "Meylour rose in fury from the depths five decades past.",
      },
      tr: {
        ContactName: "OMM_Moai01Hard",
        ReturnName: "OMM_Moai01Hard",
        TrackerReturn: "Odulunu almak icin Moai'ye don",
        ReturnText: "Meylour, elli yil onceki derinliklerden ofkeyle yukseldi.",
        PraiseText: "Meylour, elli yil onceki derinliklerden ofkeyle yukseldi.",
      },
    },
  },
  {
    name: "ForgottenForgeHard",
    fields: {
      en: {
        ContactName: "OMM_Statue01Hard",
        ReturnName: "OMM_Statue01Hard",
        TrackerReturn: "Return to Uthor's statue to claim your reward",
        OfferText: "Uthor's Exquisite Creations",
        ActiveText: "The forge remains hidden in the Stormshard Peaks.",
        ReturnText: "Uthor's Exquisite Creations=The forge is found.",
        PraiseText: "Uthor's Exquisite Creations=The forge is found.",
      },
      tr: {
        ContactName: "OMM_Statue01Hard",
        ReturnName: "OMM_Statue01Hard",
        TrackerReturn: "Odulunu almak icin Uthor'un heykeline don",
        OfferText: "Uthor'un Enfes Kreasyonlari",
        ActiveText: "Demirhane Firtina Tasi Zirveleri'nde gizli kalmaya devam ediyor.",
        ReturnText: "Uthor'un Enfes Kreasyonlari=Demirhane bulundu.",
        PraiseText: "Uthor'un Enfes Kreasyonlari=Demirhane bulundu.",
      },
    },
  },
];

const INSERT_AFTER: Record<string, string> = {
  ContactName: "Priority",
  ReturnName: "ContactName",
  TrackerReturn: "TrackerText",
  OfferText: "Description",
  ActiveText: "OfferText",
  ReturnText: "ActiveText",
  PraiseText: "ReturnText",
};

function defaultGameSwzPaths(): string[] {
  const cbqDir = path.resolve(__dirname, "..", "..", "client", "content", "localhost", "p", "cbq");
  return ["Game.swz", "Game.en.swz", "Game.tr.swz"]
    .map((name) => path.join(cbqDir, name))
    .filter((swzPath) => fs.existsSync(swzPath));
}

function parseArgs(argv: string[]): { swzPaths: string[]; verify: boolean } {
  const swzPaths: string[] = [];
  let verify = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--swz-path") {
      const value = argv[++index];
      if (!value) {
        throw new Error("--swz-path requires a value");
      }
      swzPaths.push(path.resolve(process.cwd(), value));
      continue;
    }
    if (arg === "--verify") {
      verify = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    swzPaths: swzPaths.length ? swzPaths : defaultGameSwzPaths(),
    verify,
  };
}

function getMissionEntry(xml: string, missionName: string): { entry: string; start: number; end: number } {
  const entries = xml.match(/<MissionType>[\s\S]*?<\/MissionType>/g) ?? [];
  let offset = 0;
  for (const entry of entries) {
    const start = xml.indexOf(entry, offset);
    offset = start + entry.length;
    if (entry.includes(`<MissionName>${missionName}</MissionName>`)) {
      return {
        entry,
        start,
        end: start + entry.length,
      };
    }
  }
  throw new Error(`Could not find ${missionName} in MissionTypes`);
}

function detectLocale(entry: string): Locale {
  if (
    entry.includes("<DisplayName>Forgotten Forge</DisplayName>") ||
    entry.includes("<DisplayName>Rock Hulk Garden</DisplayName>")
  ) {
    return "en";
  }
  return "tr";
}

function ensureTag(entry: string, tagName: string, value: string): { entry: string; changed: boolean } {
  const nextTag = `\n\t\t<${tagName}>${value}</${tagName}>`;
  const tagPattern = new RegExp(`\\s*<${tagName}>[\\s\\S]*?<\\/${tagName}>`);
  if (tagPattern.test(entry)) {
    const nextEntry = entry.replace(tagPattern, nextTag);
    return {
      entry: nextEntry,
      changed: nextEntry !== entry,
    };
  }

  const insertAfterTag = INSERT_AFTER[tagName];
  if (!insertAfterTag) {
    throw new Error(`No insert position for ${tagName}`);
  }

  const insertPattern = new RegExp(`(<${insertAfterTag}>[\\s\\S]*?<\\/${insertAfterTag}>)`);
  if (!insertPattern.test(entry)) {
    throw new Error(`Could not insert ${tagName}; ${insertAfterTag} not found`);
  }

  return {
    entry: entry.replace(insertPattern, `$1${nextTag}`),
    changed: true,
  };
}

function patchMissionTypes(xml: string): { xml: string; changed: boolean } {
  let nextXml = xml;
  let changed = false;

  for (const patch of PATCHES) {
    const found = getMissionEntry(nextXml, patch.name);
    const locale = detectLocale(found.entry);
    let nextEntry = found.entry;

    for (const [tagName, value] of Object.entries(patch.fields[locale])) {
      const result = ensureTag(nextEntry, tagName, value);
      nextEntry = result.entry;
      changed = changed || result.changed;
    }

    nextXml = `${nextXml.slice(0, found.start)}${nextEntry}${nextXml.slice(found.end)}`;
  }

  return {
    xml: nextXml,
    changed,
  };
}

function patchSwz(swzPath: string, verify: boolean): boolean {
  const ctx: SwzContext = parseSwz(swzPath);
  const missionTypes = ctx.chunks.find((chunk) => chunk.xml.match(/<MissionTypes[>\s]/));
  if (!missionTypes) {
    throw new Error(`${path.basename(swzPath)} is missing ${MISSION_TYPES_ROOT}`);
  }

  const patched = patchMissionTypes(missionTypes.xml);
  if (verify) {
    console.log(`${path.basename(swzPath)}: ${patched.changed ? "would patch" : "ok"}`);
    return false;
  }

  if (!patched.changed) {
    console.log(`${path.basename(swzPath)}: already patched`);
    return false;
  }

  missionTypes.xml = patched.xml;
  ensureBackup(swzPath);
  writeSwz(ctx);
  console.log(`${path.basename(swzPath)}: patched Stormshard return metadata`);
  return true;
}

function main(): void {
  const args = parseArgs(process.argv);
  if (!args.swzPaths.length) {
    throw new Error("No Game SWZ files found");
  }

  let changed = 0;
  for (const swzPath of args.swzPaths) {
    changed += patchSwz(swzPath, args.verify) ? 1 : 0;
  }

  if (!args.verify) {
    console.log(`Updated ${changed} SWZ file(s)`);
  }
}

main();
