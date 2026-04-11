set enc=utf-8
let line = "1134\u20024\u00a013"
let n = split(substitute(line,'\D',' ','g'))
call writefile([string(n)],'.tmp-split-out.txt')
qa!
