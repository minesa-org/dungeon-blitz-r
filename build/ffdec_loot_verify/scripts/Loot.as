package
{
   import flash.display.DisplayObject;
   import flash.display.Sprite;
   import flash.filters.GlowFilter;
   import flash.geom.Point;
   import flash.geom.Rectangle;
   import flash.utils.Dictionary;
   
   public class Loot
   {
      
      private static var var_1100:Dictionary;
      
      private static const const_618:int = -52;
      
      private static const const_562:int = -35;
      
      private static const const_1122:uint = 500;
      
      private static var goldGfxTypes:Vector.<GfxType>;
      
      public static var var_846:GfxType;
      
      public static var var_734:GfxType;
      
      public static const const_1236:int = 2;
      
      §§push(false);
      var _loc1_:Boolean = true;
      var _loc2_:* = §§pop();
      
      private static var var_1936:Dictionary = new Dictionary();
      
      private static var var_1945:Dictionary = new Dictionary();
      
      private static const const_1033:int = -26;
      
      loop0:
      while(true)
      {
         const_618 = -52;
         loop1:
         while(true)
         {
            const_562 = -35;
            const_1122 = 500;
            var_846 = new GfxType();
            var_734 = new GfxType();
            const_1236 = 2;
            method_975();
            method_582();
            §§push(var_846);
            loop2:
            while(true)
            {
               §§push("SFX_1.swf");
               loop3:
               while(true)
               {
                  §§pop().var_29 = §§pop();
                  §§push(var_846);
                  loop4:
                  while(true)
                  {
                     §§pop().animScale = 1.8;
                     loop5:
                     while(true)
                     {
                        §§push(var_846);
                        loop6:
                        while(_loc1_)
                        {
                           §§pop().bFireAndForget = true;
                           loop7:
                           while(_loc1_)
                           {
                              §§push(var_846);
                              loop8:
                              while(_loc1_ || Boolean(_loc2_))
                              {
                                 §§push("a_HealthLoot");
                                 while(true)
                                 {
                                    §§pop().animClass = §§pop();
                                    if(!_loc1_)
                                    {
                                       break;
                                    }
                                    §§push(var_846);
                                    if(_loc1_ || Boolean(Loot))
                                    {
                                       if(_loc1_)
                                       {
                                          §§push("Appear");
                                          if(!(_loc2_ && Boolean(_loc2_)))
                                          {
                                             if(_loc1_ || Boolean(Loot))
                                             {
                                                §§pop().baseAnim = §§pop();
                                                §§push(var_734);
                                                loop10:
                                                while(true)
                                                {
                                                   §§push("SFX_1.swf");
                                                   loop11:
                                                   while(true)
                                                   {
                                                      §§pop().var_29 = §§pop();
                                                      §§push(var_734);
                                                      loop12:
                                                      while(true)
                                                      {
                                                         §§pop().animScale = 1.8;
                                                         loop13:
                                                         while(true)
                                                         {
                                                            §§push(var_734);
                                                            loop14:
                                                            while(true)
                                                            {
                                                               §§pop().bFireAndForget = true;
                                                               if(!(_loc1_ || _loc1_))
                                                               {
                                                                  break;
                                                               }
                                                               §§push(var_734);
                                                               loop15:
                                                               while(_loc1_)
                                                               {
                                                                  §§push("a_SoulLoot");
                                                                  loop16:
                                                                  while(true)
                                                                  {
                                                                     §§pop().animClass = §§pop();
                                                                     while(_loc1_ || Boolean(Loot))
                                                                     {
                                                                        §§push(var_734);
                                                                        if(!_loc2_)
                                                                        {
                                                                           if(_loc2_ && Boolean(Loot))
                                                                           {
                                                                              break loop16;
                                                                           }
                                                                           if(!_loc2_)
                                                                           {
                                                                              §§push("Appear");
                                                                              if(!_loc2_)
                                                                              {
                                                                                 if(!_loc2_)
                                                                                 {
                                                                                    §§pop().baseAnim = §§pop();
                                                                                    if(_loc1_)
                                                                                    {
                                                                                       if(_loc1_)
                                                                                       {
                                                                                          break loop0;
                                                                                       }
                                                                                       continue loop7;
                                                                                    }
                                                                                    continue;
                                                                                 }
                                                                                 continue loop11;
                                                                              }
                                                                              continue loop16;
                                                                           }
                                                                           continue loop10;
                                                                        }
                                                                        continue loop15;
                                                                     }
                                                                     continue loop13;
                                                                  }
                                                                  continue loop14;
                                                               }
                                                               continue loop12;
                                                            }
                                                            break;
                                                         }
                                                         break;
                                                      }
                                                      break;
                                                   }
                                                   break;
                                                }
                                                continue loop5;
                                             }
                                             continue loop3;
                                          }
                                          continue;
                                       }
                                       continue loop4;
                                    }
                                    continue loop8;
                                 }
                                 break loop4;
                              }
                              continue loop6;
                           }
                           break loop5;
                        }
                        continue loop2;
                     }
                     break loop3;
                  }
                  break loop2;
               }
               continue loop1;
            }
            break;
         }
      }
      
      internal var var_1:Game;
      
      internal var lootID:uint;
      
      internal var var_11:Point;
      
      internal var var_2614:uint;
      
      internal var superAnim:SuperAnimInstance;
      
      internal var var_2607:Boolean = false;
      
      internal var var_2487:Boolean = false;
      
      internal var var_2535:uint;
      
      internal var gearType:GearType;
      
      internal var materialType:class_8;
      
      internal var var_79:uint;
      
      internal var var_2169:uint;
      
      internal var var_286:class_15;
      
      internal var var_647:class_21;
      
      internal var var_1509:uint;
      
      internal var var_2889:Boolean = false;
      
      public function Loot(param1:Game, param2:uint, param3:Point, param4:GearType, param5:class_8, param6:uint, param7:uint, param8:class_15, param9:class_21, param10:uint = 0)
      {
         §§push(false);
         var _loc18_:Boolean = true;
         var _loc19_:* = §§pop();
         var _loc11_:GfxType = null;
         var _loc12_:* = 0;
         var _loc13_:GfxType = null;
         var _loc14_:* = NaN;
         var _loc15_:GfxType = null;
         var _loc16_:GfxType = null;
         super();
         loop59:
         while(true)
         {
            if(!_loc19_)
            {
               this.var_1 = param1;
               loop60:
               while(true)
               {
                  loop61:
                  while(true)
                  {
                     if(_loc18_ || Boolean(this))
                     {
                        this.lootID = param2;
                        this.gearType = param4;
                        this.materialType = param5;
                        do
                        {
                           this.var_286 = param8;
                           this.var_647 = param9;
                        }
                        while(!_loc18_);
                        this.var_11 = new Point();
                        loop62:
                        while(true)
                        {
                           loop63:
                           while(true)
                           {
                              loop64:
                              while(true)
                              {
                                 if(!_loc19_)
                                 {
                                    this.var_2614 = this.var_1.mTimeThisTick;
                                    loop68:
                                    while(true)
                                    {
                                       loop69:
                                       while(true)
                                       {
                                          loop77:
                                          while(true)
                                          {
                                             loop78:
                                             while(true)
                                             {
                                                loop79:
                                                while(true)
                                                {
                                                   loop80:
                                                   while(true)
                                                   {
                                                      loop81:
                                                      while(true)
                                                      {
                                                         if(!_loc19_)
                                                         {
                                                            while(true)
                                                            {
                                                               if(param4)
                                                               {
                                                                  if(_loc18_)
                                                                  {
                                                                     this.superAnim = this.var_1.RenderGear(Game.const_1015,param4,1,null,null,null,true);
                                                                     if(!_loc19_)
                                                                     {
                                                                        §§push(this.superAnim);
                                                                        if(!(_loc19_ && Boolean(param1)))
                                                                        {
                                                                           §§pop().m_TheDO.filters = [new GlowFilter(4279367708)];
                                                                           break loop60;
                                                                           continue;
                                                                        }
                                                                        §§goto(addr08bb);
                                                                     }
                                                                     else
                                                                     {
                                                                        addr030e:
                                                                     }
                                                                  }
                                                                  else
                                                                  {
                                                                     §§goto(addr04b6);
                                                                  }
                                                               }
                                                               else
                                                               {
                                                                  if(param5)
                                                                  {
                                                                     _loc11_ = var_1936[param5.var_537];
                                                                     if(!_loc11_)
                                                                     {
                                                                        if(_loc19_)
                                                                        {
                                                                           break loop60;
                                                                        }
                                                                        _loc11_ = new GfxType();
                                                                        _loc11_.var_29 = "UI_1.swf";
                                                                        if(!_loc19_)
                                                                        {
                                                                           _loc11_.animClass = param5.iconName;
                                                                           while(true)
                                                                           {
                                                                              _loc11_.bFireAndForget = true;
                                                                              while(_loc18_ || Boolean(this))
                                                                              {
                                                                                 var_1936[param5.var_537] = _loc11_;
                                                                                 if(_loc19_)
                                                                                 {
                                                                                    continue;
                                                                                 }
                                                                              }
                                                                           }
                                                                           addr016d:
                                                                        }
                                                                        while(false)
                                                                        {
                                                                           §§goto(addr016d);
                                                                        }
                                                                     }
                                                                     this.superAnim = new SuperAnimInstance(this.var_1,_loc11_,true);
                                                                     if(!_loc19_)
                                                                     {
                                                                        this.superAnim.m_Seq.method_34(Seq.C_USEPOWER,"Ready",true);
                                                                     }
                                                                     break loop60;
                                                                  }
                                                                  loop82:
                                                                  while(true)
                                                                  {
                                                                     loop83:
                                                                     while(true)
                                                                     {
                                                                        loop84:
                                                                        while(true)
                                                                        {
                                                                           loop88:
                                                                           while(true)
                                                                           {
                                                                              loop89:
                                                                              while(true)
                                                                              {
                                                                                 §§push(param6);
                                                                                 if(_loc18_ || Boolean(param2))
                                                                                 {
                                                                                    if(§§pop())
                                                                                    {
                                                                                       this.var_79 = param6;
                                                                                       §§push(this.var_79);
                                                                                       §§push(40);
                                                                                       while(true)
                                                                                       {
                                                                                          if(§§pop() <= §§pop())
                                                                                          {
                                                                                             break loop89;
                                                                                          }
                                                                                          §§push(this.var_79);
                                                                                          §§push(65);
                                                                                          loop41:
                                                                                          while(true)
                                                                                          {
                                                                                             if(§§pop() <= §§pop())
                                                                                             {
                                                                                                break loop88;
                                                                                             }
                                                                                             §§push(this.var_79);
                                                                                             §§push(113);
                                                                                             loop42:
                                                                                             while(true)
                                                                                             {
                                                                                                if(!_loc19_)
                                                                                                {
                                                                                                   if(§§pop() <= §§pop())
                                                                                                   {
                                                                                                      break loop84;
                                                                                                   }
                                                                                                   §§push(this.var_79);
                                                                                                   if(_loc18_)
                                                                                                   {
                                                                                                      §§push(160);
                                                                                                      while(true)
                                                                                                      {
                                                                                                         if(!_loc18_)
                                                                                                         {
                                                                                                            break loop42;
                                                                                                         }
                                                                                                         if(§§pop() <= §§pop())
                                                                                                         {
                                                                                                            break loop82;
                                                                                                         }
                                                                                                         §§push(this.var_79);
                                                                                                      }
                                                                                                      while(true)
                                                                                                      {
                                                                                                         this.superAnim = new SuperAnimInstance(this.var_1,goldGfxTypes[_loc12_],true);
                                                                                                         §§push(this.superAnim);
                                                                                                         if(_loc19_)
                                                                                                         {
                                                                                                            break loop79;
                                                                                                         }
                                                                                                         §§push(§§pop().m_Seq);
                                                                                                         if(!(_loc18_ || Boolean(param3)))
                                                                                                         {
                                                                                                            break loop78;
                                                                                                         }
                                                                                                         §§push(Seq.C_USEPOWER);
                                                                                                         if(_loc19_)
                                                                                                         {
                                                                                                            break loop77;
                                                                                                         }
                                                                                                         §§push("Appear");
                                                                                                         if(!(_loc18_ || Boolean(param3)))
                                                                                                         {
                                                                                                            break loop69;
                                                                                                         }
                                                                                                         §§push(true);
                                                                                                         if(_loc19_)
                                                                                                         {
                                                                                                            break loop68;
                                                                                                         }
                                                                                                         §§pop().method_34(§§pop(),§§pop(),§§pop());
                                                                                                         while(true)
                                                                                                         {
                                                                                                            break loop60;
                                                                                                            break;
                                                                                                         }
                                                                                                      }
                                                                                                      break loop79;
                                                                                                      addr02f5:
                                                                                                      addr0227:
                                                                                                   }
                                                                                                   break loop83;
                                                                                                }
                                                                                                continue loop41;
                                                                                             }
                                                                                             break;
                                                                                          }
                                                                                       }
                                                                                    }
                                                                                    else
                                                                                    {
                                                                                       if(!this.var_286)
                                                                                       {
                                                                                          §§push(param10);
                                                                                          break loop83;
                                                                                       }
                                                                                       if(_loc18_)
                                                                                       {
                                                                                          _loc13_ = var_1945[this.var_286.var_1375];
                                                                                          if(!_loc13_)
                                                                                          {
                                                                                             if(!(_loc18_ || Boolean(param1)))
                                                                                             {
                                                                                                break loop60;
                                                                                             }
                                                                                             _loc13_ = new GfxType();
                                                                                             _loc13_.var_29 = "UI_2.swf";
                                                                                             if(_loc18_ || Boolean(param1))
                                                                                             {
                                                                                                _loc13_.animClass = this.var_286.var_2810;
                                                                                             }
                                                                                             loop37:
                                                                                             while(true)
                                                                                             {
                                                                                                _loc13_.bFireAndForget = true;
                                                                                                loop38:
                                                                                                while(true)
                                                                                                {
                                                                                                   _loc13_.animScale = 1;
                                                                                                   while(_loc18_)
                                                                                                   {
                                                                                                      var_1945[this.var_286.var_1375] = _loc13_;
                                                                                                      if(!(_loc19_ && Boolean(param3)))
                                                                                                      {
                                                                                                         if(!(_loc19_ && Boolean(param1)))
                                                                                                         {
                                                                                                            break loop38;
                                                                                                         }
                                                                                                         continue loop38;
                                                                                                      }
                                                                                                   }
                                                                                                   continue loop37;
                                                                                                }
                                                                                                break;
                                                                                             }
                                                                                          }
                                                                                          this.superAnim = new SuperAnimInstance(this.var_1,_loc13_,true);
                                                                                          if(!_loc19_)
                                                                                          {
                                                                                             this.superAnim.m_Seq.method_34(Seq.C_USEPOWER,"Ready",true);
                                                                                          }
                                                                                          break loop60;
                                                                                       }
                                                                                       §§goto(addr0787);
                                                                                    }
                                                                                 }
                                                                                 loop47:
                                                                                 while(true)
                                                                                 {
                                                                                    §§push(260);
                                                                                    while(!_loc19_)
                                                                                    {
                                                                                       if(§§pop() > §§pop())
                                                                                       {
                                                                                          §§push(this.var_79);
                                                                                          if(_loc18_ || Boolean(param3))
                                                                                          {
                                                                                             if(!_loc18_)
                                                                                             {
                                                                                                continue loop47;
                                                                                             }
                                                                                             §§push(452);
                                                                                             if(!(_loc18_ || Boolean(param1)))
                                                                                             {
                                                                                                continue;
                                                                                             }
                                                                                             if(!(_loc19_ && Boolean(this)))
                                                                                             {
                                                                                                if(§§pop() > §§pop())
                                                                                                {
                                                                                                   §§push(6);
                                                                                                   if(!(_loc19_ && Boolean(param3)))
                                                                                                   {
                                                                                                      _loc12_ = §§pop();
                                                                                                      break loop47;
                                                                                                   }
                                                                                                   addr02dc:
                                                                                                   _loc12_ = §§pop();
                                                                                                   break loop47;
                                                                                                }
                                                                                                if(_loc19_)
                                                                                                {
                                                                                                   break loop81;
                                                                                                }
                                                                                                §§push(5);
                                                                                             }
                                                                                             else
                                                                                             {
                                                                                                §§goto(addr031a);
                                                                                             }
                                                                                          }
                                                                                          _loc12_ = §§pop();
                                                                                          break loop47;
                                                                                       }
                                                                                       if(_loc18_ || Boolean(param2))
                                                                                       {
                                                                                          §§push(4);
                                                                                          if(!_loc18_)
                                                                                          {
                                                                                             break loop80;
                                                                                          }
                                                                                          §§push(uint(§§pop()));
                                                                                       }
                                                                                       else
                                                                                       {
                                                                                          §§goto(addr0577);
                                                                                       }
                                                                                       §§goto(addr02dc);
                                                                                    }
                                                                                    §§goto(addr02f5);
                                                                                 }
                                                                              }
                                                                              _loc12_ = 0;
                                                                              if(!(_loc18_ || Boolean(param2)))
                                                                              {
                                                                                 break loop60;
                                                                              }
                                                                           }
                                                                           _loc12_ = 1;
                                                                           §§goto(addr030e);
                                                                        }
                                                                        if(!(_loc19_ && Boolean(param2)))
                                                                        {
                                                                           _loc12_ = 2;
                                                                           if(!_loc18_)
                                                                           {
                                                                              break loop60;
                                                                           }
                                                                        }
                                                                        else
                                                                        {
                                                                           while(true)
                                                                           {
                                                                              §§push(0.45);
                                                                              if(!(_loc19_ && Boolean(param3)))
                                                                              {
                                                                                 _loc14_ = §§pop();
                                                                                 if(false)
                                                                                 {
                                                                                    §§goto(addr0759);
                                                                                 }
                                                                                 §§goto(addr081d);
                                                                              }
                                                                              §§goto(addr075c);
                                                                           }
                                                                        }
                                                                     }
                                                                     loop85:
                                                                     while(true)
                                                                     {
                                                                        while(true)
                                                                        {
                                                                           §§push(Boolean(§§pop()));
                                                                           if(_loc18_ || Boolean(param1))
                                                                           {
                                                                              var _temp_53:* = §§pop();
                                                                              §§push(_temp_53);
                                                                              if(!_temp_53)
                                                                              {
                                                                                 break;
                                                                              }
                                                                              if(!_loc18_)
                                                                              {
                                                                                 break loop85;
                                                                              }
                                                                           }
                                                                           §§pop();
                                                                           §§push(this.var_1);
                                                                           if(_loc18_)
                                                                           {
                                                                              §§push(§§pop().clientEnt);
                                                                              if(!_loc19_)
                                                                              {
                                                                                 §§push(§§pop().combatState.var_2036);
                                                                                 if(_loc18_)
                                                                                 {
                                                                                    break loop85;
                                                                                 }
                                                                                 break;
                                                                              }
                                                                              break loop64;
                                                                           }
                                                                           break loop61;
                                                                        }
                                                                        if(§§pop())
                                                                        {
                                                                           this.var_1509 = param10;
                                                                           if(!_loc19_)
                                                                           {
                                                                              this.superAnim = new SuperAnimInstance(this.var_1,var_734,true);
                                                                              this.var_2889 = true;
                                                                              §§goto(addr05c0);
                                                                           }
                                                                           §§goto(addr071e);
                                                                        }
                                                                        else
                                                                        {
                                                                           if(!this.var_647)
                                                                           {
                                                                              this.var_2169 = param7;
                                                                              if(!_loc19_)
                                                                              {
                                                                                 addr07fb:
                                                                                 this.superAnim = new SuperAnimInstance(this.var_1,var_846,true);
                                                                                 if(_loc18_ || Boolean(param1))
                                                                                 {
                                                                                    §§push(this.superAnim.m_Seq);
                                                                                    break loop63;
                                                                                 }
                                                                                 break loop59;
                                                                              }
                                                                              break loop62;
                                                                           }
                                                                           loop87:
                                                                           while(true)
                                                                           {
                                                                              _loc15_ = var_1100[this.var_647.var_8];
                                                                              if(_loc15_)
                                                                              {
                                                                                 if(_loc19_ && Boolean(param2))
                                                                                 {
                                                                                    break;
                                                                                 }
                                                                                 _loc16_ = _loc15_.GetDuplicate();
                                                                              }
                                                                              if(_loc16_)
                                                                              {
                                                                                 _loc16_.colorSwaps.push(new ColorSwap(16734039,this.var_647.var_935,0));
                                                                                 _loc16_.colorSwaps.push(new ColorSwap(14352384,this.var_647.color,0));
                                                                                 while(true)
                                                                                 {
                                                                                    _loc16_.colorSwaps.push(new ColorSwap(7798784,this.var_647.var_209,0));
                                                                                    if(_loc18_)
                                                                                    {
                                                                                       break loop87;
                                                                                    }
                                                                                 }
                                                                                 break;
                                                                              }
                                                                              while(true)
                                                                              {
                                                                                 this.superAnim = new SuperAnimInstance(this.var_1,_loc16_,true);
                                                                                 this.superAnim.m_Seq.method_34(Seq.C_USEPOWER,"Ready",true);
                                                                                 if(false)
                                                                                 {
                                                                                    break loop87;
                                                                                 }
                                                                                 break loop60;
                                                                              }
                                                                           }
                                                                           while(true)
                                                                           {
                                                                              §§goto(addr06b3);
                                                                              addr06b3:
                                                                           }
                                                                        }
                                                                     }
                                                                     §§push(Boolean(§§pop()));
                                                                     break loop86;
                                                                  }
                                                                  _loc12_ = 3;
                                                                  if(_loc19_)
                                                                  {
                                                                     break loop60;
                                                                  }
                                                               }
                                                               §§goto(addr0227);
                                                            }
                                                         }
                                                         §§goto(addr0222);
                                                      }
                                                      §§goto(addr08ae);
                                                   }
                                                   §§goto(addr0780);
                                                }
                                                §§goto(addr057c);
                                             }
                                             §§goto(addr058c);
                                          }
                                          §§goto(addr0598);
                                       }
                                       §§goto(addr07e4);
                                    }
                                    loop31:
                                    while(true)
                                    {
                                       §§pop().method_34(§§pop(),§§pop(),§§pop());
                                       _loc14_ = 1.4;
                                       §§push(this.var_1);
                                       if(_loc19_ && Boolean(param2))
                                       {
                                          break;
                                       }
                                       §§push(§§pop().clientEnt);
                                       if(!(_loc18_ || Boolean(param2)))
                                       {
                                          break loop64;
                                       }
                                       loop70:
                                       while(true)
                                       {
                                          loop71:
                                          while(true)
                                          {
                                             loop72:
                                             while(true)
                                             {
                                                loop73:
                                                while(true)
                                                {
                                                   loop74:
                                                   while(true)
                                                   {
                                                      while(true)
                                                      {
                                                         if(§§pop())
                                                         {
                                                            if(_loc18_ || Boolean(param3))
                                                            {
                                                               §§push(_loc14_);
                                                               §§push(this.var_1509);
                                                               if(!(_loc18_ || Boolean(param1)))
                                                               {
                                                                  break loop73;
                                                               }
                                                               §§push(this.var_1);
                                                               if(_loc19_)
                                                               {
                                                                  break loop72;
                                                               }
                                                               §§push(§§pop().clientEnt);
                                                               if(_loc19_ && Boolean(param2))
                                                               {
                                                                  break loop71;
                                                               }
                                                               §§push(§§pop() / §§pop().const_156);
                                                               if(!_loc18_)
                                                               {
                                                                  break loop70;
                                                               }
                                                               _loc14_ = §§pop() * §§pop();
                                                            }
                                                            else
                                                            {
                                                               while(true)
                                                               {
                                                                  this.superAnim.method_325(6684774);
                                                                  addr0577:
                                                                  while(true)
                                                                  {
                                                                     §§push(this.superAnim);
                                                                     addr057c:
                                                                     loop33:
                                                                     while(true)
                                                                     {
                                                                        §§push(§§pop().m_Seq);
                                                                        if(!(_loc19_ && Boolean(this)))
                                                                        {
                                                                           while(true)
                                                                           {
                                                                              §§push(Seq.C_USEPOWER);
                                                                              if(_loc18_)
                                                                              {
                                                                                 while(true)
                                                                                 {
                                                                                    §§push("Appear");
                                                                                    if(!(_loc18_ || Boolean(param2)))
                                                                                    {
                                                                                       break loop69;
                                                                                    }
                                                                                    §§push(true);
                                                                                    if(_loc18_ || Boolean(param3))
                                                                                    {
                                                                                       continue loop31;
                                                                                    }
                                                                                    §§goto(addr07e5);
                                                                                 }
                                                                                 break loop69;
                                                                                 addr0598:
                                                                              }
                                                                              break loop33;
                                                                           }
                                                                           break;
                                                                           addr058c:
                                                                        }
                                                                        break loop63;
                                                                     }
                                                                     §§goto(addr07e1);
                                                                  }
                                                               }
                                                               addr05c0:
                                                            }
                                                         }
                                                         loop17:
                                                         while(true)
                                                         {
                                                            §§push(_loc14_);
                                                            if(!_loc18_)
                                                            {
                                                               break loop74;
                                                            }
                                                            §§push(1);
                                                            if(_loc18_ || Boolean(param1))
                                                            {
                                                               loop76:
                                                               while(true)
                                                               {
                                                                  if(§§pop() > §§pop())
                                                                  {
                                                                     while(true)
                                                                     {
                                                                        §§push(1);
                                                                        if(!_loc18_)
                                                                        {
                                                                           break loop76;
                                                                        }
                                                                        _loc14_ = Number(§§pop());
                                                                     }
                                                                     break;
                                                                     addr04eb:
                                                                  }
                                                                  while(true)
                                                                  {
                                                                     §§push(_loc14_);
                                                                     if(_loc18_)
                                                                     {
                                                                        §§push(0.45);
                                                                        if(!(_loc19_ && Boolean(this)))
                                                                        {
                                                                           if(§§pop() < §§pop())
                                                                           {
                                                                              if(_loc18_ || Boolean(param2))
                                                                              {
                                                                                 while(true)
                                                                                 {
                                                                                    §§push(0.45);
                                                                                    if(!(_loc18_ || Boolean(param3)))
                                                                                    {
                                                                                       break;
                                                                                    }
                                                                                    _loc14_ = §§pop();
                                                                                    if(false)
                                                                                    {
                                                                                       continue loop17;
                                                                                    }
                                                                                 }
                                                                                 §§goto(addr076a);
                                                                                 addr04b6:
                                                                              }
                                                                              else
                                                                              {
                                                                                 §§goto(addr04eb);
                                                                              }
                                                                           }
                                                                           this.superAnim.m_TheDO.scaleX = this.superAnim.m_TheDO.scaleY = _loc14_;
                                                                           break loop60;
                                                                        }
                                                                        break loop70;
                                                                     }
                                                                     break;
                                                                  }
                                                                  §§goto(addr072f);
                                                               }
                                                               §§goto(addr0780);
                                                            }
                                                            §§goto(addr076c);
                                                         }
                                                      }
                                                      §§goto(addr07cd);
                                                   }
                                                   §§goto(addr07ce);
                                                }
                                                while(true)
                                                {
                                                   §§push(this.var_1);
                                                   break loop72;
                                                }
                                             }
                                             while(true)
                                             {
                                                §§push(§§pop().clientEnt);
                                                break loop71;
                                             }
                                          }
                                          while(true)
                                          {
                                             §§push(§§pop() / §§pop().maxHP);
                                             break loop70;
                                          }
                                       }
                                       while(true)
                                       {
                                          §§push(§§pop() * §§pop());
                                          loop8:
                                          while(true)
                                          {
                                             _loc14_ = §§pop();
                                             while(true)
                                             {
                                                §§push(_loc14_);
                                                loop10:
                                                while(true)
                                                {
                                                   if(!(_loc19_ && Boolean(param3)))
                                                   {
                                                      while(true)
                                                      {
                                                         §§push(1);
                                                         while(true)
                                                         {
                                                            if(§§pop() > §§pop())
                                                            {
                                                               if(!(_loc19_ && Boolean(this)))
                                                               {
                                                                  §§push(1);
                                                                  while(true)
                                                                  {
                                                                     _loc14_ = Number(§§pop());
                                                                  }
                                                                  addr0780:
                                                               }
                                                               else
                                                               {
                                                                  §§goto(addr0787);
                                                               }
                                                            }
                                                            while(true)
                                                            {
                                                               §§push(_loc14_);
                                                               if(!(_loc18_ || Boolean(param3)))
                                                               {
                                                                  break loop10;
                                                               }
                                                               while(true)
                                                               {
                                                                  §§push(0.45);
                                                                  if(_loc18_)
                                                                  {
                                                                     continue loop66;
                                                                  }
                                                                  break loop8;
                                                               }
                                                            }
                                                         }
                                                      }
                                                   }
                                                   §§goto(addr07ce);
                                                }
                                                continue loop8;
                                             }
                                             addr081d:
                                             this.superAnim.m_TheDO.scaleX = this.superAnim.m_TheDO.scaleY = _loc14_;
                                             var _temp_28:* = _loc18_;
                                             §§push(_temp_28);
                                             if(!_temp_28)
                                             {
                                                break loop66;
                                             }
                                             break loop65;
                                          }
                                       }
                                    }
                                    §§goto(addr0799);
                                 }
                                 §§goto(addr07fb);
                              }
                              while(true)
                              {
                                 if(§§pop())
                                 {
                                    if(!(_loc19_ && Boolean(param2)))
                                    {
                                       §§push(_loc14_);
                                       if(!_loc19_)
                                       {
                                          §§push(this.var_2169);
                                          break loop73;
                                       }
                                       §§goto(addr07cd);
                                    }
                                    §§goto(addr0918);
                                 }
                                 §§goto(addr0759);
                              }
                           }
                           addr07e5:
                           §§pop().method_34(Seq.C_USEPOWER,"Appear",true);
                           addr07e1:
                           addr07e4:
                           if(!(_loc18_ || Boolean(this)))
                           {
                              break loop60;
                           }
                           §§push(1.4);
                           while(true)
                           {
                              §§push(Number(§§pop()));
                              addr07ce:
                              while(true)
                              {
                                 _loc14_ = §§pop();
                                 addr0787:
                                 while(true)
                                 {
                                    §§push(this.var_1);
                                    if(_loc19_ && Boolean(this))
                                    {
                                       break loop61;
                                    }
                                    while(true)
                                    {
                                       §§push(§§pop().clientEnt);
                                       break loop64;
                                    }
                                 }
                                 break;
                              }
                           }
                           addr07cd:
                        }
                        while(true)
                        {
                           §§push(this.superAnim);
                           if(!(_loc19_ && Boolean(param1)))
                           {
                              §§pop().m_TheDO.y = this.superAnim.m_TheDO.y + const_618;
                              while(_loc19_ && Boolean(param3))
                              {
                                 §§goto(addr0906);
                              }
                              while(true)
                              {
                                 §§push(this.var_1);
                                 break loop61;
                              }
                              break loop59;
                              addr0851:
                              addr089c:
                           }
                           addr08d4:
                           loop35:
                           while(true)
                           {
                              if(!_loc19_)
                              {
                                 §§pop().m_TheDO.y = this.var_11.y;
                                 while(true)
                                 {
                                    if(this.materialType)
                                    {
                                       break loop35;
                                    }
                                    §§goto(addr0851);
                                 }
                                 addr08ae:
                              }
                              §§goto(addr08ed);
                           }
                           §§push(this.superAnim);
                           addr08bb:
                           while(true)
                           {
                              §§pop().m_TheDO.x = this.superAnim.m_TheDO.x + const_1033;
                              break;
                              §§push(this.superAnim);
                           }
                        }
                     }
                     §§goto(addr0647);
                  }
                  while(true)
                  {
                     §§pop().playerEntLayer.addChild(this.superAnim.m_TheDO);
                     if(_loc18_ || Boolean(param1))
                     {
                        if(!_loc19_)
                        {
                           break loop59;
                        }
                        §§goto(addr0918);
                     }
                     §§goto(addr089c);
                  }
                  break loop59;
               }
               this.var_11.x = param3.x;
               while(true)
               {
                  this.var_11.y = param3.y;
                  while(true)
                  {
                     §§push(this.superAnim);
                     addr08ed:
                     while(true)
                     {
                        §§pop().m_TheDO.x = this.var_11.x;
                        addr0906:
                        while(!(_loc19_ && Boolean(param3)))
                        {
                        }
                        break;
                     }
                  }
               }
               addr0918:
            }
            while(true)
            {
               §§goto(addr08d4);
            }
         }
      }
      
      public static function method_975() : void
      {
         var _temp_1:* = true;
         var _loc3_:Boolean = false;
         var _loc4_:Boolean = _temp_1;
         if(!(_loc3_ && Boolean(Loot)))
         {
            var_1100 = new Dictionary();
         }
         var _loc1_:GfxType = new GfxType();
         if(!(_loc3_ && _loc3_))
         {
            _loc1_.var_29 = "UI_1.swf";
            _loc1_.animClass = "a_DyeBottleBig";
            _loc1_.baseAnim = "Ready";
         }
         _loc1_.animScale = 0.3;
         do
         {
            _loc1_.bFireAndForget = true;
            var_1100["L"] = _loc1_;
         }
         while(false);
         var _loc2_:GfxType = new GfxType();
         _loc2_.var_29 = "UI_1.swf";
         do
         {
            _loc2_.animClass = "a_DyeBottleSmall";
            _loc2_.baseAnim = "Ready";
            _loc2_.animScale = 0.3;
            _loc2_.bFireAndForget = true;
            do
            {
               var_1100["R"] = _loc2_;
            }
            while(!_loc4_);
            var_1100["M"] = _loc2_;
         }
         while(!(_loc4_ || Boolean(Loot)));
      }
      
      public static function method_582() : void
      {
         §§push(false);
         var _loc2_:Boolean = true;
         var _loc3_:* = §§pop();
         if(_loc2_)
         {
            goldGfxTypes = new Vector.<GfxType>();
         }
         var _loc1_:GfxType = new GfxType();
         _loc1_.var_29 = "SFX_1.swf";
         _loc1_.animClass = "a_GoldLoot00";
         _loc1_.baseAnim = "Appear";
         _loc1_.animScale = 0.95;
         loop0:
         while(true)
         {
            _loc1_.bFireAndForget = true;
            while(!_loc3_)
            {
               goldGfxTypes.push(_loc1_);
               if(_loc2_)
               {
                  if(false)
                  {
                     break;
                  }
                  break loop0;
               }
            }
         }
         _loc1_ = new GfxType();
         _loc1_.var_29 = "SFX_1.swf";
         _loc1_.animClass = "a_GoldLoot01";
         _loc1_.baseAnim = "Appear";
         loop2:
         while(true)
         {
            _loc1_.animScale = 1;
            loop3:
            while(true)
            {
               _loc1_.bFireAndForget = true;
               while(_loc2_)
               {
                  goldGfxTypes.push(_loc1_);
                  if(!(_loc3_ && Boolean(_loc3_)))
                  {
                     break loop2;
                     continue loop3;
                  }
               }
               break;
            }
         }
         _loc1_ = new GfxType();
         _loc1_.var_29 = "SFX_1.swf";
         loop5:
         while(true)
         {
            _loc1_.animClass = "a_GoldLoot02";
            _loc1_.baseAnim = "Appear";
            while(!(_loc3_ && Boolean(_loc3_)))
            {
               _loc1_.animScale = 1.05;
               loop7:
               while(true)
               {
                  _loc1_.bFireAndForget = true;
                  while(_loc2_)
                  {
                     goldGfxTypes.push(_loc1_);
                     if(!_loc3_)
                     {
                        if(!_loc3_)
                        {
                           if(false)
                           {
                              break;
                           }
                           break loop5;
                        }
                        break loop7;
                     }
                  }
               }
            }
         }
         _loc1_ = new GfxType();
         _loc1_.var_29 = "SFX_1.swf";
         _loc1_.animClass = "a_GoldLoot03";
         loop9:
         while(true)
         {
            _loc1_.baseAnim = "Appear";
            _loc1_.animScale = 1.1;
            loop10:
            while(true)
            {
               _loc1_.bFireAndForget = true;
               while(_loc2_)
               {
                  goldGfxTypes.push(_loc1_);
                  if(_loc2_)
                  {
                     break loop9;
                     continue loop10;
                  }
               }
               break;
            }
         }
         _loc1_ = new GfxType();
         if(_loc2_)
         {
            _loc1_.var_29 = "SFX_1.swf";
            _loc1_.animClass = "a_GoldLoot04";
            while(true)
            {
               _loc1_.baseAnim = "Appear";
               _loc1_.animScale = 1.15;
               addr01f5:
               while(!_loc3_)
               {
               }
            }
         }
         do
         {
            _loc1_.bFireAndForget = true;
            if(!(_loc3_ && Boolean(_loc1_)))
            {
               continue;
            }
            §§goto(addr01f5);
         }
         while(goldGfxTypes.push(_loc1_), false);
         _loc1_ = new GfxType();
         if(_loc2_ || Boolean(_loc1_))
         {
            _loc1_.var_29 = "SFX_1.swf";
            while(true)
            {
               _loc1_.animClass = "a_GoldLoot05";
               _loc1_.baseAnim = "Appear";
               loop16:
               while(true)
               {
                  _loc1_.animScale = 1.2;
                  while(!_loc3_)
                  {
                     while(true)
                     {
                        _loc1_.bFireAndForget = true;
                        while(!_loc3_)
                        {
                           goldGfxTypes.push(_loc1_);
                           if(!(_loc2_ || Boolean(Loot)))
                           {
                              continue;
                           }
                           if(!(_loc2_ || Boolean(_loc1_)))
                           {
                              break loop16;
                           }
                        }
                        break;
                     }
                  }
               }
            }
         }
         while(false)
         {
            §§goto(addr0261);
         }
         _loc1_ = new GfxType();
         _loc1_.var_29 = "SFX_1.swf";
         _loc1_.animClass = "a_GoldLoot06";
         _loc1_.baseAnim = "Appear";
         loop21:
         while(true)
         {
            _loc1_.animScale = 1.25;
            while(!_loc3_)
            {
               _loc1_.bFireAndForget = true;
               goldGfxTypes.push(_loc1_);
               if(!(_loc3_ && Boolean(_loc1_)))
               {
                  break loop21;
               }
            }
         }
         goldGfxTypes.fixed = true;
      }
      
      public function method_1300() : Boolean
      {
         var _temp_1:* = true;
         var _loc14_:Boolean = false;
         var _loc15_:Boolean = _temp_1;
         var _loc3_:* = 0;
         var _loc4_:* = NaN;
         var _loc5_:Sprite = null;
         var _loc6_:Sprite = null;
         var _loc7_:Sprite = null;
         var _loc8_:* = null;
         var _loc9_:Packet = null;
         var _loc10_:Rectangle = null;
         var _loc11_:EntType = null;
         var _loc12_:Number = NaN;
         var _loc13_:* = NaN;
         var _loc1_:Entity = this.var_1.clientEnt;
         §§push(this.var_1.mTimeThisTick);
         if(!_loc14_)
         {
            §§push(uint(§§pop()));
         }
         var _loc2_:* = §§pop();
         loop39:
         while(true)
         {
            loop40:
            while(true)
            {
               loop49:
               while(true)
               {
                  loop56:
                  while(true)
                  {
                     loop58:
                     while(true)
                     {
                        loop59:
                        while(true)
                        {
                           loop60:
                           while(true)
                           {
                              if(this.var_2607)
                              {
                                 loop0:
                                 while(true)
                                 {
                                    §§push(this.materialType);
                                    if(!(_loc15_ || Boolean(this)))
                                    {
                                       break;
                                    }
                                    §§push(!§§pop());
                                    loop1:
                                    while(true)
                                    {
                                       var _temp_84:* = §§pop();
                                       §§push(_temp_84);
                                       §§push(_temp_84);
                                       loop2:
                                       while(true)
                                       {
                                          if(§§pop())
                                          {
                                             §§pop();
                                             loop3:
                                             while(true)
                                             {
                                                §§push(this.var_286);
                                                if(!(_loc14_ && Boolean(_loc2_)))
                                                {
                                                   §§push(!§§pop());
                                                   if(_loc14_)
                                                   {
                                                      while(true)
                                                      {
                                                         §§pop();
                                                         if(_loc14_)
                                                         {
                                                            break;
                                                         }
                                                         §§push(this.var_647);
                                                         if(!(_loc15_ || Boolean(this)))
                                                         {
                                                            break loop61;
                                                         }
                                                         §§push(!§§pop());
                                                         while(true)
                                                         {
                                                            if(§§pop())
                                                            {
                                                               §§push(this.superAnim);
                                                               if(!(_loc14_ && Boolean(_loc1_)))
                                                               {
                                                                  §§push(§§pop().m_bFinished);
                                                                  if(_loc15_)
                                                                  {
                                                                     if(!(_loc15_ || Boolean(_loc1_)))
                                                                     {
                                                                        break;
                                                                     }
                                                                     if(_loc14_)
                                                                     {
                                                                        continue loop1;
                                                                     }
                                                                     §§push(!§§pop());
                                                                     if(_loc14_)
                                                                     {
                                                                        addr0424:
                                                                        if(§§pop())
                                                                        {
                                                                           break loop40;
                                                                        }
                                                                        return this.superAnim;
                                                                     }
                                                                  }
                                                               }
                                                               §§goto(addr028c);
                                                            }
                                                            §§push(_loc2_);
                                                            if(_loc15_)
                                                            {
                                                               §§push(this.var_2535);
                                                               if(_loc14_ && Boolean(_loc3_))
                                                               {
                                                                  break loop58;
                                                               }
                                                               §§push(§§pop() - §§pop());
                                                               while(true)
                                                               {
                                                                  §§push(uint(§§pop()));
                                                                  if(_loc14_)
                                                                  {
                                                                     break loop60;
                                                                  }
                                                               }
                                                               break loop60;
                                                               addr00f0:
                                                            }
                                                            while(true)
                                                            {
                                                               _loc3_ = §§pop();
                                                               if(_loc14_ && Boolean(_loc3_))
                                                               {
                                                                  break;
                                                               }
                                                               §§push(_loc3_);
                                                               if(_loc14_ && Boolean(this))
                                                               {
                                                                  break loop59;
                                                               }
                                                               §§push(const_1122);
                                                               if(!(_loc15_ || Boolean(_loc3_)))
                                                               {
                                                                  break loop58;
                                                               }
                                                               §§push(§§pop() / §§pop());
                                                               if(_loc15_ || Boolean(_loc2_))
                                                               {
                                                                  §§push(Number(§§pop()));
                                                                  if(_loc14_)
                                                                  {
                                                                     break loop56;
                                                                  }
                                                               }
                                                               if(!_loc14_)
                                                               {
                                                                  _loc4_ = §§pop();
                                                                  §§push(_loc4_);
                                                                  if(!_loc15_)
                                                                  {
                                                                     break loop56;
                                                                  }
                                                                  §§push(1);
                                                                  if(_loc14_)
                                                                  {
                                                                     break loop49;
                                                                  }
                                                                  if(§§pop() > §§pop())
                                                                  {
                                                                     if(_loc15_)
                                                                     {
                                                                        §§push(this.superAnim);
                                                                        if(!_loc14_)
                                                                        {
                                                                           §§pop().DestroySuperAnimInstance();
                                                                           return false;
                                                                        }
                                                                        addr023e:
                                                                        addr027a:
                                                                        _loc6_ = §§pop().m_TheDO;
                                                                        _loc6_.y = this.var_11.y + const_562 * _loc4_;
                                                                        while(true)
                                                                        {
                                                                           if(!_loc14_)
                                                                           {
                                                                              _loc6_.scaleX = 0.8 * (1 - _loc4_);
                                                                              if(!_loc15_)
                                                                              {
                                                                                 break;
                                                                              }
                                                                           }
                                                                           _loc6_.scaleY = 0.8 * (1 - _loc4_);
                                                                           break;
                                                                        }
                                                                        §§push(this.var_647);
                                                                        break loop61;
                                                                     }
                                                                     addr0420:
                                                                     §§push(this.var_2487);
                                                                  }
                                                                  else
                                                                  {
                                                                     §§push(this.materialType);
                                                                     if(_loc15_)
                                                                     {
                                                                        break loop0;
                                                                     }
                                                                     §§goto(addr03e1);
                                                                  }
                                                               }
                                                               else
                                                               {
                                                                  §§goto(addr00f0);
                                                               }
                                                            }
                                                            continue loop3;
                                                            §§goto(addr0424);
                                                         }
                                                      }
                                                      break;
                                                   }
                                                   while(true)
                                                   {
                                                      var _temp_110:* = §§pop();
                                                      §§push(_temp_110);
                                                      §§push(_temp_110);
                                                      if(_loc14_ && Boolean(_loc1_))
                                                      {
                                                         break;
                                                      }
                                                      continue loop61;
                                                   }
                                                   continue loop2;
                                                }
                                                §§goto(addr0228);
                                             }
                                             break;
                                          }
                                          §§goto(addr0178);
                                       }
                                       break;
                                    }
                                 }
                                 if(§§pop())
                                 {
                                    §§push(this.superAnim);
                                    if(_loc14_ && Boolean(_loc1_))
                                    {
                                       break loop39;
                                    }
                                    _loc5_ = §§pop().m_TheDO;
                                    _loc5_.y = this.var_11.y + const_618 + const_562 * _loc4_;
                                    if(!_loc14_)
                                    {
                                       _loc5_.scaleX = 0.8 * (1 - _loc4_);
                                       if(_loc15_ || Boolean(_loc2_))
                                       {
                                          _loc5_.scaleY = 0.8 * (1 - _loc4_);
                                       }
                                    }
                                 }
                                 addr0228:
                                 while(true)
                                 {
                                    if(§§pop())
                                    {
                                       §§push(this.superAnim);
                                       if(_loc14_ && Boolean(this))
                                       {
                                          break;
                                       }
                                       §§goto(addr023e);
                                    }
                                    §§goto(addr027a);
                                 }
                                 addr028c:
                                 _loc7_ = §§pop().m_TheDO;
                                 _loc7_.y = this.var_11.y + const_562 * _loc4_;
                                 if(!_loc14_)
                                 {
                                    _loc7_.scaleX = 0.8 * (1 - _loc4_);
                                    if(_loc15_)
                                    {
                                       _loc7_.scaleY = 0.8 * (1 - _loc4_);
                                    }
                                 }
                                 return true;
                                 §§push(this.var_286);
                              }
                              §§goto(addr0420);
                           }
                           §§goto(addr040a);
                        }
                        §§goto(addr03ac);
                     }
                     §§goto(addr040e);
                  }
                  §§goto(addr040e);
               }
               if(§§pop() >= §§pop())
               {
                  if(this.gearType)
                  {
                     §§push(SoundConfig.var_1818);
                     while(true)
                     {
                        §§push(§§pop());
                        loop30:
                        while(true)
                        {
                           _loc8_ = §§pop();
                           loop31:
                           while(true)
                           {
                              while(true)
                              {
                                 loop57:
                                 while(true)
                                 {
                                    §§push(_loc8_);
                                    if(_loc15_)
                                    {
                                       if(§§pop())
                                       {
                                          if(_loc15_ || Boolean(_loc1_))
                                          {
                                             if(_loc14_)
                                             {
                                                break;
                                             }
                                             SoundManager.Play(_loc8_,1);
                                          }
                                          if(!(_loc15_ || Boolean(_loc1_)))
                                          {
                                             continue loop31;
                                          }
                                          if(!(_loc14_ && Boolean(_loc3_)))
                                          {
                                             if(_loc14_ && Boolean(_loc1_))
                                             {
                                                break loop40;
                                             }
                                             addr0439:
                                             (_loc9_ = new Packet(LinkUpdater.PKTTYPE_PICKUP_LOOTDROP)).method_9(this.lootID);
                                             this.var_1.serverConn.SendPacket(_loc9_);
                                             continue loop51;
                                             while(true)
                                             {
                                                continue loop57;
                                             }
                                          }
                                          §§goto(addr0433);
                                       }
                                       §§goto(addr0439);
                                    }
                                    while(true)
                                    {
                                       §§push(§§pop());
                                       if(_loc15_)
                                       {
                                          _loc8_ = §§pop();
                                          §§push(_loc14_ && Boolean(_loc2_));
                                          continue loop54;
                                       }
                                       continue loop30;
                                    }
                                    §§goto(addr0408);
                                    addr036b:
                                 }
                                 §§goto(addr03e5);
                              }
                              break loop40;
                           }
                           break loop40;
                        }
                        break loop40;
                     }
                     break;
                     addr0401:
                  }
                  if(!this.materialType)
                  {
                     §§push(this.var_79);
                     while(true)
                     {
                        if(_loc15_ || Boolean(_loc2_))
                        {
                           addr03ac:
                           if(§§pop())
                           {
                              break;
                           }
                           §§push(this.var_2169);
                           if(_loc14_ && Boolean(_loc2_))
                           {
                              continue;
                           }
                           if(!§§pop())
                           {
                              continue loop32;
                           }
                           if(!(_loc14_ && Boolean(this)))
                           {
                              §§goto(addr036b);
                              §§push(SoundConfig.var_2158);
                           }
                           else
                           {
                              §§goto(addr032f);
                           }
                        }
                        else
                        {
                           §§goto(addr040a);
                        }
                        §§goto(addr040e);
                     }
                     while(true)
                     {
                        if(_loc14_)
                        {
                           break loop53;
                        }
                        §§push(SoundConfig.var_2154);
                        if(!_loc15_)
                        {
                           break loop54;
                        }
                        if(_loc15_ || Boolean(this))
                        {
                           _loc8_ = §§pop();
                           §§goto(addr032f);
                        }
                        else
                        {
                           §§goto(addr0401);
                        }
                     }
                  }
                  §§goto(addr03e5);
               }
               return true;
            }
            while(true)
            {
               if(!this.var_1.CanSendPacket())
               {
                  return true;
                  addr0408:
               }
               addr0433:
               while(true)
               {
                  §§push(_loc2_);
                  addr040a:
                  addr03e5:
                  while(true)
                  {
                     addr040e:
                     §§push(§§pop() - this.var_2614);
                     §§push(350);
                     break loop49;
                  }
                  addr03e5:
                  while(true)
                  {
                     §§push(SoundConfig.var_1818);
                     break loop54;
                  }
               }
            }
         }
         _loc10_ = §§pop().m_TheDO.getBounds(this.var_1.levelLayer as DisplayObject);
         _loc11_ = _loc1_.entType;
         loop41:
         while(true)
         {
            if(_loc15_)
            {
               §§push(_loc1_.appearPosY);
               while(true)
               {
                  _loc12_ = §§pop();
                  §§push(_loc1_.appearPosX);
                  §§push(_loc11_.width);
                  while(true)
                  {
                     while(true)
                     {
                        §§push(§§pop() * 0.5);
                        if(_loc15_)
                        {
                           §§push(§§pop() - §§pop());
                           if(!_loc15_)
                           {
                              break;
                           }
                           var _temp_34:* = §§pop();
                           §§push(_temp_34);
                           §§push(_temp_34);
                        }
                        _loc13_ = §§pop();
                        break;
                     }
                     if(_loc14_)
                     {
                        break;
                     }
                     var _temp_35:* = §§pop() <= _loc10_.x + _loc10_.width;
                     §§push(_temp_35);
                     §§push(_temp_35);
                     while(true)
                     {
                        if(§§pop())
                        {
                           §§pop();
                           while(true)
                           {
                              §§push(_loc13_);
                              if(!_loc14_)
                              {
                                 §§push(_loc11_.width);
                                 while(true)
                                 {
                                    §§push(§§pop() + §§pop());
                                 }
                                 addr0682:
                              }
                              addr0683:
                              while(true)
                              {
                                 §§push(§§pop() >= _loc10_.x);
                              }
                           }
                           addr0674:
                        }
                        while(true)
                        {
                           break loop42;
                        }
                     }
                  }
               }
            }
            while(true)
            {
               this.var_2487 = true;
               loop45:
               while(true)
               {
                  loop46:
                  while(true)
                  {
                     loop47:
                     while(true)
                     {
                        loop48:
                        while(true)
                        {
                           if(!(_loc14_ && Boolean(_loc2_)))
                           {
                              if(!_loc14_)
                              {
                                 if(false)
                                 {
                                    while(true)
                                    {
                                       §§push(_loc12_);
                                       §§push(_loc11_.height);
                                       if(!(_loc15_ || Boolean(_loc1_)))
                                       {
                                          break loop47;
                                       }
                                       if(!(_loc15_ || Boolean(this)))
                                       {
                                          continue loop10;
                                       }
                                       §§push(§§pop() - §§pop());
                                       if(_loc14_ && Boolean(_loc3_))
                                       {
                                          break loop46;
                                       }
                                       §§push(§§pop() <= _loc10_.y + _loc10_.height);
                                       if(!_loc14_)
                                       {
                                          if(!(_loc15_ || Boolean(_loc3_)))
                                          {
                                             break loop42;
                                          }
                                          while(true)
                                          {
                                             var _temp_41:* = §§pop();
                                             §§push(_temp_41);
                                             §§push(_temp_41);
                                             if(!_loc15_)
                                             {
                                                continue loop42;
                                             }
                                             if(_loc14_ && Boolean(_loc3_))
                                             {
                                                break loop48;
                                             }
                                             if(!§§pop())
                                             {
                                                break loop45;
                                             }
                                          }
                                          continue loop42;
                                       }
                                       loop22:
                                       while(true)
                                       {
                                          §§pop();
                                          addr05ca:
                                          while(true)
                                          {
                                             §§push(_loc12_ >= _loc10_.y);
                                             if(_loc15_ || Boolean(_loc1_))
                                             {
                                                break loop45;
                                             }
                                             break;
                                          }
                                          while(true)
                                          {
                                             §§pop();
                                             break loop22;
                                          }
                                          break loop47;
                                       }
                                    }
                                    break loop47;
                                 }
                                 break loop41;
                              }
                              §§goto(addr0674);
                           }
                           §§goto(addr05ca);
                        }
                        §§goto(addr06d1);
                     }
                     §§goto(addr0682);
                  }
                  §§goto(addr0683);
               }
               while(true)
               {
                  if(!§§pop())
                  {
                     break loop41;
                  }
                  break;
               }
            }
         }
         return true;
      }
      
      public function method_946() : void
      {
         var _temp_1:* = true;
         var _loc1_:Boolean = false;
         var _loc2_:Boolean = _temp_1;
         this.gearType = null;
         loop0:
         while(true)
         {
            this.materialType = null;
            while(true)
            {
               this.var_11 = null;
               if(!(_loc2_ || _loc2_))
               {
                  break;
               }
               this.superAnim.DestroySuperAnimInstance();
               this.superAnim = null;
               if(!_loc1_)
               {
                  break loop0;
               }
            }
         }
         this.var_1 = null;
      }
   }
}

