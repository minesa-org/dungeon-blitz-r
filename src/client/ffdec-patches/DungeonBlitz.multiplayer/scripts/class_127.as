package
{
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.FocusEvent;
   import flash.events.MouseEvent;
   import flash.events.TextEvent;
   import flash.filters.GlowFilter;
   import flash.text.StyleSheet;
   import flash.text.TextField;
   import flash.text.TextFormat;
   import flash.utils.Dictionary;
   
   public class class_127 extends class_32
   {
      
      private static const const_233:Friend = new Friend();
      
      public static const const_758:uint = 3;
      
      public static const const_8:Array = new Array();
      
      public static const const_1189:int = 6;
      
      public static const const_1168:int = 1;
      
      public static const const_1092:int = 1;
      
      public static const const_1207:int = 3;
      
      public static const const_870:int = 1;
      
      public static const const_1076:int = 2;
      
      public static const const_1257:int = 1;
      
      public static const const_965:int = 1;
      
      public static const const_1144:int = 1;
      
      public static const const_1069:int = 1;
      
      private static const const_1103:Number = 10;
      
      private static const const_1297:Number = 30;
      
      private static const const_1335:Number = 115;
      
      private static const const_724:String = "<font color=\'#7FFFFF\'>";
      
      private static const const_420:GlowFilter = new GlowFilter(11701805,1,4,4,10);
      
      private static const const_20:Dictionary = new Dictionary();
      
      private static const const_445:Array = ["Say","Party","Guild","Officer"];
      
      private static const const_1058:Array = ["/s","/p","/g","/o"];
      
      private static const const_229:Dictionary = new Dictionary();
      
      public static var var_2336:String = "Relaxed";
      
      public static var var_1979:String = "textEmote";
      
      public static var var_1566:String = "Afk";
      
      public static var var_1825:String = "Afk";
      
      public static const const_245:Array = new Array();
      
      public static var var_2590:Number = 385;
      
      private static var var_293:Dictionary = new Dictionary();
      
      public static var var_121:String = "</font>";
      
      public static const const_946:uint = 52479;
      
      public static const const_854:uint = 13487565;
      
      public static const const_1079:uint = 3454719;
      
      public static const const_1156:uint = 10101503;
      
      public static const const_887:uint = 15064320;
      
      public static const const_959:uint = 15731724;
      
      public static const const_1180:uint = 2293538;
      
      private static var var_815:Array = null;
      
      private static var var_2156:Array = ["asshole","bastard","bitch","chink","cum","cunt","damn","fag","fuck","gook","nigger","penis","shit","vagina"];
      
      private static var var_1098:Array = null;
      
      private static var var_2373:Array = ["bitch","fuck","nlgger","nigger","penis","vagina"];
      
      private static const const_1270:Array = [/a/gi,/b/gi,/c/gi,/d/gi,/e/gi,/f/gi,/g/gi,/h/gi,/i/gi,/j/gi,/k/gi,/l/gi,/m/gi,/n/gi,/o/gi,/p/gi,/q/gi,/r/gi,/s/gi,/t/gi,/u/gi,/v/gi,/w/gi,/x/gi,/y/gi,/z/gi];
      
      internal static var var_2283:Array = new Array("arsehole","ass","ballsuck","bastard","basterd","basturd","beastial","beastil","beastility","beaver","bellywhacker","bestiality","bitch","bltch","blowjob","boner","boob","browneye","browntown","bukake","bukakke","bukkake","bunghole","butt","chinck","chlnk","chink","circlejerk","clit","cobia","cock","cooter","crap","cum","cunilingus","cunillingus","cunnilingus","cunt","cyberfuc","damn","dick","dickhead","dike","dildo","dong","douchebag","dyke","ejaculat","fag","fart","felatio","fellatio","fingering","fisting","fuck","fuk","furburger","gangbang","gazongers","goddam","gonads","gook","guinne","hardon","hentai","homo","hooker","horniest","horny","hussy","jackingoff","jackoff","jackulate","jaculate","jerkoff","jism","jiz","jizm","jizz","kike","kock","kondum","kraut","kumilingus","kummer","kummilingus","kumming","kums","kunilingus","kunnilingus","lesbo","lezbian","lezbo","merde","milf","mothafuc","mothafuk","motherfuc","motherfuk","muff","niger","nigger"
      ,"nigga","nlgger","nlgga","orgasim","orgasims","orgasm","orgy","pecker","penis","phag","phelatio","phuck","phuk","phuq","pimp","piss","prick","pussi","pussies","pussy","queer","retard","returd","schlong","semen","sex","shlt","shit","sleaze","slut","snatch","spunk","tard","tasticle","tastikle","testicle","testikle","twat","vagina","wetback","whore");
      
      const_8[0] = "IqzYlypNBN";
      const_8[1] = "XDluBCYxRl";
      const_8[2] = "2vSIhoCRGJ";
      const_8[3] = "Xm61oU3zR3";
      const_8[4] = "VQ2b1Ampk7";
      const_8[5] = "7PZTMw105h";
      const_8[6] = "sJToRcCCCY";
      const_8[7] = "l5Do0CU31D";
      const_8[8] = "Wx45oIu91R";
      const_8[9] = "89KU3j6p4x";
      const_20["FRIEND"] = LinkUpdater.const_616;
      const_20["UNFRIEND"] = LinkUpdater.const_610;
      const_20["IGNORE"] = LinkUpdater.const_1039;
      const_20["ACCEPTFRIEND"] = LinkUpdater.const_616;
      const_20["DECLINEFRIEND"] = LinkUpdater.const_610;
      const_20["INVITE"] = LinkUpdater.PKTTYPE_CMD_GROUP_INVITE;
      const_20["KICK"] = LinkUpdater.PKTTYPE_CMD_GROUP_KICK;
      const_20["LEADER"] = LinkUpdater.PKTTYPE_CMD_GROUP_LEADER;
      const_20["JOIN"] = LinkUpdater.const_1020;
      const_20["GINVITE"] = LinkUpdater.PKTTYPE_CMD_GUILD_INVITE;
      const_20["GUILDINVITE"] = LinkUpdater.PKTTYPE_CMD_GUILD_INVITE;
      const_20["GPROMOTE"] = LinkUpdater.PKTTYPE_CMD_GUILD_PROMOTE;
      const_20["GUILDPROMOTE"] = LinkUpdater.PKTTYPE_CMD_GUILD_PROMOTE;
      const_20["GDEMOTE"] = LinkUpdater.PKTTYPE_CMD_GUILD_DEMOTE;
      const_20["GUILDDEMOTE"] = LinkUpdater.PKTTYPE_CMD_GUILD_DEMOTE;
      const_20["GKICK"] = LinkUpdater.PKTTYPE_CMD_GUILD_KICK;
      const_20["GUILDKICK"] = LinkUpdater.PKTTYPE_CMD_GUILD_KICK;
      const_20["GLEADER"] = LinkUpdater.PKTTYPE_CMD_GUILD_LEADER;
      const_20["GUILDLEADER"] = LinkUpdater.PKTTYPE_CMD_GUILD_LEADER;
      const_229["Say"] = "/say";
      const_229["Party"] = "/party";
      const_229["Guild"] = "/guild";
      const_229["Officer"] = "/officer";
      const_245["Paladin"] = ["Wave","Cheer L","Dance L","Relaxed L","Yell","Flex L","Sit L","Shrug","Sharpen L","Panic L","End","AFK"];
      const_245["Rogue"] = ["Wave","Cheer L","Dance L","Relaxed L","Charge","Point L","Toss L","EyesOnYou","Lean L","End","AFK"];
      const_245["Mage"] = ["Wave","Cheer L","Dance L","Relaxed L","Point","Read L","Float L","TaDah","Kickball L","Shrug","End","AFK"];
      var_293["Guild"] = "3FFF3F";
      var_293["Officer"] = "3FAF3F";
      var_293["Say"] = "EEE2BC";
      var_293["Emote"] = "FF7F3F";
      var_293["Party"] = "AFAFFF";
      var_293["Tell"] = "FF7FFF";
      var_293["Game"] = "AAAABB";
      var_293["Admin"] = "FFFF00";
      var_293["Status"] = "AAAABB";
      var_293["Channel"] = "44E2BC";
      
      internal var var_1009:Boolean = false;
      
      internal var var_2748:Boolean = false;
      
      internal var var_981:Boolean = false;
      
      internal var var_2041:String = null;
      
      internal var var_1055:Vector.<String> = new Vector.<String>();
      
      internal var var_883:uint = 0;
      
      internal var var_1006:String;
      
      internal var var_1343:Boolean = false;
      
      internal var var_230:MovieClip = null;
      
      internal var var_2982:int = 5;
      
      internal var var_2966:int = 53;
      
      internal var var_2635:Number = 680.25;
      
      internal var var_2366:Number = 78;
      
      internal var var_2794:Number = 685;
      
      internal var var_1583:class_33;
      
      internal var var_1183:class_33;
      
      internal var var_2871:class_33;
      
      internal var var_2453:class_33;
      
      internal var var_2596:class_33;
      
      internal var var_1855:class_33 = null;
      
      internal var var_2167:class_33 = null;
      
      internal var var_14:MovieClip = null;
      
      private var var_671:class_33;
      
      private var var_232:Array;
      
      private var var_506:Array;
      
      private var var_154:Array;
      
      private var var_325:Array = new Array();
      
      public function class_127(param1:Game)
      {
         super(param1,"a_ScreenChat",null);
         var_15 = true;
         mbHideOnClear = false;
      }
      
      public static function method_167(param1:String) : String
      {
         var _loc2_:uint = 0;
         var _loc4_:String = null;
         var _loc5_:String = null;
         var _loc6_:* = 0;
         if(!var_815)
         {
            var_815 = new Array();
            var_1098 = new Array();
            for each(_loc4_ in var_2156)
            {
               _loc5_ = "";
               _loc6_ = int(_loc4_.length - 1);
               while(_loc6_ >= 0)
               {
                  _loc5_ += "*";
                  _loc6_--;
               }
               var_1098.push(_loc5_);
               var_815.push(new RegExp(_loc4_,"gi"));
            }
         }
         var _loc3_:uint = var_815.length;
         _loc2_ = 0;
         while(_loc2_ < _loc3_)
         {
            param1 = param1.replace(var_815[_loc2_],var_1098[_loc2_]);
            _loc2_++;
         }
         return param1;
      }
      
      public static function method_645(param1:String) : Boolean
      {
         var _loc2_:String = null;
         var _loc3_:RegExp = null;
         var _loc4_:String = null;
         param1 = param1.toLowerCase();
         for each(_loc3_ in const_1270)
         {
            _loc2_ = param1.replace(_loc3_,"");
            for each(_loc4_ in var_2373)
            {
               if(_loc2_.indexOf(_loc4_) != -1)
               {
                  return true;
               }
            }
         }
         return false;
      }
      
      public static function method_241(param1:String) : Boolean
      {
         var _loc2_:String = null;
         param1 = param1.toLowerCase();
         for each(_loc2_ in var_2283)
         {
            if(param1.indexOf(_loc2_) != -1)
            {
               return true;
            }
         }
         return false;
      }
      
      public function method_1237(param1:String, param2:int) : void
      {
         var _loc4_:Object = null;
         var _loc5_:String = null;
         var _loc7_:String = null;
         this.var_325 = new Array();
         this.var_325.push({
            "text":"Invite...",
            "keys":"/invite <who>",
            "cmd":"/invite ",
            "send":false,
            "tip":"Invite player to a party"
         });
         this.var_325.push({
            "text":"Join...",
            "keys":"/join <who>",
            "cmd":"/join ",
            "send":false,
            "tip":"Join a friend\'s party, if possible"
         });
         this.var_325.push({
            "text":"Friend...",
            "keys":"/friend <who>",
            "cmd":"/friend ",
            "send":false,
            "tip":"Invite player to be a friend"
         });
         this.var_325.push({
            "text":"Tell...",
            "keys":"/tell <who>",
            "cmd":"/tell ",
            "send":false,
            "tip":"Send player a private message"
         });
         this.var_325.push({
            "text":"Reply...",
            "keys":"(r)",
            "cmd":"Reply",
            "send":false,
            "tip":"Reply to a private message (shortcut:\'r\')"
         });
         this.var_325.push({
            "text":"Leave",
            "keys":"/leave",
            "cmd":"/leave",
            "send":true,
            "tip":"Leave your party"
         });
         this.var_325.push({
            "text":"Ignore...",
            "keys":"/ignore <who>",
            "cmd":"/ignore ",
            "send":false,
            "tip":"Stop receiving chat from player"
         });
         this.var_325.push({
            "text":"",
            "keys":"",
            "cmd":"",
            "send":false,
            "tip":""
         });
         var _loc3_:Array = const_245[param1];
         if(_loc3_)
         {
            for each(_loc7_ in _loc3_)
            {
               _loc5_ = StringUtils.method_1002(_loc7_," ");
               _loc4_ = new Object();
               _loc4_.text = _loc5_;
               _loc4_.keys = "/" + _loc5_.toLowerCase();
               _loc4_.cmd = _loc4_.keys;
               _loc4_.send = true;
               if(_loc5_ == "End")
               {
                  _loc4_.tip = "End your current emote";
               }
               else if(_loc5_ == "AFK")
               {
                  _loc4_.tip = "Put \'AFK\' over your head";
               }
               else
               {
                  _loc4_.tip = "Do the " + _loc5_ + " emote";
               }
               this.var_325.push(_loc4_);
            }
         }
      }
      
      override public function OnCreateScreen() : void
      {
         var_2.am_ChatEntry.htmlText = "";
         var_2.am_ChatEntry.text = "";
         var_2.am_ChatEntry.tabEnabled = false;
         var _loc1_:StyleSheet = new StyleSheet();
         _loc1_.setStyle("a:hover",{
            "color":"#7FFFFF",
            "textDecoration":"underline"
         });
         _loc1_.setStyle("a:active",{
            "color":"#CFFFFF",
            "textDecoration":"underline"
         });
         var _loc2_:TextField = var_2.am_ChatHistory;
         _loc2_.styleSheet = _loc1_;
         _loc2_.multiline = true;
         _loc2_.wordWrap = true;
         _loc2_.tabEnabled = false;
         var_2.am_ChatHistory.htmlText = "";
         this.var_1583 = method_5(var_2.am_ChatExpand,this.method_583);
         this.var_1183 = method_5(var_2.am_ChatMinimize,this.method_583);
         this.var_2871 = method_5(var_2.am_ChatUp,this.method_1305);
         this.var_2453 = method_5(var_2.am_ChatDown,this.method_1267);
         this.var_2596 = method_5(var_2.am_ChatBottom,this.method_1360);
         var_2.am_BottomGlow.mouseEnabled = false;
         var_2.am_BottomGlow.mouseChildren = false;
         this.var_1183.Hide();
         var_2.am_BottomGlow.visible = false;
         var_2.am_ChatHistoryBack.mouseEnabled = false;
         var_2.am_ChatHistoryBack.mouseChildren = false;
         var_2.am_ChatHistoryBackLarge.visible = false;
         var_2.am_ChatHistoryBackLarge.mouseEnabled = false;
         var_2.am_ChatHistoryBackLarge.mouseChildren = false;
         var_2.addEventListener(MouseEvent.ROLL_OVER,this.method_660);
         var_2.addEventListener(MouseEvent.ROLL_OUT,this.method_893);
         var_2.am_ChatEntry.addEventListener(MouseEvent.MOUSE_DOWN,this.method_800);
         var_2.am_ChatEntry.addEventListener(FocusEvent.FOCUS_OUT,this.method_882);
         var_2.am_ChatEntry.addEventListener(MouseEvent.ROLL_OVER,this.method_612);
         var_2.am_ChatEntry.addEventListener(MouseEvent.ROLL_OUT,this.method_665);
         var_2.am_ChatHistory.addEventListener(MouseEvent.MOUSE_DOWN,this.method_857);
         var_2.am_ChatHistory.addEventListener(TextEvent.LINK,this.method_768);
         var_2.am_ChatHistory.addEventListener(Event.SCROLL,this.method_843);
         this.method_1825();
         this.method_953();
         this.method_486();
         this.var_671 = method_1(var_2.am_ItemMaterialDetail);
         this.var_154 = new Array();
         this.var_232 = new Array();
         this.var_506 = new Array();
      }
      
      override public function OnDestroyScreen() : void
      {
         var_2.am_ChatHistory.removeEventListener(MouseEvent.MOUSE_DOWN,this.method_857);
         var_2.am_ChatHistory.removeEventListener(TextEvent.LINK,this.method_768);
         var_2.am_ChatHistory.removeEventListener(Event.SCROLL,this.method_843);
         var_2.removeEventListener(MouseEvent.ROLL_OVER,this.method_660);
         var_2.removeEventListener(MouseEvent.ROLL_OUT,this.method_893);
         var_2.am_ChatEntry.removeEventListener(MouseEvent.MOUSE_DOWN,this.method_800);
         var_2.am_ChatEntry.removeEventListener(FocusEvent.FOCUS_OUT,this.method_882);
         var_2.am_ChatEntry.removeEventListener(MouseEvent.ROLL_OVER,this.method_612);
         var_2.am_ChatEntry.removeEventListener(MouseEvent.ROLL_OUT,this.method_665);
         this.method_458();
         this.var_1583 = null;
         this.var_1183 = null;
         this.var_2871 = null;
         this.var_2453 = null;
         this.var_2596 = null;
         if(Boolean(this.var_230) && Boolean(this.var_230.parent))
         {
            this.var_230.parent.removeChild(this.var_230);
         }
         this.var_230 = null;
         this.var_1855 = null;
         this.var_2167 = null;
         this.method_1907();
         this.method_952();
         this.method_240();
         this.var_671 = null;
         this.var_1055 = null;
      }
      
      override public function OnTickScreen() : void
      {
         this.method_844();
      }
      
      public function OnInitDisplay() : void
      {
         this.method_494();
      }
      
      private function method_660(param1:MouseEvent) : void
      {
         var_1.tooltip.TriggerTooltip(class_19.method_254("am_ChatBox"));
         this.var_2748 = true;
      }
      
      private function method_893(param1:MouseEvent) : void
      {
         var_1.tooltip.UntriggerTooltip();
         this.var_2748 = false;
         this.method_494();
      }
      
      private function method_612(param1:MouseEvent) : void
      {
         var_1.tooltip.TriggerTooltip(class_19.method_254("am_ChatEntry"));
         this.var_981 = true;
      }
      
      private function method_665(param1:MouseEvent) : void
      {
         var_1.tooltip.UntriggerTooltip();
         this.var_981 = false;
      }
      
      private function method_1305(param1:MouseEvent) : void
      {
         var _loc2_:TextField = var_2.am_ChatHistory;
         var _loc3_:int = _loc2_.scrollV;
         if(_loc3_ > 1)
         {
            _loc2_.scrollV = _loc3_ - 1;
         }
         var_2.am_BottomGlow.visible = _loc2_.scrollV != _loc2_.maxScrollV;
         param1.stopPropagation();
      }
      
      private function method_1267(param1:MouseEvent) : void
      {
         var _loc2_:TextField = var_2.am_ChatHistory;
         var _loc3_:int = _loc2_.scrollV;
         var _loc4_:int = _loc2_.maxScrollV;
         if(_loc3_ < _loc4_)
         {
            _loc2_.scrollV = _loc3_ + 1;
         }
         var_2.am_BottomGlow.visible = _loc2_.scrollV != _loc2_.maxScrollV;
         param1.stopPropagation();
      }
      
      private function method_1360(param1:MouseEvent) : void
      {
         var _loc2_:TextField = var_2.am_ChatHistory;
         _loc2_.scrollV = _loc2_.maxScrollV;
         var_2.am_BottomGlow.visible = false;
         param1.stopPropagation();
      }
      
      private function method_583(param1:MouseEvent) : void
      {
         this.method_658();
         param1.stopPropagation();
      }
      
      private function method_857(param1:MouseEvent) : void
      {
         param1.stopPropagation();
         this.method_494();
      }
      
      private function method_843(param1:Event) : void
      {
         var _loc2_:TextField = var_2.am_ChatHistory;
         var_2.am_BottomGlow.visible = _loc2_.scrollV != _loc2_.maxScrollV;
         param1.stopPropagation();
      }
      
      private function method_2009(param1:FocusEvent) : void
      {
      }
      
      public function method_658() : void
      {
         var _loc1_:TextField = var_2.am_ChatHistory;
         var_2.am_ChatHistoryBack.visible = !var_2.am_ChatHistoryBack.visible;
         var_2.am_ChatHistoryBackLarge.visible = !var_2.am_ChatHistoryBack.visible;
         if(!this.var_1343)
         {
            _loc1_.y = this.var_2635 - this.var_2794;
            _loc1_.height = this.var_2366 + this.var_2794;
            _loc1_.getCharBoundaries(0);
            if(!this.var_230)
            {
               this.var_230 = class_4.method_16("a_mChatDarkener");
            }
            this.var_230.x = _loc1_.x + var_2.x;
            this.var_230.y = _loc1_.y + var_2.y;
            this.var_230.height = _loc1_.height - this.var_2366;
            this.var_230.alpha = 0.5;
            var_1.edgeLayer.addChildAt(this.var_230,0);
         }
         else
         {
            _loc1_.y = this.var_2635;
            _loc1_.height = this.var_2366;
            _loc1_.getCharBoundaries(0);
            if(Boolean(this.var_230) && Boolean(this.var_230.parent))
            {
               this.var_230.parent.removeChild(this.var_230);
            }
            _loc1_.scrollV = _loc1_.maxScrollV;
         }
         var_2.am_BottomGlow.visible = _loc1_.scrollV != _loc1_.maxScrollV;
         this.var_1343 = !this.var_1343;
         if(this.var_1343)
         {
            this.var_1583.Hide();
            this.var_1183.Show();
            this.var_1183.PlayAnimation("Over");
         }
         else
         {
            this.var_1183.Hide();
            this.var_1583.Show();
            this.var_1583.PlayAnimation("Over");
         }
      }
      
      private function method_800(param1:MouseEvent) : void
      {
         this.BeginChat(null);
         param1.stopPropagation();
      }
      
      private function method_882(param1:FocusEvent) : void
      {
         this.var_1009 = false;
         var_1.mKeybindManager.SetContext(var_1.CONTEXT_NORMAL);
      }
      
      private function method_844() : void
      {
         if(this.var_1009 && var_2.am_ChatEntry.stage.focus != var_2.am_ChatEntry)
         {
            var_2.am_ChatEntry.stage.focus = var_2.am_ChatEntry;
         }
      }
      
      public function method_109(param1:String) : void
      {
         var _loc2_:Number = NaN;
         var _loc3_:MovieClip = null;
         var _loc4_:TextField = null;
         var _loc5_:Number = NaN;
         var _loc6_:TextFormat = null;
         this.var_1006 = param1;
         if(var_2)
         {
            _loc2_ = this.method_413(this.var_1006);
            _loc3_ = var_2.am_Channel;
            _loc4_ = _loc3_.am_ChannelText;
            MathUtil.method_2(_loc4_,this.var_1006);
            _loc5_ = 3;
            _loc6_ = _loc4_.getTextFormat();
            if(param1 == "Officer")
            {
               _loc6_.size = 11;
               _loc4_.y = _loc5_ + 2;
            }
            else
            {
               _loc6_.size = 12;
               _loc4_.y = _loc5_;
            }
            _loc4_.setTextFormat(_loc6_);
            _loc4_.textColor = _loc2_;
            this.method_728();
         }
      }
      
      public function method_728() : void
      {
         var _loc1_:TextField = var_2.am_ChatEntry;
         var _loc2_:Number = this.method_413(this.var_1006);
         _loc1_.textColor = _loc2_;
      }
      
      public function method_54(param1:int) : Boolean
      {
         if(var_1.screenKeybind.mbVisible)
         {
            return false;
         }
         this.method_844();
         if(this.var_1009)
         {
            var_1.mKeybindManager.SetContext(var_1.CONTEXT_CHAT);
            switch(param1)
            {
               case Game.COMMAND2_SCROLLUP:
                  if(this.var_883 > 0)
                  {
                     var _loc2_:String = this.var_1055[--this.var_883];
                     this.var_232 = new Array();
                     this.var_506 = new Array();
                     var _loc3_:String = this.method_566(null);
                     this.BeginChat(null);
                  }
                  return true;
               case Game.COMMAND2_SCROLLDOWN:
                  if(this.var_883 < this.var_1055.length - 1)
                  {
                     _loc2_ = this.var_1055[++this.var_883];
                     this.var_232 = new Array();
                     this.var_506 = new Array();
                     var _loc4_:String = this.method_566(null);
                     this.BeginChat(null);
                  }
                  return true;
               case Game.COMMAND2_ESCAPE:
                  this.EndChat();
                  return true;
               case Game.COMMAND2_ENTER:
                  this.method_731();
                  return true;
               case Game.COMMAND2_BACKSPACE:
                  this.method_689(true);
                  return true;
               case Game.COMMAND2_DELETE:
                  this.method_689(false);
                  return true;
            }
         }
         else
         {
            var_1.mKeybindManager.SetContext(var_1.CONTEXT_NORMAL);
            switch(param1)
            {
               case Game.const_543:
                  this.BeginChat("/");
                  break;
               case Game.const_320:
                  this.method_737();
                  break;
               case Game.const_430:
                  this.BeginChat(null);
                  this.method_109("Guild");
                  break;
               case Game.const_458:
                  this.BeginChat(null);
                  this.method_109("Party");
                  break;
               case Game.const_570:
                  this.BeginChat(null);
            }
         }
         return this.var_1009;
      }
      
      public function method_737() : void
      {
         var _loc1_:String = null;
         if(!this.var_2041)
         {
            this.ReadUnsafeStatusText("You cannot reply without receiving a message.");
         }
         else
         {
            _loc1_ = "/tell " + this.var_2041 + " ";
            this.BeginChat(_loc1_);
         }
      }
      
      public function BeginChat(param1:String) : void
      {
         var_1.mKeybindManager.SetContext(var_1.CONTEXT_CHAT);
         this.var_1009 = true;
         if(param1)
         {
            var_2.am_ChatEntry.text = param1;
            var_2.am_ChatEntry.setSelection(param1.length,param1.length);
            this.method_728();
         }
      }
      
      public function EndChat() : void
      {
         this.var_1009 = false;
         var_1.mKeybindManager.SetContext(var_1.CONTEXT_NORMAL);
         if(var_2.am_ChatEntry.stage)
         {
            var_2.am_ChatEntry.stage.focus = var_1.main;
            var_2.am_ChatEntry.stage.focus = null;
         }
         else
         {
            var_1.main.stage.focus = var_1.main;
            var_1.main.stage.focus = null;
         }
      }
      
      public function method_227(param1:String) : String
      {
         return "<font color=\'#" + var_293[param1] + "\'>";
      }
      
      public function method_413(param1:String) : Number
      {
         var _loc2_:String = "0x" + var_293[param1];
         return Number(_loc2_);
      }
      
      public function ReceiveChat(param1:uint, param2:String, param3:Boolean = true) : void
      {
         var _loc9_:String = null;
         var _loc10_:String = null;
         var _loc11_:Entity = null;
         var _loc4_:Entity = null;
         var _loc6_:String = MathUtil.method_259(param2);
         if(param1 != 0)
         {
            _loc4_ = var_1.GetEntFromID(param1);
            var _loc5_:String = (Boolean(_loc4_)) && Boolean(_loc4_.entType) ? _loc4_.entType.entName : "Unknown";
            if(param1 != var_1.clientEntID && var_1.bProfaneFilter && (Boolean(!_loc4_) || Boolean(_loc4_.var_20 & Entity.PLAYER)))
            {
               _loc6_ = method_167(_loc6_);
            }
         }
         else
         {
            param3 = false;
            param1 = var_1.clientEntID;
            _loc4_ = var_1.clientEnt;
         }
         var _loc7_:String = this.method_215(_loc6_);
         var _loc8_:String = _loc7_ ? _loc7_ : _loc6_;
         if(Boolean(param3) && Boolean(_loc4_) && Boolean(_loc4_.var_20 & Entity.PLAYER))
         {
            _loc9_ = this.method_227("Say");
            _loc10_ = var_1.FormatHotName("Unknown");
            this.method_197(_loc9_ + _loc10_ + ": " + _loc8_ + var_121);
         }
         if(_loc4_)
         {
            _loc11_ = var_1.clientEnt;
            if(Boolean((_loc11_) && _loc4_.method_355()) && Boolean(_loc4_.var_2144) && _loc4_.entType.bPassiveTurnToFace)
            {
               _loc4_.bLeft = _loc11_.appearPosX < _loc4_.appearPosX;
               _loc4_.var_2144 = false;
            }
            _loc4_.var_386.method_328(_loc8_);
            if(Boolean(_loc4_.currRoom) && Boolean(_loc4_.var_20 & Entity.PLAYER))
            {
               _loc4_.currRoom.method_79("Chat^Any");
               _loc4_.currRoom.method_79("Chat^" + _loc6_.toUpperCase());
            }
         }
      }
      
      public function FormatHotName(param1:String) : String
      {
         if(var_1.clientEntName == param1 && !(DevSettings.flags & DevSettings.DEVFLAG_STANDALONE_CLIENT))
         {
            return param1;
         }
         var _loc2_:String = "<a href=\'event:" + param1 + "\'>";
         return _loc2_ + param1 + "</a>";
      }
      
      public function method_1339(param1:String, param2:String) : void
      {
         var _loc3_:String = MathUtil.method_259(param2);
         var _loc4_:String = this.method_227("Emote");
         var _loc5_:String = var_1.FormatHotName(param1);
         this.method_197(_loc4_ + _loc5_ + " " + _loc3_ + var_121);
      }
      
      public function ReadUnsafeStatusText(param1:String, param2:String = "Status") : void
      {
         var _loc3_:String = MathUtil.method_259(param1);
         var _loc4_:String = this.method_227(param2);
         this.method_197(_loc4_ + _loc3_ + var_121);
      }
      
      public function method_84(param1:String, param2:String = "Status") : void
      {
         var _loc3_:String = this.method_215(param1);
         var _loc4_:String = _loc3_ ? _loc3_ : param1;
         var _loc5_:String = this.method_227(param2);
         this.method_197(_loc5_ + _loc4_ + var_121);
      }
      
      private function method_768(param1:TextEvent) : void
      {
         var _loc3_:TextField = null;
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         var _loc6_:String = null;
         var _loc7_:String = null;
         var _loc8_:class_42 = null;
         var _loc9_:class_64 = null;
         var _loc10_:class_8 = null;
         var _loc11_:class_87 = null;
         var _loc12_:class_20 = null;
         var _loc13_:class_10 = null;
         var _loc14_:String = null;
         var _loc15_:PowerType = null;
         var _loc16_:class_17 = null;
         var _loc17_:String = null;
         var _loc18_:uint = 0;
         var _loc19_:Number = NaN;
         var _loc20_:Number = NaN;
         var _loc21_:Array = null;
         var _loc22_:Boolean = false;
         var _loc23_:Boolean = false;
         var _loc24_:class_16 = null;
         var _loc25_:class_21 = null;
         var _loc26_:class_3 = null;
         var _loc27_:TextField = null;
         var _loc2_:String = param1.text;
         if(!_loc2_)
         {
            return;
         }
         if(_loc2_.indexOf(",") > -1)
         {
            _loc3_ = param1.target as TextField;
            _loc4_ = _loc3_.getCharIndexAtPoint(_loc3_.mouseX,_loc3_.mouseY);
            _loc5_ = _loc3_.text.lastIndexOf("\r",_loc4_) + 1;
            _loc6_ = _loc2_.split(",")[1];
            _loc7_ = _loc5_.toString() + _loc6_;
            if(!_loc2_.indexOf(const_8[0]))
            {
               _loc8_ = this.var_154[_loc7_];
               if(_loc8_)
               {
                  var_1.screenHudTooltip.ShowGearTooltip(var_1.clientEnt,_loc8_.gearType.gearID,false,_loc8_,356.35,384.95);
               }
            }
            else if(!_loc2_.indexOf(const_8[1]))
            {
               _loc9_ = this.var_154[_loc7_];
               if(_loc9_)
               {
                  var_1.screenHudTooltip.ShowCharmTooltip(_loc9_,363.35,516.7);
               }
            }
            else if(!_loc2_.indexOf(const_8[2]))
            {
               _loc10_ = this.var_154[_loc7_];
               if(_loc10_)
               {
                  this.method_1149(_loc10_);
               }
            }
            else if(!_loc2_.indexOf(const_8[3]))
            {
               _loc11_ = this.var_154[_loc7_];
               if(_loc11_)
               {
                  var_1.screenHudTooltip.ShowPetTooltip(_loc11_,true,242,523);
               }
            }
            else if(!_loc2_.indexOf(const_8[4]))
            {
               _loc12_ = this.var_154[_loc7_];
               if(_loc12_)
               {
                  var_1.screenHudTooltip.ShowMountTooltip(_loc12_,242.4,522.9);
               }
            }
            else if(!_loc2_.indexOf(const_8[5]))
            {
               _loc13_ = this.var_154[_loc7_];
               if(_loc13_)
               {
                  _loc14_ = _loc13_.rank ? _loc13_.abilityName + _loc13_.rank.toString() : _loc13_.abilityName;
                  _loc15_ = class_14.powerTypesDict[_loc14_];
                  if(!_loc15_)
                  {
                     return;
                  }
                  var_1.screenHudTooltip.ShowPowerTooltip(var_1.clientEnt,_loc15_,251.05,551.2);
               }
            }
            else if(!_loc2_.indexOf(const_8[6]))
            {
               _loc16_ = this.var_154[_loc7_];
               if(_loc16_)
               {
                  _loc17_ = _loc16_.var_61;
                  _loc18_ = uint(_loc17_.substr(_loc17_.length - 1));
                  _loc19_ = 250.3;
                  _loc20_ = 536.9;
                  _loc21_ = _loc16_.description;
                  if(_loc21_)
                  {
                     _loc22_ = _loc21_.length > 2;
                     _loc23_ = _loc21_[0].length > 52;
                     if(_loc23_)
                     {
                        _loc20_ = _loc22_ ? 536.9 : 558.65;
                     }
                     else
                     {
                        _loc20_ = _loc22_ ? 558.65 : 536.9;
                     }
                  }
                  var_1.screenHudTooltip.ShowTalentstoneTooltip(_loc16_,_loc18_,_loc19_,_loc20_);
               }
            }
            else if(!_loc2_.indexOf(const_8[7]))
            {
               _loc24_ = this.var_154[_loc7_];
               if(_loc24_)
               {
                  var_1.screenHudTooltip.ShowBasicDescriptionTooltip(_loc24_.displayName,"Egg",_loc24_.method_450(),_loc24_.description,242.4,522.9);
               }
            }
            else if(!_loc2_.indexOf(const_8[8]))
            {
               _loc25_ = this.var_154[_loc7_];
               if(_loc25_)
               {
                  var_1.screenHudTooltip.ShowDyeTooltip(_loc25_,340,606.65);
               }
            }
            else if(!_loc2_.indexOf(const_8[9]))
            {
               _loc26_ = this.var_154[_loc7_];
               if(_loc26_)
               {
                  var_1.screenHudTooltip.ShowConsumableTooltip(_loc26_,242.4,522.9,null,true);
               }
            }
         }
         else
         {
            _loc27_ = var_2.am_ChatHistory;
            this.method_206(_loc2_,_loc27_.mouseX + _loc27_.x - const_1103,_loc27_.mouseY + _loc27_.y - const_1297);
         }
         param1.stopPropagation();
      }
      
      public function method_458() : void
      {
         if(this.var_14)
         {
            this.var_14.removeEventListener(MouseEvent.ROLL_OUT,this.method_788);
            if(this.var_14.parent)
            {
               this.var_14.parent.removeChild(this.var_14);
            }
            this.var_14 = null;
         }
      }
      
      public function method_486() : void
      {
         this.var_14 = class_4.method_16("a_FriendPopup");
         this.var_14.filters = [const_420];
         this.var_14.addEventListener(MouseEvent.ROLL_OUT,this.method_788);
         this.var_14.mouseChildren = true;
         this.var_14.visible = false;
         var_2.addChild(this.var_14);
      }
      
      public function method_788(param1:MouseEvent) : void
      {
         this.method_126();
         param1.stopPropagation();
      }
      
      public function method_362(param1:MovieClip) : void
      {
         var _loc2_:int = 0;
         var _loc4_:MovieClip = null;
         var _loc3_:int = param1.numChildren;
         _loc2_ = 0;
         while(_loc2_ < _loc3_)
         {
            _loc4_ = param1.getChildAt(_loc2_) as MovieClip;
            _loc4_.dyn_Function = null;
            _loc4_.dyn_Friend = null;
            _loc4_.visible = false;
            _loc2_++;
         }
         param1.visible = false;
      }
      
      public function method_33(param1:MovieClip, param2:String, param3:String = "", param4:Function = null, param5:Friend = null) : MovieClip
      {
         var _loc8_:int = 0;
         var _loc6_:MovieClip = null;
         var _loc7_:MovieClip = null;
         var _loc9_:int = param1.numChildren;
         _loc8_ = 0;
         while(_loc8_ < _loc9_)
         {
            _loc7_ = param1.getChildAt(_loc8_) as MovieClip;
            if(!_loc7_.visible)
            {
               _loc6_ = _loc7_;
               break;
            }
            _loc8_++;
         }
         if(!_loc6_)
         {
            _loc6_ = class_4.method_16("a_FriendPopupOption");
            _loc6_.gotoAndStop("Ready");
            _loc6_.y = _loc6_.height * _loc9_ - 0.5;
            var_1.UIBasicButton_CreateBasicButton(_loc6_,this.method_452,null,false,true);
            _loc6_.addEventListener(MouseEvent.ROLL_OVER,this.method_442);
            _loc6_.addEventListener(MouseEvent.ROLL_OUT,this.method_463);
            param1.addChild(_loc6_);
         }
         _loc6_.dyn_Callback = param4;
         _loc6_.dyn_Friend = param5;
         _loc6_.visible = true;
         MathUtil.method_2(_loc6_.am_Text,const_724 + param2 + var_121,true);
         MathUtil.method_2(_loc6_.am_Keys,const_724 + param3 + var_121,true);
         return _loc6_;
      }
      
      public function method_442(param1:MouseEvent) : void
      {
         var _loc2_:MovieClip = param1.currentTarget as MovieClip;
         if(_loc2_.dyn_Callback != null)
         {
            _loc2_.gotoAndStop("Over");
         }
      }
      
      public function method_463(param1:MouseEvent) : void
      {
         var _loc2_:MovieClip = param1.currentTarget as MovieClip;
         if(_loc2_.dyn_Callback != null)
         {
            _loc2_.gotoAndStop("Ready");
         }
      }
      
      public function method_126() : void
      {
         if(this.var_14)
         {
            this.var_14.visible = false;
            this.method_362(this.var_14);
         }
      }
      
      public function FindInFriendList(param1:String) : Friend
      {
         var _loc3_:Friend = null;
         var _loc2_:Friend = null;
         for each(_loc3_ in var_1.friendList)
         {
            if(_loc3_.charName == param1)
            {
               _loc2_ = _loc3_;
               break;
            }
         }
         return _loc2_;
      }
      
      public function method_206(param1:String, param2:Number, param3:Number) : void
      {
         if(!this.var_14 || !this.var_14.parent)
         {
            return;
         }
         this.method_362(this.var_14);
         this.var_14.visible = true;
         this.var_14.x = param2;
         this.var_14.y = param3;
         var _loc4_:Friend = this.FindInFriendList(param1);
         if(!_loc4_)
         {
            this.method_33(this.var_14,param1);
            const_233.charName = param1;
            this.method_33(this.var_14,"  Invite to party","",this.method_188,const_233);
            this.method_33(this.var_14,"  Invite to friend list","",this.method_284,const_233);
            this.method_33(this.var_14,"  Ignore","",this.method_449,const_233);
            this.method_33(this.var_14,"  Tell...","",this.method_202,const_233);
         }
         else if(_loc4_.var_276)
         {
            if(Boolean(_loc4_.charName) && _loc4_.var_207 != _loc4_.charName)
            {
               this.method_33(this.var_14,"(" + _loc4_.var_207 + ")");
            }
            this.method_33(this.var_14,"  Accept friend invite","",this.method_425,_loc4_);
            this.method_33(this.var_14,"  Quietly decline","",this.method_455,_loc4_);
         }
         else if(_loc4_.bOnline)
         {
            if(Boolean(_loc4_.charName) && _loc4_.var_207 != _loc4_.charName)
            {
               this.method_33(this.var_14,"(" + _loc4_.var_207 + ")");
            }
            this.method_33(this.var_14,"  Invite to party","",this.method_188,_loc4_);
            this.method_33(this.var_14,"  Join their party","",this.method_323,_loc4_);
            this.method_33(this.var_14,"  Tell...","",this.method_202,_loc4_);
         }
         var _loc5_:TextField = var_2.am_ChatHistory;
         var _loc6_:Number = _loc5_.y + _loc5_.height;
         if(this.var_14.y < 0)
         {
            this.var_14.y = 0;
         }
         else if(this.var_14.y + this.var_14.height > _loc6_)
         {
            this.var_14.y = _loc6_ - this.var_14.height;
         }
      }
      
      public function method_188(param1:Friend) : void
      {
         this.TryToProcessChatAsLocalCommand("/invite " + param1.charName);
      }
      
      public function method_323(param1:Friend) : void
      {
         this.TryToProcessChatAsLocalCommand("/Join " + param1.charName);
      }
      
      public function method_284(param1:Friend) : void
      {
         this.TryToProcessChatAsLocalCommand("/friend " + param1.charName);
      }
      
      public function method_202(param1:Friend) : void
      {
         this.BeginChat("/tell " + param1.charName + " ");
      }
      
      public function method_449(param1:Friend) : void
      {
         this.TryToProcessChatAsLocalCommand("/ignore " + param1.charName);
      }
      
      public function method_910(param1:Friend) : void
      {
         this.TryToProcessChatAsLocalCommand("/ignore " + param1.charName);
      }
      
      public function method_949(param1:Friend) : void
      {
         this.TryToProcessChatAsLocalCommand("/unfriend " + param1.charName);
      }
      
      public function method_425(param1:Friend) : void
      {
         this.TryToProcessChatAsLocalCommand("/acceptfriend " + param1.charName);
      }
      
      public function method_455(param1:Friend) : void
      {
         this.TryToProcessChatAsLocalCommand("/declinefriend " + param1.charName);
      }
      
      public function method_452(param1:MouseEvent) : void
      {
         var _loc2_:MovieClip = param1.target as MovieClip;
         var _loc3_:Function = _loc2_.dyn_Callback;
         var _loc4_:Friend = _loc2_.dyn_Friend;
         if(_loc3_ != null)
         {
            _loc3_(_loc4_);
         }
         this.method_126();
         param1.stopPropagation();
      }
      
      public function method_197(param1:String) : void
      {
         if(!var_2)
         {
            return;
         }
         var _loc2_:TextField = var_2.am_ChatHistory;
         var _loc3_:Boolean = _loc2_.scrollV == _loc2_.maxScrollV;
         param1 = param1.replace(/\^t\s*/i,"");
         _loc2_.htmlText += param1 + "<br/>";
         if(_loc3_)
         {
            _loc2_.scrollV = _loc2_.maxScrollV;
         }
         else
         {
            var_2.am_BottomGlow.visible = true;
         }
      }
      
      public function method_785(param1:String, param2:String, param3:String) : void
      {
         var _loc4_:String = null;
         var _loc8_:String = null;
         var _loc5_:String = this.method_227("Tell");
         var _loc6_:Entity = null;
         var _loc7_:String = MathUtil.method_259(param3);
         var _loc9_:String = this.method_215(_loc7_);
         var _loc10_:String = _loc9_ ? _loc9_ : _loc7_;
         if(Boolean(param2) && var_1.clientEntName == param1)
         {
            _loc6_ = var_1.clientEnt;
            _loc8_ = var_1.FormatHotName(param2);
            _loc4_ = _loc5_ + "To " + _loc8_ + ": " + _loc10_ + var_121;
         }
         else
         {
            _loc6_ = var_1.GetPlayerEntFromEntName(param1);
            if(var_1.bProfaneFilter)
            {
               _loc10_ = method_167(_loc10_);
            }
            _loc8_ = var_1.FormatHotName(param1);
            _loc4_ = _loc5_ + _loc8_ + " whispers: " + _loc10_ + var_121;
            this.var_2041 = param1;
         }
         if(_loc6_)
         {
            _loc6_.var_386.method_328(_loc10_);
         }
         this.method_197(_loc4_);
      }
      
      public function method_446(param1:String, param2:String, param3:String) : void
      {
         var _loc5_:String = null;
         var _loc8_:String = null;
         var _loc4_:String = this.method_227(param1);
         var _loc6_:Entity = null;
         var _loc7_:String = MathUtil.method_259(param3);
         var _loc9_:String = this.method_215(_loc7_);
         var _loc10_:String = _loc9_ ? _loc9_ : _loc7_;
         if(Boolean(var_1.clientEnt) && var_1.clientEntName == param2)
         {
            _loc6_ = var_1.clientEnt;
            _loc8_ = var_1.FormatHotName(param2);
            _loc5_ = _loc4_ + "[" + param1 + "] " + _loc8_ + ": " + _loc10_ + var_121;
         }
         else
         {
            _loc6_ = var_1.GetPlayerEntFromEntName(param2);
            if(var_1.bProfaneFilter)
            {
               _loc10_ = method_167(_loc10_);
            }
            _loc8_ = var_1.FormatHotName(param2);
            _loc5_ = _loc4_ + "[" + param1 + "] " + _loc8_ + ": " + _loc10_ + var_121;
         }
         if(_loc6_)
         {
            _loc6_.var_386.method_328(_loc10_);
         }
         this.method_197(_loc5_);
      }
      
      public function method_803() : void
      {
         this.method_240();
         this.method_310();
      }
      
      public function method_731() : void
      {
         var _loc1_:String = var_2.am_ChatEntry.text;
         var_2.am_ChatEntry.text = "";
         var _loc2_:String = _loc1_;
         _loc1_ = this.method_1478(_loc1_);
         if(_loc1_)
         {
            this.method_991(_loc1_);
            this.var_1055.push(_loc1_);
            this.var_883 = this.var_1055.length;
         }
         this.EndChat();
      }
      
      public function method_991(param1:String) : void
      {
         if(param1)
         {
            if(param1.charAt(0) != "\\" && param1.charAt(0) != "/")
            {
               param1 = const_229[this.var_1006] + " " + param1;
            }
            this.method_537(var_1.clientEntID,param1);
         }
      }

      private function method_1940(param1:String) : Boolean
      {
         var _loc2_:String = null;
         if(!param1)
         {
            return false;
         }
         _loc2_ = param1.toLowerCase();
         while(_loc2_.length && _loc2_.charAt(_loc2_.length - 1) == " ")
         {
            _loc2_ = _loc2_.substr(0,_loc2_.length - 1);
         }
         return _loc2_ == "/lang:tr" || _loc2_ == "/lang:en" || _loc2_ == "\\lang:tr" || _loc2_ == "\\lang:en";
      }
      
      public function method_537(param1:uint, param2:String, param3:Boolean = false) : void
      {
         if(this.method_1940(param2))
         {
            if(var_1.CanSendPacket())
            {
               var_1.linkUpdater.WriteChatMessage(param1,param2);
            }
            return;
         }
         if(param3 || !this.TryToProcessChatAsLocalCommand(param2))
         {
            if(var_1.CanSendPacket())
            {
               this.ReceiveChat(param1,param2);
               var_1.linkUpdater.WriteChatMessage(param1,param2);
            }
         }
      }
      
      public function TryToProcessChatAsLocalCommand(param1:String) : Boolean
      {
         var _loc4_:uint = 0;
         var _loc5_:Array = null;
         var _loc6_:String = null;
         var _loc7_:String = null;
         var _loc8_:Array = null;
         var _loc9_:String = null;
         var _loc10_:String = null;
         var _loc2_:Boolean = false;
         var _loc3_:uint = uint(param1.length);
         if(_loc3_ >= 1 && (param1.charAt(0) == "\\" || param1.charAt(0) == "/"))
         {
            _loc4_ = 1;
            if(_loc3_ >= 2 && (param1.charAt(1) == "\\" || param1.charAt(1) == "/"))
            {
               _loc4_ = 2;
            }
            _loc5_ = param1.split(" ");
            _loc6_ = _loc5_[0].substr(_loc4_);
            if(_loc6_.length)
            {
               _loc7_ = _loc6_.toUpperCase();
               _loc8_ = _loc5_.slice(1);
               _loc2_ = this.method_1260(_loc7_,_loc8_);
               if(!_loc2_)
               {
                  _loc2_ = true;
                  _loc9_ = this.method_215(_loc6_,true);
                  _loc10_ = _loc9_ ? _loc9_ : _loc6_;
                  this.ReadUnsafeStatusText("Unknown Command: " + _loc10_);
               }
            }
            else
            {
               _loc2_ = true;
            }
         }
         return _loc2_;
      }
      
      private function method_130(param1:String, param2:String) : void
      {
         this.ReadUnsafeStatusText("Incorrect Format: /" + param1.toLowerCase() + " " + param2);
      }
      
      private function method_1260(param1:String, param2:Array) : Boolean
      {
         var _loc4_:Boolean = false;
         var _loc5_:String = null;
         var _loc8_:Packet = null;
         var _loc9_:Packet = null;
         var _loc10_:Packet = null;
         var _loc11_:Packet = null;
         var _loc12_:String = null;
         var _loc13_:String = null;
         var _loc14_:Packet = null;
         var _loc15_:Packet = null;
         var _loc16_:Packet = null;
         var _loc17_:Packet = null;
         var _loc18_:Packet = null;
         var _loc19_:Packet = null;
         var _loc20_:Packet = null;
         var _loc21_:String = null;
         var _loc3_:Entity = var_1.clientEnt;
         if(!_loc3_ || !var_1.CanSendPacket())
         {
            return true;
         }
         if(const_20[param1])
         {
            if(param2.length != 1)
            {
               this.method_130(param1,"<player>");
            }
            else
            {
               var _loc6_:uint = uint(const_20[param1]);
               var _loc7_:Packet = new Packet(0);
               _loc7_.method_26(param2[0]);
               var_1.serverConn.SendPacket(null);
            }
            _loc4_ = true;
         }
         else if(param1 == "TELEPORT")
         {
            if(param2.length != 1)
            {
               this.method_130(param1,"<player>");
            }
            else if(Boolean(_loc3_) && _loc3_.entState != Entity.const_6)
            {
               _loc8_ = new Packet(LinkUpdater.const_1276);
               _loc8_.method_26(param2[0]);
               var_1.serverConn.SendPacket(_loc8_);
               var_1.mbTransferMode = true;
            }
            _loc4_ = true;
         }
         else if(param1 == "LOCK")
         {
            _loc9_ = new Packet(LinkUpdater.const_707);
            _loc9_.method_15(true);
            var_1.serverConn.SendPacket(_loc9_);
            _loc4_ = true;
         }
         else if(param1 == "UNLOCK")
         {
            _loc10_ = new Packet(LinkUpdater.const_707);
            _loc10_.method_15(false);
            var_1.serverConn.SendPacket(_loc10_);
            _loc4_ = true;
         }
         else if(param1 == "LEAVE" || param1 == "QUIT")
         {
            _loc11_ = new Packet(LinkUpdater.PKTTYPE_CMD_GROUP_LEAVE);
            var_1.serverConn.SendPacket(_loc11_);
            _loc4_ = true;
         }
         else if(param1 == "GCREATE" || param1 == "GUILDCREATE")
         {
            if(!param2.length)
            {
               this.method_130(param1,"<guild>");
            }
            else
            {
               _loc12_ = param2.join(" ");
               _loc13_ = _loc12_.replace(/[^a-zA-Z ]/g,"");
               if(_loc13_ != _loc12_)
               {
                  this.method_84("Guild names can only contain A-Z and spaces.");
               }
               else if(method_241(_loc13_.replace(/[ ]/g,"")))
               {
                  this.method_84("Your guild name violates our naming policy.");
               }
               else
               {
                  _loc13_ = _loc13_.replace(/[ ]+/g," ");
                  _loc14_ = new Packet(LinkUpdater.PKTTYPE_CMD_GUILD_CREATE);
                  _loc14_.method_26(_loc13_);
                  var_1.serverConn.SendPacket(_loc14_);
               }
            }
            _loc4_ = true;
         }
         else if(param1 == "GQUIT" || param1 == "GUILDQUIT")
         {
            _loc15_ = new Packet(LinkUpdater.PKTTYPE_CMD_GUILD_QUIT);
            var_1.serverConn.SendPacket(_loc15_);
            _loc4_ = true;
         }
         else if(param1 == "GDISBAND" || param1 == "GUILDDISBAND")
         {
            _loc16_ = new Packet(LinkUpdater.PKTTYPE_CMD_GUILD_DISBAND);
            var_1.serverConn.SendPacket(_loc16_);
            _loc4_ = true;
         }
         else if(param1 == "T" || param1 == "TELL" || param1 == "W" || param1 == "WHISPER")
         {
            if(param2.length < 2)
            {
               this.method_130(param1,"<player> <message>");
            }
            else
            {
               _loc5_ = param2.slice(1).join(" ");
               if(_loc5_)
               {
                  _loc17_ = new Packet(LinkUpdater.PKTTYPE_SEND_CHAT_PRIVATE);
                  _loc17_.method_26(param2[0]);
                  _loc17_.method_26(_loc5_);
                  var_1.serverConn.SendPacket(_loc17_);
               }
            }
            _loc4_ = true;
         }
         else if(param1 == "G" || param1 == "GU" || param1 == "GUILD")
         {
            if(!param2.length)
            {
               this.method_130(param1,"<message>");
            }
            else
            {
               _loc5_ = param2.join(" ");
               if(_loc5_)
               {
                  _loc18_ = new Packet(LinkUpdater.PKTTYPE_SEND_CHAT_GUILD);
                  _loc18_.method_26(_loc5_);
                  var_1.serverConn.SendPacket(_loc18_);
               }
               this.method_109("Guild");
            }
            _loc4_ = true;
         }
         else if(param1 == "O" || param1 == "OFFICER")
         {
            if(!param2.length)
            {
               this.method_130(param1,"<message>");
            }
            else
            {
               _loc5_ = param2.join(" ");
               if(_loc5_)
               {
                  _loc19_ = new Packet(LinkUpdater.PKTTYPE_SEND_CHAT_OFFICER);
                  _loc19_.method_26(_loc5_);
                  var_1.serverConn.SendPacket(_loc19_);
               }
               this.method_109("Officer");
            }
            _loc4_ = true;
         }
         else if(param1 == "P" || param1 == "PARTY")
         {
            if(!param2.length)
            {
               this.method_130(param1,"<message>");
            }
            else
            {
               _loc5_ = param2.join(" ");
               if(_loc5_)
               {
                  _loc20_ = new Packet(LinkUpdater.PKTTYPE_SEND_CHAT_GROUP);
                  _loc20_.method_26(_loc5_);
                  var_1.serverConn.SendPacket(_loc20_);
               }
               this.method_109("Party");
            }
            _loc4_ = true;
         }
         else if(param1 == "SAY" || param1 == "S" || param1 == "LOCAL")
         {
            if(!param2.length)
            {
               this.method_130(param1,"<message>");
            }
            else
            {
               _loc5_ = param2.join(" ");
               if(_loc5_)
               {
                  this.method_537(var_1.clientEntID,_loc5_,true);
               }
               this.method_109("Say");
            }
            _loc4_ = true;
         }
         else if(param1 == "FPS")
         {
            if(var_1.main)
            {
               if(!var_1.main.resourceMonitor)
               {
                  var_1.main.CreateResourceMonitor();
               }
               else
               {
                  var_1.main.resourceMonitor.visible = !var_1.main.resourceMonitor.visible;
               }
            }
            _loc4_ = true;
         }
         else if(param1 == "PERF")
         {
            var_1.screenHud.Toggle();
            var_1.screenHudTop.Toggle();
            var_1.screenHudTopRight.Toggle();
            _loc4_ = true;
         }
         else if(param1 == "AFK")
         {
            _loc3_.DoEmote(var_1566 + " loop");
            _loc4_ = true;
         }
         else if(param1 == "E" || param1 == "EMOTE" || param1 == "EM" || param1 == "ME")
         {
            if(!param2.length)
            {
               this.method_130(param1,"<emote>");
            }
            else
            {
               _loc3_.DoEmote(var_1979 + " " + param2.join(" "));
            }
            _loc4_ = true;
         }
         else if(_loc3_.entType.className)
         {
            _loc21_ = Entity.method_415(param1,_loc3_.entType.className);
            if(_loc21_)
            {
               _loc3_.DoEmote(_loc21_);
               _loc4_ = true;
            }
         }
         return _loc4_;
      }
      
      public function method_2036(param1:String) : void
      {
         var _loc3_:EntType = null;
         var _loc4_:Number = NaN;
         var _loc5_:Entity = null;
         if(!(DevSettings.flags & DevSettings.DEVFLAG_STANDALONE_CLIENT))
         {
            return;
         }
         var _loc2_:int = 0;
         DevSettings.flags |= DevSettings.const_511;
         for each(_loc3_ in class_14.entTypes)
         {
            EntType.method_48(_loc3_.entName);
            if(_loc3_.var_106 != "" && _loc3_.var_106 != null && _loc3_.var_106 != "None")
            {
               if(param1.toUpperCase() == "ALL" && (_loc3_.var_106 != "Dragon" && _loc3_.var_106 != "Villager") || param1.toUpperCase() == _loc3_.var_106.toUpperCase())
               {
                  _loc4_ = var_1.clientEnt.bFacingLeft() ? var_1.clientEnt.physPosX - 200 : var_1.clientEnt.physPosX + 200;
                  _loc4_ = _loc4_ + _loc2_;
                  _loc5_ = new Entity(var_1,_loc3_.entName,null,_loc4_,var_1.clientEnt.physPosY - 200,Entity.LOCAL | Entity.MONSTER,Entity.const_531,0,0,0,null,null,null,null,null,null);
                  var_1.entities.push(_loc5_);
                  _loc5_.BeginActive();
                  _loc5_.UpdatePos(_loc5_.physPosX + _loc3_.width,_loc5_.physPosY - 100);
                  _loc2_ += _loc3_.width * 2;
               }
            }
         }
      }
      
      private function method_1864(param1:MouseEvent) : void
      {
         this.method_1011();
         param1.stopPropagation();
      }
      
      private function method_1011() : void
      {
         var _loc1_:MovieClip = var_2.am_ChannelChoices;
         if(_loc1_.visible)
         {
            this.method_310();
         }
         else
         {
            _loc1_.visible = true;
            this.method_240();
         }
      }
      
      private function method_310() : void
      {
         var _loc1_:MovieClip = null;
         if(var_2)
         {
            _loc1_ = var_2.am_ChannelChoices;
            _loc1_.visible = false;
         }
      }
      
      private function method_1741(param1:MouseEvent) : void
      {
         var _loc2_:MovieClip = param1.target as MovieClip;
         var _loc3_:String = _loc2_.am_Text.text;
         this.method_109(_loc3_);
         this.method_310();
         this.BeginChat(null);
         param1.stopPropagation();
      }
      
      private function method_1825() : void
      {
         var _loc5_:MovieClip = null;
         var _loc6_:String = null;
         var _loc7_:uint = 0;
         var _loc8_:TextField = null;
         this.var_2167 = method_5(var_2.am_Channel,this.method_1864);
         this.var_2167.mMovieClip.mouseChildren = false;
         var _loc1_:MovieClip = var_2.am_ChannelChoices;
         _loc1_.filters = [const_420];
         this.method_109(const_445[0]);
         var _loc2_:Number = 0;
         var _loc3_:uint = const_445.length;
         var _loc4_:uint = 0;
         while(_loc4_ < _loc3_)
         {
            _loc5_ = class_4.method_16("");
            if(_loc3_ == 1)
            {
               _loc5_ = class_4.method_16("a_ChannelOptionSingle");
            }
            else if(_loc4_ == 0)
            {
               _loc5_ = class_4.method_16("a_ChannelOptionBottom");
            }
            else if(_loc4_ == _loc3_ - 1)
            {
               _loc5_ = class_4.method_16("a_ChannelOptionTop");
            }
            else
            {
               _loc5_ = class_4.method_16("a_ChannelOptionMiddle");
            }
            _loc5_.gotoAndStop("Ready");
            _loc1_.addChild(_loc5_);
            _loc2_ -= _loc5_.height;
            _loc5_.y = _loc2_;
            _loc6_ = const_445[_loc4_];
            _loc7_ = this.method_413(_loc6_);
            _loc8_ = _loc5_.am_Text;
            MathUtil.method_2(_loc8_,_loc6_);
            _loc8_.textColor = _loc7_;
            _loc8_ = _loc5_.am_Key;
            MathUtil.method_2(_loc8_,const_1058[_loc4_]);
            _loc8_.textColor = _loc7_;
            method_5(_loc5_,this.method_1741,this.method_288,this.method_378);
            _loc4_++;
         }
         _loc1_.visible = false;
      }
      
      public function method_288(param1:MouseEvent) : void
      {
         var _loc2_:MovieClip = param1.currentTarget as MovieClip;
         _loc2_.gotoAndStop("Over");
      }
      
      public function method_378(param1:MouseEvent) : void
      {
         var _loc2_:MovieClip = param1.currentTarget as MovieClip;
         _loc2_.gotoAndStop("Ready");
      }
      
      public function method_1907() : void
      {
         var _loc2_:MovieClip = null;
         var _loc1_:MovieClip = var_2.am_ChannelChoices;
         _loc1_.filters = null;
         while(_loc1_.numChildren)
         {
            _loc2_ = _loc1_.removeChildAt(0) as MovieClip;
            var_1.UIBasicButton_DestroyBasicButton(_loc2_);
            _loc2_.removeEventListener(MouseEvent.ROLL_OVER,this.method_288);
            _loc2_.addEventListener(MouseEvent.ROLL_OUT,this.method_378);
         }
      }
      
      private function method_953() : void
      {
         var _loc5_:Object = null;
         var _loc6_:MovieClip = null;
         this.method_1237(var_1.clientEnt ? var_1.clientEnt.entType.className : null,var_1.clientEnt ? int(var_1.clientEnt.entType.baseLevel) : int(null));
         if(!this.var_1855)
         {
            this.var_1855 = method_5(var_2.am_ChatChange,this.method_1759);
            this.var_1855.mMovieClip.mouseChildren = false;
         }
         this.method_952();
         var _loc1_:MovieClip = var_2.am_ChatOptions.am_ChatChoices;
         _loc1_.filters = [const_420];
         var _loc2_:Number = 0;
         var _loc3_:uint = this.var_325.length;
         var _loc4_:* = int(_loc3_ - 1);
         while(_loc4_ >= 0)
         {
            _loc5_ = this.var_325[_loc4_];
            _loc6_ = class_4.method_16("");
            if(_loc3_ == 1)
            {
               _loc6_ = class_4.method_16("a_ChatOptionSingle");
            }
            else if(_loc4_ == _loc3_ - 1)
            {
               _loc6_ = class_4.method_16("a_ChatOptionBottom");
            }
            else if(_loc4_ == 0)
            {
               _loc6_ = class_4.method_16("a_ChatOptionTop");
            }
            else
            {
               _loc6_ = class_4.method_16("a_ChatOptionMiddle");
            }
            _loc6_.gotoAndStop("Ready");
            _loc1_.addChild(_loc6_);
            _loc2_ -= _loc6_.height;
            _loc6_.y = _loc2_;
            MathUtil.method_2(_loc6_.am_Text,_loc5_.text);
            MathUtil.method_2(_loc6_.am_Keys,_loc5_.keys);
            _loc6_.dyn_object = _loc5_;
            if(_loc5_.text)
            {
               method_5(_loc6_,this.method_1411,this.method_288,this.method_378);
            }
            _loc4_--;
         }
         _loc1_.visible = false;
      }
      
      public function method_952() : void
      {
         var _loc2_:MovieClip = null;
         var _loc3_:Object = null;
         var _loc1_:MovieClip = var_2.am_ChatOptions.am_ChatChoices;
         _loc1_.filters = null;
         while(_loc1_.numChildren)
         {
            _loc2_ = _loc1_.removeChildAt(0) as MovieClip;
            _loc3_ = _loc2_.dyn_object;
            _loc2_.dyn_object = null;
            if(_loc3_.text)
            {
               _loc2_.removeEventListener(MouseEvent.ROLL_OVER,this.method_288);
               _loc2_.removeEventListener(MouseEvent.ROLL_OUT,this.method_378);
            }
         }
      }
      
      private function method_1759(param1:MouseEvent) : void
      {
         this.method_1355();
         param1.stopPropagation();
      }
      
      private function method_1355() : void
      {
         var _loc1_:MovieClip = var_2.am_ChatOptions.am_ChatChoices;
         var _loc2_:Boolean = _loc1_.visible;
         this.method_953();
         if(_loc2_)
         {
            this.method_240();
         }
         else
         {
            _loc1_.visible = true;
            this.method_310();
         }
      }
      
      private function method_240() : void
      {
         var _loc1_:MovieClip = null;
         if(var_2)
         {
            _loc1_ = var_2.am_ChatOptions.am_ChatChoices;
            _loc1_.visible = false;
         }
      }
      
      private function method_1411(param1:MouseEvent) : void
      {
         var _loc4_:String = null;
         var _loc2_:MovieClip = param1.target as MovieClip;
         var _loc3_:Object = _loc2_.dyn_object;
         if(_loc3_.cmd != "")
         {
            if(_loc3_.cmd == "Reply")
            {
               this.method_737();
            }
            else if(_loc3_.cmd == "SendChat")
            {
               _loc4_ = var_2.am_ChatEntry.text;
               if(_loc4_)
               {
                  this.method_731();
               }
            }
            else if(_loc3_.cmd == "BeginChat")
            {
               this.BeginChat(null);
            }
            else if(_loc3_.cmd == "Say" || _loc3_.cmd == "Party" || _loc3_.cmd == "Guild" || _loc3_.cmd == "Officer")
            {
               this.method_109(_loc3_.cmd);
               this.BeginChat(null);
            }
            else if(_loc3_.send)
            {
               this.method_537(var_1.clientEntID,_loc3_.cmd);
            }
            else if(!_loc3_.send)
            {
               this.BeginChat(_loc3_.cmd);
            }
         }
         this.method_240();
      }
      
      public function AddItemInfoToChatEntry(param1:String, param2:String) : void
      {
         if(!this.var_506.length)
         {
            var_2.am_ChatEntry.addEventListener(TextEvent.TEXT_INPUT,this.method_381);
         }
         if(this.var_506.length < const_758)
         {
            this.var_232.push(param1);
            this.var_506.push(param2);
            if(var_2.am_ChatEntry.text.length)
            {
               var_2.am_ChatEntry.text += param1;
               var_2.stage.focus = var_2.am_ChatEntry;
               var_1.mKeybindManager.SetContext(var_1.CONTEXT_CHAT);
               this.var_1009 = true;
            }
            else
            {
               this.BeginChat(param1);
            }
         }
      }
      
      private function method_1478(param1:String) : String
      {
         while(this.var_506.length)
         {
            param1 = param1.replace(this.var_232.pop(),this.var_506.pop());
         }
         var_2.am_ChatEntry.removeEventListener(TextEvent.TEXT_INPUT,this.method_381);
         return param1;
      }
      
      private function method_381(param1:Event) : void
      {
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         var _loc2_:TextField = param1.target as TextField;
         var _loc3_:int = 0;
         while(_loc3_ < this.var_232.length)
         {
            _loc4_ = _loc2_.text.indexOf(this.var_232[_loc3_]);
            _loc5_ = _loc4_ + this.var_232[_loc3_].length;
            if(_loc2_.selectionBeginIndex < _loc5_ && _loc2_.selectionEndIndex > _loc4_)
            {
               _loc2_.setSelection(Math.min(_loc2_.selectionBeginIndex,_loc4_),Math.max(_loc2_.selectionEndIndex,_loc5_));
               this.var_232.splice(_loc3_,1);
               this.var_506.splice(_loc3_,1);
               break;
            }
            _loc3_++;
         }
         if(!this.var_232.length)
         {
            var_2.am_ChatEntry.removeEventListener(TextEvent.TEXT_INPUT,this.method_381);
         }
      }
      
      private function method_689(param1:Boolean) : void
      {
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         var _loc6_:Boolean = false;
         if(!this.var_232.length)
         {
            return;
         }
         var _loc2_:TextField = var_2.am_ChatEntry;
         var _loc3_:int = 0;
         while(_loc3_ < this.var_232.length)
         {
            _loc4_ = _loc2_.text.indexOf(this.var_232[_loc3_]);
            _loc5_ = _loc4_ + this.var_232[_loc3_].length;
            _loc6_ = param1 ? _loc2_.selectionEndIndex == _loc5_ : _loc2_.selectionBeginIndex == _loc4_;
            if(_loc2_.selectionBeginIndex < _loc5_ && _loc2_.selectionEndIndex > _loc4_ || _loc6_)
            {
               _loc2_.setSelection(Math.min(_loc2_.selectionBeginIndex,_loc4_),Math.max(_loc2_.selectionEndIndex,_loc5_));
               this.var_232.splice(_loc3_,1);
               this.var_506.splice(_loc3_,1);
               break;
            }
            _loc3_++;
         }
         if(!this.var_232.length)
         {
            var_2.am_ChatEntry.removeEventListener(TextEvent.TEXT_INPUT,this.method_381);
         }
      }
      
      private function method_1115(param1:String, param2:String, param3:String) : String
      {
         var _loc4_:String = "<a href=\'event:" + param1 + "," + param3 + "\'>";
         return _loc4_ + param2 + "</a>";
      }
      
      public function method_1881(param1:String) : String
      {
         var _loc2_:uint = 0;
         var _loc3_:uint = uint(param1);
         if(_loc3_ == 0)
         {
            _loc2_ = ScreenArmory.const_24;
         }
         else if(_loc3_ == 1)
         {
            _loc2_ = ScreenArmory.const_22;
         }
         else if(_loc3_ == 2)
         {
            _loc2_ = ScreenArmory.const_23;
         }
         else if(_loc3_ == class_64.const_775)
         {
            _loc2_ = ScreenArmory.const_23;
         }
         else if(_loc3_ == class_64.const_787)
         {
            _loc2_ = ScreenArmory.const_22;
         }
         return "<font color=\'#" + _loc2_.toString(16) + "\'>";
      }
      
      private function method_215(param1:String, param2:Boolean = false) : String
      {
         var _loc10_:String = null;
         var _loc11_:Array = null;
         var _loc12_:String = null;
         var _loc13_:int = 0;
         var _loc14_:String = null;
         var _loc15_:String = null;
         var _loc16_:Array = null;
         var _loc17_:String = null;
         var _loc18_:String = null;
         var _loc19_:String = null;
         if(param1.indexOf("{") <= -1 || param1.indexOf("}") <= -1)
         {
            return null;
         }
         var _loc3_:String = "";
         var _loc4_:String = param1;
         var _loc6_:int = param1.indexOf("{");
         var _loc7_:int = param1.indexOf("}",_loc6_);
         var _loc8_:String = "";
         while(_loc7_ > -1)
         {
            _loc10_ = _loc4_.substring(0,_loc6_);
            _loc3_ += _loc10_;
            _loc8_ += _loc10_;
            _loc11_ = _loc4_.substring(_loc6_ + 1,_loc7_).split(":");
            _loc12_ = _loc11_.shift();
            _loc13_ = const_8.indexOf(_loc12_);
            _loc14_ = _loc12_ + ":";
            _loc15_ = null;
            if(_loc13_ == 0)
            {
               _loc15_ = this.method_1984(_loc11_);
            }
            else if(_loc13_ == 1)
            {
               _loc15_ = this.method_1356(_loc11_);
            }
            else if(_loc13_ == 2)
            {
               _loc15_ = this.method_1583(_loc11_);
            }
            else if(_loc13_ == 3)
            {
               _loc15_ = this.method_1390(_loc11_);
            }
            else if(_loc13_ == 4)
            {
               _loc15_ = this.method_1205(_loc11_);
            }
            else if(_loc13_ == 5)
            {
               _loc15_ = this.method_1871(_loc11_);
            }
            else if(_loc13_ == 6)
            {
               _loc15_ = this.method_1742(_loc11_);
            }
            else if(_loc13_ == 7)
            {
               _loc15_ = this.method_1684(_loc11_);
            }
            else if(_loc13_ == 8)
            {
               _loc15_ = this.method_1537(_loc11_);
            }
            else if(_loc13_ == 9)
            {
               _loc15_ = this.method_1580(_loc11_);
            }
            if(_loc15_)
            {
               _loc16_ = _loc15_.split(":");
               _loc17_ = _loc16_[0];
               _loc18_ = _loc16_[1];
               _loc19_ = this.method_1881(_loc16_[2]);
               if(0 < const_758)
               {
                  var _loc20_:String = _loc19_ + "[" + this.method_1115(_loc12_,_loc17_,_loc18_) + "]" + var_121;
                  _loc3_ += null;
                  var _loc5_:uint = 1;
               }
               else
               {
                  _loc3_ += "[" + _loc17_ + "]";
               }
               _loc8_ += "[" + _loc17_ + "]";
            }
            else
            {
               _loc3_ += _loc4_.substring(_loc6_,_loc7_ + 1);
            }
            _loc4_ = _loc4_.substr(_loc7_ + 1);
            _loc6_ = _loc4_.indexOf("{");
            _loc7_ = _loc4_.indexOf("}");
         }
         var _loc9_:String = _loc4_;
         _loc3_ += _loc9_;
         _loc8_ += _loc9_;
         if(param2)
         {
            return _loc8_;
         }
         return _loc3_;
      }
      
      private function method_1984(param1:Array) : String
      {
         if(param1.length != const_1189)
         {
            return null;
         }
         var _loc2_:GearType = class_14.gearTypesDict[param1[0]];
         if(!_loc2_ || _loc2_.var_884)
         {
            return null;
         }
         var _loc3_:int = 1;
         while(_loc3_ < param1.length)
         {
            param1[_loc3_] = uint(param1[_loc3_]);
            _loc3_++;
         }
         var _loc4_:class_64 = param1[1] ? class_64.method_56(param1[1]) : null;
         var _loc5_:class_64 = param1[2] ? class_64.method_56(param1[2]) : null;
         var _loc6_:class_64 = param1[3] ? class_64.method_56(param1[3]) : null;
         var _loc7_:class_21 = class_14.var_194[param1[4]];
         var _loc8_:class_21 = class_14.var_194[param1[5]];
         var _loc9_:class_42 = new class_42(_loc2_,_loc4_,_loc5_,_loc6_,_loc7_,_loc8_,false);
         var _loc10_:uint = uint(var_2.am_ChatHistory.text.length);
         var _loc11_:String = _loc10_.toString() + _loc2_.gearName;
         this.var_154[_loc11_] = _loc9_;
         return _loc2_.displayName + ":" + _loc2_.gearName + ":" + String(GearType.var_603[_loc2_.var_8]);
      }
      
      private function method_1356(param1:Array) : String
      {
         if(param1.length != const_1168)
         {
            return null;
         }
         var _loc2_:uint = uint(param1[0]);
         var _loc3_:class_64 = _loc2_ ? class_64.method_56(_loc2_) : null;
         if(!_loc3_)
         {
            return null;
         }
         var _loc4_:String = _loc3_.var_13.var_693 + class_64.const_780[_loc3_.var_8] + (_loc3_.var_8 ? String(_loc3_.secondary) : "");
         var _loc5_:uint = uint(var_2.am_ChatHistory.text.length);
         var _loc6_:String = _loc5_.toString() + _loc4_;
         this.var_154[_loc6_] = _loc3_;
         var _loc7_:String = _loc3_.method_118() ? String(class_64.const_775) : (_loc3_.method_124() ? String(class_64.const_787) : String(_loc3_.var_8));
         return _loc3_.method_49() + ":" + _loc4_ + ":" + _loc7_;
      }
      
      private function method_1583(param1:Array) : String
      {
         if(param1.length != const_1092)
         {
            return null;
         }
         var _loc2_:uint = uint(param1[0]);
         if(!_loc2_)
         {
            return null;
         }
         var _loc3_:class_8 = class_14.var_629[_loc2_];
         if(!_loc3_)
         {
            return null;
         }
         var _loc4_:String = _loc3_.var_537;
         var _loc5_:uint = uint(var_2.am_ChatHistory.text.length);
         var _loc6_:String = _loc5_.toString() + _loc4_;
         this.var_154[_loc6_] = _loc3_;
         return _loc3_.displayName + ":" + _loc4_ + ":" + String(GearType.var_603[_loc3_.var_139]);
      }
      
      private function method_1390(param1:Array) : String
      {
         if(param1.length != const_1207)
         {
            return null;
         }
         var _loc2_:int = 0;
         while(_loc2_ < param1.length)
         {
            param1[_loc2_] = uint(param1[_loc2_]);
            _loc2_++;
         }
         var _loc3_:class_7 = class_14.var_224[param1[0]];
         if(!_loc3_)
         {
            return null;
         }
         var _loc4_:class_87 = new class_87(var_1,_loc3_,param1[1],param1[2],0);
         var _loc5_:String = _loc3_.var_310;
         var _loc6_:uint = uint(var_2.am_ChatHistory.text.length);
         var _loc7_:String = _loc6_.toString() + _loc5_;
         this.var_154[_loc7_] = _loc4_;
         var _loc8_:String = _loc3_.var_255;
         var _loc9_:uint = _loc8_ == "M" ? uint(0) : (_loc8_ == "R" ? uint(1) : 2);
         return _loc3_.displayName + ":" + _loc5_ + ":" + _loc9_;
      }
      
      private function method_1205(param1:Array) : String
      {
         if(param1.length != const_870)
         {
            return null;
         }
         var _loc2_:uint = uint(param1[0]);
         var _loc3_:class_20 = class_14.var_464[_loc2_];
         if(!_loc3_)
         {
            return null;
         }
         var _loc4_:String = _loc3_.var_566;
         var _loc5_:uint = uint(var_2.am_ChatHistory.text.length);
         var _loc6_:String = _loc5_.toString() + _loc4_;
         this.var_154[_loc6_] = _loc3_;
         var _loc7_:String = _loc3_.var_255;
         var _loc8_:uint = _loc7_ == "M" ? uint(0) : (_loc7_ == "R" ? uint(1) : uint(2));
         return _loc3_.displayName + ":" + _loc4_ + ":" + _loc8_;
      }
      
      private function method_1871(param1:Array) : String
      {
         if(param1.length != const_1076)
         {
            return null;
         }
         var _loc2_:Entity = var_1.clientEnt;
         if(!_loc2_)
         {
            return null;
         }
         var _loc3_:String = param1[0];
         var _loc4_:uint = uint(param1[1]);
         var _loc5_:String = _loc3_ + _loc4_.toString();
         var _loc6_:class_10 = class_14.var_1101[_loc5_];
         if(!_loc6_)
         {
            return null;
         }
         var _loc7_:String = _loc4_ ? _loc6_.abilityName + _loc4_.toString() : _loc6_.abilityName;
         var _loc8_:PowerType = class_14.powerTypesDict[_loc7_];
         var _loc9_:String = _loc6_.abilityName + _loc4_.toString();
         var _loc10_:uint = uint(var_2.am_ChatHistory.text.length);
         var _loc11_:String = _loc10_.toString() + _loc9_;
         this.var_154[_loc11_] = _loc6_;
         var _loc12_:uint = _loc4_ / class_10.const_105 * 2;
         return _loc8_.displayName + " - Rank " + _loc6_.rank.toString() + ":" + _loc9_ + ":" + _loc12_.toString();
      }
      
      private function method_1742(param1:Array) : String
      {
         if(param1.length != const_1257)
         {
            return null;
         }
         var _loc2_:Entity = var_1.clientEnt;
         if(!_loc2_)
         {
            return null;
         }
         var _loc3_:uint = uint(param1[0]);
         var _loc4_:class_17 = class_14.var_872[_loc3_];
         if(!_loc4_)
         {
            return null;
         }
         var _loc5_:String = _loc4_.var_61;
         var _loc6_:uint = uint(var_2.am_ChatHistory.text.length);
         var _loc7_:String = _loc6_.toString() + _loc5_;
         this.var_154[_loc7_] = _loc4_;
         return _loc4_.displayName + ":" + _loc5_ + ":" + "0";
      }
      
      private function method_1684(param1:Array) : String
      {
         if(param1.length != const_965)
         {
            return null;
         }
         var _loc2_:Entity = var_1.clientEnt;
         if(!_loc2_)
         {
            return null;
         }
         var _loc3_:uint = uint(param1[0]);
         var _loc4_:class_16 = class_14.var_212[_loc3_];
         if(!_loc4_)
         {
            return null;
         }
         var _loc5_:String = _loc4_.var_1205;
         var _loc6_:uint = uint(var_2.am_ChatHistory.text.length);
         var _loc7_:String = _loc6_.toString() + _loc5_;
         this.var_154[_loc7_] = _loc4_;
         var _loc8_:String = _loc4_.method_450();
         var _loc9_:uint = _loc8_ == "M" ? uint(0) : (_loc8_ == "R" ? uint(1) : uint(2));
         return _loc4_.displayName + ":" + _loc5_ + ":" + _loc9_.toString();
      }
      
      private function method_1537(param1:Array) : String
      {
         if(param1.length != const_1144)
         {
            return null;
         }
         var _loc2_:Entity = var_1.clientEnt;
         if(!_loc2_)
         {
            return null;
         }
         var _loc3_:uint = uint(param1[0]);
         var _loc4_:class_21 = class_14.var_194[_loc3_];
         if(!_loc4_)
         {
            return null;
         }
         var _loc5_:String = _loc4_.var_1215;
         var _loc6_:uint = uint(var_2.am_ChatHistory.text.length);
         var _loc7_:String = _loc6_.toString() + _loc5_;
         this.var_154[_loc7_] = _loc4_;
         var _loc8_:String = _loc4_.var_8;
         var _loc9_:uint = _loc8_ == "M" ? uint(0) : (_loc8_ == "R" ? uint(1) : uint(2));
         return _loc4_.displayName + ":" + _loc5_ + ":" + _loc9_;
      }
      
      private function method_1580(param1:Array) : String
      {
         if(param1.length != const_1069)
         {
            return null;
         }
         var _loc2_:Entity = var_1.clientEnt;
         if(!_loc2_)
         {
            return null;
         }
         var _loc3_:uint = uint(param1[0]);
         var _loc4_:class_3 = class_14.var_419[_loc3_];
         if(!_loc4_)
         {
            return null;
         }
         var _loc5_:String = _loc4_.var_1950;
         var _loc6_:uint = uint(var_2.am_ChatHistory.text.length);
         var _loc7_:String = String(_loc6_) + _loc5_;
         this.var_154[_loc7_] = _loc4_;
         var _loc8_:String = _loc4_.var_8;
         var _loc9_:uint = _loc8_ == "M" ? uint(0) : (_loc8_ == "R" ? uint(1) : uint(2));
         return _loc4_.displayName + ":" + _loc5_ + ":" + _loc9_;
      }
      
      private function method_1149(param1:class_8) : void
      {
         var _loc2_:MovieClip = this.var_671.mMovieClip;
         var _loc3_:uint = class_8.method_220(param1.var_139);
         if(_loc3_ == class_8.const_705)
         {
            MathUtil.method_8(_loc2_.am_Name,param1.displayName,ScreenArmory.const_24);
         }
         else if(_loc3_ == class_8.const_725)
         {
            MathUtil.method_8(_loc2_.am_Name,param1.displayName,ScreenArmory.const_22);
         }
         else if(_loc3_ == class_8.const_637)
         {
            MathUtil.method_8(_loc2_.am_Name,param1.displayName,ScreenArmory.const_23);
         }
         var _loc4_:uint = const_946;
         if(param1.var_103 == "Trog")
         {
            _loc4_ = const_854;
         }
         else if(param1.var_103 == "Mythic")
         {
            _loc4_ = const_1079;
         }
         else if(param1.var_103 == "Infernal")
         {
            _loc4_ = const_1156;
         }
         else if(param1.var_103 == "Undead")
         {
            _loc4_ = const_887;
         }
         else if(param1.var_103 == "Draconic")
         {
            _loc4_ = const_959;
         }
         else if(param1.var_103 == "Sylvan")
         {
            _loc4_ = const_1180;
         }
         MathUtil.method_8(_loc2_.am_Type,param1.var_103 + " Material",_loc4_);
         this.var_671.Show();
      }
      
      private function method_494() : void
      {
         var_1.screenHudTooltip.HideTooltip(true);
         this.var_671.Hide();
      }
      
      private function method_566(param1:String) : String
      {
         var _loc5_:String = null;
         var _loc6_:String = null;
         var _loc7_:String = null;
         if(!param1)
         {
            return "";
         }
         var _loc2_:int = param1.indexOf("{");
         var _loc3_:int = param1.indexOf("}");
         var _loc4_:String = "";
         while(_loc3_ > -1)
         {
            _loc5_ = param1.substr(0,_loc2_);
            _loc4_ += _loc5_;
            _loc6_ = param1.substring(_loc2_,_loc3_ + 1);
            _loc7_ = this.method_215(_loc6_,true);
            if(_loc7_)
            {
               _loc4_ += _loc7_;
               this.AddItemInfoToChatEntry(_loc7_,_loc6_);
            }
            param1 = param1.substr(_loc3_ + 1);
            _loc2_ = param1.indexOf("{");
            _loc3_ = param1.indexOf("}");
         }
         return _loc4_ + param1;
      }
   }
}

