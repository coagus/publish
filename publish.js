const oracledb = require('oracledb');
const axios = require('axios');
const xlsx = require("xlsx");

const isValidProjectDB = async (projectName) => {
    console.log('Valid',projectName,'in DB');
    let valid = false;
    try {
        connection = await oracledb.getConnection({ user: "ECM01", password: "ECM01", connectionString: "100.126.1.96:1521/D_EOC01" });
        result = await connection.execute(
            `select STATUS from ECM01.cwpc_project where projectcode = :project`,
            [projectName],
            { resultSet: true, outFormat: oracledb.OUT_FORMAT_OBJECT })
          
        const rs = result.resultSet
        let status = 'DEF'
        let project = await rs.getRows(0)

        if (project.length > 0) {
            console.log('status:', project[0].STATUS)
            status = project[0].STATUS
        } else {
            console.log('Project not exists')
        }
          
        await rs.close();

        if (status == 'ACT') {
            console.log('Set Status to DEF')
            await connection.execute(
                "begin setCatalogProjectStatus(:project,'DEF'); commit; end;", 
                [projectName]
            );
        }

        valid = true;
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
    return valid;
}

const postProject = async (projectName, task) => {
    console.log(task,projectName);
    let result = false;    
    await axios.post('http://100.126.0.13:7004/ecm/ecm/CatalogManagement/v2/project/'+projectName+'/'+task+'', {
        headers: {
            'OnBehalfOf': 'upadmin'
        }
    })
    .then(res => {
        if (res.data[0].status != null && res.data[0].status == 200) {
            console.log(res.data[0].message)
            result = true
        } else {
            console.log(`statusCode: ${res.status}`)
            console.log(res.data)
        }
    })
    .catch(error => {
        console.error(error)
    })    

    return result;
}

async function run() {
    let file = process.argv.slice(2)[0];

    console.log('Read file',file);
    const book = xlsx.readFile(file);

    console.log('Read sheet Projects');
    const sheet = book.Sheets['Projects'];

    if (sheet != null) {
        console.log('Read project list in col A');
        for (let cell in sheet) {    
            if(cell.toString()[0] === 'A' && cell.toString()[1] !== '1') {
                var projectName = sheet[cell].v;
                console.log('***** Start publishing the project',projectName,'*****')
                if (await isValidProjectDB(projectName)
                    && await postProject(projectName,'validate')
                    && await postProject(projectName,'publish')) {
                    console.log(projectName, 'Published!');        
                }
            }
        }
    } else {
        console.log('Not exists sheet Projects in this file');
    }    
}

run();
