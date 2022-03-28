const oracledb = require('oracledb')
const axios = require('axios')
const xlsx = require("xlsx")
const config = require('config')
const fs = require('fs')
const util = require('util')

const writeFile = util.promisify(fs.writeFile)

const isValidProjectDB = async (projectName) => {
    console.log('Valid',projectName,'in DB')
    let valid = false
    const dbConfig = config.get('dbConfig')
    try {
        connection = await oracledb.getConnection(dbConfig)
        result = await connection.execute(
            `select STATUS from ECM01.cwpc_project where projectcode = :project`,
            [projectName],
            { resultSet: true, outFormat: oracledb.OUT_FORMAT_OBJECT })
          
        const rs = result.resultSet
        let project = await rs.getRows(0)

        if (project.length > 0) {
            console.log('status:', project[0].STATUS)
            if (project[0].STATUS == 'ACT') {
                console.log('Set Status to DEF')
                await connection.execute(
                    "begin setCatalogProjectStatus(:project,'DEF'); commit; end;", 
                    [projectName]
                )
            }
    
            valid = true
        } else {
            console.log('Project not exists')
        }
          
        await rs.close()       
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
    return valid
}

const postProject = async (projectName, task) => {
    console.log(task,projectName)
    const url = config.get('urlPost')
    let result = false  
    await axios.post(`http://${url}/ecm/ecm/CatalogManagement/v2/project/${projectName}/${task}`, {
        headers: {
            'OnBehalfOf': 'upadmin'
        }
    })
    .then(res => {
        if (res.data.length > 0 && res.data[0].hasOwnProperty('status') && res.data[0].status == 200) {
            console.log(res.data[0].message)
            result = true
        } else {
            console.log('Error while to ' + task)
            console.log(res.data)
        }
    })
    .catch(error => {
        console.log('Post error to ' + task)
        console.error(error)
    })    

    return result
}

const getTraces = async (projectList, pathBSCS) => {
    if (!fs.existsSync(pathBSCS)){
        fs.mkdirSync(pathBSCS)
    }

    const dbConfig = config.get('dbConfig')
    try {
        connection = await oracledb.getConnection(dbConfig)

        let qry = `SELECT pr.projectcode, prcmm.catalogobjectcode
                     FROM ecm01.cwpc_project pr
                     JOIN ecm01.cwpc_projectcommand prcmm ON pr.projectid = prcmm.projectid
                    WHERE pr.projectcode IN (`;

        for (let i=0; i < projectList.length; i++) {
            qry += ((i>0) ? ", :v" : ":v") + i
        }

        qry += `) GROUP BY pr.projectcode, prcmm.catalogobjectcode`

        let result = await connection.execute(qry, projectList, {resultSet: true, outFormat: oracledb.OUT_FORMAT_OBJECT})          
        let rs = result.resultSet
        let row, dat, item
        let proys = []
        while ((row = await rs.getRow())) {
            dat = `{"project": "${row.PROJECTCODE}", "po": "${row.CATALOGOBJECTCODE}"}`
            item = JSON.parse(dat)
            proys.push(item)            
        }          
        await rs.close()  

        result = await connection.execute(
            `SELECT creation_time, send_data 
               FROM ecm01.CWMESSAGELOG
              WHERE operation = 'billingAdapter.BSCSAdapter.productofferingwrite:ProductOfferingWriteService/productOfferingWrite'
                AND user_id='upadmin'
                AND creation_time > sysdate-1`,{},
            {resultSet: true, outFormat: oracledb.OUT_FORMAT_OBJECT, fetchInfo: {"SEND_DATA": {type: oracledb.BUFFER}}})
          
        rs = result.resultSet
        let trace

        while ((row = await rs.getRow())) {
            trace = row.SEND_DATA.toString()
            if (!trace.includes('billingAdapter.BSCSAdapter.productofferingwrite:sessionChangeRequest')) {
                for (const proy of proys) {
                    if (trace.includes(proy.po)) {
                        if (!fs.existsSync(`${pathBSCS}/${proy.project}.xml`)) {
                            console.log(`Save trace: ${proy.project}.xml`)
                            writeFile(`${pathBSCS}/${proy.project}.xml`,row.SEND_DATA.toString())
                        }                   
                        break
                    }
                }                
            }
        }          
        await rs.close()
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

async function run() {
    let file = process.argv.slice(2)[0]
    let pathBSCS = file.replace('publish.xlsx','BSCS')

    console.log('Read file',file)
    const book = xlsx.readFile(file)

    console.log('Read sheet Projects')
    const sheet = book.Sheets['Projects']

    let projectList = []

    if (sheet != null) {
        console.log('Read project list in column A')
        for (let cell in sheet) {    
            if(cell.toString()[0] === 'A' && cell.toString()[1] !== '1') {
                var projectName = sheet[cell].v
                console.log('***** Start publishing the project',projectName,'*****')
                if (await isValidProjectDB(projectName)
                    && await postProject(projectName,'validate')
                    && await postProject(projectName,'publish')) {
                    console.log('***** ',projectName, 'Published! *****') 
                    projectList.push(projectName)
                }
            }
        }
    } else {
        console.log('Not exists sheet Projects in this file')
    }

    getTraces(projectList, pathBSCS)
}

run()