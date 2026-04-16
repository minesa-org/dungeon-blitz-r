package
{
   public class class_103
   {
      
      internal var stackCount:uint;
      
      internal var consumableType:class_3;
      
      public function class_103(param1:class_3, param2:uint)
      {
         super();
         this.consumableType = param1;
         this.stackCount = param2;
      }
      
      public function method_786() : void
      {
         this.consumableType = null;
      }
      
      private function method_2084(param1:uint) : uint
      {
         if(this.consumableType.type != "Potion")
         {
            return param1;
         }
         if(!param1)
         {
            return 0;
         }
         if(param1 < class_3.const_133 && param1 <= 100)
         {
            return uint(param1 * class_3.const_133);
         }
         return param1;
      }
      
      public function method_943() : uint
      {
         var _loc1_:uint = 0;
         if(this.consumableType.type == "Potion")
         {
            _loc1_ = this.method_2084(this.stackCount);
            return uint(Math.ceil(_loc1_ / class_3.const_133));
         }
         return this.stackCount;
      }
      
      public function method_578() : Number
      {
         var _loc1_:uint = 0;
         var _loc2_:Number = NaN;
         var _loc3_:uint = 0;
         var _loc4_:Number = NaN;
         if(this.consumableType.type == "Potion")
         {
            _loc1_ = this.method_2084(this.stackCount);
            _loc2_ = _loc1_ / class_3.const_133;
            _loc3_ = uint(_loc2_);
            _loc4_ = _loc2_ - _loc3_;
            if(_loc4_)
            {
               return _loc4_;
            }
            if(_loc3_)
            {
               return 1;
            }
            return 0;
         }
         return this.stackCount;
      }
      
      public function method_906() : uint
      {
         return uint(this.method_578() * 100);
      }
      
      public function method_915() : uint
      {
         var _loc1_:uint = 0;
         var _loc2_:Number = NaN;
         var _loc3_:uint = 0;
         var _loc4_:Number = NaN;
         if(this.consumableType.type == "Potion")
         {
            _loc1_ = this.method_2084(this.stackCount);
            _loc2_ = _loc1_ / class_3.const_133;
            _loc3_ = uint(_loc2_);
            _loc4_ = _loc2_ - _loc3_;
            return _loc4_ ? _loc3_ : (_loc3_ ? uint(_loc3_ - 1) : 0);
         }
         return this.stackCount;
      }
      
      public function method_1996(param1:uint) : Boolean
      {
         var _loc2_:uint = 0;
         var _loc3_:uint = 0;
         var _loc4_:Number = NaN;
         var _loc5_:Number = NaN;
         if(this.consumableType.type == "Potion")
         {
            if(!param1)
            {
               return false;
            }
            if(!this.stackCount)
            {
               return true;
            }
            _loc2_ = this.method_2084(param1);
            _loc3_ = this.method_2084(this.stackCount);
            _loc4_ = _loc2_ / class_3.const_133 - uint(_loc2_ / class_3.const_133);
            _loc5_ = _loc3_ / class_3.const_133 - uint(_loc3_ / class_3.const_133);
            if(!_loc4_)
            {
               return false;
            }
            if(!_loc5_)
            {
               return true;
            }
            if(_loc5_ > _loc4_)
            {
               return true;
            }
            return false;
         }
         return true;
      }
   }
}
