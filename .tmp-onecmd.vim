set enc=utf-8
set fileencoding=utf-8
let n=split(substitute(getline(1),'[^0-9]',' ','g'))
let s=''
let i=0
while i<len(n)
  let s.=repeat(i%2?nr2char(160):nr2char(0x2002),str2nr(n[i]))
  let i+=1
endwhile
let g=map(range(0,strchars(s)-1,79),'strcharpart(s,v:val,79)')
let t=getline(2,'$')
call setline(1,g+t)
write
qa!
