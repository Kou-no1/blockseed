const MESSAGES = {
E_DIV0: { low: '0で われないよ', high: '0で わることは できません' },
E_DEEP: { low: 'ブロックが おおすぎるよ', high: 'くりかえしが 深すぎます' },
E_NOVAR: { low: 'その はこは まだ ないよ', high: 'その変数は まだ ありません' },
E_STUCK: { low: 'とまらなく なってるみたい', high: 'プログラムが 終わりません' },
E_LOAD: { low: 'ひらけなかったよ', high: 'ファイルを 読みこめませんでした' },
E_UNKNOWN: { low: 'うまく いかなかったよ', high: '予期しない エラーが おきました' }
};

export class UserError extends Error {
constructor(code, message, blockId) {
super(message || code);
this.name = 'UserError';
this.code = code || 'E_UNKNOWN';
this.blockId = blockId || null;
}
}

export function friendlyError(error, level) {
const code = error && error.code && MESSAGES[error.code] ? error.code : 'E_UNKNOWN';
return MESSAGES[code][Number(level) <= 2 ? 'low' : 'high'];
}

export function guard(action, onError) {
try {
const value = action();
if (value && typeof value.then === 'function') return value.catch(onError);
return value;
} catch (error) {
onError(error);
return undefined;
}
}
