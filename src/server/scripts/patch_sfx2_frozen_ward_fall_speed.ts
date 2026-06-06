import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";

const repoRoot = path.resolve(__dirname, "../../..");
const targetSwf = path.join(repoRoot, "src", "client", "content", "localhost", "p", "cbp", "SFX_2.swf");
const sourceSwf = path.join(repoRoot, "build", "ffdec-sfx2-frozenward-speed", "SFX_2.source.swf");
const workRoot = path.join(repoRoot, "build", "ffdec-sfx2-frozenward-speed");
const extractedXml = path.join(workRoot, "SFX_2.source.xml");
const patchedXml = path.join(workRoot, "SFX_2.frozenward-time-compressed.xml");
const patchedSwf = path.join(workRoot, "SFX_2.frozenward-time-compressed.swf");
const ffdecHome = path.join(repoRoot, "build", "ffdec-home");
const ffdecJar = path.join(repoRoot, "build", "tools", "ffdec_25.0.0", "ffdec-cli.jar");

const targetFrameCount = 56;
const expectedSourceFrameCount = 80;
const landingEffectStartFrame = 58;
const landingEffectEndFrame = 70;
const landingAlphaScale = 0.75;
const landingMatrixScale = 0.92;
const fallTimeExponent = 0.72;
const showFrameTag = '<item type="ShowFrameTag" forceWriteAsLong="false"/>';

interface SpriteParts {
  before: string;
  frames: string[];
  after: string;
  frameCount: number;
}

function runFfdec(args: string[]): void {
  fs.mkdirSync(ffdecHome, { recursive: true });
  fs.mkdirSync(path.join(ffdecHome, "Library", "Application Support", "FFDec", "logs"), { recursive: true });
  execFileSync(
    "java",
    [`-Duser.home=${ffdecHome}`, "-jar", ffdecJar, ...args],
    { cwd: repoRoot, stdio: "inherit" },
  );
}

function ensureOriginalSourceSwf(): void {
  fs.mkdirSync(path.dirname(sourceSwf), { recursive: true });
  const original = execFileSync("git", ["show", "HEAD:src/client/content/localhost/p/cbp/SFX_2.swf"], {
    cwd: repoRoot,
    maxBuffer: 16 * 1024 * 1024,
  });
  fs.writeFileSync(sourceSwf, original);
}

function ensureBackup(filePath: string): string {
  const backup = `${filePath}.bak`;
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(filePath, backup);
  }
  return backup;
}

