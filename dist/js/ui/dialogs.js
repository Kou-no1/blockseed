export class DialogManager {
constructor(root) {
this.root = root;
this.active = null;
this.returnFocus = null;
}

close(value) {
if (!this.active) return;
const active = this.active;
this.active = null;
this.root.textContent = '';
document.body.classList.remove('has-dialog');
active.resolve(value);
if (this.returnFocus && document.contains(this.returnFocus)) this.returnFocus.focus();
}

show(options) {
if (this.active) this.close(null);
this.returnFocus = document.activeElement;
const manager = this;
const backdrop = document.createElement('div');
backdrop.className = 'dialog-backdrop';
const dialog = document.createElement('section');
dialog.className = 'dialog-card' + (options.wide ? ' dialog-card--wide' : '');
dialog.setAttribute('role', 'dialog');
dialog.setAttribute('aria-modal', 'true');
dialog.addEventListener('keydown', function (event) {
if (event.key === 'Escape') {
event.preventDefault();
event.stopPropagation();
manager.close(null);
} else if (event.key === 'Tab') {
const controls = Array.from(dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]'))
.filter(control => !control.disabled && control.getClientRects().length);
const first = controls[0];
const last = controls[controls.length - 1];
if (event.shiftKey && event.target === first) { event.preventDefault(); last?.focus(); }
else if (!event.shiftKey && event.target === last) { event.preventDefault(); first?.focus(); }
}
});
const title = document.createElement('h2');
title.textContent = options.title || 'おしらせ';
title.id = 'dialog-title';
dialog.setAttribute('aria-labelledby', title.id);
dialog.appendChild(title);
if (options.message) {
const message = document.createElement('p');
message.className = 'dialog-message';
message.textContent = options.message;
dialog.appendChild(message);
}
if (options.content) {
const content = typeof options.content === 'function' ? options.content() : options.content;
if (content) dialog.appendChild(content);
}
const actions = document.createElement('div');
actions.className = 'dialog-actions';
(options.buttons || [{ label: 'わかった', value: true, primary: true }]).forEach(function (item) {
const button = document.createElement('button');
button.type = 'button';
button.textContent = item.label;
if (item.primary) button.className = 'is-primary';
if (item.danger) button.className = 'is-danger';
button.addEventListener('click', function () { manager.close(item.value); });
actions.appendChild(button);
});
dialog.appendChild(actions);
backdrop.appendChild(dialog);
this.root.appendChild(backdrop);
document.body.classList.add('has-dialog');
return new Promise(function (resolve) {
manager.active = { resolve: resolve, dialog: dialog };
requestAnimationFrame(function () {
const focus = dialog.querySelector('input, textarea, select, button');
if (focus) focus.focus();
});
});
}

askYesNo(title, message, dangerous) {
return this.show({
title: title,
message: message,
buttons: [
{ label: 'やめる', value: false },
{ label: dangerous ? 'けす' : 'はい', value: true, primary: !dangerous, danger: dangerous }
]
});
}

async ask(title, message, initial) {
const input = document.createElement('input');
input.className = 'dialog-input';
input.type = 'text';
input.value = initial || '';
input.maxLength = 80;
const accepted = await this.show({
title: title,
message: message,
content: input,
buttons: [{ label: 'あとで', value: false }, { label: 'きめた', value: true, primary: true }]
});
return accepted ? input.value.trim() : null;
}
}
