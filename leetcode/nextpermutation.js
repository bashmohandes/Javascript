/**
 * @param {number[]} nums
 * @return {void} Do not return anything, modify nums in-place instead.
 */
//TODO: FIX
var nextPermutation = function(nums) {
    if(nums || nums.length === 1) {
        return;
    }

    var i = nums.length - 2
    while(i >= 0 && nums[i] >= nums[i + 1]) i--;

    if(i >= 0) {
        var j = nums.length - 1
        while(nums[j] <= nums[i]) j--
        swap(nums, i, j)
    }

    reverse(nums, i + 1, nums.length - 1)
};

function swap(nums, i, j) {
    var tmp = nums[i]
    nums[i] = nums[j]
    nums[j] = tmp
}

function reverse(nums, i, j) {
    while(i < j) {
        swap(nums, i++, j--)
    }
}
/*
    1 2 3 -> 1 3 2
    1 3 2 -> 2 1 3
    2 1 3 -> 2 3 1
    2 3 1 -> 3 1 2
    3 1 2 -> 3 2 1
    3 2 1 -> 1 2 3
    --------------
    1 2 -> 2 1
*/