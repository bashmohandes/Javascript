function permute(nums) {
    
    var dict = {}
    for(var i = 0; i< nums.length; i++) {
        if(nums[i] in dict) {
            dict[nums[i]] ++
        } else {
            dict[nums[i]] = 1
        }
    }
    
    var result = []

    doPermute(nums, dict, 0, result)    
}

function doPermute(nums, dict, level, result) {
    if(nums.length === level) {
        console.log(result)
        return
    }    
    for(var n in dict) {        
        if(dict[n] > 0) {
            result.push(n)
            dict[n] --
            doPermute(nums, dict, level + 1, result)
            result.pop()
            dict[n] ++
        }
    }
}

permute([1, 3, 2])