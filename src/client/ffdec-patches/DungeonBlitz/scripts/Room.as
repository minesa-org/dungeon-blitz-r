package
{
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.geom.Point;
   import flash.geom.Rectangle;
   import flash.utils.Dictionary;
   import flash.utils.getQualifiedClassName;
   
   public class Room
   {
      
      public static const const_243:uint = 0;
      
      public static const ROOM_MIN_X:int = -65535;
      
      public static const ROOM_MAX_X:int = 65535;
      
      public static const ROOM_MIN_Y:int = -16384;
      
      public static const ROOM_MAX_Y:int = 16383;
      
      private static const const_1117:uint = 5000;
      
      private static const const_977:uint = 30000;
      
      public static const const_1068:uint = 1200000;
      
      public static const const_1046:Number = 200;
      
      public static const const_141:Array = new Array();
      
      private static const const_795:a_Group = new a_Group("DummyGroup",null);
      
      const_141[EntType.const_697] = 1;
      const_141[EntType.const_102] = 1;
      const_141[EntType.const_109] = 5;
      const_141[EntType.const_123] = 10;
      const_141[EntType.const_92] = 20;
      
      internal var var_1:Game;
      
      internal var var_150:MovieClip;
      
      internal var var_1276:Dictionary;
      
      internal var var_113:uint;
      
      internal var var_854:Dictionary;
      
      internal var var_780:Array;
      
      internal var var_1082:Array;
      
      internal var var_63:Object;
      
      private var var_409:Dictionary;
      
      internal var var_229:Vector.<Entity>;
      
      internal var var_323:String;
      
      internal var var_928:Point;
      
      internal var var_2678:MovieClip;
      
      internal var var_460:Vector.<a_Cue>;
      
      internal var var_1159:Vector.<a_Group>;
      
      internal var var_1214:MovieClip;
      
      internal var var_1143:String;
      
      internal var var_241:BossFight;
      
      internal var var_1047:uint = 0;
      
      internal var var_1358:String = "";
      
      internal var var_1377:uint = 0;
      
      internal var var_2199:String = "";
      
      internal var var_1925:Boolean = false;
      
      internal var var_235:CutScene;
      
      internal var var_1052:Boolean = false;
      
      internal var var_473:Vector.<CutScene>;
      
      internal var var_1207:uint = 0;
      
      internal var var_122:a_GameHook = null;
      
      internal var var_1166:uint;
      
      internal var var_2364:uint;
      
      internal var mRoomTick:uint = 1;
      
      internal var var_2459:uint = 0;
      
      internal var var_1978:Function;
      
      internal var var_1672:Function;
      
      internal var var_2411:Boolean = false;
      
      internal var var_1219:Vector.<class_145>;
      
      internal var var_1530:Vector.<class_147>;
      
      internal var var_2025:Boolean;
      
      internal var var_2259:Boolean;
      
      internal var var_2046:Boolean;
      
      internal var var_2308:Boolean;
      
      internal var var_2024:Boolean;
      
      internal var var_2856:Boolean;
      
      internal var var_1440:Number = 0;
      
      internal var var_1266:Number = 0;
      
      internal var var_2527:Boolean;
      
      internal var var_2769:Boolean;
      
      internal var var_2864:Boolean;
      
      internal var bSlowAggroRoom:Boolean;
      
      internal var bInitialized:Boolean;
      
      internal var var_1118:Boolean;
      
      internal var var_584:Boolean;
      
      internal var var_2498:Boolean;
      
      internal var var_2420:Boolean;
      
      internal var bInstanced:Boolean;
      
      internal var var_1330:Array = new Array();
      
      internal var playersInRoom:int = 0;
      
      internal var var_2335:uint = 0;
      
      internal var var_2261:uint = 0;
      
      internal var var_802:uint;
      
      internal var var_1217:uint;
      
      internal var var_1417:Boolean = false;
      
      public function Room(param1:Game, param2:MovieClip)
      {
         super();
         this.var_1 = param1;
         this.var_150 = param2;
         this.var_1276 = new Dictionary();
         this.var_63 = new Object();
         this.var_409 = new Dictionary();
         this.var_854 = new Dictionary();
         this.var_780 = new Array();
         this.var_1082 = new Array();
         this.var_460 = new Vector.<a_Cue>();
         this.var_1159 = new Vector.<a_Group>();
         this.var_229 = new Vector.<Entity>();
         this.var_1219 = new Vector.<class_145>();
         this.var_1530 = new Vector.<class_147>();
         var _loc3_:Rectangle = this.var_150.getBounds(this.var_150.parent);
         this.var_1266 = _loc3_.bottom;
         var _loc4_:uint = uint(uint(this.var_150.y - ROOM_MIN_Y) << 17);
         var _loc5_:uint = uint(this.var_150.x - ROOM_MIN_X) + 1;
         this.var_113 = _loc4_ | _loc5_;
      }
      
      private static function method_940(param1:Entity) : Boolean
      {
         if(param1.var_20 & Entity.REMOTE)
         {
            return false;
         }
         if(param1.var_20 & Entity.PLAYER)
         {
            return false;
         }
         if(param1.entState == Entity.const_6)
         {
            return false;
         }
         return !param1.behaviorType.var_1832 && param1.behaviorType.var_1241 != "Parrot" && param1.behaviorType.var_1241 != "NPC";
      }
      
      public function method_1691() : void
      {
         var _loc1_:String = null;
         var _loc2_:String = null;
         var _loc3_:String = null;
         var _loc4_:String = null;
         var _loc5_:String = null;
         var _loc6_:String = null;
         var _loc7_:class_145 = null;
         var _loc8_:a_Cue = null;
         var _loc9_:a_Group = null;
         var _loc10_:CutScene = null;
         for(_loc1_ in this.var_854)
         {
            delete this.var_854[_loc1_];
         }
         this.var_854 = null;
         for(_loc2_ in this.var_780)
         {
            delete this.var_780[_loc2_];
         }
         this.var_780 = null;
         for(_loc3_ in this.var_1082)
         {
            delete this.var_1082[_loc3_];
         }
         this.var_1082 = null;
         for(_loc4_ in this.var_63)
         {
            delete this.var_63[_loc4_];
         }
         this.var_63 = null;
         for(_loc5_ in this.var_409)
         {
            delete this.var_409[_loc5_];
         }
         this.var_409 = null;
         for(_loc6_ in this.var_1276)
         {
            delete this.var_1276[_loc6_];
         }
         this.var_1276 = null;
         for each(_loc7_ in this.var_1219)
         {
            _loc7_.method_1465();
         }
         this.var_1219 = null;
         if(this.var_241)
         {
            this.var_241.method_1896();
         }
         this.var_241 = null;
         if(this.var_235)
         {
            this.var_235.method_932();
         }
         this.var_235 = null;
         if(this.var_473)
         {
            for each(_loc10_ in this.var_473)
            {
               _loc10_.method_932();
            }
            this.var_473 = null;
         }
         if(this.var_122)
         {
            this.var_122.DestroyGameHook();
         }
         this.var_122 = null;
         for each(_loc8_ in this.var_460)
         {
            _loc8_.DestroyCue();
         }
         this.var_460 = null;
         for each(_loc9_ in this.var_1159)
         {
            _loc9_.DestroyGroup();
         }
         this.var_1159 = null;
         this.var_1530 = null;
         this.var_229 = null;
         this.var_1672 = null;
         this.var_1978 = null;
         this.var_1330 = null;
         this.var_1214 = null;
         this.var_928 = null;
         this.var_2678 = null;
         this.var_150 = null;
         this.var_1 = null;
      }
      
      public function method_896(param1:String) : void
      {
         this.var_323 = param1;
         this.var_2025 = getQualifiedClassName(this.var_150) == "a_Room_NRBoat";
         this.var_2259 = getQualifiedClassName(this.var_150) == "a_Room_NR07";
         this.var_2046 = getQualifiedClassName(this.var_150) == "a_Room_NR08";
         this.var_2308 = getQualifiedClassName(this.var_150) == "a_Room_NRToGoblinRaider1";
         this.var_2024 = getQualifiedClassName(this.var_150) == "a_Room_Main";
         this.var_2856 = this.var_2025 || this.var_2259 || this.var_2046 || this.var_2308 || this.var_2024;
         this.var_2527 = this.var_323 == "Optional";
         this.var_2769 = this.var_323 == "WaveBoss" || this.var_323 == "BasicBoss" || this.var_323 == "IntroBoatFight";
         this.var_2864 = !this.var_1.level.bInstanced && (this.var_323 == "StaticRespawn" || this.var_323 == "StaticAggro");
         this.bSlowAggroRoom = this.var_323 == "StaticRespawn";
         this.var_2498 = this.var_323 == "Armory";
         this.var_2420 = !this.var_2498;
         this.bInstanced = this.var_1.level.bInstanced;
      }
      
      public function method_1581(param1:Entity) : void
      {
         var _loc2_:Entity = null;
         var _loc3_:uint = this.var_229.length;
         var _loc4_:uint = 0;
         while(_loc4_ < _loc3_)
         {
            _loc2_ = this.var_229[_loc4_];
            if(_loc2_ == param1)
            {
               this.var_229.splice(_loc4_,1);
               param1.var_1609 = null;
               return;
            }
            _loc4_++;
         }
      }
      
      public function method_1251(param1:String) : Array
      {
         return this.var_854[param1];
      }
      
      public function method_2144(param1:String) : DisplayObject
      {
         var _loc2_:Array = this.var_854[param1];
         return _loc2_ ? _loc2_[0] : null;
      }
      
      public function method_838(param1:Point, param2:Point, param3:Boolean) : class_37
      {
         var _loc4_:Point = new Point(0,0);
         var _loc5_:class_37 = this.var_1.collMan.getFloorCollision(0,param1.x,param1.y,new Point(0,-5000),_loc4_,null,new Point(),new Point(),CollisionManager.HARD_FLOOR | CollisionManager.SOFT_FLOOR,CollisionManager.SEARCHFLAG_UPWARD_INCLUDE_SOFT);
         var _loc6_:Point = new Point(0,0);
         var _loc7_:class_37 = this.var_1.collMan.getFloorCollision(0,param1.x,param1.y,new Point(0,5000),_loc6_,null,new Point(),new Point(),CollisionManager.HARD_FLOOR | CollisionManager.SOFT_FLOOR,CollisionManager.SEARCHFLAG_UPWARD_INCLUDE_SOFT);
         if(Boolean(_loc5_) && Boolean(_loc7_))
         {
            if(param3 || Math.abs(_loc4_.y - param1.y) > Math.abs(_loc6_.y - param1.y))
            {
               param2.x = _loc6_.x;
               param2.y = _loc6_.y - Entity.PULLBACK_DIST;
               return _loc7_;
            }
            param2.x = _loc4_.x;
            param2.y = _loc4_.y - Entity.PULLBACK_DIST;
            return _loc5_;
         }
         if(_loc5_)
         {
            param2.x = _loc4_.x;
            param2.y = _loc4_.y - Entity.PULLBACK_DIST;
            return _loc5_;
         }
         if(_loc7_)
         {
            param2.x = _loc6_.x;
            param2.y = _loc6_.y - Entity.PULLBACK_DIST;
            return _loc7_;
         }
         return null;
      }
      
      public function RemoveCue(param1:a_Cue) : void
      {
         var _loc2_:Entity = this.method_35(param1.name);
         if(_loc2_)
         {
            _loc2_.var_1835 = true;
         }
         param1.bSpawned = false;
      }
      
      public function SpawnCue(param1:a_Cue, param2:Boolean = false) : Entity
      {
         var _loc4_:Point = null;
         var _loc9_:class_145 = null;
         var _loc11_:int = 0;
         var _loc12_:BehaviorType = null;
         var _loc13_:Point = null;
         if(param1.bSpawned)
         {
            return null;
         }
         var _loc3_:EntType = EntType.method_48(param1.entType);
         if(!_loc3_ || !_loc3_.entName.indexOf("EmberBush"))
         {
            return null;
         }
         if(this.bInstanced && this.var_1.groupmates && this.var_1.groupmates.length && !this.var_1.bAmGroupLeader)
         {
            if(param1.team != "friend")
            {
               return null;
            }
         }
         if(param1.bRareSpawn)
         {
            var _loc10_:uint = this.var_1.mTimeThisTick - param1.mLastSpawned;
            if(_loc10_ < const_1068)
            {
               return null;
            }
            param1.mLastSpawned = this.var_1.mTimeThisTick;
         }
         var _loc5_:class_37 = null;
         if(param1.bDidGroundSnap)
         {
            _loc4_ = param1.groupSnapPos;
         }
         else
         {
            _loc11_ = 0;
            _loc4_ = this.var_1.method_234(param1);
            _loc12_ = BehaviorType.method_367(_loc3_.var_562);
            if(!_loc12_.var_881 && !_loc3_.var_832)
            {
               _loc13_ = new Point(_loc4_.x,_loc4_.y);
               _loc5_ = this.method_838(_loc4_,_loc13_,_loc12_.var_983);
               if(Boolean(_loc5_) && Boolean(_loc13_))
               {
                  _loc11_ = Math.round(_loc4_.y - _loc13_.y);
                  _loc4_.x = _loc13_.x;
                  _loc4_.y = _loc13_.y;
               }
            }
            param1.bDidGroundSnap = true;
            param1.groupSnapPos = _loc4_;
            param1.groupSnapOffsetY = _loc11_;
         }
         var _loc6_:int = int(Entity.const_531);
         if(param1.team)
         {
            if(param1.team == "friend")
            {
               _loc6_ = int(Entity.GOODGUY);
            }
            else if(param1.team == "enemy")
            {
               _loc6_ = int(Entity.BADGUY);
            }
            else if(param1.team == "neutral")
            {
               _loc6_ = int(Entity.NEUTRAL);
            }
         }
         var _loc7_:uint = uint(Entity.LOCAL | Entity.MONSTER | (param2 ? Entity.const_241 : 0));
         var _loc8_:Entity = new Entity(this.var_1,_loc3_.entName,param1,_loc4_.x,_loc4_.y,_loc7_,_loc6_,0,0,0,null,null,null,null,null,null);
         _loc8_.var_1609 = this;
         _loc8_.currRoom = this;
         _loc8_.brain.spawnSurface = _loc5_;
         _loc8_.bLeft = param1.IsFacingLeft();
         for each(_loc9_ in this.var_1219)
         {
            if(_loc9_.var_1833 == "am_BossFight")
            {
               if(_loc9_.method_810(_loc4_.x,_loc4_.y))
               {
                  _loc8_.var_2685 = true;
                  break;
               }
            }
         }
         if(_loc8_.behaviorType.var_1832)
         {
            ++this.var_1.level.var_968;
         }
         param1.bSpawned = true;
         param1.defeatTick = 0;
         if(!_loc8_.behaviorType.var_53)
         {
            this.var_802 += uint(const_141[_loc8_.entType.var_138]);
         }
         this.var_229.push(_loc8_);
         this.var_1.entities.push(_loc8_);
         return _loc8_;
      }
      
      public function method_239(param1:String) : void
      {
         var _loc2_:a_Cue = null;
         for each(_loc2_ in this.var_460)
         {
            if(_loc2_.bDoNotAutoSpawn && _loc2_.groupName == param1)
            {
               this.SpawnCue(_loc2_);
            }
         }
      }
      
      public function method_1097() : void
      {
         var _loc2_:Entity = null;
         var _loc3_:a_Cue = null;
         DevSettings;
         if(!(-1 & DevSettings.DEVFLAG_SPAWN_MONSTERS))
         {
            return;
         }
         var _loc1_:Dictionary = new Dictionary();
         for each(_loc2_ in this.var_229)
         {
            if(_loc2_.cue)
            {
               _loc1_[_loc2_.cue] = true;
            }
         }
         for each(_loc3_ in this.var_460)
         {
            if(!_loc3_.bDoNotAutoSpawn && !_loc1_[_loc3_])
            {
               this.SpawnCue(_loc3_);
            }
         }
         this.var_1217 = 0;
      }
      
      public function method_1872() : void
      {
         var _loc1_:Entity = null;
         var _loc3_:a_Cue = null;
         var _loc2_:* = int(this.var_229.length - 1);
         while(_loc2_ >= 0)
         {
            _loc1_ = this.var_229[_loc2_];
            if(!_loc1_.behaviorType.var_1939)
            {
               _loc1_.var_1835 = true;
            }
            _loc2_--;
         }
         for each(_loc3_ in this.var_460)
         {
            _loc3_.bSpawned = false;
         }
         this.var_1118 = this.playersInRoom ? true : false;
         this.bInitialized = false;
         this.var_584 = false;
         this.var_1440 = 0;
      }
      
      public function method_547() : void
      {
         var _loc1_:Entity = null;
         this.var_1118 = true;
         this.var_2335 = 0;
         DevSettings;
         if(!(-1 & DevSettings.DEVFLAG_MASTER_CLIENT) && !(-1 & DevSettings.DEVFLAG_STANDALONE_CLIENT))
         {
            return;
         }
         for each(_loc1_ in this.var_229)
         {
            this.method_1722(_loc1_,_loc1_.cue.sayOnSpawn);
         }
         if(Boolean(this.var_122) && this.var_122.initialPhase != null)
         {
            this.HookSetPhase(this.var_122.initialPhase);
         }
      }
      
      public function method_1326(param1:Entity) : void
      {
         var _loc2_:Entity = null;
         ++this.playersInRoom;
         if(!this.var_1118)
         {
            this.method_547();
         }
         if(this.var_2856 && param1 == this.var_1.clientEnt)
         {
            this.var_1.method_799(this);
         }
         if(this.bInstanced && Boolean(param1))
         {
            for each(_loc2_ in this.var_229)
            {
               if(Boolean(_loc2_) && Boolean(_loc2_.brain))
               {
                  _loc2_.brain.method_1292(param1);
               }
            }
         }
      }
      
      public function method_886(param1:Entity) : void
      {
         --this.playersInRoom;
         if(!this.playersInRoom)
         {
            this.var_2335 = this.var_1.mTimeThisTick;
         }
      }
      
      public function method_1722(param1:Entity, param2:String) : void
      {
         if(param2)
         {
            param1.StartSkit(param2,false,param1.brain ? param1.brain.mostHatedEnt : null);
         }
      }
      
      public function method_1845(param1:String) : void
      {
         var _loc2_:Entity = null;
         if(!param1)
         {
            return;
         }
         for each(_loc2_ in this.var_1.entities)
         {
            if(_loc2_.var_20 & Entity.PLAYER)
            {
               if(_loc2_.currRoom == this)
               {
                  this.var_1.linkUpdater.method_1129(_loc2_.id,param1);
               }
            }
         }
      }
      
      public function method_275() : void
      {
         this.method_1097();
         this.var_2261 = this.method_348();
         this.bInitialized = true;
      }
      
      public function method_2138(param1:a_Cue) : String
      {
         if(!param1.name.indexOf("am_"))
         {
            return param1.name;
         }
         return getQualifiedClassName(param1);
      }
      
      public function method_1027() : void
      {
         var _loc1_:Entity = null;
         var _loc2_:CutScene = null;
         var _loc3_:Entity = null;
         if(this.var_2411)
         {
            this.var_2364 = 0;
            this.var_1166 = this.var_1.mTimeThisTick;
            this.var_1978 = this.var_1672;
            this.var_1672 = null;
            this.var_2411 = false;
         }
         if(this.var_1978 != null)
         {
            this.var_1978(this.var_122);
            this.var_2364 = this.HookGetTime();
            this.var_2459 = this.mRoomTick;
         }
         ++this.mRoomTick;
         for each(_loc1_ in this.var_229)
         {
            if(!_loc1_.var_2410)
            {
               _loc1_.var_2276 = _loc1_.currHP;
            }
            else
            {
               _loc1_.var_2410 = false;
            }
         }
         if(this.var_241)
         {
            this.var_241.method_1981();
         }
         if(this.var_235)
         {
            this.var_235.method_761();
         }
         if(this.var_473)
         {
            for each(_loc2_ in this.var_473)
            {
               _loc2_.method_761();
            }
         }
         if(Boolean(this.var_122) && !this.var_241)
         {
            if(this.var_122.bBossFightBeginsOnRoomClear && !this.method_348())
            {
               this.method_307();
            }
            else if(this.var_122.bossFightBeginsWhenThisGuyIsDead != null)
            {
               _loc3_ = this.method_35(this.var_122.bossFightBeginsWhenThisGuyIsDead);
               if(!_loc3_ || _loc3_.entState == Entity.const_6)
               {
                  this.method_307();
               }
            }
         }
         if(this.var_2864)
         {
            this.method_1969();
         }
         else if(this.var_323 == "WaveBoss" || this.var_323 == "WaveBasic")
         {
            this.method_1584();
         }
         else
         {
            this.method_695();
         }
      }
      
      public function method_79(param1:String) : void
      {
         this.var_409[param1] = this.mRoomTick;
      }
      
      public function method_348() : uint
      {
         var _loc2_:Entity = null;
         var _loc1_:uint = 0;
         for each(_loc2_ in this.var_229)
         {
            if(_loc2_.entState != Entity.const_6 && !_loc2_.behaviorType.var_53)
            {
               _loc1_++;
            }
         }
         return _loc1_;
      }
      
      public function method_1990() : uint
      {
         var _loc2_:Entity = null;
         var _loc1_:uint = 0;
         for each(_loc2_ in this.var_229)
         {
            if(_loc2_.entState != Entity.const_6 && !_loc2_.behaviorType.var_53)
            {
               _loc1_ += uint(const_141[_loc2_.entType.var_138]);
            }
         }
         return _loc1_;
      }
      
      public function method_1264() : Number
      {
         var _loc1_:uint = 0;
         var _loc2_:uint = 0;
         if(this.var_1 && this.var_1.level && (this.var_1.level.internalName == "TutorialDungeon" || this.var_1.level.internalName == "GoblinRiverDungeon" || this.var_1.level.internalName == "GoblinRiverDungeonHard"))
         {
            _loc1_ = this.method_348();
            if(_loc1_ > this.var_2261)
            {
               this.var_2261 = _loc1_;
            }
            _loc2_ = this.method_1990();
            if(_loc2_ > this.var_802)
            {
               this.var_802 = _loc2_;
            }
         }
         if(!this.var_2261)
         {
            if(!this.var_2261)
            {
               return 1;
            }
         }
         if(Boolean(this.var_2261) && !this.var_802)
         {
            return 0;
         }
         if(!this.var_802)
         {
            return 1;
         }
         _loc2_ = this.method_1990();
         if(_loc2_ >= this.var_802)
         {
            return 0;
         }
         if(this.var_1217 > this.var_802)
         {
            this.var_1217 = this.var_802;
         }
         return 1 - (_loc2_ + this.var_1217) / this.var_802;
      }
      
      public function method_1147(param1:String, param2:String, param3:String) : void
      {
         if(param1 == "SetDynamicCollision")
         {
            this.SetDynamicCollision(param2,param3 == "On");
         }
         else if(param1 == "SetDoorState")
         {
            var _loc4_:Door = this.var_1.level.method_1462(param2);
            if(_loc4_)
            {
               _loc4_.bDisabled = param3 != "On";
            }
         }
         else if(param1 == "SetTutorialState")
         {
            if(param3 == "On")
            {
               this.var_1.var_655.method_290(param2);
            }
            else
            {
               this.var_1.var_655.method_187(param2);
            }
         }
         else if(param1 == "SetEntityAnimation")
         {
            var _loc5_:Entity = this.var_1.GetEntFromID(int(param2));
            if(Boolean(_loc5_) && _loc5_.entState != Entity.const_6)
            {
               _loc5_.gfx.m_Seq.method_34(Seq.C_USEPOWER,param3,true);
            }
         }
      }
      
      public function method_35(param1:String) : Entity
      {
         var _loc2_:Entity = null;
         for each(_loc2_ in this.var_229)
         {
            if(_loc2_.cue.name == param1)
            {
               return _loc2_;
            }
         }
         return null;
      }
      
      public function method_851(param1:String) : a_Cue
      {
         var _loc2_:a_Cue = null;
         for each(_loc2_ in this.var_460)
         {
            if(_loc2_.name == param1)
            {
               return _loc2_;
            }
         }
         return null;
      }
      
      public function method_691(param1:String) : a_Group
      {
         var _loc2_:a_Group = null;
         for each(_loc2_ in this.var_1159)
         {
            if(_loc2_.mGroupName == param1)
            {
               return _loc2_;
            }
         }
         return null;
      }
      
      public function method_695() : void
      {
         if(!this.var_584 && !this.method_348() && (!this.var_241 || !this.var_241.var_1434))
         {
            this.var_584 = true;
            this.var_1440 = this.var_1.mTimeThisTick;
            this.method_1107("ToAdvance");
         }
      }
      
      public function method_1107(param1:String) : void
      {
         this.var_1.level.method_112(this.var_113,"SetDynamicCollision","am_DynamicCollision_" + param1,"Off");
         var _loc2_:Entity = this.method_35("am_" + param1);
         if(Boolean(_loc2_) && _loc2_.entState != Entity.const_6)
         {
            this.var_1.level.method_112(this.var_113,"SetEntityAnimation",_loc2_.id.toString(),"Open");
         }
      }
      
      public function RoomAggro(param1:Entity) : void
      {
         var _loc2_:Entity = null;
         for each(_loc2_ in this.var_229)
         {
            if(_loc2_.brain)
            {
               _loc2_.brain.AddHate(param1,0,false);
            }
         }
      }
      
      public function method_2111(param1:String) : void
      {
         this.var_1.level.method_112(this.var_113,"SetDynamicCollision","am_DynamicCollision_" + param1,"On");
         var _loc2_:Entity = this.method_35("am_" + param1);
         if(Boolean(_loc2_) && _loc2_.entState != Entity.const_6)
         {
            this.var_1.level.method_112(this.var_113,"SetEntityAnimation",_loc2_.id.toString(),"Ready");
         }
      }
      
      public function method_562(param1:String, param2:Number) : void
      {
         var _loc3_:Entity = this.var_1.clientEnt;
         if(!_loc3_ || _loc3_.currRoom != this)
         {
            return;
         }
         SoundManager.Play(param1,param2);
      }
      
      public function method_526(param1:String, param2:String, param3:Boolean) : void
      {
         var _loc4_:SuperAnimInstance = this.method_67(param1);
         if(_loc4_)
         {
            _loc4_.m_Seq.method_34(Seq.C_EMOTE,param2,param3);
         }
      }
      
      public function method_67(param1:String) : SuperAnimInstance
      {
         var _loc2_:class_147 = null;
         for each(_loc2_ in this.var_1530)
         {
            if(_loc2_.var_2609 == param1)
            {
               return _loc2_.superAnim;
            }
         }
         return null;
      }
      
      public function method_237(param1:uint) : void
      {
         var _loc2_:Entity = this.var_1.clientEnt;
         if(Boolean(_loc2_) && _loc2_.currRoom == this && Boolean(_loc2_.var_24))
         {
            _loc2_.var_24.var_418.method_237("",param1);
         }
      }
      
      public function method_572(param1:Boolean) : void
      {
         this.var_1052 = true;
         this.var_1417 = param1;
      }
      
      public function method_752() : void
      {
         this.var_1052 = false;
         this.var_1417 = false;
         this.var_1207 = const_243;
      }
      
      public function method_903(param1:uint, param2:String, param3:uint, param4:String) : void
      {
         this.var_1925 = true;
         this.var_1047 = param1;
         this.var_1358 = param2;
         this.var_1377 = param3;
         this.var_2199 = param4;
      }
      
      public function method_935(param1:uint, param2:String, param3:uint, param4:String) : void
      {
         if(param1)
         {
            this.var_1047 = param1;
            this.var_1358 = param2;
         }
         if(param3)
         {
            this.var_1377 = param3;
            this.var_2199 = param4;
         }
      }
      
      public function method_876() : void
      {
         this.var_1925 = false;
      }
      
      public function method_1647() : void
      {
         var _loc8_:uint = 0;
         var _loc9_:Sprite = null;
         var _loc10_:Sprite = null;
         var _loc11_:SuperAnimInstance = null;
         var _loc12_:SuperAnimInstance = null;
         var _loc13_:String = null;
         var _loc14_:uint = 0;
         var _loc15_:Sprite = null;
         var _loc16_:uint = 0;
         var _loc17_:SuperAnimInstance = null;
         var _loc18_:Number = NaN;
         var _loc19_:SuperAnimInstance = null;
         var _loc20_:String = null;
         var _loc21_:SuperAnimInstance = null;
         var _loc22_:Sprite = null;
         var _loc23_:Number = NaN;
         var _loc24_:String = null;
         var _loc25_:SuperAnimInstance = null;
         var _loc26_:SuperAnimInstance = null;
         var _loc27_:uint = 0;
         var _loc28_:uint = 0;
         var _loc29_:uint = 0;
         var _loc30_:Number = NaN;
         if(!this.var_63.bBoatInit)
         {
            _loc8_ = 1;
            while(_loc8_ <= 14)
            {
               _loc13_ = "am_WaveFG" + _loc8_;
               _loc14_ = 2000 + Math.random() * 2000;
               _loc15_ = this.method_67(_loc13_).m_TheDO;
               this.var_63[_loc13_ + "OrigY"] = _loc15_.y;
               this.var_63[_loc13_ + "Cycle"] = _loc14_;
               this.var_63[_loc13_ + "Time"] = this.var_1.mTimeThisTick;
               _loc8_++;
            }
            _loc9_ = this.method_67("am_PlayerBoat").m_TheDO;
            _loc10_ = this.method_67("am_PlayerBoatFront").m_TheDO;
            this.var_63["PlayerBoatOrigY"] = _loc9_.y;
            this.var_63["PlayerBoatFrontOrigY"] = _loc10_.y;
            _loc11_ = this.method_67("am_WaveBGLEFT");
            this.var_63["WAVELEFT"] = _loc11_.m_TheDO.x;
            _loc12_ = this.method_67("am_CloudLEFT");
            this.var_63["CLOUDLEFT"] = _loc12_.m_TheDO.x;
            this.var_63.bBoatInit = true;
         }
         var _loc1_:Boolean = false;
         var _loc2_:uint = this.var_1.mTimeThisTick;
         var _loc3_:uint = uint(this.var_63.boatFightLightFlash);
         if(_loc2_ >= _loc3_)
         {
            _loc16_ = 1;
            while(_loc16_ <= 11)
            {
               _loc19_ = this.method_67("am_Cloud" + _loc16_);
               if(_loc19_)
               {
                  _loc19_.m_Seq.method_34(Seq.C_EMOTE,"Lightning",false);
               }
               _loc16_++;
            }
            _loc17_ = null;
            _loc18_ = Math.random();
            if(_loc18_ <= 0.1)
            {
               _loc17_ = this.method_67("am_Lightning1");
            }
            else if(_loc18_ <= 0.2)
            {
               _loc17_ = this.method_67("am_Lightning2");
            }
            else if(_loc18_ <= 0.3)
            {
               _loc17_ = this.method_67("am_Lightning3");
            }
            if(_loc17_)
            {
               _loc17_.m_Seq.method_34(Seq.C_EMOTE,"Lightning",false);
               SoundManager.Play("FXP_Thunder1",0.6);
            }
            this.var_63.boatFightLightFlash = _loc2_ + Math.random() * 2000 + 3000;
            _loc1_ = true;
         }
         var _loc4_:uint = 1;
         while(_loc4_ <= 4)
         {
            _loc20_ = "am_Cloud" + _loc4_;
            _loc21_ = this.method_67(_loc20_);
            _loc22_ = _loc21_.m_TheDO;
            _loc22_.x -= 1 * this.var_1.TIMESTEP;
            _loc23_ = Number(this.var_63["CLOUDLEFT"]);
            if(_loc22_.x < _loc23_)
            {
               _loc24_ = "am_Cloud" + (_loc4_ == 1 ? 4 : _loc4_ - 1);
               _loc25_ = this.method_67(_loc24_);
               _loc22_.x = _loc25_.m_TheDO.x + 600 + Math.random() * 200;
            }
            _loc4_++;
         }
         _loc8_ = 1;
         while(_loc8_ <= 14)
         {
            _loc13_ = "am_WaveFG" + _loc8_;
            _loc14_ = uint(this.var_63[_loc13_ + "Cycle"]);
            _loc26_ = this.method_67(_loc13_);
            _loc15_ = _loc26_.m_TheDO;
            _loc27_ = uint(this.var_63[_loc13_ + "OrigY"]);
            _loc28_ = (_loc2_ - this.var_63[_loc13_ + "Time"]) % _loc14_;
            _loc29_ = _loc14_ / 2;
            _loc15_.y = _loc27_ + 0.4 * (0.5 + Math.sin(Math.PI * (_loc28_ - _loc29_) / _loc29_));
            _loc15_.x -= 8 * this.var_1.TIMESTEP;
            _loc30_ = Number(this.var_63["WAVELEFT"]);
            if(_loc15_.x < _loc30_)
            {
               var _loc33_:String = "am_WaveFG" + (_loc8_ == 1 ? 14 : _loc8_ - 1);
               var _loc34_:SuperAnimInstance = this.method_67(_loc33_);
               _loc15_.x = _loc34_.m_TheDO.x + 200 + Math.random() * 200;
            }
            if(_loc1_)
            {
               _loc26_.m_Seq.method_34(Seq.C_EMOTE,"Lightning",false);
            }
            _loc8_++;
         }
         var _loc5_:Number = this.var_1.var_776;
         var _loc6_:Sprite = this.method_67("am_PlayerBoat").m_TheDO;
         var _loc7_:Sprite = this.method_67("am_PlayerBoatFront").m_TheDO;
         _loc6_.y = this.var_63["PlayerBoatOrigY"] + _loc5_;
         _loc7_.y = this.var_63["PlayerBoatFrontOrigY"] + _loc5_;
      }
      
      public function method_1584() : void
      {
         var _loc2_:String = null;
         var _loc3_:Number = NaN;
         var _loc1_:Entity = this.method_35("am_WaveBoss");
         if(Boolean(_loc1_) && _loc1_.entState != Entity.const_399)
         {
            _loc2_ = null;
            _loc3_ = _loc1_.currHP / _loc1_.maxHP;
            if(_loc3_ <= 1 && !this.var_63["bossWaveOne"])
            {
               this.method_239("am_WaveOne");
               this.var_63["bossWaveOne"] = true;
            }
            if(_loc3_ <= 0.67 && !this.var_63["bossWaveTwo"])
            {
               this.method_239("am_WaveTwo");
               this.var_63["bossWaveTwo"] = true;
            }
            if(_loc3_ <= 0.33 && !this.var_63["bossWaveThree"])
            {
               this.method_239("am_WaveThree");
               this.var_63["bossWaveThree"] = true;
            }
            if(_loc1_.entState == Entity.const_6 && !this.var_63["bossWaveFour"])
            {
               this.method_239("am_WaveFour");
               this.var_63["bossWaveFour"] = true;
            }
         }
         this.method_695();
      }
      
      private function method_1618(param1:a_Cue, param2:a_Cue) : int
      {
         return param1.x - param2.x;
      }
      
      public function method_1874() : void
      {
         var _loc2_:* = 0;
         var _loc3_:a_Cue = null;
         var _loc4_:EntType = null;
         var _loc5_:BehaviorType = null;
         var _loc1_:Vector.<a_Cue> = this.var_460.concat();
         _loc1_.sort(this.method_1618);
         _loc2_ = int(_loc1_.length - 1);
         while(_loc2_ >= 0)
         {
            _loc3_ = _loc1_[_loc2_];
            _loc4_ = _loc3_.entType ? EntType.method_48(_loc3_.entType) : null;
            _loc5_ = _loc4_ ? BehaviorType.method_367(_loc4_.var_562) : null;
            if(!_loc5_ || _loc5_.var_53)
            {
               _loc1_.splice(_loc2_,1);
            }
            _loc2_--;
         }
         var _loc6_:int = 1;
         var _loc8_:int = int(_loc1_.length);
         _loc2_ = 0;
         while(_loc2_ < _loc8_)
         {
            _loc3_ = _loc1_[_loc2_];
            _loc3_.aggroTeamID = _loc6_;
            if(_loc2_ + 1 < _loc8_)
            {
               var _loc7_:a_Cue = _loc1_[_loc2_ + 1];
               if(_loc7_.x - _loc3_.x > const_1046)
               {
                  _loc6_++;
               }
            }
            _loc2_++;
         }
      }
      
      public function method_1969() : void
      {
         var _loc2_:uint = 0;
         var _loc1_:uint = this.var_1.mTimeThisTick;
         if(this.var_584)
         {
            if(_loc1_ - this.var_1440 >= Entity.TIME_MONSTER_LAYS_DEAD_BEFORE_VANISHING)
            {
               if(Boolean(this.playersInRoom) && _loc1_ - this.var_1440 >= const_977 || !this.playersInRoom && _loc1_ - this.var_2335 >= const_1117)
               {
                  this.method_1872();
               }
            }
         }
         else
         {
            _loc2_ = this.method_348();
            if(!_loc2_)
            {
               this.var_584 = true;
               this.var_1440 = _loc1_;
            }
         }
      }
      
      public function SetDynamicCollision(param1:String, param2:Boolean) : void
      {
         var _loc4_:int = 0;
         var _loc6_:Entity = null;
         var _loc7_:int = 0;
         var _loc3_:Array = this.var_1276[param1];
         if(!_loc3_)
         {
            return;
         }
         var _loc5_:int = int(_loc3_.length);
         _loc4_ = 0;
         while(_loc4_ < _loc5_)
         {
            _loc3_[_loc4_].bDisabled = !param2;
            _loc4_++;
         }
         if(this.var_1.entities)
         {
            _loc7_ = int(this.var_1.entities.length);
            _loc4_ = 0;
            while(_loc4_ < _loc7_)
            {
               _loc6_ = this.var_1.entities[_loc4_];
               if(_loc6_.currRoom == this)
               {
                  _loc6_.var_1460 = true;
               }
               _loc4_++;
            }
         }
      }
      
      public function method_307() : void
      {
         if(!this.var_1118)
         {
            this.method_547();
         }
         if(!this.var_241)
         {
            this.var_241 = new BossFight(this.var_1,this);
         }
         this.var_241.method_1508();
      }
      
      public function method_465(param1:Array) : void
      {
         if(!this.var_235)
         {
            this.var_235 = new CutScene(this.var_1,this);
         }
         this.var_235.method_441(param1,false);
      }
      
      public function method_1762(param1:Array) : void
      {
         if(!this.var_235)
         {
            this.var_235 = new CutScene(this.var_1,this);
         }
         this.var_235.method_441(param1,false,true);
         this.var_1417 = true;
      }
      
      public function method_744(param1:Array) : void
      {
         var _loc3_:CutScene = null;
         if(!this.var_473)
         {
            this.var_473 = new Vector.<CutScene>();
         }
         var _loc2_:CutScene = null;
         for each(_loc3_ in this.var_473)
         {
            if(_loc3_.var_631 == param1)
            {
               _loc2_ = _loc3_;
               break;
            }
         }
         if(!_loc2_)
         {
            _loc2_ = new CutScene(this.var_1,this);
         }
         _loc2_.method_441(param1,true);
         this.var_473.push(_loc2_);
      }
      
      public function HookAnimate(param1:String, param2:String, param3:Boolean) : void
      {
         this.method_526(param1,param2,param3);
         this.var_1.linkUpdater.method_1483(this.var_113,param1,param2,param3);
      }
      
      public function HookPlaySound(param1:String, param2:Number) : void
      {
         this.method_562(param1,param2);
         this.var_1.linkUpdater.method_1065(this.var_113,param1,param2);
      }
      
      public function HookAmbush(param1:String) : void
      {
         if(!this.var_63[param1])
         {
            this.var_63[param1] = true;
            this.method_239(param1);
         }
      }
      
      public function HookSetVar(param1:String, param2:String) : void
      {
         if(this.var_1.var_1280)
         {
            this.var_1.var_1280[param1] = param2;
         }
      }
      
      public function HookGetVar(param1:String) : String
      {
         if(this.var_1.var_1280)
         {
            return this.var_1.var_1280[param1];
         }
         return null;
      }
      
      public function HookCollisionOn(param1:String) : void
      {
         this.var_1.level.method_112(this.var_113,"SetDynamicCollision",param1,"On");
      }
      
      public function HookCollisionOff(param1:String) : void
      {
         this.var_1.level.method_112(this.var_113,"SetDynamicCollision",param1,"Off");
      }
      
      public function HookPlayScript(param1:Array) : void
      {
         this.method_744(param1);
      }
      
      public function HookPlayCutScene(param1:Array) : void
      {
         this.method_465(param1);
      }
      
      private function method_157(param1:uint) : Boolean
      {
         return param1 > this.var_2459 && param1 <= this.mRoomTick;
      }
      
      public function HookOnTrigger(param1:String) : Boolean
      {
         var _loc2_:uint = uint(this.var_409[param1]);
         if(this.method_157(_loc2_))
         {
            return true;
         }
         return false;
      }
      
      public function HookOnEnterVolume(param1:String) : Boolean
      {
         var _loc2_:uint = uint(this.var_409["EnterVolume^" + param1]);
         if(this.method_157(_loc2_))
         {
            return true;
         }
         return false;
      }
      
      public function HookOnExitVolume(param1:String) : Boolean
      {
         var _loc2_:uint = uint(this.var_409["ExitVolume^" + param1]);
         if(this.method_157(_loc2_))
         {
            return true;
         }
         return false;
      }
      
      public function HookRoomCleared() : Boolean
      {
         return this.var_584;
      }
      
      public function HookGetGroup(param1:MovieClip, param2:uint = 0, param3:Boolean = true) : a_Group
      {
         var _loc4_:a_Group = this.method_691(param1.name);
         if(_loc4_)
         {
            if(param3)
            {
               _loc4_.Choose(param2);
            }
            return _loc4_;
         }
         if(param2 == 0)
         {
            _loc4_ = new a_Group(param1.name,this);
            this.var_1159.push(_loc4_);
            return _loc4_;
         }
         const_795.mRoom = this;
         return const_795;
      }
      
      public function HookEnableDoor(param1:MovieClip) : void
      {
         var _loc2_:String = param1.name;
         this.var_1.level.method_112(this.var_113,"SetDoorState",_loc2_,"On");
      }
      
      public function HookDisableDoor(param1:MovieClip) : void
      {
         var _loc2_:String = param1.name;
         this.var_1.level.method_112(this.var_113,"SetDoorState",_loc2_,"Off");
      }
      
      public function HookShowTutorial(param1:String) : void
      {
         this.var_1.level.method_112(this.var_113,"SetTutorialState",param1,"On");
      }
      
      public function HookHideTutorial(param1:String) : void
      {
         this.var_1.level.method_112(this.var_113,"SetTutorialState",param1,"Off");
      }
      
      public function HookCancelScript(param1:Array) : void
      {
         var _loc2_:CutScene = null;
         for each(_loc2_ in this.var_473)
         {
            if(_loc2_.var_631 == param1)
            {
               _loc2_.method_502();
            }
         }
      }
      
      public function HookOnScriptFinish(param1:Array) : Boolean
      {
         var _loc2_:CutScene = null;
         for each(_loc2_ in this.var_473)
         {
            if(_loc2_.var_631 == param1)
            {
               if(this.method_157(_loc2_.var_1697))
               {
                  return true;
               }
               return false;
            }
         }
         if(Boolean(this.var_235) && this.var_235.var_631 == param1)
         {
            if(this.method_157(this.var_235.var_1697))
            {
               return true;
            }
            return false;
         }
         return false;
      }
      
      public function HookOnEmote(param1:String) : Boolean
      {
         var _loc2_:uint = param1 ? uint(this.var_409["Emote^" + param1.toUpperCase()]) : uint(this.var_409["Emote^Any"]);
         if(this.method_157(_loc2_))
         {
            return true;
         }
         return false;
      }
      
      public function HookOnChat(param1:String) : Boolean
      {
         var _loc2_:uint = param1 ? uint(this.var_409["Chat^" + param1.toUpperCase()]) : uint(this.var_409["Chat^Any"]);
         if(this.method_157(_loc2_))
         {
            return true;
         }
         return false;
      }
      
      public function HookActiveEmote(param1:String) : Boolean
      {
         var _loc2_:String = null;
         var _loc3_:Entity = null;
         for each(_loc3_ in this.var_1.entities)
         {
            if(_loc3_.var_20 & Entity.PLAYER)
            {
               _loc2_ = _loc3_.currEmote;
               if(Boolean(_loc2_) && (!param1 || _loc2_.toUpperCase() == param1.toUpperCase()))
               {
                  return true;
               }
            }
         }
         return false;
      }
      
      public function HookActiveChat(param1:String) : Boolean
      {
         var _loc2_:String = null;
         var _loc3_:ChatBubble = null;
         var _loc4_:MovieClip = null;
         var _loc5_:Entity = null;
         for each(_loc5_ in this.var_1.entities)
         {
            if(_loc5_.var_20 & Entity.PLAYER)
            {
               _loc3_ = _loc5_.var_386;
               _loc4_ = _loc3_.var_34;
               if(!(!_loc4_ || !_loc4_.visible))
               {
                  _loc2_ = _loc3_.var_1490;
                  if(Boolean(_loc2_) && (!param1 || _loc2_.toUpperCase() == param1.toUpperCase()))
                  {
                     return true;
                  }
               }
            }
         }
         return false;
      }
      
      public function HookTrace(param1:String) : void
      {
      }
      
      public function GetTarget() : Entity
      {
         var _loc2_:Entity = null;
         var _loc3_:uint = 0;
         var _loc4_:uint = 0;
         var _loc1_:Vector.<Entity> = new Vector.<Entity>();
         for each(_loc2_ in this.var_1.entities)
         {
            if(Boolean(_loc2_.var_20 & Entity.PLAYER) && _loc2_.entState != Entity.const_6 && _loc2_.currRoom == this)
            {
               _loc1_.push(_loc2_);
            }
         }
         _loc3_ = _loc1_.length;
         if(_loc3_)
         {
            _loc4_ = Math.random() * _loc3_;
            return _loc1_[_loc4_];
         }
         return null;
      }
      
      public function CueKillAllMonsters() : void
      {
         var _loc2_:Entity = null;
         var _loc3_:int = 0;
         var _loc4_:Packet = null;
         var _loc1_:Vector.<Entity> = this.var_1.entities;
         for each(_loc2_ in _loc1_)
         {
            if(Boolean(_loc2_) && _loc2_.currRoom == this && method_940(_loc2_))
            {
               _loc3_ = _loc2_.currHP;
               if(_loc2_.brain)
               {
                  _loc2_.brain.var_792 = new Dictionary();
               }
               _loc2_.TakeDamage(_loc3_,true);
               _loc4_ = new Packet(LinkUpdater.PKTTYPE_CHAR_REGEN);
               _loc4_.method_9(_loc2_.id);
               _loc4_.method_24(-_loc3_);
               this.var_1.serverConn.SendPacket(_loc4_);
               if(Boolean(_loc2_.cue) && !_loc2_.behaviorType.var_53)
               {
                  this.var_1217 += uint(const_141[_loc2_.entType.var_138]);
               }
            }
         }
      }
      
      public function CueHookSkit(param1:a_Cue, param2:String) : void
      {
         if(!param2)
         {
            return;
         }
         var _loc3_:Entity = this.method_35(param1.name);
         if(_loc3_)
         {
            _loc3_.StartSkit(param2,false,this.GetTarget());
         }
      }
      
      public function CueHookActivate(param1:a_Cue) : void
      {
         var _loc2_:Entity = this.method_35(param1.name);
         var _loc3_:Entity = this.GetTarget();
         if(Boolean(_loc2_) && Boolean(_loc2_.brain) && Boolean(_loc3_))
         {
            _loc2_.brain.AddHate(_loc3_,0,false);
         }
      }
      
      private function method_825(param1:a_Cue, param2:Entity) : void
      {
         var _loc3_:Entity = this.method_35(param1.name);
         if(!_loc3_ || !_loc3_.brain)
         {
            return;
         }
         _loc3_.brain.bDeepSleep = false;
         if(!param2)
         {
            param2 = this.GetTarget();
         }
         if(param2)
         {
            _loc3_.brain.AddHate(param2,0,false);
         }
      }
      
      public function CueHookAggro(param1:a_Cue) : void
      {
         this.method_825(param1,null);
      }
      
      public function CueListHookGroupAggro(param1:Vector.<a_Cue>, param2:uint) : void
      {
         var _loc3_:Entity = this.GetTarget();
         if(!_loc3_)
         {
            return;
         }
         var _loc4_:uint = 0;
         while(_loc4_ < param2)
         {
            this.method_825(param1[_loc4_],_loc3_);
            _loc4_++;
         }
      }
      
      public function CueHookSleep(param1:a_Cue) : void
      {
         var _loc2_:Entity = this.method_35(param1.name);
         if(Boolean(_loc2_) && Boolean(_loc2_.brain))
         {
            _loc2_.brain.bDeepSleep = false;
            _loc2_.brain.ClearHateList();
         }
      }
      
      public function CueHookDeepSleep(param1:a_Cue) : void
      {
         var _loc2_:Entity = this.method_35(param1.name);
         if(Boolean(_loc2_) && Boolean(_loc2_.brain))
         {
            _loc2_.brain.bDeepSleep = true;
            _loc2_.brain.ClearHateList();
         }
      }
      
      public function CueHookClearHate(param1:a_Cue) : void
      {
         var _loc2_:Entity = this.method_35(param1.name);
         if(Boolean(_loc2_) && Boolean(_loc2_.brain))
         {
            _loc2_.brain.ClearHateList();
         }
      }
      
      public function CueHookSpawn(param1:a_Cue) : void
      {
         this.SpawnCue(param1);
      }
      
      public function CueHookRemove(param1:a_Cue) : void
      {
         this.RemoveCue(param1);
      }
      
      public function HookAtStart() : Boolean
      {
         if(this.var_1166 == this.var_1.mTimeThisTick)
         {
            return true;
         }
         return false;
      }
      
      public function HookAtTime(param1:uint) : Boolean
      {
         var _loc2_:uint = this.var_1.mTimeThisTick;
         var _loc3_:uint = this.var_1166 + param1;
         if(_loc2_ == _loc3_)
         {
            return true;
         }
         var _loc4_:uint = this.var_1166 + this.var_2364;
         if(_loc3_ > _loc4_ && _loc3_ < _loc2_)
         {
            return true;
         }
         return false;
      }
      
      public function HookAtTimeRepeat(param1:uint, param2:uint) : Boolean
      {
         var _loc3_:uint = this.var_1.mTimeThisTick - this.var_1166;
         if(_loc3_ < param2)
         {
            return false;
         }
         var _loc4_:uint = _loc3_ - param2;
         var _loc5_:uint = uint(_loc4_ / param1);
         var _loc6_:uint = param2 + param1 * _loc5_;
         if(this.HookAtTime(_loc6_))
         {
            return true;
         }
         return false;
      }
      
      public function HookGetTime() : uint
      {
         return this.var_1.mTimeThisTick - this.var_1166;
      }
      
      public function HookSetPhase(param1:Function) : void
      {
         this.var_1672 = param1;
         this.var_2411 = true;
      }
      
      public function CueHookAddPowers(param1:a_Cue, param2:Array) : void
      {
         var _loc4_:String = null;
         var _loc3_:Entity = this.method_35(param1.name);
         if(!_loc3_)
         {
            return;
         }
         for(_loc4_ in param2)
         {
            _loc3_.method_1350(_loc4_);
         }
      }
      
      public function CueHookRemovePowers(param1:a_Cue, param2:Array) : void
      {
         var _loc4_:String = null;
         var _loc3_:Entity = this.method_35(param1.name);
         if(!_loc3_)
         {
            return;
         }
         for(_loc4_ in param2)
         {
            _loc3_.method_1437(_loc4_);
         }
      }
      
      public function CueHookSetPowers(param1:a_Cue, param2:Array) : void
      {
         var _loc3_:Entity = this.method_35(param1.name);
         if(_loc3_)
         {
            _loc3_.method_822(param2);
         }
      }
      
      public function CueHookResetPowers(param1:a_Cue) : void
      {
         var _loc2_:Entity = this.method_35(param1.name);
         if(_loc2_)
         {
            _loc2_.method_1587();
         }
      }
      
      public function CueHookSetMelee(param1:a_Cue, param2:String) : void
      {
         var _loc3_:Entity = this.method_35(param1.name);
         if(_loc3_)
         {
            _loc3_.method_1400(param2);
         }
      }
      
      public function CueHookSetRanged(param1:a_Cue, param2:String) : void
      {
         var _loc3_:Entity = this.method_35(param1.name);
         if(_loc3_)
         {
            _loc3_.method_1254(param2);
         }
      }
      
      public function CueHookSetAnimation(param1:a_Cue, param2:String) : void
      {
         var _loc3_:Entity = this.method_35(param1.name);
         if(_loc3_)
         {
            this.var_1.level.method_112(this.var_113,"SetEntityAnimation",_loc3_.id,param2);
         }
      }
      
      public function CueHookQuickFirePower(param1:a_Cue, param2:String, param3:String) : void
      {
         var _loc6_:Point = null;
         var _loc4_:Entity = this.method_35(param1.name);
         var _loc5_:PowerType = class_14.powerTypesDict[param2];
         if(Boolean(_loc4_) && Boolean(_loc5_))
         {
            _loc6_ = param3 ? _loc4_.method_279(param3) : null;
            if(Boolean(_loc6_) && Boolean(_loc4_.brain))
            {
               _loc4_.brain.method_419(_loc6_);
            }
            _loc4_.combatState.method_678(_loc5_);
         }
      }
      
      public function CueHookFirePower(param1:a_Cue, param2:String, param3:String) : void
      {
         var _loc6_:Point = null;
         var _loc4_:Entity = this.method_35(param1.name);
         var _loc5_:PowerType = class_14.powerTypesDict[param2];
         if(Boolean(_loc4_) && Boolean(_loc5_))
         {
            _loc6_ = param3 ? _loc4_.method_279(param3) : null;
            if(Boolean(_loc6_) && Boolean(_loc4_.brain))
            {
               _loc4_.brain.method_419(_loc6_);
            }
            _loc4_.combatState.method_51(_loc5_,false);
         }
      }
      
      public function CueHookDelayFirePower(param1:a_Cue, param2:String, param3:uint, param4:String) : void
      {
         var _loc7_:Point = null;
         var _loc5_:Entity = this.method_35(param1.name);
         var _loc6_:PowerType = class_14.powerTypesDict[param2];
         if(Boolean(_loc5_) && Boolean(_loc6_))
         {
            _loc7_ = param4 ? _loc5_.method_279(param4) : null;
            if(Boolean(_loc7_) && Boolean(_loc5_.brain))
            {
               _loc5_.brain.method_419(_loc7_);
            }
            _loc5_.combatState.method_51(_loc6_,false,param3);
         }
      }
      
      public function CueHookRevive(param1:a_Cue) : void
      {
         var _loc2_:Entity = this.method_35(param1.name);
         if(!_loc2_)
         {
            return;
         }
         var _loc3_:int = _loc2_.maxHP - _loc2_.currHP;
         if(_loc3_ <= 0)
         {
            return;
         }
         _loc2_.TakeDamage(-_loc3_,true);
         var _loc4_:Packet = new Packet(LinkUpdater.PKTTYPE_CHAR_REGEN);
         _loc4_.method_9(_loc2_.id);
         _loc4_.method_24(_loc3_);
         this.var_1.serverConn.SendPacket(_loc4_);
      }
      
      public function CueHookKill(param1:a_Cue) : void
      {
         var _loc2_:Entity = this.method_35(param1.name);
         if(!_loc2_)
         {
            return;
         }
         var _loc3_:int = _loc2_.currHP;
         if(!_loc3_)
         {
            return;
         }
         _loc2_.TakeDamage(_loc3_,true);
         var _loc4_:Packet = new Packet(LinkUpdater.PKTTYPE_CHAR_REGEN);
         _loc4_.method_9(_loc2_.id);
         _loc4_.method_24(-_loc3_);
         this.var_1.serverConn.SendPacket(_loc4_);
      }
      
      public function CueHookAddBuff(param1:a_Cue, param2:String) : void
      {
         var _loc5_:uint = 0;
         var _loc3_:Entity = this.method_35(param1.name);
         var _loc4_:BuffType = class_14.buffTypesDict[param2];
         if(Boolean(_loc3_) && Boolean(_loc3_.combatState) && Boolean(_loc4_))
         {
            _loc5_ = _loc3_.magicDamage ? uint(_loc3_.magicDamage) : uint(_loc3_.meleeDamage);
            _loc3_.combatState.AddBuff(_loc4_,_loc3_,_loc5_,0);
         }
      }
      
      public function CueHookRemoveAllBuffs(param1:a_Cue) : void
      {
         var _loc2_:Entity = this.method_35(param1.name);
         if(Boolean(_loc2_) && Boolean(_loc2_.combatState))
         {
            _loc2_.combatState.RemoveAllBuffs();
         }
      }
      
      public function CueHookRemoveBuff(param1:a_Cue, param2:String) : void
      {
         var _loc3_:Entity = this.method_35(param1.name);
         var _loc4_:BuffType = class_14.buffTypesDict[param2];
         if(Boolean(_loc3_) && Boolean(_loc3_.combatState) && Boolean(_loc4_))
         {
            _loc3_.combatState.RemoveBuff(_loc4_);
         }
      }
      
      public function CueHookOnDefeat(param1:a_Cue) : Boolean
      {
         if(param1.bSpawned && this.method_157(param1.defeatTick))
         {
            return true;
         }
         return false;
      }
      
      public function CueHookDefeated(param1:a_Cue) : Boolean
      {
         return param1.bSpawned && Boolean(param1.defeatTick);
      }
      
      public function CueHookHealth(param1:a_Cue) : Number
      {
         var _loc2_:Entity = this.method_35(param1.name);
         if(_loc2_)
         {
            return _loc2_.currHP / _loc2_.maxHP;
         }
         return 0;
      }
      
      public function CueHookAtHealth(param1:a_Cue, param2:Number) : Boolean
      {
         var _loc3_:String = param1.name;
         var _loc4_:String = _loc3_ + "^" + param2;
         if(this.var_63[_loc4_])
         {
            return false;
         }
         var _loc5_:Entity = this.method_35(_loc3_);
         if(!_loc5_)
         {
            return false;
         }
         var _loc6_:Number = _loc5_.currHP / _loc5_.maxHP;
         var _loc7_:Number = _loc5_.var_2276 / _loc5_.maxHP;
         if(_loc6_ <= param2 && param2 < _loc7_)
         {
            _loc5_.var_2410 = true;
            this.var_63[_loc4_] = true;
            return true;
         }
         return false;
      }
      
      public function CueHookGoto(param1:a_Cue, param2:String, param3:uint) : void
      {
         var _loc4_:Entity = this.method_35(param1.name);
         if(_loc4_)
         {
            _loc4_.method_945(param2,param3);
         }
      }
      
      public function CueHasArrived(param1:a_Cue) : Boolean
      {
         var _loc2_:Entity = this.method_35(param1.name);
         return !_loc2_ || !_loc2_.bGotoLocation;
      }
      
      public function CueHookTweakBehavior(param1:a_Cue, param2:String, param3:Boolean) : Boolean
      {
         var _loc4_:Entity = this.method_35(param1.name);
         if(!_loc4_ || !_loc4_.behaviorType)
         {
            return false;
         }
         _loc4_.behaviorType = BehaviorType.TweakBehavior(_loc4_.behaviorType,param1.behaviorTweaks);
         return true;
      }
      
      public function CueHookBehavior(param1:a_Cue, param2:String) : void
      {
      }
      
      public function CueHookResetBehavior(param1:a_Cue) : void
      {
      }
      
      public function CueHookStance(param1:a_Cue, param2:String) : void
      {
      }
   }
}

