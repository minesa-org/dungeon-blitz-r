#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const CLASS_NAME = "a_Room_Tutorial_04";
const DEFAULT_SWF = path.join("src", "client", "content", "localhost", "p", "cbp", "LevelsNR.swf");

function parseArgs(argv) {
  const args = { ffdec: "", swf: DEFAULT_SWF, verify: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--ffdec" || arg === "-f") {
      args.ffdec = argv[++i] || "";
      continue;
    }
    if (arg === "--swf" || arg === "--swf-path") {
      args.swf = argv[++i] || "";
      continue;
    }
    if (arg === "--verify" || arg === "--dry-run") {
      args.verify = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("node src/server/scripts/patch_levelsnr_room4_jump_training_rewrite.js [--verify] [--swf <path>] [--ffdec <path>]");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function repoRoot() {
  return path.resolve(__dirname, "..", "..", "..");
}

function resolvePath(root, value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function detectFfdec(root, preferred) {
  const candidates = [];
  if (preferred) {
    candidates.push(resolvePath(root, preferred));
  }
  candidates.push(
    path.join(root, "build", "tools", "ffdec_25.0.0", "ffdec-cli.exe"),
    path.join(root, "build", "tools", "ffdec_25.0.0", "ffdec-cli.jar"),
    path.join(root, "build", "tools", "ffdec_25.0.0", "ffdec.bat"),
  );
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || "";
}

function runFfdec(ffdecPath, args) {
  const resolved = path.resolve(ffdecPath);
  const basename = path.basename(resolved).toLowerCase();
  if (basename.endsWith(".jar")) {
    execFileSync("java", ["-jar", resolved, "-cli", ...args], { stdio: "inherit" });
    return;
  }
  if (basename.endsWith(".bat")) {
    execFileSync("cmd.exe", ["/c", resolved, "-cli", ...args], { stdio: "inherit" });
    return;
  }
  execFileSync(resolved, ["-cli", ...args], { stdio: "inherit" });
}

function replaceExact(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`Could not find ${label} in ${CLASS_NAME}.as`);
  }
  return source.replace(needle, replacement);
}

function replaceAny(source, needles, replacement, label) {
  for (const needle of needles) {
    if (source.includes(needle)) {
      return source.replace(needle, replacement);
    }
  }
  throw new Error(`Could not find ${label} in ${CLASS_NAME}.as`);
}

function patchSource(source) {
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const join = (lines) => lines.join(eol);
  const droppingYReplacement = join([
    "      public function GetDroppingPlayerY(param1:Object) : Number",
    "      {",
    "         if(param1 != null && param1[\"physPosY\"] != undefined)",
    "         {",
    "            return Number(param1[\"physPosY\"]);",
    "         }",
    "         if(!isNaN(this.dropLastY))",
    "         {",
    "            return this.dropLastY;",
    "         }",
    "         if(!isNaN(this.dropGroundY))",
    "         {",
    "            return this.dropGroundY;",
    "         }",
    "         return NaN;",
    "      }",
  ]);

  const droppingYPattern = /public function GetDroppingPlayerY\(param1:Object\) : Number[\s\S]*?public function GetDroppingPlayerGrounded/m;
  if (!droppingYPattern.test(source)) {
    throw new Error(`Could not find GetDroppingPlayerY in ${CLASS_NAME}.as`);
  }
  source = source.replace(droppingYPattern, `${droppingYReplacement}${eol}${eol}      public function GetDroppingPlayerGrounded`);

  if (source.includes("public function OnDroppingEnterFrame")) {
    return source;
  }

  source = replaceExact(
    source,
    "      public var Script_FindDoor:Array;",
    join([
      "      public var Script_FindDoor:Array;",
      "",
      "      public var roomHook:a_GameHook;",
      "",
      "      public var trackedPlayer:Object;",
      "",
      "      public var jumpPhaseState:String;",
      "",
      "      public var wasOnGround:Boolean;",
      "",
      "      public var jumpStarted:Boolean;",
      "",
      "      public var jumpCompleted:Boolean;",
      "",
      "      public var jumpGroundY:Number;",
      "",
      "      public var jumpGroundedEpsilon:Number = 1;",
      "",
      "      public var dropPhaseState:String;",
      "",
      "      public var dropStarted:Boolean;",
      "",
      "      public var dropCompleted:Boolean;",
      "",
      "      public var dropGroundY:Number;",
      "",
      "      public var dropGroundedEpsilon:Number = 1;",
      "",
      "      public var dropLastY:Number;",
    ]),
    "state field block",
  );

  source = replaceAny(
    source,
    [
      join([
        "      public function InitRoom(param1:a_GameHook) : void",
        "      {",
        "         param1.initialPhase = this.FirstTick;",
        "      }",
      ]),
      join([
        "      public function InitRoom(param1:a_GameHook) : void",
        "      {",
        "         this.roomHook = param1;",
        "         this.trackedPlayer = null;",
        "         this.jumpPhaseState = \"IDLE\";",
        "         this.wasOnGround = false;",
        "         this.jumpStarted = false;",
        "         this.jumpCompleted = false;",
        "         this.jumpGroundY = NaN;",
        "         if(!this.hasEventListener(Event.ENTER_FRAME))",
        "         {",
        "            this.addEventListener(Event.ENTER_FRAME,this.OnJumpTrainingEnterFrame);",
        "         }",
        "         param1.initialPhase = this.FirstTick;",
        "      }",
      ]),
    ],
    join([
      "      public function InitRoom(param1:a_GameHook) : void",
      "      {",
      "         this.roomHook = param1;",
      "         this.trackedPlayer = null;",
      "         this.jumpPhaseState = \"IDLE\";",
      "         this.wasOnGround = false;",
      "         this.jumpStarted = false;",
      "         this.jumpCompleted = false;",
      "         this.jumpGroundY = NaN;",
      "         this.dropPhaseState = \"IDLE\";",
      "         this.dropStarted = false;",
      "         this.dropCompleted = false;",
      "         this.dropGroundY = NaN;",
      "         this.dropLastY = NaN;",
      "         if(!this.hasEventListener(Event.ENTER_FRAME))",
      "         {",
      "            this.addEventListener(Event.ENTER_FRAME,this.OnJumpTrainingEnterFrame);",
      "         }",
      "         param1.initialPhase = this.FirstTick;",
      "      }",
    ]),
    "InitRoom",
  );

  source = replaceAny(
    source,
    [
      join([
        "      public function WaitingForJump(param1:a_GameHook) : void",
        "      {",
        "         if(param1.OnScriptFinish(this.Script_OpeningScene))",
        "         {",
        "            param1.Animate(\"am_JumpTut\",\"Show\",true);",
        "         }",
        "         if(param1.OnTrigger(\"am_Trigger_Fall2\"))",
        "         {",
        "            param1.PlayScript(this.Script_Fall);",
        "         }",
        "         if(param1.OnTrigger(\"am_Trigger_2\"))",
        "         {",
        "            param1.Animate(\"am_JumpTut\",\"Remove\",true);",
        "            param1.Animate(\"am_DropTut\",\"Show\",true);",
        "            param1.CancelScript(this.Script_OpeningScene);",
        "            param1.CancelScript(this.Script_Fall);",
        "            if(param1.GetTime() < 3000)",
        "            {",
        "               param1.PlayScript(this.Script_JumpFast);",
        "            }",
        "            else",
        "            {",
        "               param1.PlayScript(this.Script_JumpSlow);",
        "            }",
        "            param1.SetPhase(this.WaitingForDrop);",
        "         }",
        "      }",
      ]),
      join([
        "      public function WaitingForJump(param1:a_GameHook) : void",
        "      {",
        "         if(param1.OnScriptFinish(this.Script_OpeningScene))",
        "         {",
        "            param1.Animate(\"am_JumpTut\",\"Show\",true);",
        "            if(this.jumpPhaseState == \"IDLE\")",
        "            {",
        "               this.BeginJumpTracking();",
        "            }",
        "         }",
        "         if(param1.OnTrigger(\"am_Trigger_Fall2\"))",
        "         {",
        "            param1.PlayScript(this.Script_Fall);",
        "         }",
        "         if(this.jumpPhaseState == \"JUMP\" && this.jumpCompleted)",
        "         {",
        "            this.CompleteJumpTutorial(param1);",
        "         }",
        "      }",
      ]),
    ],
    join([
      "      public function WaitingForJump(param1:a_GameHook) : void",
      "      {",
      "         if(param1.OnScriptFinish(this.Script_OpeningScene))",
      "         {",
      "            param1.Animate(\"am_JumpTut\",\"Show\",true);",
      "            if(this.jumpPhaseState == \"IDLE\")",
      "            {",
      "               this.BeginJumpTracking();",
      "            }",
      "         }",
      "         if(param1.OnTrigger(\"am_Trigger_Fall2\"))",
      "         {",
      "            param1.PlayScript(this.Script_Fall);",
      "         }",
      "         if(this.jumpPhaseState == \"JUMP\" && this.jumpCompleted)",
      "         {",
      "            this.CompleteJumpTutorial(param1);",
      "         }",
      "      }",
    ]),
    "WaitingForJump",
  );

  source = replaceExact(
    source,
    join([
      "      public function WaitingForDrop(param1:a_GameHook) : void",
      "      {",
      "         if(param1.OnTrigger(\"am_Trigger_3\"))",
      "         {",
      "            param1.PlayScript(this.Script_Fall);",
      "         }",
      "         if(param1.OnTrigger(\"am_Trigger_Fall3\"))",
      "         {",
      "            param1.Animate(\"am_DropTut\",\"Remove\",true);",
      "            param1.CancelScript(this.Script_JumpFast);",
      "            param1.CancelScript(this.Script_JumpSlow);",
      "            param1.CancelScript(this.Script_Fall);",
      "         }",
      "         if(param1.OnTrigger(\"am_Trigger_Fall3\"))",
      "         {",
      "            param1.PlayScript(this.Script_FindDoor);",
      "         }",
      "         if(param1.OnScriptFinish(this.Script_FindDoor))",
      "         {",
      "            param1.Animate(\"am_DoorTut\",\"Show\",true);",
      "            param1.SetPhase(this.WaitingOnDoor);",
      "         }",
      "      }",
    ]),
    join([
      "      public function WaitingForDrop(param1:a_GameHook) : void",
      "      {",
      "         if(this.dropPhaseState == \"COMPLETE_DROPPING\" && !this.dropCompleted)",
      "         {",
      "            this.dropCompleted = true;",
      "            this.CompleteDroppingTutorial(param1);",
      "         }",
      "      }",
    ]),
    "WaitingForDrop",
  );

  source = replaceAny(
    source,
    [
      join([
        "      public function WaitingOnDoor(param1:a_GameHook) : void",
        "      {",
        "         if(param1.AtTime(15000))",
        "         {",
        "            param1.Animate(\"am_DoorTut\",\"Remove\",true);",
        "            param1.SetPhase(null);",
        "         }",
        "      }",
      ]),
      join([
        "      public function WaitingOnDoor(param1:a_GameHook) : void",
        "      {",
        "         if(param1.AtTime(15000))",
        "         {",
        "            this.jumpPhaseState = \"DONE\";",
        "            param1.Animate(\"am_DoorTut\",\"Remove\",true);",
        "            param1.SetPhase(null);",
        "         }",
        "      }",
      ]),
    ],
    join([
      "      public function WaitingOnDoor(param1:a_GameHook) : void",
      "      {",
      "         if(param1.AtTime(15000))",
      "         {",
      "            this.jumpPhaseState = \"DONE\";",
      "            param1.Animate(\"am_DoorTut\",\"Remove\",true);",
      "            param1.SetPhase(null);",
      "         }",
      "      }",
    ]),
    "WaitingOnDoor",
  );

  const helperReplacement = join([
      "      public function ResolveTrackedPlayer() : Object",
      "      {",
      "         var _loc1_:Object = null;",
      "         _loc1_ = this.roomHook != null ? this.roomHook.linkToRoom : null;",
      "         if(_loc1_ && _loc1_.var_1 && _loc1_.var_1.clientEnt && _loc1_.var_1.clientEnt.currRoom == _loc1_)",
      "         {",
      "            return _loc1_.var_1.clientEnt;",
      "         }",
      "         return null;",
      "      }",
      "",
      "      public function GetTrackedPlayerGrounded(param1:Object) : Boolean",
      "      {",
      "         if(!param1)",
      "         {",
      "            return false;",
      "         }",
      "         if(param1.cue && param1.cue.bDidGroundSnap)",
      "         {",
      "            this.jumpGroundY = Number(param1.physPosY);",
      "            return true;",
      "         }",
      "         if(isNaN(this.jumpGroundY) || Number(param1.physPosY) > this.jumpGroundY)",
      "         {",
      "            this.jumpGroundY = Number(param1.physPosY);",
      "         }",
      "         return Number(param1.physPosY) >= this.jumpGroundY - this.jumpGroundedEpsilon;",
      "      }",
      "",
      "      public function BeginJumpTracking() : void",
      "      {",
      "         this.trackedPlayer = this.ResolveTrackedPlayer();",
      "         if(!this.trackedPlayer)",
      "         {",
      "            return;",
      "         }",
      "         this.jumpPhaseState = \"JUMP\";",
      "         this.jumpStarted = false;",
      "         this.jumpCompleted = false;",
      "         this.wasOnGround = this.GetTrackedPlayerGrounded(this.trackedPlayer);",
      "         if(this.wasOnGround)",
      "         {",
      "            this.jumpGroundY = Number(this.trackedPlayer.physPosY);",
      "         }",
      "      }",
      "",
      "      public function CompleteJumpTutorial(param1:a_GameHook) : void",
      "      {",
      "         this.jumpPhaseState = \"DROPPING\";",
      "         this.dropPhaseState = \"IDLE\";",
      "         this.dropStarted = false;",
      "         this.dropCompleted = false;",
      "         this.dropGroundY = NaN;",
      "         this.dropLastY = NaN;",
      "         param1.Animate(\"am_JumpTut\",\"Remove\",true);",
      "         param1.Animate(\"am_DropTut\",\"Show\",true);",
      "         param1.CancelScript(this.Script_OpeningScene);",
      "         param1.CancelScript(this.Script_Fall);",
      "         if(param1.GetTime() < 3000)",
      "         {",
      "            param1.PlayScript(this.Script_JumpFast);",
      "         }",
      "         else",
      "         {",
      "            param1.PlayScript(this.Script_JumpSlow);",
      "         }",
      "         this.StartDroppingTutorial(param1);",
      "         param1.SetPhase(this.WaitingForDrop);",
      "      }",
      "",
      "      public function StartDoorTutorial(param1:a_GameHook) : void",
      "      {",
      "         if(this.jumpPhaseState == \"DOOR\" || this.jumpPhaseState == \"DONE\")",
      "         {",
      "            return;",
      "         }",
      "         this.jumpPhaseState = \"DOOR\";",
      "         param1.CancelScript(this.Script_JumpFast);",
      "         param1.CancelScript(this.Script_JumpSlow);",
      "         param1.CancelScript(this.Script_Fall);",
      "         param1.CancelScript(this.Script_FindDoor);",
      "         if(_root.startDoorTutorial != undefined)",
      "         {",
      "            _root.startDoorTutorial();",
      "            return;",
      "         }",
      "         if(_root.doorTutorial != undefined && _root.doorTutorial.startTutorial != undefined)",
      "         {",
      "            _root.doorTutorial.startTutorial();",
      "            return;",
      "         }",
      "         param1.PlayScript(this.Script_FindDoor);",
      "         param1.Animate(\"am_DoorTut\",\"Show\",true);",
      "         param1.SetPhase(this.WaitingOnDoor);",
      "      }",
      "",
      "      public function OnJumpTrainingEnterFrame(param1:Event) : void",
      "      {",
      "         var _loc2_:Boolean = false;",
      "         if(this.jumpPhaseState != \"JUMP\" || this.jumpCompleted || !this.roomHook)",
      "         {",
      "            return;",
      "         }",
      "         this.trackedPlayer = this.ResolveTrackedPlayer();",
      "         if(!this.trackedPlayer)",
      "         {",
      "            return;",
      "         }",
      "         _loc2_ = this.GetTrackedPlayerGrounded(this.trackedPlayer);",
      "         if(this.wasOnGround && !_loc2_)",
      "         {",
      "            this.jumpStarted = true;",
      "         }",
      "         else if(this.jumpStarted && _loc2_)",
      "         {",
      "            this.jumpCompleted = true;",
      "         }",
      "         this.wasOnGround = _loc2_;",
      "      }",
      "",
      "      public function ResolveDroppingPlayer() : Object",
      "      {",
      "         if(_root != null && _root.player != undefined)",
      "         {",
      "            return _root.player;",
      "         }",
      "         return this.ResolveTrackedPlayer();",
      "      }",
      "",
      "      public function StartDroppingTutorial(param1:a_GameHook) : void",
      "      {",
      "         this.dropPhaseState = \"DROPPING\";",
      "         this.dropStarted = false;",
      "         this.dropCompleted = false;",
      "         this.trackedPlayer = this.ResolveDroppingPlayer();",
      "         if(this.trackedPlayer == null)",
      "         {",
      "            this.dropPhaseState = \"IDLE\";",
      "            return;",
      "         }",
      "         this.dropGroundY = this.GetDroppingPlayerY(this.trackedPlayer);",
      "         this.dropLastY = this.dropGroundY;",
      "         trace(\"DROPPING WATCHER STARTED\");",
      "         this.onEnterFrame = Delegate.create(this,this.OnDroppingEnterFrame);",
      "      }",
      "",
      "      public function GetDroppingPlayerY(param1:Object) : Number",
      "      {",
      "         if(param1 != null && param1[\"physPosY\"] != undefined)",
      "         {",
      "            return Number(param1[\"physPosY\"]);",
      "         }",
      "         if(!isNaN(this.dropLastY))",
      "         {",
         "            return this.dropLastY;",
      "         }",
      "         if(!isNaN(this.dropGroundY))",
      "         {",
      "            return this.dropGroundY;",
      "         }",
      "         return NaN;",
      "      }",
      "",
      "      public function GetDroppingPlayerGrounded(param1:Object) : Boolean",
      "      {",
      "         var _loc2_:Number = this.GetDroppingPlayerY(param1);",
      "         var _loc3_:Object = null;",
      "         if(isNaN(_loc2_))",
      "         {",
      "            return false;",
      "         }",
      "         _loc3_ = this.ResolveTrackedPlayer();",
      "         if(_loc3_ != null && _loc3_.cue != undefined && _loc3_.cue.bDidGroundSnap)",
      "         {",
      "            this.dropGroundY = _loc2_;",
      "            return true;",
      "         }",
      "         if(_loc3_ != null && this.GetTrackedPlayerGrounded(_loc3_))",
      "         {",
      "            this.dropGroundY = _loc2_;",
      "            return true;",
      "         }",
      "         return false;",
      "      }",
      "",
      "      public function OnDroppingEnterFrame() : void",
      "      {",
      "         var _loc1_:Object = this.ResolveDroppingPlayer();",
      "         var _loc2_:Number = NaN;",
      "         var _loc3_:Boolean = false;",
      "         var _loc4_:Boolean = false;",
      "         if(this.dropPhaseState != \"DROPPING\")",
      "         {",
      "            return;",
      "         }",
      "         if(_loc1_ == null)",
      "         {",
      "            this.trackedPlayer = null;",
      "            return;",
      "         }",
      "         this.trackedPlayer = _loc1_;",
      "         _loc2_ = this.GetDroppingPlayerY(_loc1_);",
      "         if(isNaN(_loc2_))",
      "         {",
      "            return;",
      "         }",
      "         _loc4_ = !isNaN(this.dropLastY) && _loc2_ > this.dropLastY;",
      "         _loc3_ = this.GetDroppingPlayerGrounded(_loc1_);",
      "         if(!this.dropStarted && _loc4_)",
      "         {",
      "            this.dropStarted = true;",
      "            trace(\"DROPPING STARTED\");",
      "         }",
      "         if(this.dropStarted && _loc3_ && !this.dropCompleted)",
      "         {",
      "            this.dropCompleted = true;",
      "            this.dropPhaseState = \"COMPLETE_DROPPING\";",
      "            trace(\"DROPPING COMPLETED\");",
      "            delete this.onEnterFrame;",
      "            return;",
      "         }",
      "         this.dropLastY = _loc2_;",
      "      }",
      "",
      "      public function CompleteDroppingTutorial(param1:a_GameHook) : void",
      "      {",
      "         this.dropPhaseState = \"START_DOOR_TUTORIAL\";",
      "         this.dropCompleted = true;",
      "         param1.Animate(\"am_DropTut\",\"Remove\",true);",
      "         param1.CancelScript(this.Script_JumpFast);",
      "         param1.CancelScript(this.Script_JumpSlow);",
      "         param1.CancelScript(this.Script_Fall);",
      "         delete this.onEnterFrame;",
      "         this.StartDoorTutorial(param1);",
      "      }",
      "",
      "      internal function __setProp___id426__a_Room_Tutorial_04_cues_0() : *",
    ]);
  const helperBlockPattern = /      public function ResolveTrackedPlayer\(\) : Object[\s\S]*?      internal function __setProp___id426__a_Room_Tutorial_04_cues_0\(\) : \*/m;
  if (helperBlockPattern.test(source)) {
    source = source.replace(helperBlockPattern, helperReplacement);
  } else {
    source = replaceExact(
      source,
      "      internal function __setProp___id426__a_Room_Tutorial_04_cues_0() : *",
      helperReplacement,
      "helper insertion point",
    );
  }

  return source;
}

function verifyPatchedSource(source) {
  if (!source.includes("public function OnJumpTrainingEnterFrame")) {
    throw new Error("Patched source is missing the ENTER_FRAME tracker.");
  }
  if (!source.includes("public function OnDroppingEnterFrame")) {
    throw new Error("Patched source is missing the dropping ENTER_FRAME tracker.");
  }
  if (!source.includes("public function StartDroppingTutorial(param1:a_GameHook)") && !source.includes("public function BeginDroppingTracking(param1:a_GameHook)")) {
    throw new Error("Patched source is missing the drop watcher bootstrap helper.");
  }
  if (!source.includes("public function StartDoorTutorial(param1:a_GameHook)") && !source.includes("public function CompleteDroppingTutorial(param1:a_GameHook)")) {
    throw new Error("Patched source is missing the door tutorial handoff helper.");
  }
  if (!source.includes("this.roomHook != null ? this.roomHook.linkToRoom")) {
    throw new Error("Patched source is missing Room-based player resolution.");
  }
  if (!source.includes("if(_root != null && _root.player != undefined)") && !source.includes("if(_loc1_ != null && _loc1_[\"player\"] != undefined)")) {
    throw new Error("Patched source is missing the root player drop resolution.");
  }
  if (!source.includes("this.onEnterFrame = Delegate.create(this,this.OnDroppingEnterFrame);") && !source.includes("this.addEventListener(Event.ENTER_FRAME,this.OnDroppingEnterFrame);")) {
    throw new Error("Patched source is missing the dropping watcher bind.");
  }
  if (!source.includes("bDidGroundSnap")) {
    throw new Error("Patched source is missing grounded flag detection.");
  }
  if (!source.includes("param1[\"physPosY\"] != undefined") && !source.includes("param1.physPosY != undefined")) {
    throw new Error("Patched source is missing physPosY drop tracking.");
  }
  if (!source.includes("if(!isNaN(this.dropLastY))")) {
    throw new Error("Patched source is missing the last-known drop Y fallback.");
  }
  if (!source.includes("if(!isNaN(this.dropGroundY))")) {
    throw new Error("Patched source is missing the grounded drop Y fallback.");
  }
  if (/\._y\b/.test(source)) {
    throw new Error("Patched source still reads Entity._y.");
  }
  if (!source.includes("!this.dropStarted && _loc4_") && !source.includes("!this.dropStarted && !_loc3_ && !isNaN(this.dropLastY) && _loc2_ > this.dropLastY")) {
    throw new Error("Patched source is missing movement-based drop start detection.");
  }
  if (!source.includes("if(this.dropStarted && _loc3_ && !this.dropCompleted)") && !source.includes("if(this.dropStarted && _loc3_)")) {
    throw new Error("Patched source is missing landing-based drop completion.");
  }
  if (!source.includes("_root.startDoorTutorial()") && !source.includes("_loc2_[\"startDoorTutorial\"]()")) {
    throw new Error("Patched source is missing the primary door tutorial handoff.");
  }
  if (!source.includes("_root.doorTutorial.startTutorial()") && !source.includes("_loc2_[\"doorTutorial\"][\"startTutorial\"]()")) {
    throw new Error("Patched source is missing the fallback door tutorial handoff.");
  }
  if (source.includes("Key.isDown(")) {
    throw new Error("Patched source unexpectedly uses Key.isDown.");
  }
  const jumpStart = source.indexOf("public function WaitingForJump");
  const dropStart = source.indexOf("public function WaitingForDrop");
  if (jumpStart === -1 || dropStart === -1) {
    throw new Error("Could not isolate WaitingForJump source.");
  }
  const waitingForJump = source.slice(jumpStart, dropStart);
  if (waitingForJump.includes("OnTrigger(\"am_Trigger_2\")")) {
    throw new Error("WaitingForJump still depends on am_Trigger_2.");
  }
  const completeJumpStart = source.indexOf("public function CompleteJumpTutorial");
  const jumpFrameStart = source.indexOf("public function OnJumpTrainingEnterFrame");
  if (completeJumpStart === -1 || jumpFrameStart === -1) {
    throw new Error("Could not isolate CompleteJumpTutorial source.");
  }
  const completeJump = source.slice(completeJumpStart, jumpFrameStart);
  if (!completeJump.includes("param1.Animate(\"am_DropTut\",\"Show\",true);") || (!completeJump.includes("this.StartDroppingTutorial(param1);") && !completeJump.includes("this.BeginDroppingTracking(param1);"))) {
    throw new Error("Drop watcher is not armed from the same flow that shows am_DropTut.");
  }
  const doorStart = source.indexOf("public function WaitingOnDoor");
  if (dropStart === -1 || doorStart === -1) {
    throw new Error("Could not isolate WaitingForDrop source.");
  }
  const waitingForDrop = source.slice(dropStart, doorStart);
  if (waitingForDrop.includes("OnTrigger(\"am_Trigger_3\")") || waitingForDrop.includes("OnTrigger(\"am_Trigger_Fall3\")")) {
    throw new Error("WaitingForDrop still depends on trigger-based completion.");
  }
  if (waitingForDrop.includes("BeginDroppingTracking") || waitingForDrop.includes("StartDroppingTutorial")) {
    throw new Error("WaitingForDrop still contains the old drop bootstrap.");
  }
}

function exportSource(ffdecPath, workRoot, swfPath) {
  fs.rmSync(workRoot, { recursive: true, force: true });
  fs.mkdirSync(workRoot, { recursive: true });
  runFfdec(ffdecPath, ["-selectclass", CLASS_NAME, "-export", "script", workRoot, swfPath]);
  const scriptPath = path.join(workRoot, "scripts", `${CLASS_NAME}.as`);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`FFDec export did not create ${CLASS_NAME}.as`);
  }
  return scriptPath;
}

