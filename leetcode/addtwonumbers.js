/**
 * Definition for singly-linked list.
 * function ListNode(val) {
 *     this.val = val;
 *     this.next = null;
 * }
 */
/**
 * @param {ListNode} l1
 * @param {ListNode} l2
 * @return {ListNode}
 */
var addTwoNumbers = function(l1, l2) {
    var c1 = l1, c2 = l2
    var carry = 0    
    var result
    var current, prev
    while(c1 || c2 || carry) {        
        var sum = (c1 ? c1.val : 0) + (c2 ? c2.val : 0) + carry
        if(!current) {
            current = new ListNode(sum % 10)
            if(!result) {
                result = current
            }
            if(prev) {
                prev.next = current
            }
        }
        carry = Math.floor(sum / 10)
        if(c1) {
            c1 = c1.next
        }
        if(c2) {                    
            c2 = c2.next
        }
        prev = current        
        current = current.next
    }

    return result
};


function ListNode(val) {
      this.val = val;
      this.next = null;
 }

 var l1 = new ListNode(2)
 l1.next = new ListNode(4)
 l1.next.next = new ListNode(3)


 var l2 = new ListNode(5)
 l2.next = new ListNode(6)
 l2.next.next = new ListNode(4)

 console.log(addTwoNumbers(l1, l2))