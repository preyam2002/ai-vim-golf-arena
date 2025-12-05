import { createInitialState, tokenizeKeystrokes, executeKeystroke } from './src/lib/vim-engine';

const initial = 'line1\n\n\n\nline2\n\n\n\nline3';
const ks = ':%s/\\n\\n/\\r/g<CR>jddj3dd$pj$pjdd:g/^$/d<CR>';
let state = createInitialState(initial);
for (const t of tokenizeKeystrokes(ks)) {
  state = executeKeystroke(state, t);
}
console.log(JSON.stringify({lines: state.lines, cursor: [state.cursorLine, state.cursorCol], mode: state.mode}, null, 2));
