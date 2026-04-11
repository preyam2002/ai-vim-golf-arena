:%s/\(\d\+\)\n\n\(\d\+\)\n\n\(\d\+\)/\1\t\2\t\3/g
:w! .tmp-vim-out.txt
:q!
