let s = "1134\u20024\u00a013\u20024\u00a0"
echo split(substitute(s, '[^0-9]', ' ', 'g'))
qa!
