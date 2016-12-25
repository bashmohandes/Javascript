/**
 * @param {string[]} strs
 * @return {string}
 */
var longestCommonPrefix = function(strs) {
    var trieRoot = new Trie()
    for(var i = 0; i< strs.length; i++) {
        trieRoot.add(strs[i])
    }

    return trieRoot.longestPrefix()
};

function Trie(){
    this.nodes = {}
    this.endOfString = false    

    this.add = function(str) {        
        var tmp = this.nodes;
        if(str === "") {
            tmp[""] = new Trie()
        }

        for(var i = 0; i< str.length; i++) {
            var trieNode;
            if(str[i] in tmp) {
                trieNode = tmp[str[i]]
            } else {
                trieNode = new Trie()
                tmp[str[i]] = trieNode
            }

            tmp = trieNode.nodes;
            if(i === str.length - 1) {
                trieNode.endOfString = true
            }
        }
    }

    this.longestPrefix = function() {
        var prefix = "";
        var tmp = this;        
        //console.log(tmp)
        while(tmp && Object.keys(tmp.nodes).length === 1) {            
            prefix += Object.keys(tmp.nodes)[0];
            tmp = tmp.nodes[Object.keys(tmp.nodes)[0]]
            if(tmp.endOfString) {
                break;
            }
        }

        return prefix;
    }
}

console.log(longestCommonPrefix(["a"]))