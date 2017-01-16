/**
 * @param {number[]} nums
 * @return {number[][]}
 */
var threeSum = function(nums) {
    var result = []
    nums.sort(function(a, b) {return a - b})
    for(var i = 0; i < nums.length - 2; i++) {
        if(i > 0 && nums[i] === nums[i - 1]) {
            continue    
        }  
        var sum = 0 - nums[i]
        var lo = i + 1
        var hi = nums.length - 1
        while(hi > lo) {
            if(nums[hi] + nums[lo] === sum) {
                result.push([nums[i], nums[lo], nums[hi]])
                lo ++
                hi --
                while(lo < hi && nums[lo] === nums[lo - 1]) lo ++
                while(hi > lo && nums[hi] === nums[hi + 1]) hi --                
            } else if(nums[hi] + nums[lo] > sum) {
                hi --
            } else {
                lo ++
            }
        }
    }
    return result
};

console.log(threeSum([-1, 0, 1, 2, -1, -4]))