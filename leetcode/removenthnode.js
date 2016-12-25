/**
 * Definition for singly-linked list.
 * function ListNode(val) {
 *     this.val = val;
 *     this.next = null;
 * }
 */
/**
 * @param {ListNode} head
 * @param {number} n
 * @return {ListNode}
 */
var removeNthFromEnd = function(head, n) {
    if(!head) {
        return head
    }

    var runner = head
    var fastRunner = head
    for(var i = 0; i<n; i++) {
        fastRunner = fastRunner.next
    }   

    while(fastRunner && fastRunner.next) {
        runner = runner.next
        fastRunner = fastRunner.next
    }

    if(!fastRunner) {
        head = head.next
    } else {
        runner.next = runner.next.next
    }
    return head
};

function ListNode(val) {
     this.val = val;
     this.next = null;
}

var input = new ListNode(1)

console.log(removeNthFromEnd(input, 1))