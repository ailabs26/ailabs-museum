'use strict';

function normalizeTimeout(timeoutValue) {
  const parsedTimeout = Number.parseInt(timeoutValue || '', 10);
  return Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 0;
}

function readStream(stream, options = {}) {
  const timeoutMs = normalizeTimeout(options.timeoutMs);

  return new Promise((resolve, reject) => {
    const chunks = [];
    let timer = null;
    let settled = false;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const cleanup = () => {
      clearTimer();
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
    };

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };

    const armTimer = () => {
      if (!timeoutMs || settled) return;
      clearTimer();
      timer = setTimeout(() => {
        finish(reject, new Error(`stdin timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    };

    function onData(chunk) {
      chunks.push(chunk);
      armTimer();
    }

    function onEnd() {
      finish(resolve, chunks.join(''));
    }

    function onError(error) {
      finish(reject, error);
    }

    stream.setEncoding(options.encoding || 'utf8');
    stream.on('data', onData);
    stream.once('end', onEnd);
    stream.once('error', onError);
    armTimer();
  });
}

function readStatuslineInput(options = {}) {
  return readStream(options.stream || process.stdin, {
    encoding: 'utf8',
    timeoutMs: options.timeoutMs ?? process.env.CK_STATUSLINE_STDIN_TIMEOUT_MS
  });
}

module.exports = {
  normalizeTimeout,
  readStatuslineInput,
  readStream
};
