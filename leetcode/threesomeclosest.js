/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
var threeSumClosest = function(nums, target) {
    if(!nums) {
        return 0
    }
    if(nums.length < 3) {
        return Math.sum(nums)
    }
    var minDelta = Number.MAX_VALUE
    var result = nums[0] + nums[1] + nums[2]
    nums.sort(function(a, b){return a - b})
    for(var i = 0; i<nums.length - 2; i++) {
        var lo = i + 1
        var hi = nums.length - 1        
        while(lo < hi) {
            var sum = nums[i] + nums[lo] + nums[hi]
            if(sum === target) {
                return sum
            }
            
            if(Math.abs(target - result) > Math.abs(target - sum)) {                
                result = sum  
            }
            if(sum > target){
                hi --
            } else {
                lo ++
            }
        }
    }
    
    return result
};

console.log(threeSumClosest([-1, 2, 1, -4], 1))