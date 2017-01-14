/**
 * @param {number} n
 * @return {string[]}
 */
var fizzBuzz = function(n) {
    var result = []
    for(var i = 1; i<=n; i++) {
        var str = ""        
        if(i % 3 == 0) {
            str += "Fizz"
        }

        if(i % 5 == 0) {
            str += "Buzz"            
        }
        if(str === "") {
            str += i
        }
        result.push(str)
    }

    return result
};

console.log(fizzBuzz(15))