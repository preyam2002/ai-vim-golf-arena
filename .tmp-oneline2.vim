let n=split(substitute(getline(1),'\D',' ','g'))
let s=join(map(range(len(n)),'repeat(v:val%2?nr2char(160):nr2char(8194),n[v:val])'),'')
call setline(1,map(range(0,strchars(s)-1,79),'strcharpart(s,v:val,79)')+getline(2,'$'))
write! .tmp-vim-work3.txt
qa!
