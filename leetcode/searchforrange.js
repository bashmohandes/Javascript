/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var searchRange = function(nums, target) {
    var start = 0
    var end = nums.length - 1    
    var startIndex = 0
    var endIndex = 0
    
    while(start <= end) {                
        var med = start + Math.floor((end - start) / 2)
        if(nums[med] === target) {
            // find start and end indices
            startIndex = med
            endIndex = med
            while(startIndex > 0 && nums[startIndex - 1] === nums[med]) {
                startIndex --
            }
            while(endIndex < nums.length - 1 && nums[endIndex + 1] === nums[med]) {
                endIndex ++
            }
            
            return [startIndex, endIndex]
        } else if (target < nums[med]) {
            end = med - 1
        } else {
            start = med + 1
        }                
    }
    
    return [-1, -1]
};


console.log(searchRange([5, 7, 7, 8, 8, 10], 8))