/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
var threeSumClosest = function(nums, target) {
    var minDelta = Number.MAX_VALUE
    var result
    nums.sort(function(a, b){return a - b})
    for(var i = 0; i<nums.length - 2; i++) {
        for(var j = i + 1; j<nums.length - 1; j++) {
            for(var k = j + 1; k<nums.length; k++) {
                var delta = Math.abs(target - (nums[i] + nums[j] + nums[k]))
                if(delta < minDelta) {
                    minDelta = delta
                    result = nums[i] + nums[j] + nums[k]
                }
            }
        }
    }
    
    return result
};

console.log(threeSumClosest([-1, 2, 1, -4], 1))