const xlsx = require("xlsx");

let file = process.argv.slice(2)[0];

console.log(file);

const workbook = xlsx.readFile(file);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

for (let z in worksheet) {
  if(z.toString()[0] === 'A') {
    console.log(worksheet[z].v)
  }
}