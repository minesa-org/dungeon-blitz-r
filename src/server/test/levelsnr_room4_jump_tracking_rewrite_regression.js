const { strict: assert } = require("assert");
const path = require("path");
const fs = require("fs");

function main() {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const scriptPath = path.join(repoRoot, "src", "server", "scripts", "patch_levelsnr_room4_jump_training_rewrite.js");
  const source = fs.readFileSync(scriptPath, "utf8");

  assert.match(source, /OnJumpTrainingEnterFrame/, "patch script should inject ENTER_FRAME jump tracking");
  assert.match(source, /OnDroppingEnterFrame/, "patch script should inject ENTER_FRAME drop tracking");
  assert.match(source, /StartDroppingTutorial/, "patch script should inject a dedicated drop bootstrap helper");
  assert.match(source, /StartDoorTutorial/, "patch script should inject the door tutorial helper");
  assert.match(source, /bDidGroundSnap/, "patch script should use grounded flag tracking");
  assert.match(source, /Number\(param1\.physPosY\) >= this\.jumpGroundY - this\.jumpGroundedEpsilon/, "patch script should keep jump Y-threshold fallback");
  assert.match(source, /physPosY/, "patch script should read dropping Y from physPosY");
  assert.match(source, /if\(!isNaN\(this\.dropLastY\)\)/, "patch script should fall back to last tracked drop Y");
  assert.match(source, /if\(!isNaN\(this\.dropGroundY\)\)/, "patch script should fall back to grounded drop Y");
  assert.doesNotMatch(source, /param1\._y/, "patch script should not access Entity._y");
  assert.match(source, /this\.onEnterFrame = Delegate\.create\(this,this\.OnDroppingEnterFrame\);/, "patch script should bind the drop watcher on the room frame loop");
  assert.match(source, /this\.StartDroppingTutorial\(param1\);/, "patch script should start the watcher from the same flow that shows the drop UI");
  assert.match(source, /if\(_root != null && _root\.player != undefined\)/, "patch script should prefer _root.player during drop tracking");
  assert.match(source, /!this\.dropStarted && _loc4_/, "patch script should detect dropping from downward movement");
  assert.match(source, /if\(this\.dropStarted && _loc3_ && !this\.dropCompleted\)/, "patch script should complete dropping when the player lands");
  assert.match(source, /DROPPING STARTED/, "patch script should emit a drop-start trace");
  assert.match(source, /DROPPING COMPLETED/, "patch script should emit a drop-complete trace");
  assert.match(source, /_root\.startDoorTutorial\(\)/, "patch script should call the primary door tutorial handoff");
  assert.match(source, /_root\.doorTutorial\.startTutorial\(\)/, "patch script should call the fallback door tutorial handoff");
  assert.match(source, /am_DoorTut\\",\\"Show\\",true/, "patch script should show the door tutorial balloon");
  assert.match(source, /WaitingForJump still depends on am_Trigger_2/, "patch script should verify the old trigger gate is gone");
  assert.match(source, /WaitingForDrop still depends on trigger-based completion/, "patch script should verify the old drop trigger gates are gone");
  assert.match(source, /WaitingForDrop still contains the old drop bootstrap/, "patch script should verify the old drop bootstrap is gone");
  assert.match(source, /Patched source unexpectedly uses Key\.isDown\./, "patch script should guard against key polling in emitted source");
  console.log("levelsnr_room4_jump_tracking_rewrite_regression: ok");
}

main();
