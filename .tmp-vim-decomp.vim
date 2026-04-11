let g:nums = split(substitute(getline(1), '[^0-9]', ' ', 'g'))
let g:out = ''
let g:i = 0
while g:i < len(g:nums)
  let g:ch = g:i % 2 == 0 ? nr2char(0x2002) : nr2char(160)
  let g:out .= repeat(g:ch, str2nr(g:nums[g:i]))
  let g:i += 1
endwhile
let g:lines = []
let g:j = 0
while g:j < len(g:out)
  call add(g:lines, strpart(g:out, g:j, 79))
  let g:j += 79
endwhile
1,1delete _
call append(0, g:lines)
write! .tmp-vim-decomp-out.txt
qa!
