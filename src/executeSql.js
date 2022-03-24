const oracledb = require('oracledb')
const fs = require('fs')
const util = require('util')

const readdir = util.promisify(fs.readdir)
const readFile = util.promisify(fs.readFile)

const getScripts = async (path) => {
    const scripts = [] 
    const files = await readdir(path)

    for (const file of files) {
        const script = await readFile(`${path}/${file}`)
        let sql = {
            "file": file,
            "script": script.toString()
          };
        scripts.push(sql)
    }

    return scripts
}

const run = async () => {
    let path = process.argv.slice(2)[0]

    try {
        connection = await oracledb.getConnection({ user: "ECM01", password: "ECM01", connectionString: "100.126.1.96:1521/D_EOC01" })
        let scripts = await getScripts(path)
        for (const sql of scripts) {
            console.log(`execute script: ${sql.file}`)
            await connection.execute(`begin ${sql.script} end;`)
        }
    } catch (err) {
        console.log('Database error:')
        console.error(err)
    } finally {
        if (connection) {
            try {
                await connection.close()
            } catch (err) {
                console.log('Error while to close DB:')
                console.error(err)
            }
        }
    }
}

run()