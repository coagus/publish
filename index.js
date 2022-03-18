const xlsx = require("xlsx");
const oracledb = require('oracledb');
const axios = require('axios')

function post(project,task) {
  console.log(task+' '+project)
  let result = false
  await axios
  .post('http://100.126.0.13:7004/ecm/ecm/CatalogManagement/v2/project/'+project+'/'+task+'', {
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

  return result
}

async function run() {
  let connection
  
  try {
    connection = await oracledb.getConnection({ user: "ECM01", password: "ECM01", connectionString: "100.126.1.96:1521/D_EOC01" })
    console.log("Successfully connected to Oracle Database")

    let file = process.argv.slice(2)[0]

    console.log('Read file ',file)
    const book = xlsx.readFile(file)

    console.log('Read sheet Projects')
    const sheet = book.Sheets['Projects']

    if (sheet != null) {
      console.log('Read project list in col A')
      for (let cell in sheet) {    
        if(cell.toString()[0] === 'A' && cell.toString()[1] !== '1') {
          var projectName = sheet[cell].v;
          console.log('project',projectName)
          result = await connection.execute(
            `select * from ECM01.cwpc_project where projectcode = :project`,
            [projectName],
            { resultSet: true, outFormat: oracledb.OUT_FORMAT_OBJECT })
          
          const rs = result.resultSet
          let status = 'DEF'
          let project = await rs.getRows(0)

          if (project.length > 0) {
            console.log('status: ', project[0].STATUS)
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

          if (post(projectName,"validate")) {
            post(projectName,"publish")
          }          
        }    
      }
    }

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
}

run()


//var orig = '   foo  ';
//console.log('hola ',orig.trim()); // 'foo'




/*
const oracledb = require('oracledb');

async function run() {

  let connection;

  try {

    connection = await oracledb.getConnection({ user: "ECM01", password: "ECM01", connectionString: "100.126.1.96:1521/D_EOC01" });

    console.log("Successfully connected to Oracle Database");

    // Now query the rows back

    result = await connection.execute(
      `select * from ECM01.cwpc_project where projectcode = 'TestRuben1'`,
      [],
      { resultSet: true, outFormat: oracledb.OUT_FORMAT_OBJECT });

    const rs = result.resultSet;
    let row;

    while ((row = await rs.getRow())) {
        console.log(row.STATUS, " is actual Status");
    }

    await rs.close();

    await connection.execute(
        "begin setCatalogProjectStatus('TestRuben1','ACT'); commit; end;"
      );

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
}

run();


const axios = require('axios')

axios
  .post('http://100.126.0.13:7004/ecm/ecm/CatalogManagement/v2/project/AmxCoMovPosOptDesc007_B22/publish', {
    headers: {
        'OnBehalfOf': 'upadmin'
      }
  })
  .then(res => {
    console.log(`statusCode: ${res.status}`)
    console.log(res)
  })
  .catch(error => {
    console.error(error)
  })
*/