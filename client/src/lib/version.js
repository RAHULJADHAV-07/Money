/* Comparing app versions, in one place, because two things depend on it: which
   release notes you have not read, and whether the API has caught up with the
   app talking to it. */

const parts = (v) => String(v || '0').split('.').map((n) => Number(n) || 0);

/** a > b, comparing major, then minor, then patch. */
export function isNewer(a, b) {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}
