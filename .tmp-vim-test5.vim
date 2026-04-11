:%s/\n\n/\t/g
:1,10s/\t/\t/g
:w! .tmp-vim-out.txt
:q!
