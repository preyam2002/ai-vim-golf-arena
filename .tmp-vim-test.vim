:%s/^  S   = 4'b    ,$/\=printf("  S%02d = 4'b%d%d%d%d,", line('.')-2, and(xor(line('.')-2,(line('.')-2)>>1)>>3,1), and(xor(line('.')-2,(line('.')-2)>>1)>>2,1), and(xor(line('.')-2,(line('.')-2)>>1)>>1,1), and(xor(line('.')-2,(line('.')-2)>>1),1))/
17G$x
:wq