function ensureBackup(filePath) {
  const backupPath = `${filePath}.bak`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
}

function applyPatch(root, ffdecPath, swfPath) {
  const workRoot = path.join(root, "build", "ffdec-levelsnr-room4-jump-training");
  const outputSwfPath = path.join(workRoot, "LevelsNR.patched.swf");
  const scriptPath = exportSource(ffdecPath, workRoot, swfPath);
  const patchedSource = patchSource(fs.readFileSync(scriptPath, "utf8"));
  verifyPatchedSource(patchedSource);
  fs.writeFileSync(scriptPath, patchedSource, "utf8");
  runFfdec(ffdecPath, ["-importScript", swfPath, outputSwfPath, path.join(workRoot, "scripts")]);
  ensureBackup(swfPath);
  fs.copyFileSync(outputSwfPath, swfPath);
  console.log(`Patched jump training rewrite into ${swfPath}`);
}

function verifyPatch(root, ffdecPath, swfPath) {
  const workRoot = path.join(root, "build", "ffdec-levelsnr-room4-jump-training-verify");
  const scriptPath = exportSource(ffdecPath, workRoot, swfPath);
  verifyPatchedSource(fs.readFileSync(scriptPath, "utf8"));
  console.log(`Verified jump training rewrite markers in ${swfPath}`);
}

function main() {
  const args = parseArgs(process.argv);
  const root = repoRoot();
  const ffdecPath = detectFfdec(root, args.ffdec);
  const swfPath = resolvePath(root, args.swf);
  if (!ffdecPath) {
    throw new Error("FFDec not found. Pass --ffdec or install JPEXS FFDec.");
  }
  if (!fs.existsSync(swfPath)) {
    throw new Error(`SWF not found: ${swfPath}`);
  }
  if (args.verify) {
    verifyPatch(root, ffdecPath, swfPath);
    return;
  }
  applyPatch(root, ffdecPath, swfPath);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
