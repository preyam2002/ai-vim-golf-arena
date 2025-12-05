const vim = require('./src/lib/vim-engine');
const initial = 'line1\n\n\n\nline2\n\n\n\nline3';
const ks = ':%s/\\n\\n/\\r/g<CR>jddj3dd$pj$pjdd:g/^$/d<CR>';
let state = vim.createInitialState(initial);
for (const t of vim.tokenizeKeystrokes(ks)) {
  state = vim.executeKeystroke(state, t);
}
console.log(state.lines);
