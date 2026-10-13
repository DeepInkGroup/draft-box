// Uniform sampling without replacement: ratings do not affect transfer offers.
function randomSample(items, count = 2, random = Math.random) {
  const pool = items.slice(), result = [];
  while (pool.length && result.length < count) {
    result.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return result;
}
module.exports = { randomSample };
