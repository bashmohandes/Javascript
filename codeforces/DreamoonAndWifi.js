function calculateProb(s1, s2) {
    var possibilties = [];
    calculatePossibilities(s2, 0, [], possibilties);

    var d = destinationNum(s1);
    var successCount = 0;
    for(var i = 0; i<possibilties.length; i++) {
        var dt = destinationNum(possibilties[i]);
        if(dt === d) {
            successCount ++;
        }
    }
    
    return ((successCount * 1.0) / (possibilties.length * 1.0));
}

function destinationNum(s1) {
    var current = 0;
    for(var i = 0; i<s1.length; i++) {
        current += s1.charAt(i) === "+" ? 1 : -1;
    }

    return current;
}

function calculatePossibilities(s2, i, soFar, posibilities) {    
    if(s2.length === i) {
        posibilities.push(soFar.join(''));
        return;
    }

    if (s2.charAt(i) === "?") {
        soFar[i] = "+"
        calculatePossibilities(s2, i + 1, soFar, posibilities);
        soFar[i] = "-";
        calculatePossibilities(s2, i + 1, soFar, posibilities);        
    } else {
        soFar[i] = s2.charAt(i);
        calculatePossibilities(s2, i + 1, soFar, posibilities);
    }
}

var s1 = readline();
var s2 = readline();

print(calculateProb(s1, s2));