/**
 * @param {number[]} nums
 * @return {number[]}
 */
var findDisappearedNumbers = function(nums) {
    for(var i = 0; i<nums.length; i++) {
        var val = Math.abs(nums[i]) - 1
        if(nums[val] > 0) {
            nums[val] = -nums[val]
        }
    }
    var result = []
    for(i =0; i<nums.length; i++) {
        if(nums[i] > 0) {
            result.push(i + 1)
        }
    }

    return result
};

console.log(findDisappearedNumbers([4,3,2,7,8,2,3,1]))