function splitSpriteFrames(xml: string): SpriteParts {
  const spriteTagMatch = /<item type="DefineSpriteTag"(?=[^>]*spriteId="2673")[^>]*>/.exec(xml);
  if (!spriteTagMatch) {
    throw new Error("a_FrostWard DefineSprite tag was not found.");
  }

  const spriteStart = spriteTagMatch.index;
  const spriteTag = spriteTagMatch[0];
  const frameCountMatch = spriteTag.match(/frameCount="(\d+)"/);
  if (!frameCountMatch) {
    throw new Error("a_FrostWard frameCount attribute was not found.");
  }

  const subTagsStart = xml.indexOf("<subTags>", spriteStart);
  const subTagsEnd = xml.indexOf("</subTags>", subTagsStart);
  if (subTagsStart < 0 || subTagsEnd < 0) {
    throw new Error("a_FrostWard subTags block was not found.");
  }

  const before = xml.slice(0, subTagsStart + "<subTags>".length);
  const subTags = xml.slice(subTagsStart + "<subTags>".length, subTagsEnd);
  const after = xml.slice(subTagsEnd);
  const framePattern = new RegExp(`[\\s\\S]*?${showFrameTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
  const frames = subTags.match(framePattern);
  const frameCount = Number(frameCountMatch[1]);

  if (!frames || frames.length !== frameCount) {
    throw new Error(`Expected ${frameCount} a_FrostWard frames, found ${frames?.length ?? 0}.`);
  }

  return { before, frames, after, frameCount };
}

function stripShowFrame(frameXml: string): string {
  const index = frameXml.lastIndexOf(showFrameTag);
  if (index < 0) {
    throw new Error("Frame is missing ShowFrameTag.");
  }

  return `${frameXml.slice(0, index)}${frameXml.slice(index + showFrameTag.length)}`;
}

function landingAlphaTransform(): string {
  return [
    '          <colorTransform type="CXFORMWITHALPHA" alphaAddTerm="0" alphaMultTerm="192" ',
    'blueAddTerm="0" blueMultTerm="256" greenAddTerm="0" greenMultTerm="256" ',
    'hasAddTerms="false" hasMultTerms="true" nbits="10" redAddTerm="0" redMultTerm="256"/>',
  ].join("");
}

function reduceLandingEffect(frameXml: string, sourceFrame: number): string {
  if (sourceFrame < landingEffectStartFrame || sourceFrame > landingEffectEndFrame) {
    return frameXml;
  }

  return frameXml.replace(/<item type="PlaceObject2Tag"[\s\S]*?<\/item>/g, (tag) => {
    let next = tag.replace(
      /(scaleX|scaleY|rotateSkew0|rotateSkew1)="(-?\d+(?:\.\d+)?)"/g,
      (_match, key: string, rawValue: string) => `${key}="${Number(rawValue) * landingMatrixScale}"`,
    );

    if (/alphaMultTerm="\d+"/.test(next)) {
      return next.replace(/alphaMultTerm="(\d+)"/, (_match, rawAlpha: string) => {
        return `alphaMultTerm="${Math.max(0, Math.min(256, Math.round(Number(rawAlpha) * landingAlphaScale)))}"`;
      });
    }

    const withFlag = next.replace('placeFlagHasColorTransform="false"', 'placeFlagHasColorTransform="true"');
    const matrixEnd = withFlag.indexOf("</matrix>");
    if (matrixEnd >= 0) {
      const insertAt = matrixEnd + "</matrix>".length;
      return `${withFlag.slice(0, insertAt)}\n${landingAlphaTransform()}${withFlag.slice(insertAt)}`;
    }

    const itemEnd = withFlag.lastIndexOf("</item>");
    if (itemEnd < 0) {
      return withFlag;
    }

    return `${withFlag.slice(0, itemEnd)}${landingAlphaTransform()}\n${withFlag.slice(itemEnd)}`;
  });
}

function compressFramesPreservingState(frames: string[]): string[] {
  if (frames.length !== expectedSourceFrameCount) {
    throw new Error(`Expected original a_FrostWard to have ${expectedSourceFrameCount} frames, found ${frames.length}.`);
  }

  const sourceIndices = Array.from({ length: targetFrameCount }, (_value, index) => {
    const progress = index / (targetFrameCount - 1);
    return Math.round(Math.pow(progress, fallTimeExponent) * (frames.length - 1));
  });

  let previousSourceIndex = -1;
  return sourceIndices.map((sourceIndex) => {
    let merged = "";
    for (let index = previousSourceIndex + 1; index <= sourceIndex; index++) {
      merged += stripShowFrame(reduceLandingEffect(frames[index], index + 1));
    }
    previousSourceIndex = sourceIndex;
    return `${merged}${showFrameTag}`;
  });
}

function compressAnimation(xml: string): { xml: string; sourceFrameCount: number; targetFrameCount: number } {
  const sprite = splitSpriteFrames(xml);
  const compressedFrames = compressFramesPreservingState(sprite.frames);
  const nextXml = `${sprite.before}${compressedFrames.join("")}${sprite.after}`.replace(
    /(<item type="DefineSpriteTag"(?=[^>]*spriteId="2673")[^>]*frameCount=")\d+(")/,
    `$1${compressedFrames.length}$2`,
  );

  return {
    xml: nextXml,
    sourceFrameCount: sprite.frameCount,
    targetFrameCount: compressedFrames.length,
  };
}

function exportXml(swfPath: string, xmlPath: string): void {
  fs.mkdirSync(path.dirname(xmlPath), { recursive: true });
  runFfdec(["-swf2xml", swfPath, xmlPath]);
}

function rebuildSwf(xmlPath: string, swfPath: string): void {
  runFfdec(["-xml2swf", xmlPath, swfPath]);
}

function main(): void {
  const verifyOnly = process.argv.includes("--verify");
  if (!fs.existsSync(ffdecJar)) {
    throw new Error(`FFDec CLI not found at ${path.relative(repoRoot, ffdecJar)}.`);
  }

  const swfForInspection = verifyOnly ? targetSwf : sourceSwf;
  if (!verifyOnly) {
    ensureOriginalSourceSwf();
  }

  exportXml(swfForInspection, extractedXml);
  const xml = fs.readFileSync(extractedXml, "utf8");
  const sprite = splitSpriteFrames(xml);

  if (verifyOnly) {
    if (sprite.frameCount !== targetFrameCount) {
      throw new Error(`Frozen Ward animation is not time-compressed. frameCount=${sprite.frameCount}`);
    }

    console.log(`Frozen Ward visual animation verified: frameCount=${sprite.frameCount}`);
    return;
  }

  const result = compressAnimation(xml);
  fs.writeFileSync(patchedXml, result.xml, "utf8");
  rebuildSwf(patchedXml, patchedSwf);
  ensureBackup(targetSwf);
  fs.copyFileSync(patchedSwf, targetSwf);

  console.log(
    `Time-compressed Frozen Ward visual animation: ${result.sourceFrameCount} -> ${result.targetFrameCount} frames.`,
  );
}

main();
