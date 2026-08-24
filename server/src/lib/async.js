// Express 5 forwards rejected promises, but wrapping keeps intent explicit.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
