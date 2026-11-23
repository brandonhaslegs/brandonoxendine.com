// Edit mode, injected by tools/edit/server.mjs. Press E (or the Edit button)
// to make every text block editable. Click into one and type; it saves to
// the HTML file when you click away or press Enter. Escape undoes the block.
(() => {
  const css = document.createElement('style');
  css.textContent = `
    .edit-bar { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; display: flex; gap: 8px; align-items: center;
      font: 600 13px/1 system-ui, sans-serif; }
    .edit-bar button { font: inherit; padding: 10px 14px; border-radius: 999px; border: 0; cursor: pointer;
      background: #111; color: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.25); }
    html.is-editing .edit-bar button { background: hotpink; }
    .edit-status { padding: 8px 12px; border-radius: 999px; background: #111; color: #fff; opacity: 0; transition: opacity .2s; }
    .edit-status.show { opacity: 1; }
    .edit-status.error { background: #c00; }
    html.is-editing [data-editable] { outline: 1px dashed rgba(255,105,180,.45); outline-offset: 3px; cursor: text; }
    html.is-editing [data-editable]:hover { outline-color: hotpink; }
    html.is-editing [data-editable]:focus { outline: 2px solid hotpink; }
    html.is-editing [data-editable].saving { outline-style: dotted; }
    html.is-editing a[href] { cursor: text; -webkit-user-drag: none; user-drag: none; }
  `;
  document.head.appendChild(css);

  const bar = document.createElement('div');
  bar.className = 'edit-bar';
  bar.innerHTML = '<span class="edit-status" role="status"></span><button type="button" title="Toggle edit mode (E)">Edit</button>';
  document.body.appendChild(bar);
  const button = bar.querySelector('button');
  const status = bar.querySelector('.edit-status');

  let timer;
  const say = (msg, error = false) => {
    status.textContent = msg;
    status.classList.toggle('error', error);
    status.classList.add('show');
    clearTimeout(timer);
    if (!error) timer = setTimeout(() => status.classList.remove('show'), 1600);
  };

  // Only the innermost blocks are editable, so a list item holding a
  // paragraph edits as the paragraph.
  const blocks = [...document.querySelectorAll('[data-edit]')].filter((el) => !el.querySelector('[data-edit]'));
  const original = new WeakMap();
  const plain = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html;
    return t.content.textContent.replace(/\s+/g, ' ').trim();
  };

  const clean = (el, before) => {
    const copy = el.cloneNode(true);
    copy.querySelectorAll('[data-edit],[contenteditable],[data-editable]').forEach((n) => {
      n.removeAttribute('data-edit');
      n.removeAttribute('contenteditable');
      n.removeAttribute('data-editable');
    });
    // Undo what the site's own scripts add to images at runtime.
    copy.querySelectorAll('img').forEach((img) => {
      img.classList.remove('zoomable');
      if (!img.classList.length) img.removeAttribute('class');
      img.removeAttribute('tabindex');
      img.removeAttribute('role');
    });
    let html = copy.innerHTML
      // Chrome sometimes leaves a stray line break at the end of a link (or
      // other inline element) right before a real one; drop the stray.
      .replace(/<br>(<\/[a-z]+>)(?=<br>)/g, '$1')
      .replace(/<br>/g, '<br />');
    // ...and a placeholder break at the very end of the block.
    if (!/<br\s*\/?>\s*$/i.test(before)) html = html.replace(/(<br \/>\s*)+$/, '');
    // Browsers type non-breaking spaces at line ends and between double
    // spaces; keep them only if the source already had them.
    if (!before.includes('&nbsp;')) html = html.replace(/&nbsp;/g, ' ');
    return html;
  };

  async function save(el) {
    const before = original.get(el);
    if (before === undefined || el.innerHTML === before) return;
    el.classList.add('saving');
    try {
      const res = await fetch('/__edit/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page: location.pathname, id: Number(el.dataset.edit), before: plain(before), html: clean(el, before) }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error);
      original.set(el, el.innerHTML);
      say(out.removed ? `Removed it from ${out.file}` : `Saved ${out.file}`);
      if (out.removed) {
        // Block numbers after this one have shifted; reload to pick them up.
        setTimeout(() => location.reload(), 600);
      }
    } catch (error) {
      say(error.message || 'Couldn’t save', true);
    } finally {
      el.classList.remove('saving');
    }
  }

  const plaintextOnly = (() => {
    const d = document.createElement('div');
    d.contentEditable = 'plaintext-only';
    return d.contentEditable === 'plaintext-only';
  })();

  function setEditing(on) {
    document.documentElement.classList.toggle('is-editing', on);
    button.textContent = on ? 'Done' : 'Edit';
    try { sessionStorage.setItem('edit-mode', on ? '1' : ''); } catch {}
    blocks.forEach((el) => {
      if (on) {
        el.contentEditable = plaintextOnly ? 'plaintext-only' : 'true';
        el.dataset.editable = '';
        el.spellcheck = true;
      } else {
        el.removeAttribute('contenteditable');
        delete el.dataset.editable;
      }
    });
    if (!on && document.activeElement?.hasAttribute('data-edit')) document.activeElement.blur();
  }
  const editing = () => document.documentElement.classList.contains('is-editing');

  blocks.forEach((el) => {
    el.addEventListener('focus', () => {
      if (editing() && !original.has(el)) original.set(el, el.innerHTML);
    });
    el.addEventListener('blur', () => editing() && save(el));
    el.addEventListener('keydown', (event) => {
      if (!editing()) return;
      if (event.key === 'Enter' && event.shiftKey) {
        // Shift+Enter is a line break inside the block (<br />).
        event.preventDefault();
        const range = getSelection().getRangeAt(0);
        range.deleteContents();
        const br = document.createElement('br');
        range.insertNode(br);
        // A break at the very end needs a second one to show the new line.
        if (!br.nextSibling || (br.nextSibling.nodeType === 3 && !br.nextSibling.textContent.trim() && !br.nextSibling.nextSibling)) {
          br.after(document.createElement('br'));
        }
        range.setStartAfter(br);
        range.collapse(true);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        el.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        el.innerHTML = original.get(el) ?? el.innerHTML;
        el.blur();
      }
    });
    // Rich text pasted from elsewhere comes in as plain text.
    el.addEventListener('paste', (event) => {
      if (!editing() || plaintextOnly) return;
      event.preventDefault();
      document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    });
  });

  // While editing, no link goes anywhere, so text inside a link (or a block
  // inside a linked card) can be clicked into and edited.
  document.addEventListener('click', (event) => {
    if (editing() && event.target.closest('a[href]') && !event.target.closest('.edit-bar')) event.preventDefault();
  }, true);

  button.addEventListener('click', () => setEditing(!editing()));
  document.addEventListener('keydown', (event) => {
    const typing = event.target.closest?.('input, textarea, select, [contenteditable]');
    if (event.key.toLowerCase() === 'e' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
      setEditing(!editing());
    }
  });

  let resume = false;
  try { resume = sessionStorage.getItem('edit-mode') === '1'; } catch {}
  if (resume) setEditing(true);
})();
