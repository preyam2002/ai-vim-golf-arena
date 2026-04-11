%s#^    { \.src_path   = "\([^"]*\)", \.bin_path \(\s*\)="\(\./build/[^"]*\)", },#\= "    {\r        .src_path   = \"".submatch(1)."\",\r        .bin_path".submatch(2)."=\"".submatch(3)."\",\r        .wasm_path  = \"".substitute(submatch(3), '^\./build/', './wasm/', '').".wasm\",\r    },"#
wq
