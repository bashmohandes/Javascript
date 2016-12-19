"use strict";

/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
    var dict = {}

    for(var i = 0; i<nums.length; i++) {
        if(nums[i] in dict) {
            return [i, dict[nums[i]]]
        }
        dict[target - nums[i]] = i
    }
    
    return []
};

console.log(twoSum([3,2,4], 6))