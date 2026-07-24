const bad = 'this is not a date';
const d = new Date(bad);
console.log('isNaN time:', isNaN(d.getTime()));
console.log('now < d:', new Date() < d);
console.log('d < now:', d < new Date());
